import net from 'node:net'

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
