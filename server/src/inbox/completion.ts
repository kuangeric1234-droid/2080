import type pg from 'pg'
import { runSkill } from '../skills/runner.ts'
import { WORKSPACE_ID, id } from '../skills/gates.ts'
import type { ModelClient } from '../skills/model.ts'

/* completion-writer on task-completion webhook (SPEC-INBOX §5): evidence is
   mandatory — missing evidence asks the assignee instead of guessing. */

export interface Evidence {
  label: string
  url: string
}

export type CompletionResult =
  | { status: 'drafted'; gateItemId: string }
  | { status: 'needs_evidence'; followUpTaskId: string }

export async function onTaskCompleted(
  db: pg.Client | pg.Pool,
  model: ModelClient,
  args: { externalRef: string; evidence: Evidence[]; actor: string; skillsDir?: string },
): Promise<CompletionResult> {
  const { rows: [task] } = await db.query(
    `SELECT t.id, t.client_id, t.assignee, t.source_request_id, r.summary, r.language, r.thread_id
     FROM tasks t JOIN requests r ON r.id = t.source_request_id
     WHERE t.external_ref = $1`,
    [args.externalRef],
  )
  if (!task) throw new Error(`no task with external_ref ${args.externalRef}`)

  await db.query(`UPDATE tasks SET status = 'done' WHERE id = $1`, [task.id])

  if (args.evidence.length === 0) {
    // no evidence, no claim — ask the assignee (§5)
    const followUpTaskId = id('task')
    await db.query(
      `INSERT INTO tasks (id, workspace_id, client_id, title, assignee, due_at, status, source_request_id)
       VALUES ($1, $2, $3, $4, $5, now() + interval '1 day', 'open', $6)`,
      [
        followUpTaskId, WORKSPACE_ID, task.client_id,
        `Provide evidence for completion email: ${task.summary}`,
        task.assignee ?? args.actor, task.source_request_id,
      ],
    )
    return { status: 'needs_evidence', followUpTaskId }
  }

  const { rows: [client] } = await db.query(`SELECT name FROM clients WHERE id = $1`, [task.client_id])
  // reply to the thread's sender; fall back to the primary contact
  const { rows: [recipient] } = await db.query(
    `SELECT from_email FROM inbox_messages WHERE thread_id = $1 ORDER BY received_at DESC LIMIT 1`,
    [task.thread_id],
  )
  const { rows: [contact] } = await db.query(
    `SELECT email[1] AS email FROM contacts WHERE client_id = $1 AND cardinality(email) > 0 ORDER BY role = 'practice_manager' DESC LIMIT 1`,
    [task.client_id],
  )
  const to = recipient?.from_email ?? contact?.email
  if (!to) throw new Error(`no recipient resolvable for task ${task.id}`)

  const run = await runSkill(db, model, {
    skill: 'completion-writer',
    clientId: task.client_id,
    trigger: 'task.completed',
    input: {
      client_name: client?.name ?? '',
      reply_language: task.language ?? 'en',
      request_summary: task.summary,
      evidence: args.evidence,
    },
    actionData: { to, thread_id: task.thread_id ?? null },
    skillsDir: args.skillsDir,
  })
  if (run.error || !run.gateItemId) {
    throw new Error(`completion-writer failed: ${run.error ?? 'no gate item'}`)
  }
  await db.query(`UPDATE requests SET status = 'done' WHERE id = $1`, [task.source_request_id])
  return { status: 'drafted', gateItemId: run.gateItemId }
}
