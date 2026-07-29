import pg from 'pg'
import { monotonicFactory } from 'ulid'

const ulid = monotonicFactory()
const id = (p: string) => `${p}_${ulid()}`

/* SPEC-SPINE §5 routing matrix: event class × severity → channels.
   Per-user overridable (quiet hours + muted classes below). Client-facing
   notifications are NOT this system — they are skill outputs through gates. */
export type Severity = 'red' | 'amber' | 'info'
export type EventClass = 'receptionist' | 'gate' | 'monitor' | 'sales' | 'client_activity'

export const MATRIX: Record<EventClass, Record<Severity, string[]>> = {
  receptionist: { red: ['slack_dm', 'sms', 'push'], amber: ['slack_channel'], info: ['digest'] },
  gate: { red: ['slack_dm', 'in_app'], amber: ['in_app', 'digest'], info: ['digest'] },
  monitor: { red: ['slack_channel', 'in_app'], amber: ['in_app', 'digest'], info: ['digest'] },
  sales: { red: ['in_app', 'slack_channel'], amber: ['digest'], info: ['digest'] },
  client_activity: { red: [], amber: ['in_app'], info: ['digest'] },
}

/* Default recipients (by role) when the event doesn't name its own. */
const DEFAULT_ROLES: Record<EventClass, string[]> = {
  receptionist: ['owner', 'seo', 'web'],
  gate: ['owner'],
  monitor: ['owner', 'seo'],
  sales: ['owner'],
  client_activity: ['owner'],
}

/* Channels that interrupt a person; suppressed inside quiet hours unless red. */
const IMMEDIATE = new Set(['slack_dm', 'sms', 'push', 'slack_channel', 'phone'])
/* Escalation ladder: a red left unacked climbs to the next rung. */
const LADDER = ['digest', 'in_app', 'slack_channel', 'slack_dm', 'sms', 'push', 'phone']

export interface NotifyEvent {
  event_class: EventClass
  severity: Severity
  title: string
  body?: string
  link?: string
  client_id?: string | null
  coalesce_key?: string | null
  roles?: string[] // override the default recipients
}

interface User {
  id: string
  workspace_id: string
  quiet_start: number
  quiet_end: number
  muted_classes: string[]
}

function inQuietHours(u: User, now: Date): boolean {
  const h = now.getHours()
  return u.quiet_start > u.quiet_end
    ? h >= u.quiet_start || h < u.quiet_end // wraps midnight (21→7)
    : h >= u.quiet_start && h < u.quiet_end
}

/** Route one event to its recipients, applying per-user prefs, quiet hours
    (red bypasses), and 10-minute coalescing. Returns what each recipient got. */
export async function route(
  db: pg.Client | pg.Pool,
  ev: NotifyEvent,
  opts: { now?: Date } = {},
): Promise<Array<{ user_id: string; id: string; channels: string[]; coalesced: boolean }>> {
  const now = opts.now ?? new Date()
  const base = MATRIX[ev.event_class][ev.severity]
  const roles = ev.roles ?? DEFAULT_ROLES[ev.event_class]
  const { rows: users } = await db.query<User>(
    `SELECT id, workspace_id, quiet_start, quiet_end, muted_classes FROM users WHERE role = ANY($1)`,
    [roles],
  )

  const out: Array<{ user_id: string; id: string; channels: string[]; coalesced: boolean }> = []
  for (const u of users) {
    if (u.muted_classes.includes(ev.event_class)) continue
    let channels = base
    if (ev.severity !== 'red' && inQuietHours(u, now)) {
      channels = channels.filter((c) => !IMMEDIATE.has(c))
    }
    if (channels.length === 0 && ev.severity !== 'red') channels = ['digest']

    if (ev.coalesce_key) {
      const { rows } = await db.query(
        `SELECT id FROM notifications
         WHERE user_id = $1 AND coalesce_key = $2 AND read_at IS NULL AND created_at > $3
         ORDER BY created_at DESC LIMIT 1`,
        [u.id, ev.coalesce_key, new Date(now.getTime() - 10 * 60_000)],
      )
      if (rows.length) {
        await db.query(`UPDATE notifications SET count = count + 1, created_at = $2 WHERE id = $1`,
          [rows[0].id, now])
        out.push({ user_id: u.id, id: rows[0].id, channels, coalesced: true })
        continue
      }
    }

    const nid = id('ntf')
    await db.query(
      `INSERT INTO notifications
         (id, workspace_id, user_id, event_class, severity, client_id, title, body, link, channels_sent, coalesce_key, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [nid, u.workspace_id, u.id, ev.event_class, ev.severity, ev.client_id ?? null,
        ev.title, ev.body ?? null, ev.link ?? null, JSON.stringify(channels), ev.coalesce_key ?? null, now],
    )
    out.push({ user_id: u.id, id: nid, channels, coalesced: false })
  }
  return out
}

/** Escalate red notifications left unacked past 30 minutes to the next rung. */
export async function escalate(db: pg.Client | pg.Pool, opts: { now?: Date } = {}): Promise<number> {
  const now = opts.now ?? new Date()
  const cutoff = new Date(now.getTime() - 30 * 60_000)
  const { rows } = await db.query(
    `SELECT id, channels_sent FROM notifications
     WHERE severity = 'red' AND read_at IS NULL AND escalated_at IS NULL AND created_at <= $1`,
    [cutoff],
  )
  for (const n of rows) {
    const cur: string[] = n.channels_sent ?? []
    const maxRung = cur.reduce((m, c) => Math.max(m, LADDER.indexOf(c)), -1)
    const next = LADDER[Math.min(maxRung + 1, LADDER.length - 1)]
    const channels = cur.includes(next) ? cur : [...cur, next]
    await db.query(`UPDATE notifications SET channels_sent = $2, escalated_at = $3 WHERE id = $1`,
      [n.id, JSON.stringify(channels), now])
  }
  return rows.length
}

/** The notification center feed for one user: unread first, newest first. */
export async function listForUser(db: pg.Client | pg.Pool, userId: string) {
  const { rows } = await db.query(
    `SELECT n.id, n.event_class, n.severity, n.title, n.body, n.link, n.count,
            n.channels_sent, n.read_at, n.escalated_at, n.created_at,
            cl.slug AS client_slug, cl.name AS client_name
     FROM notifications n LEFT JOIN clients cl ON cl.id = n.client_id
     WHERE n.user_id = $1
     ORDER BY (n.read_at IS NOT NULL), n.created_at DESC LIMIT 100`,
    [userId],
  )
  const unread = rows.filter((r) => r.read_at === null).length
  return { notifications: rows, unread }
}

/** Acknowledge (mark read). Idempotent-safe: refuses a second ack (409). */
export async function ack(db: pg.Client | pg.Pool, notifId: string, actor: string) {
  const { rows } = await db.query(
    `UPDATE notifications SET read_at = now(), acked_by = $2
     WHERE id = $1 AND read_at IS NULL RETURNING workspace_id, user_id`,
    [notifId, actor],
  )
  if (rows.length === 0) throw new Error('notification not found or already acknowledged')
  await db.query(
    `INSERT INTO audit_log (id, workspace_id, actor_type, actor_id, action, target_type, target_id, why)
     VALUES ($1, $2, 'human', $3, 'notification.ack', 'notification', $4, $5)`,
    [id('aud'), rows[0].workspace_id, actor, notifId, 'acknowledged'],
  )
  return { ok: true }
}

/** The routing/digests view: the matrix + each user's live preferences. */
export async function routingView(db: pg.Client | pg.Pool) {
  const { rows: users } = await db.query(
    `SELECT id, name, role, quiet_start, quiet_end, muted_classes FROM users ORDER BY
       CASE role WHEN 'owner' THEN 0 WHEN 'seo' THEN 1 WHEN 'web' THEN 2 ELSE 3 END`,
  )
  return { matrix: MATRIX, users, digests: ['06:30 daily briefing', '17:30 end-of-day'] }
}

/** Per-user routing overrides (quiet hours, muted classes). */
export async function updatePrefs(
  db: pg.Client | pg.Pool,
  userId: string,
  prefs: { quiet_start?: number; quiet_end?: number; muted_classes?: string[] },
) {
  const { rows } = await db.query(
    `UPDATE users SET
       quiet_start   = COALESCE($2, quiet_start),
       quiet_end     = COALESCE($3, quiet_end),
       muted_classes = COALESCE($4, muted_classes)
     WHERE id = $1 RETURNING id, quiet_start, quiet_end, muted_classes`,
    [userId, prefs.quiet_start ?? null, prefs.quiet_end ?? null, prefs.muted_classes ?? null],
  )
  if (rows.length === 0) throw new Error('user not found')
  return rows[0]
}
