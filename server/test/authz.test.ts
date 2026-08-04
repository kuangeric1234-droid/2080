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
import { can } from '../src/auth.ts'
import { authed, freePort } from './helpers.ts'

let PORT: number
let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string

beforeAll(async () => {
  PORT = await freePort()
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080az-'))
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

describe('SEC.3 authorization (SPEC-SECURITY §2)', () => {
  it('the capability matrix matches the spec', () => {
    expect(can('owner', 'g3.approve')).toBe(true)
    expect(can('seo', 'g3.approve')).toBe(false)
    expect(can('clinical', 'g3.approve')).toBe(false)
    expect(can('seo', 'g2.approve')).toBe(true)
    expect(can('clinical', 'g2.approve')).toBe(false)
    expect(can('owner', 'settings.write')).toBe(true)
    expect(can('web', 'settings.write')).toBe(false)
  })

  it('the audit actor comes from the session, never the request body', async () => {
    const app = buildApp(db, new MockModelClient(() => ({})))
    const req = await authed(app) // logs in as Wally (WC)
    const today = (await (await req('/api/today')).json()) as { flags: Array<{ id: string }> }
    const flagId = today.flags[0].id

    // body claims a different actor — the server must ignore it
    const res = await req(`/api/flags/${flagId}/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'IMPOSTER', why: 'handled' }),
    })
    expect(res.status).toBe(200)
    const { rows: [audit] } = await db.query(
      `SELECT actor_id, actor_type FROM audit_log WHERE target_id = $1 AND action = 'flag.resolve'`, [flagId])
    expect(audit).toMatchObject({ actor_id: 'WC', actor_type: 'human' })
  })

  it('a G3 gate item is owner-only — a non-owner is refused (403), the owner is not', async () => {
    // build a G3 gate item to act on
    const runId = 'sr_g3_test'
    const itemId = 'gi_g3_test'
    const { rows: [ws] } = await db.query(`SELECT id FROM workspaces LIMIT 1`)
    await db.query(
      `INSERT INTO skill_runs (id, workspace_id, skill, version, gate)
       VALUES ($1, $2, 'complaint-router', 'v1', 'G3')`, [runId, ws.id])
    await db.query(
      `INSERT INTO gate_items (id, workspace_id, skill_run_id, gate, state, payload)
       VALUES ($1, $2, $3, 'G3', 'pending', '{}'::jsonb)`,
      [itemId, ws.id, runId],
    )

    const app = buildApp(db, new MockModelClient(() => ({})))
    const asQing = await authed(app, 'qing@2080.dental') // clinical — no g3.approve
    const denied = await asQing(`/api/gate-items/${itemId}/approve`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    })
    expect(denied.status).toBe(403)

    const asWally = await authed(app, 'wally@2080.dental') // owner
    const owner = await asWally(`/api/gate-items/${itemId}/approve`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    })
    expect(owner.status).not.toBe(403) // authorized (may 409 on the empty payload, but not forbidden)
  })
})
