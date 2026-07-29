import { useState } from 'react'
import { Button } from '@/components/ui/button'

/* SEC.1 dashboard login gate. Agency users sign in with email + password;
   the server sets an httpOnly session cookie (TOTP 2FA arrives with SEC.2). */
export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        setError('That email and password don’t match.')
        setBusy(false)
        return
      }
      onSuccess()
    } catch {
      setError('Can’t reach the server — start the API with npm run api in server/.')
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4">
      <form onSubmit={submit} className="w-full max-w-[360px] rounded-[16px] border border-line bg-surface p-7 shadow-card">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex size-[34px] items-center justify-center rounded-[9px] bg-gradient-to-br from-teal to-teal-deep font-display text-[11px] font-bold text-white">
            20·80
          </div>
          <div className="font-display text-[15px] font-[650]">
            20-80 <span className="font-normal text-ink-muted">Platform</span>
          </div>
        </div>
        <h1 className="font-display text-lg font-bold tracking-[-0.3px]">Sign in</h1>
        <p className="mt-1 mb-5 text-[12.5px] text-ink-muted">Agency dashboard access.</p>

        <label className="mb-1 block text-[12px] font-semibold" htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          aria-label="Email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none focus:border-teal"
          autoFocus
          required
        />

        <label className="mt-3 mb-1 block text-[12px] font-semibold" htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          aria-label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none focus:border-teal"
          required
        />

        {error && <p className="mt-3 text-[12px] text-crit">{error}</p>}

        <Button type="submit" disabled={busy} className="mt-5 w-full justify-center">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
