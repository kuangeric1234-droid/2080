import { createHash } from 'node:crypto'
import { monotonicFactory } from 'ulid'
import type pg from 'pg'

const ulid = monotonicFactory()
export const id = (prefix: string) => `${prefix}_${ulid()}`

export const WORKSPACE_ID = 'ws_2080'

export function inputHash(input: unknown): string {
  return 'sha256:' + createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

/* The proposed action, frozen at creation. Approve executes exactly this
   payload — no re-generation between approval and execution (SPEC-SPINE §4). */
export interface ActionPayload {
  kind: string
  client_id: string | null
  data: Record<string, unknown>
}

export interface ActionResult {
  targetType: string
  targetId: string
}

type Executor = (db: pg.Client | pg.Pool, payload: ActionPayload) => Promise<ActionResult>

/* Skills never hold credentials — they propose actions, and executors are
   the platform tools that perform them (§3.2). */
export const executors: Record<string, Executor> = {
  'timeline.note': async (db, payload) => {
    if (!payload.client_id) throw new Error('timeline.note requires client_id')
    const evtId = id('evt')
    await db.query(
      `INSERT INTO timeline_events (id, workspace_id, client_id, type, occurred_at, title, body, source, created_by)
       VALUES ($1, $2, $3, 'NOTE', now(), $4, $5, 'skill', $6)`,
      [
        evtId,
        WORKSPACE_ID,
        payload.client_id,
        String(payload.data.note_title ?? 'Note'),
        payload.data.note_body == null ? null : String(payload.data.note_body),
        String(payload.data.created_by ?? 'skill'),
      ],
    )
    return { targetType: 'timeline_event', targetId: evtId }
  },
}

export async function executePayload(
  db: pg.Client | pg.Pool,
  payload: ActionPayload,
): Promise<ActionResult> {
  const executor = executors[payload.kind]
  if (!executor) throw new Error(`no executor for action kind ${payload.kind}`)
  return executor(db, payload)
}

async function audit(
  db: pg.Client | pg.Pool,
  row: {
    actorType: 'human' | 'skill' | 'system'
    actorId: string
    action: string
    targetType?: string
    targetId?: string
    clientId?: string | null
    why: string
  },
) {
  await db.query(
    `INSERT INTO audit_log (id, workspace_id, actor_type, actor_id, action, target_type, target_id, client_id, why)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id('aud'), WORKSPACE_ID, row.actorType, row.actorId, row.action,
      row.targetType ?? null, row.targetId ?? null, row.clientId ?? null, row.why,
    ],
  )
}

interface GateItemRow {
  id: string
  skill_run_id: string
  gate: string
  state: string
  payload: ActionPayload
  expires_at: Date | null
  run_input_hash: string
  skill: string
  version: string
  client_id: string | null
}

async function loadGateItem(db: pg.Client | pg.Pool, gateItemId: string): Promise<GateItemRow> {
  const { rows } = await db.query(
    `SELECT gi.id, gi.skill_run_id, gi.gate, gi.state, gi.payload, gi.expires_at,
            sr.input_hash AS run_input_hash, sr.skill, sr.version, sr.client_id
     FROM gate_items gi JOIN skill_runs sr ON sr.id = gi.skill_run_id
     WHERE gi.id = $1`,
    [gateItemId],
  )
  if (rows.length === 0) throw new Error(`gate item ${gateItemId} not found`)
  return rows[0]
}

export type GateDecision =
  | { outcome: 'executed'; result: ActionResult }
  | { outcome: 'expired' }
  | { outcome: 'invalidated' }
  | { outcome: 'rejected' }

async function settleRun(db: pg.Client | pg.Pool, runId: string, outcome: string, actor: string) {
  await db.query(`UPDATE skill_runs SET gate_outcome = $1, gate_actor = $2 WHERE id = $3`, [
    outcome, actor, runId,
  ])
}

async function ledger(
  db: pg.Client | pg.Pool,
  item: GateItemRow,
  outcome: 'edited' | 'rejected',
  diff: Record<string, unknown>,
) {
  await db.query(
    `INSERT INTO precision_ledger (id, workspace_id, skill_run_id, skill, version, outcome, diff)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id('pl'), WORKSPACE_ID, item.skill_run_id, item.skill, item.version, outcome, JSON.stringify(diff)],
  )
}

/** Approve = execute exactly the previewed payload. If inputs drifted since
    the item was created, it invalidates instead (§4). */
export async function approve(
  db: pg.Client | pg.Pool,
  gateItemId: string,
  actor: string,
  opts: { currentInputHash?: string; editedPayload?: ActionPayload } = {},
): Promise<GateDecision> {
  const item = await loadGateItem(db, gateItemId)
  if (item.state !== 'pending') throw new Error(`gate item ${gateItemId} is ${item.state}, not pending`)

  if (item.expires_at && item.expires_at.getTime() < Date.now()) {
    await db.query(`UPDATE gate_items SET state = 'expired', acted_by = $1, acted_at = now() WHERE id = $2`, [actor, gateItemId])
    await settleRun(db, item.skill_run_id, 'expired', actor)
    return { outcome: 'expired' }
  }

  if (opts.currentInputHash && opts.currentInputHash !== item.run_input_hash) {
    await db.query(`UPDATE gate_items SET state = 'expired', acted_by = $1, acted_at = now() WHERE id = $2`, [actor, gateItemId])
    await settleRun(db, item.skill_run_id, 'expired', actor)
    await audit(db, {
      actorType: 'system', actorId: 'gate-framework', action: 'gate.invalidate',
      targetType: 'gate_item', targetId: gateItemId, clientId: item.client_id,
      why: `input drift on ${item.skill}@${item.version} — item must regenerate`,
    })
    return { outcome: 'invalidated' }
  }

  const edited = opts.editedPayload != null
  const payload = opts.editedPayload ?? item.payload
  const result = await executePayload(db, payload)

  await db.query(
    `UPDATE gate_items SET state = $1, diff = $2, acted_by = $3, acted_at = now() WHERE id = $4`,
    [
      edited ? 'edited' : 'approved',
      edited ? JSON.stringify({ before: item.payload, after: payload }) : null,
      actor,
      gateItemId,
    ],
  )
  await settleRun(db, item.skill_run_id, edited ? 'edited' : 'approved', actor)
  if (edited) await ledger(db, item, 'edited', { before: item.payload, after: payload })

  await audit(db, {
    actorType: 'human', actorId: actor, action: 'gate.approve',
    targetType: 'gate_item', targetId: gateItemId, clientId: item.client_id,
    why: `${item.skill}@${item.version} proposed ${payload.kind}${edited ? ' (edited before execution)' : ''}`,
  })
  await audit(db, {
    actorType: 'human', actorId: actor, action: `${payload.kind}.execute`,
    targetType: result.targetType, targetId: result.targetId, clientId: item.client_id,
    why: `approved gate item ${gateItemId}`,
  })
  return { outcome: 'executed', result }
}

export async function reject(
  db: pg.Client | pg.Pool,
  gateItemId: string,
  actor: string,
  reason: string,
): Promise<GateDecision> {
  const item = await loadGateItem(db, gateItemId)
  if (item.state !== 'pending') throw new Error(`gate item ${gateItemId} is ${item.state}, not pending`)
  await db.query(`UPDATE gate_items SET state = 'rejected', acted_by = $1, acted_at = now() WHERE id = $2`, [actor, gateItemId])
  await settleRun(db, item.skill_run_id, 'rejected', actor)
  await ledger(db, item, 'rejected', { reason })
  await audit(db, {
    actorType: 'human', actorId: actor, action: 'gate.reject',
    targetType: 'gate_item', targetId: gateItemId, clientId: item.client_id,
    why: reason,
  })
  return { outcome: 'rejected' }
}

/** Graduation data (§4): consecutive approved-unedited streak, derived from
    gate history — resets on any edit or rejection. */
export async function graduationStreak(
  db: pg.Client | pg.Pool,
  clientId: string,
  skill: string,
): Promise<number> {
  const { rows } = await db.query(
    `SELECT gi.state FROM gate_items gi
     JOIN skill_runs sr ON sr.id = gi.skill_run_id
     WHERE sr.client_id = $1 AND sr.skill = $2 AND gi.state IN ('approved','edited','rejected')
     ORDER BY gi.acted_at DESC`,
    [clientId, skill],
  )
  let streak = 0
  for (const row of rows) {
    if (row.state === 'approved') streak += 1
    else break
  }
  return streak
}
