import type pg from 'pg'
import { ingestEvent } from '../matcher.ts'
import { WORKSPACE_ID, id } from '../skills/gates.ts'
import { runSkill } from '../skills/runner.ts'
import type { ModelClient } from '../skills/model.ts'
import { isAutoReply, stripQuotedText, type InboxConnectors, type RawEmail } from './connectors.ts'

/* W2 pipeline (SPEC-INBOX): Gmail push → persist raw → match → triage →
   requests → tasks → ack draft (G2) → chase. Enqueue-then-process: the
   webhook only persists; this function does the work. */

export interface TriageRequestEntry {
  type: string
  summary: string
  urgency: 'normal' | 'scheduled' | 'urgent'
  effective_date?: string | null
  assets_missing: string[]
  sla_days: number
  route: string
}

export interface TriageOutput {
  confidence: number
  thread_action: 'new' | 'append' | 'noise'
  tone: 'friendly' | 'neutral' | 'terse' | 'upset'
  reply_language: string
  requests: TriageRequestEntry[]
}

export interface PipelineOptions {
  /* shadow: triage runs and is logged, but no requests/tasks/acks are
     created. email-triage stays in shadow on live mail until the team's
     150-email golden set passes (BLOCKERS.md: triage-golden-set). */
  mode: 'shadow' | 'live'
  skillsDir?: string
}

export interface PipelineResult {
  inboxId: string | null
  outcome:
    | 'duplicate' | 'autoreply' | 'held_identity' | 'held_unknown' | 'prospect'
    | 'noise' | 'filed' | 'shadow' | 'triaged' | 'error'
  requestIds: string[]
  taskIds: string[]
  ackGateItemId: string | null
  chaseTaskIds: string[]
}

const ROUTE_ASSIGNEES: Record<string, string | null> = {
  web: 'IS', specialist: 'HK', coordinator: 'QG', wally: 'WC',
  reply_only: null, assets: null, file: null, human_queue: null,
}

/* Types that produce no task by design (§1). */
const NO_TASK_TYPES = new Set(['question', 'asset_delivery', 'fyi', 'spam', 'unknown'])
const FILE_ONLY_TYPES = new Set(['fyi', 'spam'])

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from)
  let remaining = Math.max(days, 0)
  while (remaining > 0) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) remaining -= 1
  }
  if (d.getDay() === 6) d.setDate(d.getDate() + 2)
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  return d
}

async function setState(
  db: pg.Client | pg.Pool,
  inboxId: string,
  fields: { state: string; disposition?: string | null; requestIds?: string[]; matchQueueId?: string | null; error?: string | null },
) {
  await db.query(
    `UPDATE inbox_messages SET state = $1, disposition = $2, request_ids = $3, match_queue_id = $4, error = $5 WHERE id = $6`,
    [
      fields.state, fields.disposition ?? null, fields.requestIds ?? [],
      fields.matchQueueId ?? null, fields.error ?? null, inboxId,
    ],
  )
}

export async function processInboundEmail(
  db: pg.Client | pg.Pool,
  model: ModelClient,
  connectors: InboxConnectors,
  email: RawEmail,
  opts: PipelineOptions,
): Promise<PipelineResult> {
  const none = { requestIds: [], taskIds: [], ackGateItemId: null, chaseTaskIds: [] }
  const body = stripQuotedText(email.bodyText)

  // 1 · persist raw, idempotent on message_id (§4, SPEC-SPINE §6)
  const inboxId = id('in')
  const inserted = await db.query(
    `INSERT INTO inbox_messages (id, workspace_id, message_id, thread_id, from_email, to_email, subject, body_text, raw, headers, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (workspace_id, message_id) DO NOTHING RETURNING id`,
    [
      inboxId, WORKSPACE_ID, email.messageId, email.threadId ?? null,
      email.from.toLowerCase(), email.to ?? 'support@2080.dental', email.subject, body,
      JSON.stringify({ bodyText: email.bodyText }), JSON.stringify(email.headers ?? {}),
      email.receivedAt ?? new Date().toISOString(),
    ],
  )
  if (inserted.rows.length === 0) return { inboxId: null, outcome: 'duplicate', ...none }

  // 2 · autoreply/OOO: suppress, never ack (§3)
  if (isAutoReply(email.headers)) {
    await setState(db, inboxId, { state: 'filed', disposition: 'autoreply' })
    return { inboxId, outcome: 'autoreply', ...none }
  }

  // tracked-thread check must precede ingest — ingest learns new threads
  const threadKnown = email.threadId
    ? (await db.query(
        `SELECT 1 FROM entity_maps WHERE workspace_id = $1 AND kind = 'thread' AND external_key = $2`,
        [WORKSPACE_ID, email.threadId.toLowerCase()],
      )).rows.length > 0
    : false

  // 3 · identity via the entity matcher; unmatched mail never hits the timeline
  const ingest = await ingestEvent(
    db,
    { emailFrom: email.from, threadId: email.threadId ?? undefined },
    {
      type: 'EMAIL_IN',
      occurredAt: email.receivedAt ?? new Date().toISOString(),
      title: `${email.from}: ${email.subject}`,
      body,
      payload: { from: email.from, message_id: email.messageId },
      source: 'gmail',
      sourceRef: email.messageId,
    },
  )
  if (ingest.decision === 'queue') {
    await setState(db, inboxId, { state: 'held', disposition: 'match_queue', matchQueueId: ingest.queueId })
    return { inboxId, outcome: 'held_identity', ...none }
  }
  if (ingest.decision === 'prospect') {
    await setState(db, inboxId, { state: 'held', disposition: 'prospect', matchQueueId: ingest.queueId })
    return { inboxId, outcome: 'prospect', ...none }
  }
  const clientId = ingest.clientId

  const { rows: [client] } = await db.query(`SELECT name FROM clients WHERE id = $1`, [clientId])
  const { rows: [sender] } = await db.query(
    `SELECT ct.name FROM contacts ct WHERE EXISTS (SELECT 1 FROM unnest(ct.email) e WHERE lower(e) = $1) AND ct.client_id = $2 LIMIT 1`,
    [email.from.toLowerCase(), clientId],
  )

  // 4 · classify (email body is DATA — triage holds no tools, action: none)
  const triageRun = await runSkill(db, model, {
    skill: 'email-triage',
    clientId,
    trigger: 'gmail.push',
    input: {
      from: email.from,
      subject: email.subject,
      body,
      thread_known: threadKnown,
      client_name: client?.name ?? null,
    },
    skillsDir: opts.skillsDir,
  })
  if (triageRun.error || triageRun.output == null) {
    await setState(db, inboxId, { state: 'error', error: triageRun.error ?? 'triage produced no output' })
    return { inboxId, outcome: 'error', ...none }
  }
  const triage = triageRun.output as TriageOutput

  // upset tone pings the coordinator even on routine requests (§2 sentiment gate)
  if (triage.tone === 'upset') {
    await db.query(
      `INSERT INTO notifications (id, workspace_id, user_id, event_class, severity, client_id, title, coalesce_key)
       VALUES ($1, $2, 'QG', 'sentiment', 'amber', $3, $4, $5)`,
      [id('ntf'), WORKSPACE_ID, clientId, `Upset tone from ${client?.name ?? email.from}`, `sentiment:${clientId}`],
    )
  }

  // 5 · noise / nothing asked for → file it (before the confidence gate:
  // an empty request list is a finding, not uncertainty)
  const actionable = triage.requests.filter((r) => !FILE_ONLY_TYPES.has(r.type))
  if (triage.thread_action === 'noise' || triage.requests.length === 0) {
    await setState(db, inboxId, { state: 'filed', disposition: 'noise' })
    return { inboxId, outcome: 'noise', ...none }
  }

  // low classification confidence → human triage queue (identity is known)
  if (triage.confidence < 0.8 || triage.requests.every((r) => r.type === 'unknown')) {
    await setState(db, inboxId, { state: 'held', disposition: 'unknown' })
    return { inboxId, outcome: 'held_unknown', ...none }
  }
  if (actionable.length === 0) {
    await setState(db, inboxId, { state: 'filed', disposition: triage.requests[0].type })
    return { inboxId, outcome: 'filed', ...none }
  }

  // 6 · shadow mode takes NO actions — the run log above is the whole output
  if (opts.mode === 'shadow') {
    await setState(db, inboxId, { state: 'triaged', disposition: 'shadow' })
    return { inboxId, outcome: 'shadow', ...none }
  }

  // 7 · live: requests + tasks + chases; complaints route straight to Wally
  const hasComplaint = actionable.some((r) => r.type === 'complaint')
  const requestIds: string[] = []
  const taskIds: string[] = []
  const chaseTaskIds: string[] = []

  for (const entry of actionable) {
    const reqId = id('req')
    requestIds.push(reqId)
    const slaDue =
      entry.urgency === 'urgent' || entry.type === 'complaint'
        ? new Date(Date.now() + 4 * 3_600_000)
        : addBusinessDays(new Date(), entry.sla_days)
    await db.query(
      `INSERT INTO requests (id, workspace_id, client_id, thread_id, type, summary, status, sla_due_at, confidence, source, missing_assets, language)
       VALUES ($1, $2, $3, $4, $5, $6, 'triaged', $7, $8, 'email', $9, $10)`,
      [
        reqId, WORKSPACE_ID, clientId, email.threadId ?? null, entry.type, entry.summary,
        slaDue, triage.confidence, JSON.stringify(entry.assets_missing), triage.reply_language,
      ],
    )

    if (!NO_TASK_TYPES.has(entry.type)) {
      const assignee = ROUTE_ASSIGNEES[entry.route] ?? null
      const { externalRef } = await connectors.tasks.createTask({
        title: entry.type === 'complaint' ? `COMPLAINT — call ${client?.name}: ${entry.summary}` : `${client?.name}: ${entry.summary}`,
        clientName: client?.name ?? '',
        dueAt: slaDue,
        assignee: entry.type === 'complaint' ? 'WC' : assignee,
      })
      const taskId = id('task')
      taskIds.push(taskId)
      await db.query(
        `INSERT INTO tasks (id, workspace_id, client_id, external_ref, title, assignee, due_at, status, source_request_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8)`,
        [
          taskId, WORKSPACE_ID, clientId, externalRef,
          entry.type === 'complaint' ? `COMPLAINT — call ${client?.name}: ${entry.summary}` : `${client?.name}: ${entry.summary}`,
          entry.type === 'complaint' ? 'WC' : assignee, slaDue, reqId,
        ],
      )
      await db.query(`UPDATE requests SET task_ids = array_append(task_ids, $1) WHERE id = $2`, [taskId, reqId])
      await db.query(
        `INSERT INTO audit_log (id, workspace_id, actor_type, actor_id, action, target_type, target_id, client_id, why)
         VALUES ($1, $2, 'skill', 'email-triage@v1', 'task.create', 'task', $3, $4, $5)`,
        [id('aud'), WORKSPACE_ID, taskId, clientId, `request: ${entry.summary}`],
      )
    }

    // chase for missing assets: +3 days, coordinator owns it (§5, minimal cadence)
    if (entry.assets_missing.length > 0 && entry.type !== 'complaint') {
      const chaseId = id('task')
      chaseTaskIds.push(chaseId)
      await db.query(
        `INSERT INTO tasks (id, workspace_id, client_id, title, assignee, due_at, status, source_request_id)
         VALUES ($1, $2, $3, $4, 'QG', $5, 'waiting', $6)`,
        [
          chaseId, WORKSPACE_ID, clientId,
          `Chase ${client?.name} for: ${entry.assets_missing.join(', ')}`,
          addBusinessDays(new Date(), 3), reqId,
        ],
      )
    }
  }

  // 8 · ack draft (G2) — never when a complaint is present (§1: no AI ack, ever)
  let ackGateItemId: string | null = null
  if (!hasComplaint) {
    const ackRun = await runSkill(db, model, {
      skill: 'ack-writer',
      clientId,
      trigger: 'inbox.triaged',
      input: {
        client_name: client?.name ?? '',
        sender_name: sender?.name ?? null,
        reply_language: triage.reply_language,
        requests: actionable.map((r) => ({
          type: r.type, summary: r.summary, sla_days: r.sla_days, assets_missing: r.assets_missing,
        })),
      },
      actionData: { to: email.from.toLowerCase(), thread_id: email.threadId ?? null },
      skillsDir: opts.skillsDir,
    })
    ackGateItemId = ackRun.gateItemId
  }

  await setState(db, inboxId, { state: 'triaged', requestIds })
  return { inboxId, outcome: 'triaged', requestIds, taskIds, ackGateItemId, chaseTaskIds }
}

/** Zero-loss audit (§13 1.5): every ingested email is accounted for —
    requests created, filed with a reason, held with a queue pointer, or a
    shadow-mode triage log. Anything else (stuck, errored, dangling) returns. */
export async function zeroLossAudit(db: pg.Client | pg.Pool): Promise<Array<{ id: string; message_id: string; state: string }>> {
  const { rows } = await db.query(
    `SELECT id, message_id, state FROM inbox_messages
     WHERE NOT (
       (state = 'triaged' AND (cardinality(request_ids) > 0 OR disposition = 'shadow'))
       OR (state = 'filed' AND disposition IS NOT NULL)
       OR (state = 'held' AND (match_queue_id IS NOT NULL OR disposition = 'unknown'))
     )
     ORDER BY received_at`,
  )
  return rows
}
