import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { migrate } from '../src/db/migrate.ts'
import { seed } from '../src/db/seed.ts'
import { buildApp } from '../src/api.ts'
import { MockModelClient } from '../src/skills/model.ts'
import { authed, freePort, stopPg } from './helpers.ts'

let PORT: number
let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string

const FIXTURE = `<!doctype html><html lang="en"><head>
  <title>Yarra Hills Dental — Dentist in Warrandyte</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head><body>
  <h1>Dentist in Warrandyte</h1><h2>Services</h2>
  <p>${'word '.repeat(120)}</p>
  <img src="a.jpg"><img src="b.jpg" alt="team">
</body></html>`

beforeAll(async () => {
  PORT = await freePort()
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080seo-'))
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
}, 180_000)

afterAll(async () => {
  await db?.end()
  await stopPg(server, dataDir)
}, 60_000)

afterEach(() => vi.unstubAllGlobals())

describe('SEO site audit (SPEC-SEO §4.2)', () => {
  it('requires auth', async () => {
    const app = buildApp(db, new MockModelClient(() => ({})))
    const res = await app.request('/api/seo/audit', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'x.test' }),
    })
    expect(res.status).toBe(401)
  })

  it('analyses a URL, stores the report, and lists it — actor from session', async () => {
    // stub the network so the test is deterministic and offline
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, url: 'https://yarrahills.test/', text: async () => FIXTURE })))
    const app = buildApp(db, new MockModelClient(() => ({})))
    const req = await authed(app) // Wally (WC)

    const res = await req('/api/seo/audit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'yarrahills.test', clientSlug: 'yarra-hills' }),
    })
    expect(res.status).toBe(200)
    const report = (await res.json()) as { id: string; score: number; grade: string; report: { categories: unknown[] } }
    expect(report.score).toBeGreaterThanOrEqual(0)
    expect(report.score).toBeLessThanOrEqual(100)
    expect(report.report.categories).toHaveLength(5)

    // persisted + audited to the logged-in user (SEC.3), not an anonymous string
    const { rows: [stored] } = await db.query(`SELECT requested_by, score FROM seo_audits WHERE id = $1`, [report.id])
    expect(stored.requested_by).toBe('WC')
    const { rows: [aud] } = await db.query(`SELECT actor_id FROM audit_log WHERE action = 'seo.audit' AND target_id = $1`, [report.id])
    expect(aud.actor_id).toBe('WC')

    // list includes the new one plus the seeded example
    const list = (await (await req('/api/seo/audits')).json()) as { audits: Array<{ id: string; grade: string }> }
    expect(list.audits.length).toBeGreaterThanOrEqual(2)
    expect(list.audits[0].id).toBe(report.id) // newest first

    // fetch one back with full report
    const one = (await (await req(`/api/seo/audit/${report.id}`)).json()) as { report: { stats: { wordCount: number } } }
    expect(one.report.stats.wordCount).toBeGreaterThan(100)
  })

  it('rejects a blank url', async () => {
    const app = buildApp(db, new MockModelClient(() => ({})))
    const req = await authed(app)
    const res = await req('/api/seo/audit', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: '' }),
    })
    expect(res.status).toBe(400)
  })
})
