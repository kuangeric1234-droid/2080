import tls from 'node:tls'
import pg from 'pg'

/* Site Health (§13 3.6): real uptime + latency + SSL-expiry probes. No paid API.
   form-canary is a stored signal (mocked until Stage-5 CMS forms exist to POST to). */

export interface Probe {
  httpStatus: number // 0 = unreachable
  latencyMs: number
  sslDaysLeft: number | null
  sslExpiresAt: string | null
}
export type Status = 'up' | 'degraded' | 'down'
export type Canary = 'ok' | 'fail' | 'unknown'

/** Deterministic health classification — the alert discipline lives here. */
export function classify(p: Probe, canary: Canary = 'unknown'): { status: Status; flags: string[] } {
  const flags: string[] = []
  let status: Status = 'up'
  if (p.httpStatus === 0) { status = 'down'; flags.push('unreachable') }
  else if (p.httpStatus >= 500) { status = 'down'; flags.push('http_5xx') }
  else if (p.httpStatus >= 400) { status = 'degraded'; flags.push('http_4xx') }
  if (p.latencyMs > 3000 && status !== 'down') { status = 'degraded'; flags.push('slow') }
  if (p.sslDaysLeft != null) {
    if (p.sslDaysLeft < 0) { status = 'down'; flags.push('ssl_expired') }
    else if (p.sslDaysLeft < 14) { if (status === 'up') status = 'degraded'; flags.push('ssl_expiring') }
    else if (p.sslDaysLeft < 30) { flags.push('ssl_soon') }
  }
  if (canary === 'fail') { if (status === 'up') status = 'degraded'; flags.push('form_canary_fail') }
  return { status, flags }
}

function certExpiry(host: string): Promise<{ daysLeft: number; validTo: string }> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 8000 }, () => {
      const cert = socket.getPeerCertificate()
      socket.end()
      if (!cert || !cert.valid_to) return reject(new Error('no certificate'))
      const validTo = new Date(cert.valid_to)
      resolve({ daysLeft: Math.floor((validTo.getTime() - Date.now()) / 86_400_000), validTo: validTo.toISOString() })
    })
    socket.once('error', reject)
    socket.setTimeout(8000, () => { socket.destroy(); reject(new Error('tls timeout')) })
  })
}

/** Live probe: uptime + latency (fetch) and SSL expiry (TLS), both best-effort. */
export async function probe(url: string): Promise<Probe> {
  const start = Date.now()
  let httpStatus = 0
  try {
    const res = await fetch(url, {
      redirect: 'follow', headers: { 'user-agent': '20-80-uptime/1.0' }, signal: AbortSignal.timeout(10_000),
    })
    httpStatus = res.status
    await res.text().catch(() => {})
  } catch { httpStatus = 0 }
  const latencyMs = Date.now() - start

  let sslDaysLeft: number | null = null
  let sslExpiresAt: string | null = null
  try {
    const cert = await certExpiry(new URL(url).hostname)
    sslDaysLeft = cert.daysLeft
    sslExpiresAt = cert.validTo
  } catch { /* best effort — leave null */ }
  return { httpStatus, latencyMs, sslDaysLeft, sslExpiresAt }
}

interface SiteRow { id: string; url: string; form_canary: Canary }

/** Re-probe one site and persist the result. `prober` is injectable for tests. */
export async function runCheck(
  db: pg.Client | pg.Pool,
  site: SiteRow,
  opts: { prober?: (url: string) => Promise<Probe> } = {},
) {
  const p = await (opts.prober ?? probe)(site.url)
  const { status, flags } = classify(p, site.form_canary)
  await db.query(
    `UPDATE site_health SET http_status = $2, latency_ms = $3, ssl_days_left = $4, ssl_expires_at = $5,
            status = $6, flags = $7, checked_at = now()
     WHERE id = $1`,
    [site.id, p.httpStatus, p.latencyMs, p.sslDaysLeft, p.sslExpiresAt, status, JSON.stringify(flags)],
  )
  return { id: site.id, url: site.url, status, flags, ...p }
}
