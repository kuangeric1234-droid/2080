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

const PORT = 5508
let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080au-'))
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

const login = (app: ReturnType<typeof buildApp>, email = 'wally@2080.dental', password = 'demo2080') =>
  app.request('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

describe('SEC.1 auth foundation (SPEC-SECURITY §1)', () => {
  it('protected routes 401 without a session; login issues an httpOnly cookie that authorizes them', async () => {
    const app = buildApp(db, new MockModelClient(() => ({})))

    // no cookie → 401
    expect((await app.request('/api/today')).status).toBe(401)
    expect((await app.request('/api/notifications?user=usr_wally')).status).toBe(401)

    // health + login stay public
    expect((await app.request('/api/health')).status).toBe(200)

    const bad = await login(app, 'wally@2080.dental', 'wrong')
    expect(bad.status).toBe(401)

    const res = await login(app)
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toMatch(/^sid=/)
    expect(setCookie.toLowerCase()).toContain('httponly')
    expect(setCookie).toContain('SameSite=Lax')
    const cookie = setCookie.split(';')[0]

    // with the cookie → 200 and the principal is the logged-in user
    const ok = await app.request('/api/today', { headers: { cookie } })
    expect(ok.status).toBe(200)
    const me = await app.request('/api/auth/me', { headers: { cookie } })
    expect(((await me.json()) as { user: { role: string } }).user.role).toBe('owner')
  })

  it('logout revokes the session — the same cookie stops working', async () => {
    const app = buildApp(db, new MockModelClient(() => ({})))
    const res = await login(app)
    const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]
    expect((await app.request('/api/today', { headers: { cookie } })).status).toBe(200)

    const out = await app.request('/api/auth/logout', { method: 'POST', headers: { cookie } })
    expect(out.status).toBe(200)
    expect((await app.request('/api/today', { headers: { cookie } })).status).toBe(401)
  })

  it('an unknown email is refused', async () => {
    const app = buildApp(db, new MockModelClient(() => ({})))
    expect((await login(app, 'nobody@example.com', 'demo2080')).status).toBe(401)
  })
})
