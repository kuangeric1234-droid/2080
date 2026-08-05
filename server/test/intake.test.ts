import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { migrate } from '../src/db/migrate.ts'
import { seed, WORKSPACE_ID } from '../src/db/seed.ts'
import { buildApp } from '../src/api.ts'
import { MockActiveCollab, MockMailSender } from '../src/inbox/connectors.ts'
import { MockModelClient } from '../src/skills/model.ts'
import { parseJotform, receiveIntake, startManualReview, unwrapJotformBody } from '../src/review/intake.ts'
import { HEALTHY, NEGLECTED, fixtureFetch } from './fixtures/practice-site.ts'
import { collectReview, decideFinding, getReview, listReviews, setScores } from '../src/review/store.ts'
import { authed, freePort, stopPg } from './helpers.ts'

let PORT: number
let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string
let mail: MockMailSender
let app: ReturnType<typeof buildApp>

beforeAll(async () => {
  PORT = await freePort()
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080itk-'))
  server = new EmbeddedPostgres({
    databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PORT,
    // stopPg removes the directory; see helpers.ts
    persistent: true, initdbFlags: ['--encoding=UTF8', '--locale=C'],
  })
  await server.initialise()
  await server.start()
  await server.createDatabase('app')
  db = new pg.Client({ host: '127.0.0.1', port: PORT, user: 'postgres', password: 'postgres', database: 'app' })
  await db.connect()
  await migrate(db)
  await seed(db)
  mail = new MockMailSender()
  app = buildApp(db, new MockModelClient(() => ({})), { mail, tasks: new MockActiveCollab() })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await stopPg(server, dataDir)
}, 60_000)

/* A real Jotform delivery: form-encoded, answers as a JSON string in
   rawRequest, field keys named by whoever built the form. */
const JOTFORM_BODY = {
  formID: '240012345678901',
  submissionID: '5901234567890123456',
  rawRequest: JSON.stringify({
    q3_practiceName: 'Stellar Smiles Dental',
    q4_yourName: { first: 'Amy', last: 'Nguyen' },
    q5_email: 'amy@stellarsmiles.com.au',
    q6_phoneNumber: { full: '(03) 9555 9999' },
    q7_websiteAddress: 'https://www.stellarsmiles.com.au/',
    q9_whatWould: 'We want more new patients from Google.',
  }),
}

describe('parsing a Jotform submission', () => {
  it('finds the fields whatever the form builder named them', () => {
    const { payload, externalId } = unwrapJotformBody(JOTFORM_BODY)
    expect(externalId).toBe('5901234567890123456')
    const p = parseJotform(payload)
    expect(p.domain).toBe('stellarsmiles.com.au')
    expect(p.practiceName).toBe('Stellar Smiles Dental')
    expect(p.contactName).toBe('Amy Nguyen')
    expect(p.contactEmail).toBe('amy@stellarsmiles.com.au')
    expect(p.contactPhone).toContain('9555 9999')
  })

  it('strips protocol, www and path from the domain', () => {
    expect(parseJotform({ website: 'HTTP://WWW.Example.COM.AU/contact/' }).domain).toBe('example.com.au')
  })

  it('falls back to any unmistakable email or URL when keys are unrecognisable', () => {
    const p = parseJotform({ field_17: 'wally@2080.dental', field_22: 'yarrahills.com.au' })
    expect(p.contactEmail).toBe('wally@2080.dental')
    expect(p.domain).toBe('yarrahills.com.au')
  })

  it('does not mistake an email for a domain', () => {
    expect(parseJotform({ url: 'someone@place.com.au' }).domain).toBeNull()
  })

  it('survives a submission with nothing usable in it', () => {
    const p = parseJotform({ q1_comments: 'call me' })
    expect(p.domain).toBeNull()
    expect(p.contactEmail).toBeNull()
  })
})

describe('receiving an audit request', () => {
  it('opens a review, notifies the dashboard and sends the email', async () => {
    const before = mail.sent.length
    const { payload, externalId } = unwrapJotformBody(JOTFORM_BODY)
    const r = await receiveIntake(db, {
      workspaceId: WORKSPACE_ID, source: 'jotform', externalId, payload,
      mail, notifyEmail: 'wally@2080.dental',
    })

    expect(r.duplicate).toBe(false)
    expect(r.parseError).toBeNull()
    expect(r.parsed.domain).toBe('stellarsmiles.com.au')
    expect(r.notified).toBeGreaterThan(0)
    expect(r.emailed).toBe(true)

    const sent = mail.sent[before]
    expect(sent.to).toBe('wally@2080.dental')
    expect(sent.subject).toContain('Stellar Smiles Dental')
    expect(sent.body).toContain('stellarsmiles.com.au')
    expect(sent.body).toContain(r.reviewId)

    // collection is queued the moment the request lands, so the box is already
    // crawling by the time Wally opens it
    expect(r.jobId).toMatch(/^job_/)
    const { rows } = await db.query(`SELECT domain, status::text, contact_email FROM reviews WHERE id = $1`, [r.reviewId])
    expect(rows[0]).toMatchObject({
      domain: 'stellarsmiles.com.au', status: 'collecting', contact_email: 'amy@stellarsmiles.com.au',
    })
  })

  /* Jotform retries. A retry must not produce a second review of the same
     practice, or Wally does the work twice. */
  it('is idempotent on a redelivered webhook', async () => {
    const { payload, externalId } = unwrapJotformBody(JOTFORM_BODY)
    const again = await receiveIntake(db, {
      workspaceId: WORKSPACE_ID, source: 'jotform', externalId, payload,
      mail, notifyEmail: 'wally@2080.dental',
    })
    expect(again.duplicate).toBe(true)
    expect(again.emailed).toBe(false)

    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM reviews WHERE domain = 'stellarsmiles.com.au'`)
    expect(rows[0].n).toBe(1)
  })

  /* A submission we cannot parse is still a lead. It must land, and it must
     say what is wrong rather than failing quietly. */
  it('still opens a review and still notifies when the domain is missing', async () => {
    const before = mail.sent.length
    const r = await receiveIntake(db, {
      workspaceId: WORKSPACE_ID, source: 'jotform', externalId: 'sub-no-domain',
      payload: { q1_message: 'please audit my site', q2_email: 'nodomain@example.com' },
      mail, notifyEmail: 'wally@2080.dental',
    })
    expect(r.parseError).toMatch(/No website address/)
    expect(r.notified).toBeGreaterThan(0)
    expect(mail.sent[before].subject).toMatch(/needs a domain/)

    const { rows } = await db.query(`SELECT status::text, domain FROM reviews WHERE id = $1`, [r.reviewId])
    expect(rows[0].status).toBe('requested')
    expect(rows[0].domain).toBe('(not supplied)')
  })

  it('records the raw payload untouched so a bad parse can be re-run', async () => {
    const { rows } = await db.query(
      `SELECT payload FROM intake_requests WHERE external_id = '5901234567890123456'`)
    expect(rows[0].payload.rawRequest.q3_practiceName).toBe('Stellar Smiles Dental')
    expect(rows[0].payload.formID).toBe('240012345678901')
  })

  it('writes the request to the audit log', async () => {
    const { rows } = await db.query(
      `SELECT action, why FROM audit_log
        WHERE action = 'review.requested' AND why LIKE '%stellarsmiles.com.au%'`)
    expect(rows).toHaveLength(1)
    expect(rows[0].why).toContain('amy@stellarsmiles.com.au')
  })
})

/* Most reviews will start by typing a URL, not by waiting for an enquiry. */
describe('auditing a URL by hand', () => {
  it('opens a review from a bare domain without notifying anyone', async () => {
    const before = mail.sent.length
    const r = await startManualReview(db, {
      workspaceId: WORKSPACE_ID, url: 'https://www.TrowseDental.com.au/about/', actor: 'WC',
    })
    expect(r.domain).toBe('trowsedental.com.au')
    expect(r.duplicate).toBe(false)
    // the person who typed it in does not need to be told it arrived
    expect(r.notified).toBe(0)
    expect(mail.sent.length).toBe(before)

    expect(r.jobId).toMatch(/^job_/)
    const { rows } = await db.query(`SELECT domain, status::text FROM reviews WHERE id = $1`, [r.reviewId])
    expect(rows[0]).toMatchObject({ domain: 'trowsedental.com.au', status: 'collecting' })
  })

  it('leaves the same evidence trail as a Jotform request', async () => {
    const { rows } = await db.query(
      `SELECT source, payload FROM intake_requests WHERE domain = 'trowsedental.com.au'`)
    expect(rows[0].source).toBe('manual')
    expect(rows[0].payload.enteredBy).toBe('WC')

    const { rows: log } = await db.query(
      `SELECT why FROM audit_log WHERE action = 'review.requested' AND why LIKE '%trowsedental%'`)
    expect(log).toHaveLength(1)
  })

  /* Typing the same site twice is double-entry, not a deliberate re-audit —
     hand back the open review rather than splitting the work in two. */
  it('hands back an open review of the same site instead of duplicating it', async () => {
    const first = await startManualReview(db, {
      workspaceId: WORKSPACE_ID, url: 'aspireone.com.au', actor: 'WC',
    })
    const again = await startManualReview(db, {
      workspaceId: WORKSPACE_ID, url: 'https://aspireone.com.au', actor: 'WC',
    })
    expect(again.duplicate).toBe(true)
    expect(again.reviewId).toBe(first.reviewId)

    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM reviews WHERE domain = 'aspireone.com.au'`)
    expect(rows[0].n).toBe(1)
  })

  it('allows a fresh audit once the last one was delivered', async () => {
    const first = await startManualReview(db, {
      workspaceId: WORKSPACE_ID, url: 'smiletogo.com.au', actor: 'WC',
    })
    await db.query(`UPDATE reviews SET status = 'delivered' WHERE id = $1`, [first.reviewId])
    const second = await startManualReview(db, {
      workspaceId: WORKSPACE_ID, url: 'smiletogo.com.au', actor: 'WC',
    })
    expect(second.duplicate).toBe(false)
    expect(second.reviewId).not.toBe(first.reviewId)
  })

  it('refuses something that is not a website address', async () => {
    for (const bad of ['', '   ', 'not a url', 'wally@2080.dental', 'just-words']) {
      await expect(startManualReview(db, { workspaceId: WORKSPACE_ID, url: bad, actor: 'WC' }))
        .rejects.toThrow()
    }
  })

  it('is reachable over the API and 400s on rubbish', async () => {
    const get = await authed(app)
    const ok = await get('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'gentletouchortho.com.au' }),
    })
    expect(ok.status).toBe(200)
    expect((await ok.json() as { domain: string }).domain).toBe('gentletouchortho.com.au')

    const bad = await get('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'hello there' }),
    })
    expect(bad.status).toBe(400)
    expect((await bad.json() as { error: string }).error).toMatch(/doesn’t look like a website address/)
  })
})

describe('the webhook endpoint', () => {
  it('accepts a form-encoded Jotform post and 200s', async () => {
    const form = new FormData()
    form.set('formID', '240012345678901')
    form.set('submissionID', '5901234567890999')
    form.set('rawRequest', JSON.stringify({ q3_practice: 'Yarra Hills Chiro', q5_email: 'hi@yarrahills.com.au', q7_website: 'yarrahills.com.au' }))

    const res = await app.request('/hooks/jotform', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const json = await res.json() as { ok: boolean; parsed: { domain: string } }
    expect(json.ok).toBe(true)
    expect(json.parsed.domain).toBe('yarrahills.com.au')
  })

  it('accepts plain JSON so the endpoint is curl-testable', async () => {
    const res = await app.request('/hooks/jotform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ submissionID: 'curl-1', website: 'trowsedental.com.au', email: 'a@b.com.au' }),
    })
    expect(res.status).toBe(200)
    expect((await res.json() as { ok: boolean }).ok).toBe(true)
  })

  it('never 500s on an unreadable body — Jotform would retry forever', async () => {
    const res = await app.request('/hooks/jotform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json at all',
    })
    expect(res.status).toBe(200)
    expect((await res.json() as { ok: boolean }).ok).toBe(false)
  })

  it('rejects a wrong token when one is configured', async () => {
    process.env.JOTFORM_WEBHOOK_TOKEN = 's3cret'
    try {
      const bad = await app.request('/hooks/jotform', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
      })
      expect(bad.status).toBe(401)

      const good = await app.request('/hooks/jotform?token=s3cret', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ submissionID: 'tok-1', website: 'aspireone.com.au' }),
      })
      expect(good.status).toBe(200)
    } finally {
      delete process.env.JOTFORM_WEBHOOK_TOKEN
    }
  })

  it('requires a session for the review API but not for the webhook', async () => {
    expect((await app.request('/api/reviews')).status).toBe(401)
    const get = await authed(app)
    expect((await get('/api/reviews')).status).toBe(200)
  })
})

describe('review lifecycle', () => {
  let reviewId: string

  it('collects evidence and drafts findings', async () => {
    const r = await receiveIntake(db, {
      workspaceId: WORKSPACE_ID, source: 'manual', externalId: 'lifecycle-1',
      payload: { practice: 'Stellar Smiles', website: 'stellarsmiles.test', email: 'a@stellarsmiles.test' },
    })
    reviewId = r.reviewId

    const out = await collectReview(db, WORKSPACE_ID, reviewId, {
      fetchImpl: fixtureFetch(NEGLECTED, 'http://stellarsmiles.test'),
      networkProbes: false,
    })
    /* 24, not 25: site.load_seconds moved to the render layer in 1.3b, and
       networkProbes:false skips that layer, so this is fetch signals only. */
    expect(out.signals).toBeGreaterThanOrEqual(24)
    expect(out.findings).toBeGreaterThan(8)

    const full = (await getReview(db, WORKSPACE_ID, reviewId))!
    expect(full.review.status).toBe('draft')
    expect(full.signals.length).toBeGreaterThanOrEqual(24)
    expect(full.categories).toHaveLength(8)

    // every stored finding names the evidence that earned it
    for (const f of full.findings) {
      if (f.snippet_id === 'summary.closer.optimistic') continue
      expect((f.triggered_by as string[]).length, f.snippet_id).toBeGreaterThan(0)
    }
  })

  it('keeps a reviewer decision across a re-collect', async () => {
    const before = (await getReview(db, WORKSPACE_ID, reviewId))!
    const cms = before.findings.find((f) => f.snippet_id === 'tech.cms.static_html')!

    await decideFinding(db, WORKSPACE_ID, cms.id, {
      state: 'accepted', editedText: 'Static HTML — move to WordPress before anything else.', actor: 'WC',
    })

    await collectReview(db, WORKSPACE_ID, reviewId, {
      fetchImpl: fixtureFetch(NEGLECTED, 'http://stellarsmiles.test'),
      networkProbes: false,
    })

    const after = (await getReview(db, WORKSPACE_ID, reviewId))!
    const same = after.findings.find((f) => f.snippet_id === 'tech.cms.static_html')!
    expect(same.state).toBe('edited')
    expect(same.edited_text).toBe('Static HTML — move to WordPress before anything else.')
    expect(same.decided_by).toBe('WC')
  })

  it('appends signals rather than overwriting them', async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM review_signals WHERE review_id = $1 AND key = 'site.https'`,
      [reviewId],
    )
    expect(rows[0].n).toBe(2) // one per collection run
    const full = (await getReview(db, WORKSPACE_ID, reviewId))!
    expect(full.signals.filter((s) => s.key === 'site.https')).toHaveLength(1) // latest only
  })

  it('lets the reviewer override the suggested scores', async () => {
    await setScores(db, WORKSPACE_ID, reviewId,
      { website_technical: 1, website_usability: 2, reputation: null }, 2, 'WC')
    const full = (await getReview(db, WORKSPACE_ID, reviewId))!
    expect(full.review.overall_score).toBe(2)
    expect(full.review.category_scores.website_technical).toBe(1)
    expect(full.review.status).toBe('in_review')
  })

  it('refuses a star score outside 1..5', async () => {
    await expect(setScores(db, WORKSPACE_ID, reviewId, { reputation: 9 }, 3, 'WC')).rejects.toThrow(/1\.\.5/)
  })

  it('shows the queue with per-review progress', async () => {
    const rows = await listReviews(db, WORKSPACE_ID)
    const mine = rows.find((r) => r.id === reviewId)!
    expect(mine.findings_candidate).toBeGreaterThan(8)
    /* Was `toBe(1)` — one reviewer accept — until 1.9 started auto-accepting the
       measurements on collect. Counted from the table rather than pinned to a
       number so the queue stays honest as the auto_safe list changes, while
       still proving the reviewer's own decision is in there. */
    const { rows: [truth] } = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM review_findings
        WHERE review_id = $1 AND state IN ('accepted','edited')`, [reviewId])
    expect(mine.findings_accepted).toBe(Number(truth.n))
    expect(mine.findings_accepted).toBeGreaterThan(1) // autos plus the human's
    expect(mine.status).toBe('in_review')
    expect(rows.some((r) => r.source === 'jotform')).toBe(true)
  })

  it('refuses to collect a review with no domain', async () => {
    const r = await receiveIntake(db, {
      workspaceId: WORKSPACE_ID, source: 'manual', externalId: 'no-domain-collect',
      payload: { message: 'audit please' },
    })
    await expect(collectReview(db, WORKSPACE_ID, r.reviewId)).rejects.toThrow(/no domain/)
  })

  it('scores a healthy site above a neglected one end to end', async () => {
    const r = await receiveIntake(db, {
      workspaceId: WORKSPACE_ID, source: 'manual', externalId: 'healthy-1',
      payload: { practice: 'Hearts Dental', website: 'heartsdental.test' },
    })
    const out = await collectReview(db, WORKSPACE_ID, r.reviewId, {
      fetchImpl: fixtureFetch(HEALTHY, 'https://heartsdental.test'),
      networkProbes: false,
    })
    const tech = out.scores.find((s) => s.category === 'website_technical')!
    expect(tech.suggested).toBe(5)
    expect(out.scores.find((s) => s.category === 'reputation')!.suggested).toBeNull()
  })
})
