import { rmSync } from 'node:fs'
import net from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'

/* Every test file boots its own embedded Postgres. Fixed port numbers meant a
   run that was interrupted — Ctrl+C, a crash, two runs racing — left a
   postmaster holding the port, and the next run failed with "another postmaster
   already running" before a single test executed. That reads as a broken build
   when the code is fine. Ask the OS for a free port instead. */
export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo
      srv.close(() => resolve(port))
    })
  })
}

/* Shut the test Postgres down and take its data directory with it.

   `embedded-postgres` deletes the directory itself when constructed with
   `persistent: false`, and on Windows that races the postmaster's own
   shutdown: `stop()` resolves while the OS still holds handles on the data
   files, the rmdir throws EBUSY, and because the throw comes from inside
   `stop()` rather than from our own teardown, vitest reports the whole FILE as
   failed even though every assertion in it passed. A suite that goes red for a
   reason unrelated to the code stops being usable as a gate.

   So the fixtures now start persistent — embedded-postgres never tries to
   delete anything — and cleanup happens here, retrying while the handles
   drain. If it still will not go, leave it: a stale temp directory is a far
   smaller problem than a false red, and this warns rather than hides. */
export async function stopPg(server: { stop(): Promise<unknown> } | undefined, dataDir: string) {
  await server?.stop()
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      rmSync(dataDir, { recursive: true, force: true })
      return
    } catch {
      await sleep(200)
    }
  }
  console.warn(`test teardown: could not remove ${dataDir} — still locked`)
}

/* SEC.1: /api/* is gated. Tests log in once and reuse the session cookie. */
type App = { request: (path: string, init?: RequestInit) => Response | Promise<Response> }

export async function authed(app: App, email = 'wally@2080.dental', password = 'demo2080') {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]
  return (path: string, init: RequestInit = {}) =>
    app.request(path, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), cookie } })
}
