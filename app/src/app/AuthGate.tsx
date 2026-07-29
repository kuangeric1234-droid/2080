import { useEffect, useState } from 'react'
import { LoginPage } from './LoginPage'

type State = { kind: 'loading' } | { kind: 'anon' } | { kind: 'authed' }

/* SEC.1: gate the whole dashboard behind a session. Mounted in main.tsx only,
   so component/shell tests that render pages directly are unaffected. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let live = true
    fetch('/api/auth/me')
      .then((r) => { if (live) setState({ kind: r.ok ? 'authed' : 'anon' }) })
      .catch(() => { if (live) setState({ kind: 'anon' }) })
    return () => { live = false }
  }, [])

  if (state.kind === 'loading') return null
  if (state.kind === 'anon') return <LoginPage onSuccess={() => setState({ kind: 'authed' })} />
  return <>{children}</>
}
