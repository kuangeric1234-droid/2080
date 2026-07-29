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
