import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { SeoPage } from './SeoPage'

const REPORT = {
  score: 72, grade: 'C',
  categories: [
    { key: 'content', label: 'Content & on-page', score: 22, max: 30, findings: [
      { id: 'title', severity: 'good', title: 'Title length is healthy', detail: '“Hearts Dental”' },
      { id: 'meta', severity: 'warning', title: 'Missing meta description', detail: 'Write a 70–155 char summary.' },
    ] },
    { key: 'technical', label: 'Technical & mobile', score: 8, max: 15, findings: [
      { id: 'viewport', severity: 'critical', title: 'No mobile viewport tag', detail: 'Add a viewport meta.' },
    ] },
  ],
  stats: { wordCount: 210 },
}
const AUDIT = { id: 'seo_1', url: 'https://heartsdental.com.au', finalUrl: 'https://heartsdental.com.au/', score: 72, grade: 'C', report: REPORT, client_name: 'Hearts Dental' }

afterEach(() => vi.unstubAllGlobals())

function stub(extra?: (path: string) => unknown) {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: { method?: string }) => {
    const path = String(url)
    const custom = extra?.(path)
    if (custom) return custom
    if (path.startsWith('/api/seo/audits')) return { ok: true, json: async () => ({ audits: [] }) }
    if (path.startsWith('/api/seo/audit') && init?.method === 'POST') return { ok: true, json: async () => AUDIT }
    throw new Error(`unexpected ${path}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('SeoPage', () => {
  it('runs an audit and renders the scored report with findings by severity', async () => {
    const fetchMock = stub()
    const user = userEvent.setup()
    render(<SeoPage />)

    await user.type(screen.getByLabelText('Website URL'), 'heartsdental.com.au')
    await user.click(screen.getByRole('button', { name: 'Analyse' }))

    expect(await screen.findByText('72')).toBeInTheDocument() // the score
    expect(screen.getByText('Missing meta description')).toBeInTheDocument()
    expect(screen.getByText('No mobile viewport tag')).toBeInTheDocument()
    expect(screen.getByText('1 critical')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/seo/audit', expect.objectContaining({ method: 'POST' }))
  })

  it('lists recent audits and opens one on click', async () => {
    stub((path) => {
      if (path.startsWith('/api/seo/audits')) {
        return { ok: true, json: async () => ({ audits: [{ id: 'seo_1', url: 'https://heartsdental.com.au', score: 72, grade: 'C', created_at: '2026-07-08T00:00:00Z', client_name: 'Hearts Dental', requested_by: 'HK' }] }) }
      }
      if (path === '/api/seo/audit/seo_1') return { ok: true, json: async () => AUDIT }
      return null
    })
    const user = userEvent.setup()
    render(<SeoPage />)
    const item = await screen.findByText('heartsdental.com.au')
    await user.click(item)
    await waitFor(() => expect(screen.getByText('No mobile viewport tag')).toBeInTheDocument())
  })
})
