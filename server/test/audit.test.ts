import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { migrate } from '../src/db/migrate.ts'
import { seed } from '../src/db/seed.ts'
import { MockModelClient } from '../src/skills/model.ts'
import { approve, setMailSender } from '../src/skills/gates.ts'
import { mockAck, mockTriage } from '../src/inbox/mockResponders.ts'
import { MockActiveCollab, MockMailSender } from '../src/inbox/connectors.ts'
import { processInboundEmail } from '../src/inbox/pipeline.ts'
import { resolveFlag } from '../src/flags.ts'
import { resolveMatch, ingestEvent } from '../src/matcher.ts'
import { rankFlags } from '../src/flags.ts'
import { buildApp } from '../src/api.ts'

const PORT = 5502
let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string

const model = new MockModelClient((req) => {
  if (req.system.startsWith('# email-triage')) return mockTriage(req.input as Parameters<typeof mockTriage>[0])
  if (req.system.startsWith('# ack-writer')) return mockAck(req.input as Parameters<typeof mockAck>[0])
  throw new Error('unexpected skill')
})

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080a-'))
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
  setMailSender(new MockMailSender())
}, 180_000)

afterAll(async () => {
  await db?.end()
  await server?.stop()
  try { rmSync(dataDir, { recursive: true, force: true }) } catch { /* win file locks */ }
}, 60_000)

describe('audit viewer (§13 1.7)', () => {
  it('every 1.5–1.6 action family appears, filterable by client/actor/action', async () => {
    // drive one of each action through the real paths
    const mail = await processInboundEmail(db, model, { mail: new MockMailSender(), tasks: new MockActiveCollab() }, {
      messageId: 'audit_e2e_1',
      threadId: 'gm_audit_thread',
      from: 'karen@heartsdental.com.au',
      subject: 'Bio + pricing update',
      bodyText: 'Dr Sharma has a new bio (attached soon), and please update pricing on the fees page.',
    }, { mode: 'live' })
    await approve(db, mail.ackGateItemId!, 'WC') // gate.approve + email.send.execute

    const flags = await rankFlags(db)
    await resolveFlag(db, flags[0].id, 'WC', 'campaign fixed') // flag.resolve

    const held = await ingestEvent(db, { emailFrom: 'practice@dentalgroupvic.com.au' }, {
      type: 'EMAIL_IN', occurredAt: new Date().toISOString(), title: 'group email',
      source: 'gmail', sourceRef: 'audit_e2e_2',
    })
    if (held.decision !== 'queue') throw new Error('expected queue')
    const { rows: [{ id: trowseId }] } = await db.query(`SELECT id FROM clients WHERE slug = 'trowse'`)
    await resolveMatch(db, held.queueId, trowseId, 'QG') // match.resolve

    const app = buildApp(db, model)
    const all = (await (await app.request('/api/audit')).json()) as {
      entries: Array<{ action: string; actor_id: string; why: string; client_slug: string | null }>
      actors: string[]
      actions: string[]
    }
    const actions = new Set(all.entries.map((e) => e.action))
    for (const expected of ['task.create', 'gate.approve', 'email.send.execute', 'flag.resolve', 'match.resolve']) {
      expect(actions, `missing ${expected}`).toContain(expected)
    }
    // every row carries an actor and a why — no anonymous, no unexplained
    for (const e of all.entries) {
      expect(e.actor_id).toBeTruthy()
      expect(e.why).toBeTruthy()
    }

    // client filter
    const hearts = (await (await app.request('/api/audit?client=hearts')).json()) as typeof all
    expect(hearts.entries.length).toBeGreaterThan(0)
    for (const e of hearts.entries) expect(e.client_slug).toBe('hearts')

    // actor filter
    const qg = (await (await app.request('/api/audit?actor=QG')).json()) as typeof all
    expect(qg.entries.length).toBeGreaterThan(0)
    for (const e of qg.entries) expect(e.actor_id).toBe('QG')

    // action-family filter (workflow lens): all gate decisions
    const gates = (await (await app.request('/api/audit?action=gate.')).json()) as typeof all
    expect(gates.entries.length).toBeGreaterThan(0)
    for (const e of gates.entries) expect(e.action.startsWith('gate.')).toBe(true)

    // facets power the filter dropdowns
    expect(all.actors).toContain('WC')
    expect(all.actions).toContain('flag.resolve')
  })

  it('the log is append-only even for the app role', async () => {
    await db.query(`SET ROLE app_user`)
    try {
      await expect(db.query(`UPDATE audit_log SET why = 'rewritten'`)).rejects.toMatchObject({ code: '42501' })
    } finally {
      await db.query(`RESET ROLE`)
    }
  })
})
