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
import { authed } from './helpers.ts'

const PORT = 5512
let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080cl-'))
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

describe('Clients CRM (§10)', () => {
  it('lists the portfolio enriched with metrics, flags and site status', async () => {
    const app = buildApp(db, new MockModelClient(() => ({})))
    expect((await app.request('/api/clients')).status).toBe(401)
    const req = await authed(app)
    const body = (await (await req('/api/clients')).json()) as { clients: Array<{ slug: string; name: string; health_score: number; enquiries_30d: number; open_flags: number; site_status: string | null }> }
    expect(body.clients.length).toBe(6) // the six seeded practices
    const hearts = body.clients.find((c) => c.slug === 'hearts')!
    expect(hearts.name).toBe('Hearts Dental')
    expect(hearts).toHaveProperty('enquiries_30d')
    expect(hearts).toHaveProperty('open_flags')
    // worst health first
    const healths = body.clients.map((c) => c.health_score).filter((h) => h != null)
    expect(healths[0]).toBeLessThanOrEqual(healths[healths.length - 1])
    // the enriched shape still carries slug+name for the audit filter
    expect(hearts.slug).toBe('hearts')
  })

  it('returns a full client record with timeline, flags, contacts and signals', async () => {
    const app = buildApp(db, new MockModelClient(() => ({})))
    const req = await authed(app)
    const d = (await (await req('/api/clients/hearts')).json()) as {
      client: { name: string }; contacts: unknown[]; timeline: unknown[]; flags: unknown[]
      kpis: { enquiries: number }; seo: { grade: string } | null; site: { status: string } | null; series: number[]
    }
    expect(d.client.name).toBe('Hearts Dental')
    expect(d.contacts.length).toBeGreaterThan(0)
    expect(d.timeline.length).toBeGreaterThan(0)
    expect(typeof d.kpis.enquiries).toBe('number')
    expect(d.seo?.grade).toBeTruthy() // seeded Hearts SEO audit
    expect(d.site?.status).toBeTruthy() // seeded Hearts site health
    expect(Array.isArray(d.series)).toBe(true)
  })

  it('404s an unknown client', async () => {
    const app = buildApp(db, new MockModelClient(() => ({})))
    const req = await authed(app)
    expect((await req('/api/clients/nope')).status).toBe(404)
  })
})
