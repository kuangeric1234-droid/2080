import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { migrate } from '../src/db/migrate.ts'
import { seed } from '../src/db/seed.ts'
import { rankFlags, resolveFlag, snoozeFlag, todayTiles } from '../src/flags.ts'
import { buildApp } from '../src/api.ts'
import { MockModelClient } from '../src/skills/model.ts'

const PORT = 5501
let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080t-'))
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
}, 180_000)

afterAll(async () => {
  await db?.end()
  await server?.stop()
  try { rmSync(dataDir, { recursive: true, force: true }) } catch { /* win file locks */ }
}, 60_000)

describe('flag ranking', () => {
  it('red outranks amber outranks info; at-risk clients get boosted', async () => {
    const flags = await rankFlags(db)
    expect(flags.length).toBeGreaterThanOrEqual(3)
    // seeded: red ads flag (yarra-hills), amber seo (smile-to-go, at_risk+low health), info (hearts)
    expect(flags[0].severity).toBe('red')
    expect(flags[0].client_slug).toBe('yarra-hills')
    const severities = flags.map((f) => f.severity)
    expect(severities.indexOf('red')).toBeLessThan(severities.indexOf('amber'))
    expect(severities.indexOf('amber')).toBeLessThan(severities.indexOf('info'))

    // the at-risk amber (smile-to-go: at_risk lifecycle + health 48) scores
    // above a hypothetical plain amber: verify boost arithmetic explicitly
    const amber = flags.find((f) => f.client_slug === 'smile-to-go')
    expect(amber).toBeDefined()
    expect(amber!.score).toBeGreaterThan(40 + 24 + 15) // weight + max age(24h→12) + risk boosts exceed plain amber
  })

  it('resolve mutates state and writes the audit log', async () => {
    const flags = await rankFlags(db)
    const target = flags.find((f) => f.severity === 'info')!
    await resolveFlag(db, target.id, 'WC', 'bio request completed')
    const { rows: [flag] } = await db.query(`SELECT state, resolved_at FROM flags WHERE id = $1`, [target.id])
    expect(flag.state).toBe('resolved')
    expect(flag.resolved_at).not.toBeNull()
    const { rows: [audit] } = await db.query(
      `SELECT action, actor_id, why FROM audit_log WHERE target_id = $1`, [target.id])
    expect(audit).toMatchObject({ action: 'flag.resolve', actor_id: 'WC', why: 'bio request completed' })
    // resolved flags leave the feed
    expect((await rankFlags(db)).find((f) => f.id === target.id)).toBeUndefined()
  })

  it('snooze mutates state and audits; double-acting conflicts', async () => {
    const flags = await rankFlags(db)
    const target = flags.find((f) => f.severity === 'amber')!
    await snoozeFlag(db, target.id, 'QG', 'waiting on BrightLocal export')
    const { rows: [flag] } = await db.query(`SELECT state FROM flags WHERE id = $1`, [target.id])
    expect(flag.state).toBe('snoozed')
    const { rows: [audit] } = await db.query(
      `SELECT action FROM audit_log WHERE target_id = $1`, [target.id])
    expect(audit.action).toBe('flag.snooze')
    await expect(resolveFlag(db, target.id, 'WC', 'nope')).rejects.toThrow(/not actionable/)
  })
})

describe('today tiles', () => {
  it('computes portfolio numbers from metrics_daily, never live APIs', async () => {
    const tiles = await todayTiles(db)
    expect(tiles).toHaveLength(4)

    // enquiries tile = the last 7 observed metric days
    const { rows: [expected] } = await db.query(
      `SELECT COALESCE(sum(v), 0)::int AS n FROM (
         SELECT date, sum(value) AS v FROM metrics_daily
         WHERE source = 'forms' AND metric = 'enquiries'
         GROUP BY date ORDER BY date DESC LIMIT 7) t`)
    expect(tiles[0].value).toBe(String(expected.n))
    expect(tiles[0].spark.length).toBeGreaterThan(20)

    // cost per enquiry is cost/conversions in dollars
    const { rows: [ads] } = await db.query(
      `SELECT sum(cost) AS cost, sum(conv) AS conv FROM (
         SELECT date,
                sum(value) FILTER (WHERE metric = 'cost_cents') AS cost,
                sum(value) FILTER (WHERE metric = 'conversions') AS conv
         FROM metrics_daily WHERE source = 'ads'
         GROUP BY date ORDER BY date DESC LIMIT 7) t`)
    expect(tiles[1].value).toBe(`$${(Number(ads.cost) / Number(ads.conv) / 100).toFixed(2)}`)

    // portfolio health counts the seeded 6 practices
    expect(tiles[3].delta).toMatch(/healthy · \d+ watch · \d+ at-risk/)
  })
})

describe('today api', () => {
  it('serves tiles + ranked flags + queue count; flag actions work over HTTP', async () => {
    const app = buildApp(db, new MockModelClient(() => ({})))
    const res = await app.request('/api/today')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { tiles: unknown[]; flags: Array<{ id: string }>; pendingGateItems: number }
    expect(body.tiles).toHaveLength(4)
    expect(body.pendingGateItems).toBeGreaterThanOrEqual(1) // seeded ack-writer item

    const flagId = body.flags[0].id
    const act = await app.request(`/api/flags/${flagId}/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'WC', why: 'handled in the ads change loop' }),
    })
    expect(act.status).toBe(200)
    const again = await app.request(`/api/flags/${flagId}/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'WC', why: 'again' }),
    })
    expect(again.status).toBe(409)
  })
})
