import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { NotificationsPage } from './NotificationsPage'

const FEED = {
  notifications: [
    {
      id: 'ntf_1', event_class: 'gate', severity: 'red', title: 'Ack draft waiting — Hearts Dental',
      body: 'email-triage drafted an acknowledgement.', count: 1, channels_sent: ['slack_dm', 'in_app'],
      read_at: null, escalated_at: null, created_at: '2026-07-08T08:00:00Z', client_name: 'Hearts Dental',
    },
    {
      id: 'ntf_2', event_class: 'monitor', severity: 'amber', title: 'CPL red 5 days — Yarra Hills',
      body: null, count: 3, channels_sent: ['in_app', 'digest'],
      read_at: null, escalated_at: null, created_at: '2026-07-08T07:00:00Z', client_name: 'Yarra Hills',
    },
  ],
  unread: 2,
}

const ROUTING = {
  matrix: { gate: { red: ['slack_dm', 'in_app'], amber: ['in_app', 'digest'], info: ['digest'] } },
  users: [
    { id: 'usr_wally', name: 'Wally Chiang', role: 'owner', quiet_start: 21, quiet_end: 7, muted_classes: [] },
    { id: 'usr_hamza', name: 'Hamza', role: 'seo', quiet_start: 22, quiet_end: 7, muted_classes: ['monitor'] },
  ],
  digests: ['06:30 daily briefing', '17:30 end-of-day'],
}

afterEach(() => vi.unstubAllGlobals())

function stubFetch() {
  const fetchMock = vi.fn(async (url: string | URL | Request, opts?: { method?: string }) => {
    const path = String(url)
    if (path.includes('/ack')) return { ok: true, json: async () => ({ ok: true }) }
    if (path.startsWith('/api/notifications/routing')) return { ok: true, json: async () => ROUTING }
    if (path.startsWith('/api/notifications')) return { ok: true, json: async () => FEED }
    throw new Error(`unexpected fetch ${path} ${opts?.method ?? ''}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('NotificationsPage', () => {
  it('renders the feed, coalesce count, and the routing matrix', async () => {
    stubFetch()
    render(<NotificationsPage />)
    expect(await screen.findByText('Ack draft waiting — Hearts Dental')).toBeInTheDocument()
    expect(screen.getByText('×3')).toBeInTheDocument() // coalesced count
    expect(screen.getByText('2 unread')).toBeInTheDocument()
    expect(screen.getByText('Routing matrix')).toBeInTheDocument()
    expect(screen.getByText(/muted: monitor/)).toBeInTheDocument() // per-user routing
  })

  it('acknowledging posts to the ack endpoint then refetches', async () => {
    const fetchMock = stubFetch()
    const user = userEvent.setup()
    render(<NotificationsPage />)
    await screen.findByText('Ack draft waiting — Hearts Dental')
    await user.click(screen.getAllByRole('button', { name: 'Acknowledge' })[0])
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/notifications/ntf_1/ack',
        expect.objectContaining({ method: 'POST' }),
      ))
  })
})
