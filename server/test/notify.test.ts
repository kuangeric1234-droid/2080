import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { migrate } from '../src/db/migrate.ts'
import { seed } from '../src/db/seed.ts'
import { ack, escalate, listForUser, MATRIX, route, routingView, updatePrefs } from '../src/notify.ts'
import { buildApp } from '../src/api.ts'
import { MockModelClient } from '../src/skills/model.ts'

const PORT = 5507
let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080n-'))
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

const at = (hour: number) => { const d = new Date(); d.setHours(hour, 0, 0, 0); return d }

describe('notification routing (SPEC-SPINE §5)', () => {
  it('red bypasses quiet hours; a non-red at the same hour is suppressed to digest', async () => {
    // Wally's quiet hours are 21:00–07:00. 02:00 is inside them.
    const red = await route(db, {
      event_class: 'receptionist', severity: 'red', roles: ['owner'],
      title: 'Emergency — Trowse', coalesce_key: null,
    }, { now: at(2) })
    const wallyRed = red.find((r) => r.user_id === 'usr_wally')!
    // receptionist red = slack_dm + sms + push, all immediate — red keeps them all
    expect(wallyRed.channels).toEqual(MATRIX.receptionist.red)
    expect(wallyRed.channels).toContain('sms')

    const amber = await route(db, {
      event_class: 'receptionist', severity: 'amber', roles: ['owner'],
      title: 'After-hours voicemail — Trowse', coalesce_key: null,
    }, { now: at(2) })
    const wallyAmber = amber.find((r) => r.user_id === 'usr_wally')!
    // receptionist amber = slack_channel (immediate) → dropped in quiet hours → digest fallback
    expect(wallyAmber.channels).toEqual(['digest'])
  })

  it('coalesces five same-key events within the window into one with count 5', async () => {
    const now = at(10) // outside quiet hours
    const key = 'ads-cpl-yarra-hills'
    for (let i = 0; i < 5; i++) {
      await route(db, {
        event_class: 'monitor', severity: 'amber', roles: ['owner'],
        title: 'CPL still red — Yarra Hills', coalesce_key: key,
      }, { now })
    }
    const { rows } = await db.query(
      `SELECT count, channels_sent FROM notifications WHERE user_id = 'usr_wally' AND coalesce_key = $1`,
      [key],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].count).toBe(5)
  })

  it('a red left unacked past 30 minutes escalates to the next channel up', async () => {
    const old = new Date(Date.now() - 31 * 60_000)
    const [made] = await route(db, {
      event_class: 'gate', severity: 'red', roles: ['owner'],
      title: 'Tier C approval waiting', coalesce_key: null,
    }, { now: old })
    // gate red = slack_dm + in_app
    const n = await escalate(db, { now: new Date() })
    expect(n).toBeGreaterThanOrEqual(1)
    const { rows: [row] } = await db.query(
      `SELECT channels_sent, escalated_at FROM notifications WHERE id = $1`, [made.id])
    expect(row.escalated_at).not.toBeNull()
    expect(row.channels_sent).toContain('sms') // one rung above slack_dm
    // a second escalate pass does not re-escalate the same one
    expect(await escalate(db, { now: new Date() })).toBe(0)
  })

  it('per-user routing: a muted class silences that user but not the others', async () => {
    await updatePrefs(db, 'usr_hamza', { muted_classes: ['monitor'] })
    const made = await route(db, {
      event_class: 'monitor', severity: 'amber', roles: ['owner', 'seo'],
      title: 'Impression share lost — Smile Council', coalesce_key: null,
    }, { now: at(10) })
    expect(made.some((r) => r.user_id === 'usr_wally')).toBe(true)
    expect(made.some((r) => r.user_id === 'usr_hamza')).toBe(false)
    await updatePrefs(db, 'usr_hamza', { muted_classes: [] }) // restore
  })
})

describe('notification center + routing view', () => {
  it('lists a user feed unread-first and acks (409 on double-ack)', async () => {
    const before = await listForUser(db, 'usr_wally')
    expect(before.unread).toBeGreaterThan(0)
    const unreadTop = before.notifications.find((n) => n.read_at === null)!
    await ack(db, unreadTop.id, 'WC')
    const after = await listForUser(db, 'usr_wally')
    expect(after.unread).toBe(before.unread - 1)
    await expect(ack(db, unreadTop.id, 'WC')).rejects.toThrow(/already acknowledged/)
    // the ack is on the audit trail
    const { rows: [aud] } = await db.query(
      `SELECT action, actor_id FROM audit_log WHERE target_id = $1 AND action = 'notification.ack'`,
      [unreadTop.id])
    expect(aud).toMatchObject({ action: 'notification.ack', actor_id: 'WC' })
  })

  it('routing view returns the matrix and each user with prefs', async () => {
    const view = await routingView(db)
    expect(view.matrix.gate.red).toContain('slack_dm')
    expect(view.users.find((u: { role: string }) => u.role === 'owner')?.name).toBe('Wally Chiang')
    expect(view.digests.length).toBe(2)
  })

  it('serves the feed and ack over HTTP', async () => {
    const app = buildApp(db, new MockModelClient(() => ({})))
    const res = await app.request('/api/notifications?user=usr_ish')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { notifications: Array<{ id: string; read_at: string | null }>; unread: number }
    expect(body.unread).toBeGreaterThan(0)
    const target = body.notifications.find((n) => n.read_at === null)!
    const acked = await app.request(`/api/notifications/${target.id}/ack`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actor: 'IS' }),
    })
    expect(acked.status).toBe(200)
    const dbl = await app.request(`/api/notifications/${target.id}/ack`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actor: 'IS' }),
    })
    expect(dbl.status).toBe(409)
  })
})
