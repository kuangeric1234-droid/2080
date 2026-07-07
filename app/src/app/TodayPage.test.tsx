import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { TodayPage } from './TodayPage'

const TODAY = {
  tiles: [
    { label: 'New patient enquiries · portfolio (7d)', value: '97', unit: '', delta: '▲ 12 vs prior week', deltaTone: 'up', spark: [1, 2, 3] },
    { label: 'Cost per enquiry · avg (7d)', value: '$22.40', unit: '', delta: '▼ $4.10 — cheaper is better', deltaTone: 'down-good', spark: [3, 2, 1] },
    { label: 'Ads spend · portfolio (7d)', value: '$1,680', unit: '', delta: '▲ $80 vs prior week', deltaTone: 'flat', spark: [1, 2, 1] },
    { label: 'Portfolio health', value: '72', unit: '/100', delta: '3 healthy · 2 watch · 1 at-risk', deltaTone: 'down', spark: [7, 6, 7] },
  ],
  flags: [
    { id: 'flag_A', client_name: 'Yarra Hills Dental', workflow: 'W3', severity: 'red', title: 'CPA up 38% in 7 days', opened_at: new Date().toISOString(), score: 112 },
  ],
}
const GATES = { items: [] }

afterEach(() => vi.unstubAllGlobals())

function stubFetch() {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url)
    if (path.startsWith('/api/today')) return { ok: true, json: async () => TODAY }
    if (path.startsWith('/api/gate-items')) return { ok: true, json: async () => GATES }
    if (path.includes('/resolve') && init?.method === 'POST') return { ok: true, json: async () => ({ ok: true }) }
    throw new Error(`unexpected fetch ${path}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('TodayPage', () => {
  it('renders tiles, ranked flags and the empty queue state', async () => {
    stubFetch()
    render(<TodayPage />)
    expect(await screen.findByText('97')).toBeInTheDocument()
    expect(screen.getByText('Portfolio health')).toBeInTheDocument()
    expect(screen.getByText('CPA up 38% in 7 days')).toBeInTheDocument()
    expect(screen.getByText('Queue is clear.')).toBeInTheDocument()
    expect(screen.getByText('0 waiting on you')).toBeInTheDocument()
  })

  it('resolving a flag requires a reason and posts it', async () => {
    const fetchMock = stubFetch()
    const user = userEvent.setup()
    render(<TodayPage />)
    await user.click(await screen.findByRole('button', { name: 'Resolve' }))
    const confirm = screen.getByRole('button', { name: 'Confirm resolve' })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Reason' }), 'fixed the campaign')
    await user.click(confirm)
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/flags/flag_A/resolve',
        expect.objectContaining({ body: JSON.stringify({ actor: 'WC', why: 'fixed the campaign' }) }),
      ))
  })
})
