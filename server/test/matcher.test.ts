import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { migrate } from '../src/db/migrate.ts'
import { seed } from '../src/db/seed.ts'
import { matchInbound, ingestEvent, resolveMatch, type InboundRefs } from '../src/matcher.ts'

const PORT = 5499
const HERE = path.dirname(fileURLToPath(import.meta.url))

interface GoldenCase {
  name: string
  refs: InboundRefs
  expect: { decision: string; client?: string; method?: string; candidates?: number }
}
const GOLDEN: { cases: GoldenCase[] } = JSON.parse(
  readFileSync(path.join(HERE, 'golden/matcher.golden.json'), 'utf8'),
)

let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string
const idBySlug: Record<string, string> = {}
const slugById: Record<string, string> = {}

const NOTE = {
  type: 'EMAIL_IN',
  occurredAt: new Date().toISOString(),
  title: 'test event',
  source: 'gmail',
} as const

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080m-'))
  server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  })
  await server.initialise()
  await server.start()
  await server.createDatabase('app')
  db = new pg.Client({
    host: '127.0.0.1', port: PORT, user: 'postgres', password: 'postgres', database: 'app',
  })
  await db.connect()
  await migrate(db)
  await seed(db)

  const { rows } = await db.query(`SELECT id, slug FROM clients`)
  for (const r of rows) {
    idBySlug[r.slug] = r.id
    slugById[r.id] = r.slug
  }

  // golden fixture: source-ref maps the demo portfolio would have accumulated
  const maps: Array<[string, string, string]> = [
    ['portal_session', 'psn_hearts_77', 'hearts'],
    ['ac_project', 'ac_5512', 'smile-council'],
    ['gbp', 'gbp_trowse_1', 'trowse'],
    ['brightlocal', 'bl_9981', 'smile-to-go'],
    ['thread', 'th_yh_88', 'yarra-hills'],
  ]
  for (const [kind, key, slug] of maps) {
    await db.query(
      `INSERT INTO entity_maps (id, workspace_id, kind, external_key, client_id, learned_from)
       VALUES ('map_' || $1 || '_t', 'ws_2080', $1, $2, $3, 'test-fixture')`,
      [kind, key, idBySlug[slug]],
    )
  }
  // a management group whose staff email domain spans two practices
  await db.query(
    `INSERT INTO contacts (id, workspace_id, client_id, name, email, role)
     VALUES
       ('ct_grp_sc', 'ws_2080', $1, 'Group Admin (SC)', ARRAY['sc-admin@dentalgroupvic.com.au','billing@dentalgroupvic.com.au'], 'billing'),
       ('ct_grp_tr', 'ws_2080', $2, 'Group Admin (TR)', ARRAY['tr-admin@dentalgroupvic.com.au','billing@dentalgroupvic.com.au'], 'billing')`,
    [idBySlug['smile-council'], idBySlug['trowse']],
  )
}, 180_000)

afterAll(async () => {
  await db?.end()
  await server?.stop()
  try { rmSync(dataDir, { recursive: true, force: true }) } catch { /* win file locks */ }
}, 60_000)

describe('entity matcher golden set (SPEC-SPINE §3/§7)', () => {
  it('routes ≥95% of the 30-event golden set correctly', async () => {
    const failures: string[] = []
    for (const gc of GOLDEN.cases) {
      const result = await matchInbound(db, gc.refs)
      let ok = result.decision === gc.expect.decision
      if (ok && gc.expect.client && result.decision === 'auto') {
        ok = slugById[result.clientId] === gc.expect.client
      }
      if (ok && gc.expect.method && result.decision !== 'prospect') {
        ok = result.method === gc.expect.method
      }
      if (ok && gc.expect.candidates != null && result.decision === 'queue') {
        ok = result.candidates.length === gc.expect.candidates
      }
      if (!ok) failures.push(`${gc.name}: expected ${JSON.stringify(gc.expect)}, got ${JSON.stringify(result)}`)
    }
    expect(GOLDEN.cases.length).toBe(30)
    expect(failures, failures.join('\n')).toHaveLength(0) // 30/30 — DoD floor is ≥29
  })

  it('everything under 0.8 goes to the queue, never auto', async () => {
    for (const gc of GOLDEN.cases) {
      const result = await matchInbound(db, gc.refs)
      if (result.decision === 'auto') expect(result.confidence).toBeGreaterThanOrEqual(0.8)
      if (result.decision === 'queue') expect(result.confidence).toBeLessThan(0.8)
    }
  })

  it('a shared domain queues with both candidates instead of guessing', async () => {
    const result = await matchInbound(db, { emailFrom: 'practice@dentalgroupvic.com.au' })
    expect(result.decision).toBe('queue')
    if (result.decision !== 'queue') throw new Error('unreachable')
    const slugs = result.candidates.map((c) => slugById[c.clientId]).sort()
    expect(slugs).toEqual(['smile-council', 'trowse'])
  })
})

describe('ingest + timeline', () => {
  it('auto-attaches to the timeline and learns the thread', async () => {
    const outcome = await ingestEvent(
      db,
      { emailFrom: 'karen@heartsdental.com.au', threadId: 'gm_thread_new_450' },
      { ...NOTE, title: 'Karen: parking update for the site' },
    )
    expect(outcome.decision).toBe('auto')
    if (outcome.decision !== 'auto') throw new Error('unreachable')
    expect(slugById[outcome.clientId]).toBe('hearts')

    const { rows: [evt] } = await db.query(
      `SELECT client_id, title, source FROM timeline_events WHERE id = $1`, [outcome.eventId])
    expect(evt.client_id).toBe(idBySlug['hearts'])
    expect(evt.title).toMatch(/parking update/)

    // a stripped reply on the same thread now matches on continuity
    const reply = await matchInbound(db, { threadId: 'gm_thread_new_450' })
    expect(reply).toMatchObject({ decision: 'auto', method: 'thread', confidence: 0.97 })
  })

  it('queue choice creates a mapping that auto-matches next time', async () => {
    const refs = { emailFrom: 'bentrowse@gmail.com', signatureName: 'Dr Ben Trowse' }
    const held = await ingestEvent(db, refs, { ...NOTE, title: 'Ben: invoice question from personal address' })
    expect(held.decision).toBe('queue')
    if (held.decision !== 'queue') throw new Error('unreachable')

    // no timeline event yet — the event is held in the queue
    const before = await db.query(
      `SELECT count(*)::int AS n FROM timeline_events WHERE title LIKE 'Ben: invoice question%'`)
    expect(before.rows[0].n).toBe(0)

    const { eventId } = await resolveMatch(db, held.queueId, idBySlug['trowse'], 'WC')
    const { rows: [evt] } = await db.query(`SELECT client_id FROM timeline_events WHERE id = $1`, [eventId])
    expect(evt.client_id).toBe(idBySlug['trowse'])

    // the matcher learned: same sender now autos at contact-email confidence
    const again = await matchInbound(db, { emailFrom: 'bentrowse@gmail.com' })
    expect(again).toMatchObject({ decision: 'auto', method: 'contact_email', confidence: 0.98 })
    if (again.decision !== 'auto') throw new Error('unreachable')
    expect(slugById[again.clientId]).toBe('trowse')

    const { rows: [audit] } = await db.query(
      `SELECT action FROM audit_log WHERE target_id = $1`, [held.queueId])
    expect(audit.action).toBe('match.resolve')
  })

  it('a resolved queue item cannot be resolved twice', async () => {
    const held = await ingestEvent(
      db,
      { emailFrom: 'practice@dentalgroupvic.com.au' },
      { ...NOTE, title: 'group admin question' },
    )
    if (held.decision !== 'queue') throw new Error('expected queue')
    await resolveMatch(db, held.queueId, idBySlug['smile-council'], 'WC')
    await expect(resolveMatch(db, held.queueId, idBySlug['trowse'], 'WC')).rejects.toThrow(/not open/)
  })

  it('prospects are held for the sales flow, not the timeline', async () => {
    const outcome = await ingestEvent(
      db,
      { emailFrom: 'newlead@gmail.com' },
      { ...NOTE, title: 'enquiry: do you build dental sites?' },
    )
    expect(outcome.decision).toBe('prospect')
    if (outcome.decision !== 'prospect') throw new Error('unreachable')
    const { rows: [row] } = await db.query(`SELECT state FROM match_queue WHERE id = $1`, [outcome.queueId])
    expect(row.state).toBe('prospect')
  })
})
