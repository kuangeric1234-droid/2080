import { Hono } from 'hono'
import type pg from 'pg'
import type { ModelClient } from './skills/model.ts'
import { approve, reject } from './skills/gates.ts'
import { runSkill } from './skills/runner.ts'
import { resolveMatch } from './matcher.ts'
import { rankFlags, resolveFlag, snoozeFlag, todayTiles } from './flags.ts'
import { processInboundEmail, zeroLossAudit } from './inbox/pipeline.ts'
import { onTaskCompleted } from './inbox/completion.ts'
import {
  MockActiveCollab, MockMailSender, type InboxConnectors, type RawEmail,
} from './inbox/connectors.ts'

/** The platform API. Small on purpose — routes land with the §13 step that
    needs them. */
export function buildApp(db: pg.Client | pg.Pool, model: ModelClient, connectors?: InboxConnectors) {
  const app = new Hono()
  const inboxConnectors: InboxConnectors =
    connectors ?? { mail: new MockMailSender(), tasks: new MockActiveCollab() }
  /* Live is safe while the mail/task connectors are mocks. The moment real
     Gmail credentials are wired, this must default to shadow until the
     150-email golden set passes (BLOCKERS.md: triage-golden-set). */
  const inboxMode = (process.env.INBOX_MODE as 'shadow' | 'live') ?? 'live'

  app.get('/api/health', (c) => c.json({ ok: true }))

  /* Webhooks: persist + process. Real Gmail push delivers a historyId and the
     messages are pulled; the mock form accepts the raw message directly. */
  app.post('/hooks/gmail', async (c) => {
    const email = await c.req.json<RawEmail>()
    if (!email.messageId || !email.from) return c.json({ error: 'messageId and from are required' }, 400)
    const result = await processInboundEmail(db, model, inboxConnectors, email, { mode: inboxMode })
    return c.json(result)
  })

  app.post('/hooks/activecollab', async (c) => {
    const body = await c.req.json<{ externalRef: string; evidence?: Array<{ label: string; url: string }>; actor?: string }>()
    if (!body.externalRef) return c.json({ error: 'externalRef is required' }, 400)
    try {
      const result = await onTaskCompleted(db, model, {
        externalRef: body.externalRef, evidence: body.evidence ?? [], actor: body.actor ?? 'system',
      })
      return c.json(result)
    } catch (err) {
      return c.json({ error: (err as Error).message }, 422)
    }
  })

  app.get('/api/inbox', async (c) => {
    const { rows: messages } = await db.query(
      `SELECT im.id, im.from_email, im.subject, im.state, im.disposition, im.received_at,
              im.thread_id, im.match_queue_id,
              COALESCE(json_agg(json_build_object(
                'id', r.id, 'type', r.type, 'summary', r.summary,
                'status', r.status, 'sla_due_at', r.sla_due_at,
                'client_name', cl.name
              ) ORDER BY r.created_at) FILTER (WHERE r.id IS NOT NULL), '[]') AS requests
       FROM inbox_messages im
       LEFT JOIN requests r ON r.id = ANY(im.request_ids)
       LEFT JOIN clients cl ON cl.id = r.client_id
       GROUP BY im.id
       ORDER BY im.received_at DESC`,
    )
    const unaccounted = await zeroLossAudit(db)
    return c.json({ messages, unaccounted: unaccounted.length })
  })

  app.get('/api/match-queue', async (c) => {
    const { rows: items } = await db.query(
      `SELECT id, refs, event, candidates, confidence, state, created_at
       FROM match_queue WHERE state = 'open' ORDER BY created_at`,
    )
    return c.json({ items })
  })

  app.post('/api/match-queue/:id/resolve', async (c) => {
    const { clientId, actor } = await c.req.json<{ clientId: string; actor: string }>()
    if (!clientId || !actor) return c.json({ error: 'clientId and actor are required' }, 400)
    try {
      const result = await resolveMatch(db, c.req.param('id'), clientId, actor)
      // held inbox mail is attached to its client's timeline by resolveMatch
      await db.query(
        `UPDATE inbox_messages SET state = 'filed', disposition = 'resolved_by_human'
         WHERE match_queue_id = $1 AND state = 'held'`,
        [c.req.param('id')],
      )
      return c.json(result)
    } catch (err) {
      return c.json({ error: (err as Error).message }, 409)
    }
  })

  app.get('/api/clients', async (c) => {
    const { rows } = await db.query(`SELECT id, slug, name, lifecycle FROM clients ORDER BY name`)
    return c.json({ clients: rows })
  })

  app.get('/api/today', async (c) => {
    const [tiles, flags, queue] = await Promise.all([
      todayTiles(db),
      rankFlags(db),
      db.query(`SELECT count(*)::int AS n FROM gate_items WHERE state = 'pending'`),
    ])
    return c.json({ tiles, flags, pendingGateItems: queue.rows[0].n })
  })

  app.post('/api/flags/:id/resolve', async (c) => {
    const { actor, why } = await c.req.json<{ actor: string; why: string }>()
    if (!actor || !why) return c.json({ error: 'actor and why are required' }, 400)
    try {
      await resolveFlag(db, c.req.param('id'), actor, why)
      return c.json({ ok: true })
    } catch (err) {
      return c.json({ error: (err as Error).message }, 409)
    }
  })

  app.post('/api/flags/:id/snooze', async (c) => {
    const { actor, why } = await c.req.json<{ actor: string; why: string }>()
    if (!actor || !why) return c.json({ error: 'actor and why are required' }, 400)
    try {
      await snoozeFlag(db, c.req.param('id'), actor, why)
      return c.json({ ok: true })
    } catch (err) {
      return c.json({ error: (err as Error).message }, 409)
    }
  })

  app.get('/api/gate-items', async (c) => {
    const state = c.req.query('state') ?? 'pending'
    const { rows } = await db.query(
      `SELECT gi.id, gi.gate, gi.state, gi.payload, gi.expires_at, gi.created_at,
              sr.skill, sr.version, sr.trigger,
              cl.slug AS client_slug, cl.name AS client_name
       FROM gate_items gi
       JOIN skill_runs sr ON sr.id = gi.skill_run_id
       LEFT JOIN clients cl ON cl.id = sr.client_id
       WHERE gi.state = $1
       ORDER BY gi.created_at ASC`,
      [state],
    )
    return c.json({ items: rows })
  })

  app.post('/api/gate-items/:id/approve', async (c) => {
    const { actor } = await c.req.json<{ actor: string }>()
    if (!actor) return c.json({ error: 'actor is required' }, 400)
    try {
      const decision = await approve(db, c.req.param('id'), actor)
      return c.json(decision)
    } catch (err) {
      return c.json({ error: (err as Error).message }, 409)
    }
  })

  app.post('/api/gate-items/:id/reject', async (c) => {
    const { actor, reason } = await c.req.json<{ actor: string; reason: string }>()
    if (!actor || !reason) return c.json({ error: 'actor and reason are required' }, 400)
    try {
      const decision = await reject(db, c.req.param('id'), actor, reason)
      return c.json(decision)
    } catch (err) {
      return c.json({ error: (err as Error).message }, 409)
    }
  })

  /* Dev trigger: run a skill against a seeded client by slug. */
  app.post('/api/skills/:name/run', async (c) => {
    const body = await c.req.json<{ clientSlug?: string; trigger?: string }>()
    let clientId: string | null = null
    let input: unknown = body
    if (body.clientSlug) {
      const { rows } = await db.query(
        `SELECT id, name, slug, lifecycle FROM clients WHERE slug = $1`,
        [body.clientSlug],
      )
      if (rows.length === 0) return c.json({ error: `no client ${body.clientSlug}` }, 404)
      clientId = rows[0].id
      input = { name: rows[0].name, slug: rows[0].slug, lifecycle: rows[0].lifecycle }
    }
    const outcome = await runSkill(db, model, {
      skill: c.req.param('name'),
      clientId,
      trigger: body.trigger ?? 'manual',
      input,
    })
    return c.json({
      runId: outcome.runId,
      gate: outcome.definition.gate,
      error: outcome.error,
      gateItemId: outcome.gateItemId,
      executed: outcome.executed,
    }, outcome.error ? 422 : 200)
  })

  return app
}
