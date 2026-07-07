import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { migrate } from '../src/db/migrate.ts'
import { seed } from '../src/db/seed.ts'
import { loadSkill } from '../src/skills/loader.ts'
import { MockModelClient, costCents } from '../src/skills/model.ts'
import { runSkill } from '../src/skills/runner.ts'
import { approve, reject, graduationStreak, inputHash } from '../src/skills/gates.ts'
import { buildApp } from '../src/api.ts'

const PORT = 5498
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/skills')

let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string
let heartsId: string

const helloMock = new MockModelClient((req) => {
  const input = req.input as { name: string; lifecycle: string }
  return {
    note_title: `${input.name} is on the platform`,
    note_body: `${input.name} is now live. Current stage: ${input.lifecycle}.`,
  }
})

const heartsInput = { name: 'Hearts Dental', slug: 'hearts', lifecycle: 'operate' }

async function runHello() {
  return runSkill(db, helloMock, {
    skill: 'hello-world',
    clientId: heartsId,
    trigger: 'test',
    input: heartsInput,
  })
}

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080s-'))
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
  const { rows } = await db.query(`SELECT id FROM clients WHERE slug = 'hearts'`)
  heartsId = rows[0].id
}, 180_000)

afterAll(async () => {
  await db?.end()
  await server?.stop()
  try { rmSync(dataDir, { recursive: true, force: true }) } catch { /* win file locks */ }
}, 60_000)

describe('skill loader', () => {
  it('loads hello-world with prompt, schema and gate config', () => {
    const def = loadSkill('hello-world')
    expect(def.version).toBe('v1')
    expect(def.gate).toBe('G2')
    expect(def.modelTier).toBe('fast')
    expect(def.action).toBe('timeline.note')
    expect(def.systemPrompt).toContain('House rules')
    expect(def.outputSchema).toHaveProperty('required')
  })

  it('rejects an unknown version', () => {
    expect(() => loadSkill('hello-world', 'v99')).toThrow()
  })
})

describe('skill runner (G2)', () => {
  it('runs, logs and creates a pending gate item with the frozen payload', async () => {
    const outcome = await runHello()
    expect(outcome.error).toBeNull()
    expect(outcome.gateItemId).not.toBeNull()
    expect(outcome.executed).toBeNull() // G2 must not act before approval

    const { rows: [run] } = await db.query(`SELECT * FROM skill_runs WHERE id = $1`, [outcome.runId])
    expect(run.skill).toBe('hello-world')
    expect(run.version).toBe('v1')
    expect(run.gate).toBe('G2')
    expect(run.gate_outcome).toBeNull()
    expect(run.input_hash).toBe(inputHash(heartsInput))
    expect(run.tokens_in).toBeGreaterThan(0)
    expect(run.tokens_out).toBeGreaterThan(0)
    expect(run.cost_cents).toBeGreaterThanOrEqual(1)
    expect(run.latency_ms).toBeGreaterThanOrEqual(0)

    const { rows: [item] } = await db.query(`SELECT * FROM gate_items WHERE id = $1`, [outcome.gateItemId])
    expect(item.state).toBe('pending')
    expect(item.gate).toBe('G2')
    expect(item.payload.kind).toBe('timeline.note')
    expect(item.payload.data.note_title).toBe('Hearts Dental is on the platform')
    expect(item.expires_at).not.toBeNull()
  })

  it('records invalid structured output as an error, creates no gate item', async () => {
    const badMock = new MockModelClient(() => ({ wrong_shape: true }))
    const outcome = await runSkill(db, badMock, {
      skill: 'hello-world', clientId: heartsId, trigger: 'test', input: heartsInput,
    })
    expect(outcome.error).toMatch(/schema validation/)
    expect(outcome.gateItemId).toBeNull()
    const { rows: [run] } = await db.query(`SELECT error, output FROM skill_runs WHERE id = $1`, [outcome.runId])
    expect(run.error).toMatch(/schema validation/)
    expect(run.output).toBeNull()
  })
})

describe('gate framework (SPEC-SPINE §4)', () => {
  it('approve executes exactly the frozen payload and audits it', async () => {
    const { gateItemId } = await runHello()
    const { rows: [stored] } = await db.query(`SELECT payload FROM gate_items WHERE id = $1`, [gateItemId])

    const decision = await approve(db, gateItemId!, 'WC')
    expect(decision.outcome).toBe('executed')
    if (decision.outcome !== 'executed') throw new Error('unreachable')

    // the executed timeline event carries the frozen payload byte-for-byte
    const { rows: [evt] } = await db.query(
      `SELECT title, body, source FROM timeline_events WHERE id = $1`, [decision.result.targetId])
    expect(evt.title).toBe(stored.payload.data.note_title)
    expect(evt.body).toBe(stored.payload.data.note_body)
    expect(evt.source).toBe('skill')

    const { rows: [item] } = await db.query(`SELECT state, acted_by FROM gate_items WHERE id = $1`, [gateItemId])
    expect(item.state).toBe('approved')
    expect(item.acted_by).toBe('WC')

    const { rows: audits } = await db.query(
      `SELECT action FROM audit_log WHERE target_id IN ($1, $2) ORDER BY at`,
      [gateItemId, decision.result.targetId])
    expect(audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(['gate.approve', 'timeline.note.execute']))
  })

  it('input drift invalidates instead of executing', async () => {
    const { gateItemId } = await runHello()
    const drifted = inputHash({ ...heartsInput, lifecycle: 'at_risk' })
    const decision = await approve(db, gateItemId!, 'WC', { currentInputHash: drifted })
    expect(decision.outcome).toBe('invalidated')
    const { rows: [item] } = await db.query(`SELECT state FROM gate_items WHERE id = $1`, [gateItemId])
    expect(item.state).toBe('expired')
  })

  it('expired items refuse to execute', async () => {
    const { gateItemId } = await runHello()
    await db.query(`UPDATE gate_items SET expires_at = now() - interval '1 hour' WHERE id = $1`, [gateItemId])
    const decision = await approve(db, gateItemId!, 'WC')
    expect(decision.outcome).toBe('expired')
  })

  it('reject writes the precision ledger', async () => {
    const { gateItemId, runId } = await runHello()
    await reject(db, gateItemId!, 'WC', 'tone is off for this practice')
    const { rows: [pl] } = await db.query(`SELECT outcome, diff FROM precision_ledger WHERE skill_run_id = $1`, [runId])
    expect(pl.outcome).toBe('rejected')
    expect(pl.diff.reason).toMatch(/tone/)
  })

  it('edited approval executes the edit, records the diff and the ledger', async () => {
    const { gateItemId, runId } = await runHello()
    const { rows: [stored] } = await db.query(`SELECT payload FROM gate_items WHERE id = $1`, [gateItemId])
    const edited = {
      ...stored.payload,
      data: { ...stored.payload.data, note_title: 'Hearts Dental joins the platform' },
    }
    const decision = await approve(db, gateItemId!, 'WC', { editedPayload: edited })
    expect(decision.outcome).toBe('executed')
    if (decision.outcome !== 'executed') throw new Error('unreachable')

    const { rows: [evt] } = await db.query(`SELECT title FROM timeline_events WHERE id = $1`, [decision.result.targetId])
    expect(evt.title).toBe('Hearts Dental joins the platform')

    const { rows: [item] } = await db.query(`SELECT state, diff FROM gate_items WHERE id = $1`, [gateItemId])
    expect(item.state).toBe('edited')
    expect(item.diff.before.data.note_title).toBe('Hearts Dental is on the platform')
    expect(item.diff.after.data.note_title).toBe('Hearts Dental joins the platform')

    const { rows: [pl] } = await db.query(`SELECT outcome FROM precision_ledger WHERE skill_run_id = $1`, [runId])
    expect(pl.outcome).toBe('edited')
  })

  it('G1 executes immediately and records an auto gate item', async () => {
    const outcome = await runSkill(db, helloMock, {
      skill: 'auto-note', clientId: heartsId, trigger: 'test', input: heartsInput,
      skillsDir: FIXTURES,
    })
    expect(outcome.executed).not.toBeNull()
    const { rows: [item] } = await db.query(`SELECT state FROM gate_items WHERE id = $1`, [outcome.gateItemId])
    expect(item.state).toBe('auto')
    const { rows: [run] } = await db.query(`SELECT gate_outcome FROM skill_runs WHERE id = $1`, [outcome.runId])
    expect(run.gate_outcome).toBe('auto')
  })

  it('graduation streak counts consecutive approved-unedited and resets on edit', async () => {
    // a fresh client isolates the streak from earlier tests
    await db.query(
      `INSERT INTO clients (id, workspace_id, slug, name, practice_type) VALUES ('cl_streak', 'ws_2080', 'streaky', 'Streak Dental', 'dental')`)
    const run = () => runSkill(db, helloMock, {
      skill: 'hello-world', clientId: 'cl_streak', trigger: 'test', input: heartsInput,
    })
    const a = await run(); await approve(db, a.gateItemId!, 'WC')
    const b = await run(); await approve(db, b.gateItemId!, 'WC')
    expect(await graduationStreak(db, 'cl_streak', 'hello-world')).toBe(2)
    const c = await run()
    const { rows: [stored] } = await db.query(`SELECT payload FROM gate_items WHERE id = $1`, [c.gateItemId])
    await approve(db, c.gateItemId!, 'WC', {
      editedPayload: { ...stored.payload, data: { ...stored.payload.data, note_title: 'edited' } },
    })
    expect(await graduationStreak(db, 'cl_streak', 'hello-world')).toBe(0)
  })
})

describe('api', () => {
  it('lists pending gate items with client context and approves via HTTP', async () => {
    const app = buildApp(db, helloMock)
    const runRes = await app.request('/api/skills/hello-world/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientSlug: 'hearts', trigger: 'api-test' }),
    })
    expect(runRes.status).toBe(200)
    const { gateItemId } = (await runRes.json()) as { gateItemId: string }

    const listRes = await app.request('/api/gate-items?state=pending')
    const { items } = (await listRes.json()) as { items: Array<Record<string, string>> }
    const item = items.find((i) => i.id === gateItemId)
    expect(item).toBeDefined()
    expect(item?.client_slug).toBe('hearts')
    expect(item?.skill).toBe('hello-world')

    const approveRes = await app.request(`/api/gate-items/${gateItemId}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'WC' }),
    })
    expect(approveRes.status).toBe(200)
    const decision = (await approveRes.json()) as { outcome: string }
    expect(decision.outcome).toBe('executed')

    // double-approve conflicts
    const again = await app.request(`/api/gate-items/${gateItemId}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'WC' }),
    })
    expect(again.status).toBe(409)
  })
})
