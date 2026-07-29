import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AuthGate } from './AuthGate'

afterEach(() => vi.unstubAllGlobals())

describe('AuthGate (SEC.1 dashboard login gate)', () => {
  it('shows the login form when the session check returns 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })))
    render(<AuthGate><div>DASHBOARD</div></AuthGate>)
    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument()
  })

  it('renders the app when the session is valid', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ user: { role: 'owner' } }) })))
    render(<AuthGate><div>DASHBOARD</div></AuthGate>)
    expect(await screen.findByText('DASHBOARD')).toBeInTheDocument()
  })

  it('signing in with valid credentials reveals the dashboard', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const path = String(url)
      if (path.endsWith('/api/auth/me')) return { ok: false, status: 401, json: async () => ({}) }
      if (path.endsWith('/api/auth/login')) return { ok: true, status: 200, json: async () => ({ user: { role: 'owner' } }) }
      throw new Error(`unexpected ${path}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<AuthGate><div>DASHBOARD</div></AuthGate>)

    await user.type(await screen.findByLabelText('Email'), 'wally@2080.dental')
    await user.type(screen.getByLabelText('Password'), 'demo2080')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST' }))
  })
})
