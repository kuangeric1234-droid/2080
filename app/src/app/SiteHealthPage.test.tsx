import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { SiteHealthPage } from './SiteHealthPage'

const SITES = [
  { id: 's1', url: 'https://smiletogo.com.au', status: 'down', http_status: 503, latency_ms: 820, ssl_days_left: 60, form_canary: 'ok', flags: ['http_5xx'], checked_at: '2026-07-08T00:00:00Z', client_name: 'Smile To Go' },
  { id: 's2', url: 'https://yarrahills.com.au', status: 'degraded', http_status: 200, latency_ms: 610, ssl_days_left: 11, form_canary: 'ok', flags: ['ssl_expiring'], checked_at: '2026-07-08T00:00:00Z', client_name: 'Yarra Hills' },
  { id: 's3', url: 'https://heartsdental.com.au', status: 'up', http_status: 200, latency_ms: 420, ssl_days_left: 240, form_canary: 'ok', flags: [], checked_at: '2026-07-08T00:00:00Z', client_name: 'Hearts Dental' },
]

afterEach(() => vi.unstubAllGlobals())

describe('SiteHealthPage', () => {
  it('renders the fleet worst-first with statuses and SSL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ sites: SITES }) })))
    render(<SiteHealthPage />)
    expect(await screen.findByText('smiletogo.com.au')).toBeInTheDocument()
    expect(screen.getByText('Down')).toBeInTheDocument()
    expect(screen.getByText('Degraded')).toBeInTheDocument()
    expect(screen.getByText('11d')).toBeInTheDocument() // SSL expiring
    expect(screen.getByText('1/3')).toBeInTheDocument() // sites-up tile: 1 up of 3
  })

  it('re-check posts a live probe and reloads', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const path = String(url)
      if (path.includes('/check')) return { ok: true, json: async () => ({ id: 's1', status: 'up' }) }
      return { ok: true, json: async () => ({ sites: SITES }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<SiteHealthPage />)
    await screen.findByText('smiletogo.com.au')
    await user.click(screen.getAllByRole('button', { name: 'Re-check' })[0])
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/site-health/s1/check', expect.objectContaining({ method: 'POST' })))
  })
})
