import { type Context, Hono } from 'hono'
import type pg from 'pg'
import type { ModelClient } from './skills/model.ts'
import { approve, reject } from './skills/gates.ts'
import { runSkill } from './skills/runner.ts'
import { resolveMatch } from './matcher.ts'
import { rankFlags, resolveFlag, snoozeFlag, todayTiles } from './flags.ts'
import { processInboundEmail, zeroLossAudit } from './inbox/pipeline.ts'
import { onTaskCompleted } from './inbox/completion.ts'
import { ack as ackNotify, listForUser, routingView, updatePrefs } from './notify.ts'
import { deleteCookie, getCookie } from 'hono/cookie'
import { can, createSession, issueCookie, type Principal, requireAuth, revokeSession, SESSION_COOKIE, verifyPassword } from './auth.ts'
import { runAudit } from './seo/audit.ts'
import { runCheck } from './sitehealth/probe.ts'
import { receiveIntake, startManualReview, unwrapJotformBody } from './review/intake.ts'
import { exportReviewDocx } from './review/docx.ts'
import { addManualFinding, decideFinding, getReview, listReviews, manualBank, setScores } from './review/store.ts'
import { enqueue, getJob, listJobs } from './jobs/queue.ts'
import { JOB_KINDS, collectDedupeKey } from './jobs/handlers.ts'
import { WORKSPACE_ID } from './db/seed.ts'
import {
  MockActiveCollab, MockMailSender, type InboxConnectors, type RawEmail,
} from './inbox/connectors.ts'

/** The platform API. Small on purpose — routes land with the §13 step that
    needs them. */
export function buildApp(db: pg.Client | pg.Pool, model: ModelClient, connectors?: InboxConnectors) {
  const app = new Hono<{ Variables: { principal: Principal } }>()
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

  /* The free-SEO-audit form on 2080solutions.com.au. Jotform posts
     form-encoded with the answers as a JSON string in `rawRequest`; plain JSON
     is accepted too so the endpoint is curl-testable.

     Deliberately outside the /api/* session gate — Jotform cannot hold a
     session — and guarded by a shared token instead. Deliberately never 500s:
     Jotform retries on error, and a retry storm against a half-working parser
     loses more leads than it saves. */
  app.post('/hooks/jotform', async (c) => {
    const expected = process.env.JOTFORM_WEBHOOK_TOKEN
    if (expected && c.req.query('token') !== expected) {
      return c.json({ error: 'bad token' }, 401)
    }

    let body: Record<string, unknown>
    try {
      const ct = c.req.header('content-type') ?? ''
      body = ct.includes('json')
        ? await c.req.json<Record<string, unknown>>()
        : (Object.fromEntries((await c.req.formData()).entries()) as Record<string, unknown>)
    } catch {
      return c.json({ ok: false, error: 'unreadable body' }, 200)
    }

    const { payload, externalId } = unwrapJotformBody(body)
    try {
      const result = await receiveIntake(db, {
        workspaceId: WORKSPACE_ID,
        source: 'jotform',
        externalId,
        payload,
        mail: inboxConnectors.mail,
        notifyEmail: process.env.REVIEW_NOTIFY_EMAIL,
      })
      return c.json({ ok: true, ...result })
    } catch (err) {
      /* Record the failure rather than bouncing it: a submission we cannot
         process is still a lead, and it must not vanish into a retry loop. */
      console.error('jotform intake failed', err)
      return c.json({ ok: false, error: (err as Error).message }, 200)
    }
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

  /* ── Auth (SEC.1 · SPEC-SECURITY §1) ────────────────────────────────────
     login + logout are public and registered here BEFORE the gate; everything
     under /api/* below requires a valid session cookie. /hooks/* use HMAC
     (SEC.6), and /api/health stays public (registered at the top). */
  app.post('/api/auth/login', async (c) => {
    const { email, password } = await c.req.json<{ email: string; password: string }>()
    const { rows } = await db.query(
      `SELECT id, name, role, workspace_id, password_hash FROM users WHERE email = $1`, [email])
    const u = rows[0]
    if (!u || !verifyPassword(password, u.password_hash)) {
      return c.json({ error: 'invalid email or password' }, 401)
    }
    issueCookie(c, await createSession(db, u))
    return c.json({ user: { id: u.id, name: u.name, role: u.role } })
  })

  app.post('/api/auth/logout', async (c) => {
    await revokeSession(db, getCookie(c, SESSION_COOKIE))
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true })
  })

  app.use('/api/*', requireAuth(db))

  app.get('/api/auth/me', (c) => c.json({ user: c.get('principal') }))

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
    const { clientId } = await c.req.json<{ clientId: string }>()
    if (!clientId) return c.json({ error: 'clientId is required' }, 400)
    try {
      const result = await resolveMatch(db, c.req.param('id'), clientId, c.get('principal').handle)
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

  /* Clients CRM (§10): the portfolio backbone, enriched from real seeded data.
     Keeps the {clients:[{slug,name,...}]} shape the audit filter relies on. */
  app.get('/api/clients', async (c) => {
    const { rows } = await db.query(
      `SELECT c.id, c.slug, c.name, c.lifecycle, c.practice_type, c.health_score, c.languages,
              COALESCE(enq.n, 0)::int AS enquiries_30d,
              ads.cost_cents::int AS ads_cost_cents,
              COALESCE(fl.open_flags, 0)::int AS open_flags,
              sh.status AS site_status
       FROM clients c
       LEFT JOIN (SELECT client_id, sum(value) n FROM metrics_daily
                  WHERE source = 'forms' AND metric = 'enquiries' AND date > CURRENT_DATE - 30
                  GROUP BY client_id) enq ON enq.client_id = c.id
       LEFT JOIN (SELECT client_id, sum(value) FILTER (WHERE metric = 'cost_cents') AS cost_cents
                  FROM metrics_daily WHERE source = 'ads' AND date > CURRENT_DATE - 30
                  GROUP BY client_id) ads ON ads.client_id = c.id
       LEFT JOIN (SELECT client_id, count(*) open_flags FROM flags WHERE state = 'open' GROUP BY client_id) fl ON fl.client_id = c.id
       LEFT JOIN site_health sh ON sh.client_id = c.id
       WHERE c.archived_at IS NULL
       ORDER BY c.health_score ASC NULLS LAST, c.name`,
    )
    return c.json({ clients: rows })
  })

  app.get('/api/clients/:slug', async (c) => {
    const { rows: crows } = await db.query(
      `SELECT id, slug, name, practice_type, lifecycle, health_score, languages, timezone, guarantee_started_at, created_at
       FROM clients WHERE slug = $1`, [c.req.param('slug')])
    if (crows.length === 0) return c.json({ error: 'not found' }, 404)
    const client = crows[0]
    const cid = client.id

    const contacts = (await db.query(
      `SELECT name, email, phone, role, is_vip FROM contacts WHERE client_id = $1 ORDER BY is_vip DESC, name`, [cid])).rows
    const timeline = (await db.query(
      `SELECT type, occurred_at, title, body, source FROM timeline_events WHERE client_id = $1 ORDER BY occurred_at DESC LIMIT 12`, [cid])).rows
    const flags = (await db.query(
      `SELECT id, severity, title, workflow, opened_at FROM flags WHERE client_id = $1 AND state = 'open' ORDER BY opened_at DESC`, [cid])).rows
    const tasks = (await db.query(
      `SELECT id, title, assignee, status, due_at, sla_state FROM tasks WHERE client_id = $1 AND status = 'open' ORDER BY due_at NULLS LAST LIMIT 10`, [cid])).rows
    const seo = (await db.query(
      `SELECT id, url, score, grade, created_at FROM seo_audits WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1`, [cid])).rows[0] ?? null
    const site = (await db.query(
      `SELECT url, status, latency_ms, ssl_days_left, form_canary, flags FROM site_health WHERE client_id = $1 LIMIT 1`, [cid])).rows[0] ?? null
    const kpis = (await db.query(
      `SELECT COALESCE(sum(value) FILTER (WHERE source='forms' AND metric='enquiries'),0)::int AS enquiries,
              COALESCE(sum(value) FILTER (WHERE source='ads' AND metric='cost_cents'),0)::int AS ads_cost_cents,
              COALESCE(sum(value) FILTER (WHERE source='ads' AND metric='conversions'),0)::int AS conversions
       FROM metrics_daily WHERE client_id = $1 AND date > CURRENT_DATE - 30`, [cid])).rows[0]
    const series = (await db.query(
      `SELECT date, sum(value)::float AS v FROM metrics_daily
       WHERE client_id = $1 AND source='forms' AND metric='enquiries' AND date > CURRENT_DATE - 30
       GROUP BY date ORDER BY date`, [cid])).rows.map((r) => r.v)

    return c.json({ client, contacts, timeline, flags, tasks, seo, site, kpis, series })
  })

  /* Audit viewer (§13 1.7): filter by client, actor, action family.
     The log is append-only at the DB level — this is a read surface. */
  app.get('/api/audit', async (c) => {
    const client = c.req.query('client') // slug
    const actor = c.req.query('actor')
    const action = c.req.query('action') // exact or family prefix (e.g. "gate.")
    const params: unknown[] = []
    const where: string[] = []
    if (client) {
      params.push(client)
      where.push(`cl.slug = $${params.length}`)
    }
    if (actor) {
      params.push(actor)
      where.push(`a.actor_id = $${params.length}`)
    }
    if (action) {
      params.push(action.endsWith('.') ? `${action}%` : action)
      where.push(`a.action LIKE $${params.length}`)
    }
    const { rows } = await db.query(
      `SELECT a.id, a.at, a.actor_type, a.actor_id, a.action, a.target_type, a.target_id,
              a.why, a.rollback_of, cl.slug AS client_slug, cl.name AS client_name
       FROM audit_log a LEFT JOIN clients cl ON cl.id = a.client_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY a.at DESC LIMIT 200`,
      params,
    )
    const { rows: facets } = await db.query(
      `SELECT array_agg(DISTINCT a.actor_id) AS actors, array_agg(DISTINCT a.action) AS actions
       FROM audit_log a`,
    )
    return c.json({ entries: rows, actors: facets[0].actors ?? [], actions: facets[0].actions ?? [] })
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
    const { why } = await c.req.json<{ why: string }>()
    if (!why) return c.json({ error: 'why is required' }, 400)
    try {
      await resolveFlag(db, c.req.param('id'), c.get('principal').handle, why)
      return c.json({ ok: true })
    } catch (err) {
      return c.json({ error: (err as Error).message }, 409)
    }
  })

  app.post('/api/flags/:id/snooze', async (c) => {
    const { why } = await c.req.json<{ why: string }>()
    if (!why) return c.json({ error: 'why is required' }, 400)
    try {
      await snoozeFlag(db, c.req.param('id'), c.get('principal').handle, why)
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

  /* G3 gate items (complaints, spend, high-risk) are owner-only (SPEC-SECURITY §2). */
  async function guardG3(c: Context<{ Variables: { principal: Principal } }>, gateItemId: string): Promise<Response | null> {
    const { rows } = await db.query(`SELECT gate FROM gate_items WHERE id = $1`, [gateItemId])
    if (rows[0]?.gate === 'G3' && !can(c.get('principal').role, 'g3.approve')) {
      return c.json({ error: 'G3 actions are restricted to the agency owner' }, 403)
    }
    return null
  }

  app.post('/api/gate-items/:id/approve', async (c) => {
    const denied = await guardG3(c, c.req.param('id'))
    if (denied) return denied
    try {
      const decision = await approve(db, c.req.param('id'), c.get('principal').handle)
      return c.json(decision)
    } catch (err) {
      return c.json({ error: (err as Error).message }, 409)
    }
  })

  app.post('/api/gate-items/:id/reject', async (c) => {
    const { reason } = await c.req.json<{ reason: string }>()
    if (!reason) return c.json({ error: 'reason is required' }, 400)
    const denied = await guardG3(c, c.req.param('id'))
    if (denied) return denied
    try {
      const decision = await reject(db, c.req.param('id'), c.get('principal').handle, reason)
      return c.json(decision)
    } catch (err) {
      return c.json({ error: (err as Error).message }, 409)
    }
  })

  /* Notifications (§13 3.1): the notification center + per-user routing.
     Emission (route/escalate) is internal — called by the pipeline/gates and
     the cron escalator; these are the read/act + preferences surfaces. */
  app.get('/api/notifications', async (c) => {
    const user = c.req.query('user') ?? 'usr_wally'
    return c.json(await listForUser(db, user))
  })

  app.post('/api/notifications/:id/ack', async (c) => {
    try {
      return c.json(await ackNotify(db, c.req.param('id'), c.get('principal').handle))
    } catch (err) {
      return c.json({ error: (err as Error).message }, 409)
    }
  })

  app.get('/api/notifications/routing', async (c) => c.json(await routingView(db)))

  app.put('/api/users/:id/prefs', async (c) => {
    const prefs = await c.req.json<{ quiet_start?: number; quiet_end?: number; muted_classes?: string[] }>()
    try {
      return c.json(await updatePrefs(db, c.req.param('id'), prefs))
    } catch (err) {
      return c.json({ error: (err as Error).message }, 404)
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

  /* SEO site audit (SPEC-SEO §4.2): analyse a live URL → scored on-page/technical
     report. Deterministic (real HTML, no external API); seo-diagnose narrates later. */
  app.post('/api/seo/audit', async (c) => {
    const { url, clientSlug } = await c.req.json<{ url: string; clientSlug?: string }>()
    if (!url || !/\./.test(url)) return c.json({ error: 'a website URL is required' }, 400)
    let clientId: string | null = null
    if (clientSlug) {
      const { rows } = await db.query(`SELECT id FROM clients WHERE slug = $1`, [clientSlug])
      clientId = rows[0]?.id ?? null
    }
    const result = await runAudit(db, { url, clientId, requestedBy: c.get('principal').handle })
    return c.json(result)
  })

  app.get('/api/seo/audits', async (c) => {
    const { rows } = await db.query(
      `SELECT a.id, a.url, a.final_url, a.status, a.score, a.grade, a.created_at, a.requested_by,
              cl.slug AS client_slug, cl.name AS client_name
       FROM seo_audits a LEFT JOIN clients cl ON cl.id = a.client_id
       ORDER BY a.created_at DESC LIMIT 50`,
    )
    return c.json({ audits: rows })
  })

  app.get('/api/seo/audit/:id', async (c) => {
    const { rows } = await db.query(
      `SELECT a.id, a.url, a.final_url, a.status, a.score, a.grade, a.report, a.created_at,
              cl.name AS client_name
       FROM seo_audits a LEFT JOIN clients cl ON cl.id = a.client_id WHERE a.id = $1`,
      [c.req.param('id')],
    )
    if (rows.length === 0) return c.json({ error: 'not found' }, 404)
    return c.json(rows[0])
  })

  /* Site Health (§13 3.6): uptime + SSL, worst-first. Re-check probes live. */
  app.get('/api/site-health', async (c) => {
    const { rows } = await db.query(
      `SELECT s.id, s.url, s.status, s.http_status, s.latency_ms, s.ssl_days_left, s.form_canary, s.flags, s.checked_at,
              cl.slug AS client_slug, cl.name AS client_name
       FROM site_health s LEFT JOIN clients cl ON cl.id = s.client_id
       ORDER BY CASE s.status WHEN 'down' THEN 0 WHEN 'degraded' THEN 1 WHEN 'up' THEN 2 ELSE 3 END, cl.name`,
    )
    return c.json({ sites: rows })
  })

  app.post('/api/site-health/:id/check', async (c) => {
    const { rows } = await db.query(`SELECT id, url, form_canary FROM site_health WHERE id = $1`, [c.req.param('id')])
    if (rows.length === 0) return c.json({ error: 'not found' }, 404)
    return c.json(await runCheck(db, rows[0]))
  })

  /* ── Online Presence Review (module 1) ─────────────────────────────────── */

  app.get('/api/reviews', async (c) =>
    c.json({ reviews: await listReviews(db, c.get('principal').workspaceId) }))

  /* Audit a URL straight off, without waiting for an enquiry — an existing
     client, a prospect, a competitor. Same record shape as a Jotform request. */
  app.post('/api/reviews', async (c) => {
    const body = await c.req.json<{
      url: string; practiceName?: string; contactName?: string; contactEmail?: string
    }>()
    try {
      return c.json(await startManualReview(db, {
        workspaceId: c.get('principal').workspaceId,
        url: body.url,
        practiceName: body.practiceName,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        actor: c.get('principal').handle,
      }))
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400)
    }
  })

  app.get('/api/reviews/:id', async (c) => {
    const found = await getReview(db, c.get('principal').workspaceId, c.req.param('id'))
    return found ? c.json(found) : c.json({ error: 'not found' }, 404)
  })

  /* Crawling a live site is tens of seconds and longer once a browser joins,
     so it is queued rather than run inside the request. Returns the job to
     poll; a second press while one is running returns the same job instead of
     starting a second crawl of the client's site. */
  app.post('/api/reviews/:id/collect', async (c) => {
    const workspaceId = c.get('principal').workspaceId
    const reviewId = c.req.param('id')
    const { rows } = await db.query(
      `SELECT domain FROM reviews WHERE id = $1 AND workspace_id = $2`, [reviewId, workspaceId])
    if (rows.length === 0) return c.json({ error: 'review not found' }, 404)
    if (!rows[0].domain || rows[0].domain === '(not supplied)') {
      return c.json({ error: 'this review has no domain yet' }, 422)
    }

    const { job, alreadyQueued } = await enqueue(db, {
      workspaceId,
      kind: JOB_KINDS.reviewCollect,
      payload: { workspaceId, reviewId },
      dedupeKey: collectDedupeKey(reviewId),
    })
    if (!alreadyQueued) {
      await db.query(`UPDATE reviews SET status = 'collecting', collect_error = NULL WHERE id = $1`,
        [reviewId])
    }
    return c.json({ jobId: job.id, state: job.state, alreadyQueued })
  })

  app.get('/api/jobs/:id', async (c) => {
    const job = await getJob(db, c.req.param('id'))
    if (!job || job.workspace_id !== c.get('principal').workspaceId) {
      return c.json({ error: 'not found' }, 404)
    }
    return c.json({
      id: job.id, kind: job.kind, state: job.state, attempts: job.attempts,
      maxAttempts: job.max_attempts, error: job.last_error, result: job.result,
      createdAt: job.created_at, finishedAt: job.finished_at,
    })
  })

  app.get('/api/jobs', async (c) => c.json({ jobs: await listJobs(db) }))

  app.get('/api/reviews/:id/bank', async (c) => {
    try {
      return c.json({ groups: await manualBank(db, c.get('principal').workspaceId, c.req.param('id')) })
    } catch (err) {
      return c.json({ error: (err as Error).message }, 404)
    }
  })

  app.post('/api/reviews/:id/findings', async (c) => {
    const body = await c.req.json<{ snippetId: string; vars?: Record<string, string | number> }>()
    if (!body.snippetId) return c.json({ error: 'snippetId is required' }, 400)
    try {
      return c.json(await addManualFinding(db, c.get('principal').workspaceId, c.req.param('id'),
        body.snippetId, body.vars ?? {}, c.get('principal').handle))
    } catch (err) {
      return c.json({ error: (err as Error).message }, 422)
    }
  })

  app.post('/api/reviews/findings/:id/decide', async (c) => {
    const body = await c.req.json<{ state: 'accepted' | 'rejected' | 'candidate'; editedText?: string }>()
    try {
      return c.json(await decideFinding(db, c.get('principal').workspaceId, c.req.param('id'), {
        state: body.state, editedText: body.editedText, actor: c.get('principal').handle,
      }))
    } catch (err) {
      return c.json({ error: (err as Error).message }, 404)
    }
  })

  /* The deliverable. Refuses rather than shipping a paragraph with an unfilled
     variable in it — a practice must never receive "such as {{public_email}}". */
  app.get('/api/reviews/:id/export.docx', async (c) => {
    try {
      const { filename, buffer } = await exportReviewDocx(
        db, c.get('principal').workspaceId, c.req.param('id'))
      await db.query(
        `UPDATE reviews SET status = 'delivered', delivered_at = now() WHERE id = $1`,
        [c.req.param('id')])
      return new Response(new Uint8Array(buffer), {
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'content-disposition': `attachment; filename="${filename}"`,
        },
      })
    } catch (err) {
      return c.json({ error: (err as Error).message }, 422)
    }
  })

  app.put('/api/reviews/:id/scores', async (c) => {
    const body = await c.req.json<{ scores: Record<string, number | null>; overall: number | null }>()
    try {
      return c.json(await setScores(db, c.get('principal').workspaceId, c.req.param('id'),
        body.scores ?? {}, body.overall ?? null, c.get('principal').handle))
    } catch (err) {
      return c.json({ error: (err as Error).message }, 422)
    }
  })

  return app
}
