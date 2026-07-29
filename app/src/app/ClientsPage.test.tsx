import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ClientsPage } from './ClientsPage'

const LIST = [
  { id: 'c1', slug: 'smile-to-go', name: 'Smile To Go', lifecycle: 'at_risk', practice_type: 'dental', health_score: 48, languages: ['en'], enquiries_30d: 12, ads_cost_cents: 240000, open_flags: 2, site_status: 'down' },
  { id: 'c2', slug: 'hearts', name: 'Hearts Dental', lifecycle: 'operate', practice_type: 'dental', health_score: 62, languages: ['en', 'zh'], enquiries_30d: 41, ads_cost_cents: 779000, open_flags: 1, site_status: 'up' },
]
const DETAIL = {
  client: { name: 'Hearts Dental', slug: 'hearts', practice_type: 'dental', lifecycle: 'operate', health_score: 62, languages: ['en', 'zh'], timezone: 'Australia/Melbourne' },
  contacts: [{ name: 'Karen Smith', email: ['karen@heartsdental.com.au'], phone: [], role: 'practice_manager', is_vip: true }],
  timeline: [{ type: 'EMAIL', occurred_at: '2026-07-08T00:00:00Z', title: 'Bio + pricing update', body: null, source: 'gmail' }],
  flags: [{ id: 'f1', severity: 'amber', title: 'CPL up 38%', workflow: 'W3', opened_at: '2026-07-08T00:00:00Z' }],
  tasks: [],
  seo: { id: 's1', url: 'https://heartsdental.com.au', score: 76, grade: 'C', created_at: '2026-07-08T00:00:00Z' },
  site: { url: 'https://heartsdental.com.au', status: 'up', latency_ms: 420, ssl_days_left: 240, form_canary: 'ok', flags: [] },
  kpis: { enquiries: 41, ads_cost_cents: 779000, conversions: 60 },
  series: [1, 2, 3],
}

afterEach(() => vi.unstubAllGlobals())

function stub() {
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
    const path = String(url)
    if (path === '/api/clients/hearts') return { ok: true, json: async () => DETAIL }
    if (path.startsWith('/api/clients')) return { ok: true, json: async () => ({ clients: LIST }) }
    throw new Error(`unexpected ${path}`)
  }))
}

describe('ClientsPage', () => {
  it('lists the portfolio worst-health-first with enrichment', async () => {
    stub()
    render(<ClientsPage />)
    expect(await screen.findByText('Smile To Go')).toBeInTheDocument()
    expect(screen.getByText('Hearts Dental')).toBeInTheDocument()
    expect(screen.getByText('48')).toBeInTheDocument() // health
    expect(screen.getByText('41')).toBeInTheDocument() // enquiries
  })

  it('opens a client record on click', async () => {
    stub()
    const user = userEvent.setup()
    render(<ClientsPage />)
    await user.click(await screen.findByText('Hearts Dental'))
    await waitFor(() => expect(screen.getByText('Bio + pricing update')).toBeInTheDocument()) // timeline
    expect(screen.getByText('Karen Smith')).toBeInTheDocument() // contact
    expect(screen.getByText('CPL up 38%')).toBeInTheDocument() // flag
  })
})
