import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'
import { monotonicFactory } from 'ulid'

const ulid = monotonicFactory()
const id = (prefix: string) => `${prefix}_${ulid()}`

export const WORKSPACE_ID = 'ws_2080'

const daysAgo = (n: number, hour = 9) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d
}
const dateStr = (d: Date) => d.toISOString().slice(0, 10)

/* Deterministic daily wave so charts look alive without Math.random. */
const wave = (base: number, amp: number, day: number, phase = 0) =>
  Math.round(base + amp * Math.sin((day + phase) / 4.2) + (day % 3))

/** Truncates everything and reseeds the demo portfolio (§13 1.2 DoD). */
export async function seed(client: pg.Client) {
  const tables = [
    'entity_maps', 'notifications', 'audit_log', 'gate_items', 'precision_ledger',
    'skill_runs', 'sync_status', 'metrics_daily', 'deals', 'tasks', 'flags',
    'requests', 'timeline_events', 'contacts', 'clients', 'workspaces',
  ]
  await client.query(`TRUNCATE ${tables.join(', ')} CASCADE`)

  await client.query(
    `INSERT INTO workspaces (id, workspace_id, name) VALUES ($1, $1, '20-80 Solutions')`,
    [WORKSPACE_ID],
  )

  /* ── clients: the demo portfolio ─────────────────────────────────────── */
  const portfolio = [
    { slug: 'hearts', name: 'Hearts Dental', lifecycle: 'operate', health: 62, languages: ['en', 'zh'] },
    { slug: 'yarra-hills', name: 'Yarra Hills Dental', lifecycle: 'operate', health: 74, languages: ['en'] },
    { slug: 'smile-council', name: 'Smile Council', lifecycle: 'operate', health: 88, languages: ['en'] },
    { slug: 'trowse', name: 'Trowse Dental', lifecycle: 'operate', health: 91, languages: ['en'] },
    { slug: 'aspire-one', name: 'Aspire One Dental', lifecycle: 'build', health: 70, languages: ['en'] },
    { slug: 'smile-to-go', name: 'Smile To Go', lifecycle: 'at_risk', health: 48, languages: ['en'] },
  ] as const

  const clientId: Record<string, string> = {}
  for (const p of portfolio) {
    clientId[p.slug] = id('cl')
    await client.query(
      `INSERT INTO clients (id, workspace_id, slug, name, practice_type, lifecycle,
         health_score, languages, plan, guarantee_started_at)
       VALUES ($1, $2, $3, $4, 'dental', $5, $6, $7, $8, $9)`,
      [
        clientId[p.slug], WORKSPACE_ID, p.slug, p.name, p.lifecycle, p.health, p.languages,
        JSON.stringify({ website: true, ads: true, seo: true, receptionist: p.slug === 'hearts' }),
        p.slug === 'smile-to-go' ? daysAgo(120) : null,
      ],
    )
  }

  /* ── contacts ────────────────────────────────────────────────────────── */
  const contacts: Array<[string, string, string[], string, boolean, string | null]> = [
    ['hearts', 'Dr Priya Sharma', ['priya@heartsdental.com.au'], 'owner', false, null],
    ['hearts', 'Karen Wu', ['karen@heartsdental.com.au'], 'practice_manager', true, 'zh'],
    ['yarra-hills', 'Dr Tom Nguyen', ['tom@yarrahillsdental.com.au'], 'owner', false, null],
    ['yarra-hills', 'Melissa Grant', ['reception@yarrahillsdental.com.au'], 'front_desk', false, null],
    ['smile-council', 'Dr Angela Rossi', ['angela@smilecouncil.com.au'], 'owner', false, null],
    ['trowse', 'Dr Ben Trowse', ['ben@trowsedental.com.au'], 'owner', false, null],
    ['aspire-one', 'Dr Sofia Marino', ['sofia@aspireone.dental'], 'owner', false, null],
    ['smile-to-go', 'Dr Jack Lee', ['jack@smiletogo.com.au'], 'owner', false, null],
  ]
  for (const [slug, name, email, role, vip, lang] of contacts) {
    await client.query(
      `INSERT INTO contacts (id, workspace_id, client_id, name, email, role, portal_access, is_vip, language_pref)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)`,
      [id('ct'), WORKSPACE_ID, clientId[slug], name, email, role, vip, lang],
    )
  }

  /* ── the Hearts double-request email (W2 demo scenario) ──────────────── */
  const heartsThread = 'gm_thread_hearts_0707'
  await client.query(
    `INSERT INTO timeline_events (id, workspace_id, client_id, type, occurred_at, title, body, payload, source, source_ref)
     VALUES ($1, $2, $3, 'EMAIL_IN', $4,
       'Karen Wu: new bio for Dr Sharma + pricing page update',
       'Hi team — two things: Dr Sharma has a new bio (attached soon), and can we update the Invisalign pricing on the fees page? Thanks!',
       $5, 'gmail', $6)`,
    [id('evt'), WORKSPACE_ID, clientId['hearts'], daysAgo(0, 8),
     JSON.stringify({ from: 'karen@heartsdental.com.au', subject: 'Bio + pricing update' }), heartsThread],
  )
  const reqBio = id('req')
  const reqPricing = id('req')
  await client.query(
    `INSERT INTO requests (id, workspace_id, client_id, thread_id, type, summary, status, sla_due_at, confidence, source, missing_assets, language)
     VALUES
       ($1, $3, $4, $5, 'content_update', 'New bio for Dr Sharma', 'waiting_client', $6, 0.97, 'email', '["bio copy","headshot"]', 'en'),
       ($2, $3, $4, $5, 'website_change', 'Update Invisalign pricing on fees page', 'triaged', $6, 0.97, 'email', '[]', 'en')`,
    [reqBio, reqPricing, WORKSPACE_ID, clientId['hearts'], heartsThread, daysAgo(-2, 17)],
  )
  const taskBio = id('task')
  const taskPricing = id('task')
  await client.query(
    `INSERT INTO tasks (id, workspace_id, client_id, title, assignee, due_at, status, source_request_id)
     VALUES
       ($1, $3, $4, 'Chase + publish new bio for Dr Sharma', 'HK', $5, 'waiting', $6),
       ($2, $3, $4, 'Update Invisalign pricing on fees page', 'IS', $5, 'open', $7)`,
    [taskBio, taskPricing, WORKSPACE_ID, clientId['hearts'], daysAgo(-2, 17), reqBio, reqPricing],
  )
  await client.query(`UPDATE requests SET task_ids = ARRAY[$1] WHERE id = $2`, [taskBio, reqBio])
  await client.query(`UPDATE requests SET task_ids = ARRAY[$1] WHERE id = $2`, [taskPricing, reqPricing])

  /* ── flags: the live demo scenarios ──────────────────────────────────── */
  const flagRows: Array<[string, string, string, string, string, object]> = [
    ['yarra-hills', 'W3', 'red', 'CPA up 38% in 7 days on "Implants — Yarra"',
     'yarra-hills:ads:cpa-spike',
     { metric: 'cpa', change: '+38%', window: '7d', campaign: 'Implants — Yarra' }],
    ['smile-to-go', 'W4', 'amber', '"dentist blackburn" dropped 4 → 9',
     'smile-to-go:seo:dentist-blackburn',
     { keyword: 'dentist blackburn', from: 4, to: 9, since: dateStr(daysAgo(2)) }],
    ['hearts', 'W2', 'info', 'Bio request waiting on client assets for 0 of 7 days',
     'hearts:inbox:bio-chase',
     { request: 'New bio for Dr Sharma', waiting_on: 'client' }],
  ]
  const flagIds: string[] = []
  for (const [slug, wf, sev, title, dedupe, diagnosis] of flagRows) {
    const fid = id('flag')
    flagIds.push(fid)
    await client.query(
      `INSERT INTO flags (id, workspace_id, client_id, workflow, severity, state, dedupe_key, title, diagnosis, opened_at)
       VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8, $9)`,
      [fid, WORKSPACE_ID, clientId[slug], wf, sev, dedupe, title, JSON.stringify(diagnosis), daysAgo(1, 6)],
    )
  }
  const adsTask = id('task')
  await client.query(
    `INSERT INTO tasks (id, workspace_id, client_id, title, assignee, status, source_flag_id)
     VALUES ($1, $2, $3, 'Review implant campaign search terms', 'WC', 'open', $4)`,
    [adsTask, WORKSPACE_ID, clientId['yarra-hills'], flagIds[0]],
  )
  await client.query(`UPDATE flags SET task_id = $1 WHERE id = $2`, [adsTask, flagIds[0]])

  /* ── assorted timeline history ───────────────────────────────────────── */
  const events: Array<[string, string, number, string, string, string, object]> = [
    ['hearts', 'CALL', 1, 'Mrs Lin — rescued after-hours call, booking request (中文)', 'voice',
     'call_lin_0107', { language: 'zh', outcome: 'booking_request', duration_s: 262 }],
    ['yarra-hills', 'REPORT', 6, 'June performance report sent', 'skill', 'rep_june_yh',
     { period: '2026-06', roas: 10.9 }],
    ['smile-council', 'REVIEW', 3, 'New 5★ Google review — response drafted for approval', 'skill',
     'rev_sc_192', { rating: 5, platform: 'google' }],
    ['trowse', 'PUBLISH', 4, 'Blog post published: "Wisdom teeth — what to expect"', 'cms',
     'pub_tr_88', { page: '/blog/wisdom-teeth' }],
    ['smile-to-go', 'INVOICE', 9, 'June invoice issued ($2,400)', 'xero', 'inv_stg_0626',
     { amount_cents: 240000 }],
    ['aspire-one', 'MEETING', 2, 'Kickoff meeting — brand direction agreed', 'fathom', 'mtg_ao_kick',
     { attendees: 4 }],
  ]
  for (const [slug, type, days, title, source, ref, payload] of events) {
    await client.query(
      `INSERT INTO timeline_events (id, workspace_id, client_id, type, occurred_at, title, payload, source, source_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id('evt'), WORKSPACE_ID, clientId[slug], type, daysAgo(days, 11), title, JSON.stringify(payload), source, ref],
    )
  }

  /* ── deals ───────────────────────────────────────────────────────────── */
  await client.query(
    `INSERT INTO deals (id, workspace_id, client_id, name, stage, source_channel, value_estimate_cents, stage_history)
     VALUES
       ($1, $3, NULL, 'Brunswick Family Dental', 'warm', 'web_form', 3600000, $4),
       ($2, $3, NULL, 'Northcote Smiles', 'meeting', 'referral', 5400000, $5)`,
    [id('deal'), id('deal'), WORKSPACE_ID,
     JSON.stringify([{ stage: 'cold', at: daysAgo(14).toISOString() }, { stage: 'warm', at: daysAgo(5).toISOString() }]),
     JSON.stringify([{ stage: 'cold', at: daysAgo(21).toISOString() }, { stage: 'warm', at: daysAgo(10).toISOString() }, { stage: 'meeting', at: daysAgo(1).toISOString() }])],
  )

  /* ── 30 days of monitor metrics for the operate clients ──────────────── */
  const metricPlan: Array<[string, string, string, number, number]> = [
    ['hearts', 'ads', 'cost_cents', 9800, 900],
    ['hearts', 'ads', 'conversions', 6, 2],
    ['hearts', 'forms', 'enquiries', 4, 2],
    ['yarra-hills', 'ads', 'cost_cents', 14200, 1300],
    ['yarra-hills', 'ads', 'conversions', 8, 3],
    ['yarra-hills', 'forms', 'enquiries', 5, 2],
    ['yarra-hills', 'calls', 'rescued', 1, 1],
    ['smile-to-go', 'seo', 'avg_position', 6, 3],
  ]
  for (const [slug, source, metric, base, amp] of metricPlan) {
    for (let day = 30; day >= 1; day--) {
      await client.query(
        `INSERT INTO metrics_daily (workspace_id, client_id, date, source, metric, value)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [WORKSPACE_ID, clientId[slug], dateStr(daysAgo(day)), source, metric, wave(base, amp, day)],
      )
    }
  }

  /* ── sync status: honest freshness, one stale source ─────────────────── */
  for (const p of portfolio) {
    for (const source of ['ads', 'seo', 'ga4', 'reviews'] as const) {
      const stale = p.slug === 'smile-to-go' && source === 'seo'
      await client.query(
        `INSERT INTO sync_status (workspace_id, client_id, source, last_ok_at, state, detail)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [WORKSPACE_ID, clientId[p.slug], source,
         stale ? daysAgo(3, 5) : daysAgo(0, 5), stale ? 'stale' : 'ok',
         stale ? 'BrightLocal export missing since Friday' : null],
      )
    }
  }

  /* ── a skill run with a pending gate item + audit trail ──────────────── */
  const runTriage = id('run')
  await client.query(
    `INSERT INTO skill_runs (id, workspace_id, skill, version, client_id, trigger, input_hash, output, gate, gate_outcome, tokens_in, tokens_out, cost_cents, latency_ms)
     VALUES ($1, $2, 'email-triage', 'v1', $3, 'gmail.push', 'sha256:demo1', $4, 'G1', 'auto', 2100, 340, 2, 1800)`,
    [runTriage, WORKSPACE_ID, clientId['hearts'],
     JSON.stringify({ requests: 2, types: ['content_update', 'website_change'] })],
  )
  const runAck = id('run')
  await client.query(
    `INSERT INTO skill_runs (id, workspace_id, skill, version, client_id, trigger, input_hash, output, gate, tokens_in, tokens_out, cost_cents, latency_ms)
     VALUES ($1, $2, 'ack-writer', 'v1', $3, 'request.triaged', 'sha256:demo2', $4, 'G2', 2600, 410, 3, 2100)`,
    [runAck, WORKSPACE_ID, clientId['hearts'],
     JSON.stringify({ draft: 'Hi Karen — got both requests. Pricing update is underway; could you send Dr Sharma’s new bio and headshot when ready?' })],
  )
  await client.query(
    `INSERT INTO gate_items (id, workspace_id, skill_run_id, gate, state, payload, expires_at)
     VALUES ($1, $2, $3, 'G2', 'pending', $4, $5)`,
    [id('gate'), WORKSPACE_ID, runAck,
     JSON.stringify({ action: 'email.send', to: 'karen@heartsdental.com.au', subject: 'Re: Bio + pricing update' }),
     daysAgo(-1, 8)],
  )
  await client.query(
    `INSERT INTO audit_log (id, workspace_id, actor_type, actor_id, action, target_type, target_id, client_id, why)
     VALUES
       ($1, $3, 'skill', 'email-triage@v1', 'request.create', 'request', $4, $5, 'Inbound email split into two requests'),
       ($2, $3, 'skill', 'email-triage@v1', 'task.create', 'task', $6, $5, 'Request: update Invisalign pricing')`,
    [id('aud'), id('aud'), WORKSPACE_ID, reqBio, clientId['hearts'], taskPricing],
  )

  /* ── entity maps the matcher would have learned ──────────────────────── */
  const maps: Array<[string, string, string]> = [
    ['domain', 'heartsdental.com.au', 'hearts'],
    ['domain', 'yarrahillsdental.com.au', 'yarra-hills'],
    ['email', 'karen@heartsdental.com.au', 'hearts'],
    ['phone_did', '+61390001112', 'hearts'],
    ['ads_account', '493-201-8876', 'yarra-hills'],
    ['thread', heartsThread, 'hearts'],
  ]
  for (const [kind, key, slug] of maps) {
    await client.query(
      `INSERT INTO entity_maps (id, workspace_id, kind, external_key, client_id, learned_from)
       VALUES ($1, $2, $3, $4, $5, 'seed')`,
      [id('map'), WORKSPACE_ID, kind, key, clientId[slug]],
    )
  }

  await client.query(
    `INSERT INTO notifications (id, workspace_id, user_id, event_class, severity, client_id, title, coalesce_key)
     VALUES
       ($1, $3, 'WC', 'gate_item', 'amber', $4, 'Ack draft for Hearts waiting on you', 'gate:hearts'),
       ($2, $3, 'WC', 'monitor_flag', 'red', $5, 'Yarra Hills CPA up 38% in 7 days', 'flag:yarra-hills:ads')`,
    [id('ntf'), id('ntf'), WORKSPACE_ID, clientId['hearts'], clientId['yarra-hills']],
  )
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await seed(client)
    console.log('seeded demo portfolio')
  } finally {
    await client.end()
  }
}
