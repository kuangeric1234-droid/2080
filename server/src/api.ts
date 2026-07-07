import { Hono } from 'hono'
import type pg from 'pg'
import type { ModelClient } from './skills/model.ts'
import { approve, reject } from './skills/gates.ts'
import { runSkill } from './skills/runner.ts'

/** The platform API. Small on purpose — routes land with the §13 step that
    needs them. */
export function buildApp(db: pg.Client | pg.Pool, model: ModelClient) {
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ ok: true }))

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
