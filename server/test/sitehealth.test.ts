import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { migrate } from '../src/db/migrate.ts'
import { seed } from '../src/db/seed.ts'
import { buildApp } from '../src/api.ts'
import { MockModelClient } from '../src/skills/model.ts'
import { classify, runCheck, type Probe } from '../src/sitehealth/probe.ts'
import { authed } from './helpers.ts'

const PORT = 5511
let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080sh-'))
  server = new EmbeddedPostgres({
    databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PORT,
    persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'],
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
  await server?.stop()
  try { rmSync(dataDir, { recursive: true, force: true }) } catch { /* win file locks */ }
}, 60_000)

const p = (o: Partial<Probe>): Probe => ({ httpStatus: 200, latencyMs: 300, sslDaysLeft: 200, sslExpiresAt: null, ...o })

describe('Site Health classification (§13 3.6)', () => {
  it('a healthy site is up with no flags', () => {
    expect(classify(p({}), 'ok')).toEqual({ status: 'up', flags: [] })
  })
  it('5xx and unreachable are down', () => {
    expect(classify(p({ httpStatus: 503 })).status).toBe('down')
    expect(classify(p({ httpStatus: 0, latencyMs: 10_000 })).status).toBe('down')
  })
  it('slow, expiring SSL and a failed canary degrade the site', () => {
    expect(classify(p({ latencyMs: 4000 })).status).toBe('degraded')
    expect(classify(p({ sslDaysLeft: 11 }))).toMatchObject({ status: 'degraded', flags: ['ssl_expiring'] })
    expect(classify(p({}), 'fail')).toMatchObject({ status: 'degraded', flags: ['form_canary_fail'] })
  })
  it('SSL under 30 days is a soft flag but still up', () => {
    expect(classify(p({ sslDaysLeft: 20 }))).toEqual({ status: 'up', flags: ['ssl_soon'] })
  })
})

describe('Site Health probe + API', () => {
  it('runCheck persists the probe result (injected prober)', async () => {
    const { rows: [site] } = await db.query(`SELECT id, url, form_canary FROM site_health LIMIT 1`)
    const fake: Probe = { httpStatus: 200, latencyMs: 123, sslDaysLeft: 5, sslExpiresAt: null }
    const res = await runCheck(db, site, { prober: async () => fake })
    expect(res.status).toBe('degraded') // ssl 5 days
    const { rows: [stored] } = await db.query(`SELECT status, latency_ms, ssl_days_left FROM site_health WHERE id = $1`, [site.id])
    expect(stored).toMatchObject({ status: 'degraded', latency_ms: 123, ssl_days_left: 5 })
  })

  it('GET /api/site-health lists seeded sites worst-first, and requires auth', async () => {
    const app = buildApp(db, new MockModelClient(() => ({})))
    expect((await app.request('/api/site-health')).status).toBe(401)
    const req = await authed(app)
    const body = (await (await req('/api/site-health')).json()) as { sites: Array<{ status: string; url: string }> }
    expect(body.sites.length).toBeGreaterThanOrEqual(5)
    expect(body.sites[0].status).toBe('down') // worst-first ordering
  })
})
