import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { Context, Next } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import pg from 'pg'
import { monotonicFactory } from 'ulid'

const ulid = monotonicFactory()
const id = (p: string) => `${p}_${ulid()}`

/* SPEC-SECURITY §1: 12h idle / 7d absolute; httpOnly SameSite cookie. */
const IDLE_MS = 12 * 60 * 60 * 1000
const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000
export const SESSION_COOKIE = 'sid'

export interface Principal {
  sessionId: string
  userId: string
  role: string
  handle: string // audit actor identity (WC/HK/IS/QG)
  workspaceId: string
  name: string
}

/* scrypt with a per-user salt; stored as "salt:hash". */
export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`
}

export function verifyPassword(pw: string, stored: string | null): boolean {
  if (!stored) return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const known = Buffer.from(hash, 'hex')
  const calc = scryptSync(pw, salt, 32)
  return known.length === calc.length && timingSafeEqual(known, calc)
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')

interface UserRow { id: string; workspace_id: string }

export async function createSession(db: pg.Client | pg.Pool, user: UserRow): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const now = Date.now()
  await db.query(
    `INSERT INTO sessions (id, workspace_id, user_id, token_hash, idle_expires_at, absolute_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id('ses'), user.workspace_id, user.id, tokenHash(token), new Date(now + IDLE_MS), new Date(now + ABSOLUTE_MS)],
  )
  return token
}

/** Validate a cookie token; slides the idle window on success. */
export async function validateSession(db: pg.Client | pg.Pool, token: string | undefined): Promise<Principal | null> {
  if (!token) return null
  const { rows } = await db.query(
    `SELECT s.id, s.user_id, s.idle_expires_at, s.absolute_expires_at, s.revoked_at,
            u.role, u.handle, u.workspace_id, u.name
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1`,
    [tokenHash(token)],
  )
  const s = rows[0]
  if (!s || s.revoked_at) return null
  const now = new Date()
  if (now > new Date(s.absolute_expires_at) || now > new Date(s.idle_expires_at)) return null
  await db.query(`UPDATE sessions SET idle_expires_at = $2 WHERE id = $1`, [s.id, new Date(now.getTime() + IDLE_MS)])
  return { sessionId: s.id, userId: s.user_id, role: s.role, handle: s.handle, workspaceId: s.workspace_id, name: s.name }
}

export async function revokeSession(db: pg.Client | pg.Pool, token: string | undefined): Promise<void> {
  if (!token) return
  await db.query(`UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, [tokenHash(token)])
}

export function issueCookie(c: Context, token: string): void {
  /* Secure once the box is reachable from the internet: without it the session
     cookie will travel over plain http if anything ever reaches the API that
     way. Off when the request itself is http so localhost and the tailnet keep
     working — a cookie the browser refuses to store is an unusable dev setup.
     No Domain attribute on purpose: the browser only ever sees the origin it
     asked (Vercel rewrites server-side), so the cookie stays first-party. */
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'Lax', path: '/', maxAge: ABSOLUTE_MS / 1000,
    secure: new URL(c.req.url).protocol === 'https:',
  })
}

/** Hono middleware: 401 unless a valid session cookie is present. Sets `principal`. */
export function requireAuth(db: pg.Client | pg.Pool) {
  return async (c: Context<{ Variables: { principal: Principal } }>, next: Next) => {
    const principal = await validateSession(db, getCookie(c, SESSION_COOKIE))
    if (!principal) return c.json({ error: 'authentication required' }, 401)
    c.set('principal', principal)
    await next()
  }
}

/* ── Authorization (SEC.3 · SPEC-SECURITY §2 permission matrix) ─────────── */
export type Capability = 'g3.approve' | 'g2.approve' | 'settings.write' | 'billing.write' | 'client.write'

const CAPABILITIES: Record<string, Set<Capability>> = {
  owner: new Set(['g3.approve', 'g2.approve', 'settings.write', 'billing.write', 'client.write']),
  seo: new Set(['g2.approve', 'client.write']),
  web: new Set(['g2.approve', 'client.write']),
  coordinator: new Set(['g2.approve', 'client.write']),
  clinical: new Set(['client.write']), // reviewer: no approvals
}

export function can(role: string, cap: Capability): boolean {
  return CAPABILITIES[role]?.has(cap) ?? false
}

/** Hono middleware: 403 unless the session principal holds `cap`. */
export function requireCapability(cap: Capability) {
  return async (c: Context<{ Variables: { principal: Principal } }>, next: Next) => {
    if (!can(c.get('principal').role, cap)) return c.json({ error: `requires: ${cap}` }, 403)
    await next()
  }
}
