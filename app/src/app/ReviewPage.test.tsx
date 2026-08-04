import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ReviewPage } from './ReviewPage'

const EMPTY = { reviews: [] }
const calls: Array<{ url: string; init?: RequestInit }> = []

function mockFetch(post: unknown, status = 200) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (init?.method === 'POST') return new Response(JSON.stringify(post), { status })
    return new Response(JSON.stringify(EMPTY), { status: 200 })
  }) as unknown as typeof fetch
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/review']}>
      <Routes>
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/review/:id" element={<div>detail page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => { calls.length = 0 })
afterEach(() => vi.unstubAllGlobals())

describe('audit a URL', () => {
  it('starts a review from a typed domain and opens it', async () => {
    vi.stubGlobal('fetch', mockFetch({ reviewId: 'rev_9', domain: 'heartsdental.com.au', duplicate: false }))
    const user = userEvent.setup()
    renderPage()

    const box = await screen.findByLabelText('Audit a website')
    await user.type(box, 'heartsdental.com.au')
    await user.click(screen.getByRole('button', { name: 'Run review' }))

    await waitFor(() => {
      const post = calls.find((c) => c.init?.method === 'POST')!
      expect(post.url).toBe('/api/reviews')
      expect(JSON.parse(post.init!.body as string)).toEqual({ url: 'heartsdental.com.au' })
    })
    expect(await screen.findByText('detail page')).toBeInTheDocument()
  })

  it('submits on Enter', async () => {
    vi.stubGlobal('fetch', mockFetch({ reviewId: 'rev_9', duplicate: false }))
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByLabelText('Audit a website'), 'yarrahills.com.au{Enter}')
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'POST')).toBe(true))
  })

  /* An open review of the same site is handed back rather than duplicated, and
     going to it must not re-crawl what has already been collected. */
  it('opens an existing review without asking for a re-crawl', async () => {
    vi.stubGlobal('fetch', mockFetch({ reviewId: 'rev_open', duplicate: true }))
    const user = userEvent.setup()
    const { container } = renderPage()

    await user.type(await screen.findByLabelText('Audit a website'), 'aspireone.com.au{Enter}')
    await screen.findByText('detail page')
    expect(container.ownerDocument.location.search).not.toContain('collect')
  })

  it('shows the server’s complaint instead of failing silently', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: '"hello there" doesn’t look like a website address' }, 400))
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Audit a website'), 'hello there{Enter}')
    expect(await screen.findByText(/doesn’t look like a website address/)).toBeInTheDocument()
    expect(screen.queryByText('detail page')).not.toBeInTheDocument()
  })

  it('will not submit an empty box', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    renderPage()
    await screen.findByLabelText('Audit a website')
    expect(screen.getByRole('button', { name: 'Run review' })).toBeDisabled()
  })

  it('explains what collection does, since it takes a moment', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    renderPage()
    expect(await screen.findByText(/No enquiry needed/)).toBeInTheDocument()
  })

  it('still shows the empty queue underneath', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    renderPage()
    expect(await screen.findByText(/No audit requests yet/)).toBeInTheDocument()
    expect(screen.getByText(/hooks\/jotform/)).toBeInTheDocument()
  })
})
