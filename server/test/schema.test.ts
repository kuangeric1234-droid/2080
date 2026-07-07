import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { migrate } from '../src/db/migrate.ts'
import { seed, WORKSPACE_ID } from '../src/db/seed.ts'

const PORT = 5497
let server: EmbeddedPostgres
let client: pg.Client
let dataDir: string

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080-'))
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
  client = new pg.Client({
    host: '127.0.0.1', port: PORT, user: 'postgres', password: 'postgres', database: 'app',
  })
  await client.connect()
  await migrate(client)
  await seed(client)
}, 180_000)

afterAll(async () => {
  await client?.end()
  await server?.stop()
  try { rmSync(dataDir, { recursive: true, force: true }) } catch { /* win file locks */ }
}, 60_000)

describe('spine schema (SPEC-SPINE §7)', () => {
  it('every table carries a NOT NULL workspace_id', async () => {
    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name <> 'schema_migrations'`)
    expect(tables.length).toBeGreaterThanOrEqual(16)
    for (const { table_name } of tables) {
      const { rows } = await client.query(
        `SELECT is_nullable FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'workspace_id'`,
        [table_name],
      )
      expect(rows, `${table_name} is missing workspace_id`).toHaveLength(1)
      expect(rows[0].is_nullable, `${table_name}.workspace_id must be NOT NULL`).toBe('NO')
    }
  })

  it('rejects an insert without workspace_id', async () => {
    await expect(
      client.query(
        `INSERT INTO clients (id, slug, name, practice_type) VALUES ('cl_x', 'x', 'X', 'dental')`,
      ),
    ).rejects.toMatchObject({ code: '23502' }) // not_null_violation
  })

  it('timeline is append-only for the app role (UPDATE and DELETE revoked)', async () => {
    await client.query('SET ROLE app_user')
    try {
      await expect(
        client.query(`UPDATE timeline_events SET title = 'tampered'`),
      ).rejects.toMatchObject({ code: '42501' }) // insufficient_privilege
      await expect(
        client.query(`DELETE FROM timeline_events`),
      ).rejects.toMatchObject({ code: '42501' })
      // …but INSERT stays open
      const { rows } = await client.query(
        `SELECT id, client_id FROM timeline_events LIMIT 1`,
      )
      await client.query(
        `INSERT INTO timeline_events (id, workspace_id, client_id, type, occurred_at, title, source)
         VALUES ('evt_role_test', $1, $2, 'NOTE', now(), 'app role can append', 'manual')`,
        [WORKSPACE_ID, rows[0].client_id],
      )
    } finally {
      await client.query('RESET ROLE')
    }
  })

  it('audit_log is append-only for the app role', async () => {
    await client.query('SET ROLE app_user')
    try {
      await expect(
        client.query(`UPDATE audit_log SET why = 'rewritten history'`),
      ).rejects.toMatchObject({ code: '42501' })
      await expect(client.query(`DELETE FROM audit_log`)).rejects.toMatchObject({ code: '42501' })
    } finally {
      await client.query('RESET ROLE')
    }
  })

  it('tasks must have exactly one source', async () => {
    const { rows } = await client.query(`SELECT id, client_id FROM requests LIMIT 1`)
    // zero sources
    await expect(
      client.query(
        `INSERT INTO tasks (id, workspace_id, client_id, title) VALUES ('task_x0', $1, $2, 'orphan')`,
        [WORKSPACE_ID, rows[0].client_id],
      ),
    ).rejects.toMatchObject({ code: '23514' }) // check_violation
    // two sources
    await expect(
      client.query(
        `INSERT INTO tasks (id, workspace_id, client_id, title, source_request_id, source_meeting_id)
         VALUES ('task_x2', $1, $2, 'double', $3, 'mtg_x')`,
        [WORKSPACE_ID, rows[0].client_id, rows[0].id],
      ),
    ).rejects.toMatchObject({ code: '23514' })
  })
})

describe('demo portfolio seed (§13 1.2 DoD)', () => {
  it('seeds the six demo practices', async () => {
    const { rows } = await client.query(`SELECT slug FROM clients ORDER BY slug`)
    expect(rows.map((r) => r.slug)).toEqual([
      'aspire-one', 'hearts', 'smile-council', 'smile-to-go', 'trowse', 'yarra-hills',
    ])
  })

  it('every practice has at least one portal contact', async () => {
    const { rows } = await client.query(`
      SELECT c.slug, count(ct.id)::int AS n
      FROM clients c LEFT JOIN contacts ct ON ct.client_id = c.id
      GROUP BY c.slug`)
    for (const r of rows) expect(r.n, `${r.slug} has no contacts`).toBeGreaterThanOrEqual(1)
  })

  it('the Hearts double-request is split into two requests with linked tasks', async () => {
    const { rows } = await client.query(`
      SELECT r.id, r.task_ids FROM requests r
      JOIN clients c ON c.id = r.client_id
      WHERE c.slug = 'hearts' AND r.thread_id = 'gm_thread_hearts_0707'`)
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      expect(r.task_ids).toHaveLength(1)
      const { rows: t } = await client.query(
        `SELECT source_request_id FROM tasks WHERE id = $1`, [r.task_ids[0]],
      )
      expect(t[0].source_request_id).toBe(r.id)
    }
  })

  it('holds 30 days of monitor metrics for the ads clients', async () => {
    const { rows } = await client.query(`
      SELECT count(DISTINCT date)::int AS days FROM metrics_daily m
      JOIN clients c ON c.id = m.client_id
      WHERE c.slug = 'yarra-hills' AND m.source = 'ads' AND m.metric = 'cost_cents'`)
    expect(rows[0].days).toBe(30)
  })

  it('sync_status reports honestly — Smile To Go SEO is stale', async () => {
    const { rows } = await client.query(`
      SELECT state, detail FROM sync_status s
      JOIN clients c ON c.id = s.client_id
      WHERE c.slug = 'smile-to-go' AND s.source = 'seo'`)
    expect(rows[0].state).toBe('stale')
    expect(rows[0].detail).toBeTruthy()
    const { rows: ok } = await client.query(
      `SELECT count(*)::int AS n FROM sync_status WHERE state = 'ok'`)
    expect(ok[0].n).toBe(23) // 6 clients × 4 sources − 1 stale
  })

  it('reseeding is idempotent', async () => {
    await seed(client)
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM clients`)
    expect(rows[0].n).toBe(6)
  })
})
