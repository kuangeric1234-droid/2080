import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ReviewDetailPage } from './ReviewDetailPage'

const REVIEW = {
  review: {
    id: 'rev_1',
    domain: 'stellarsmiles.com.au',
    practice_name: 'Stellar Smiles Dental',
    contact_name: 'Amy Nguyen',
    contact_email: 'amy@stellarsmiles.com.au',
    status: 'draft',
    category_scores: { website_technical: 2, reputation: null },
    overall_score: 2,
    collect_error: null,
    collected_at: '2026-08-04T00:10:00Z',
    requested_at: '2026-08-04T00:00:00Z',
  },
  signals: [
    {
      target: 'stellarsmiles.com.au', key: 'site.https', value: false, source: 'http',
      provenance: 'GET https://stellarsmiles.com.au resolved to http://stellarsmiles.com.au (HTTP 200)',
      collected_at: '2026-08-04T00:10:00Z',
    },
    {
      target: 'stellarsmiles.com.au', key: 'pages.service_pages', value: null, source: 'crawl',
      provenance: 'Cannot tell from the 4 pages crawled whether the site has dedicated service pages — no sitemap to count against',
      collected_at: '2026-08-04T00:10:00Z',
    },
  ],
  findings: [
    {
      id: 'fnd_1', snippet_id: 'tech.https.absent', category: 'website_technical',
      dimension: 'Performance', variant: 'negative', weight: 3, state: 'candidate',
      rendered_text: 'The website is not using the SSL/HTTPS protocol, which means visitors will be notified…',
      edited_text: null, vars: {}, triggered_by: ['site.https'], ahpra_blocking: false, decided_by: null,
    },
    {
      id: 'fnd_2', snippet_id: 'biz.ahpra.testimonials', category: 'website_business',
      dimension: 'AHPRA', variant: 'negative', weight: 3, state: 'accepted',
      rendered_text: 'Under the AHPRA guideline, you’re not allowed to have reviews/testimonials…',
      edited_text: null, vars: {}, triggered_by: ['content.testimonials_present'],
      ahpra_blocking: true, decided_by: 'WC',
    },
    {
      id: 'fnd_3', snippet_id: 'biz.email.public_domain', category: 'website_business',
      dimension: 'Authority', variant: 'negative', weight: 3, state: 'accepted',
      rendered_text: 'It’s not professional to use public email domain/address such as {{public_email}}.',
      edited_text: null, vars: {}, triggered_by: ['site.contact.email_domain_public'],
      ahpra_blocking: false, decided_by: 'WC',
    },
  ],
  competitors: [],
  exhibits: [],
  categories: [
    {
      key: 'website_business', label: 'Website (Business)',
      dimensions: ['UVP', 'Content', 'AHPRA'], automation: 'semi', automation_note: 'Crawl plus judgement.',
    },
    {
      key: 'website_technical', label: 'Website (Technical)',
      dimensions: ['Performance', 'Analytics'], automation: 'full', automation_note: 'Every snippet is signal-driven.',
    },
    {
      key: 'reputation', label: 'Reputation',
      dimensions: ['Reviews'], automation: 'manual', automation_note: 'Needs the Places API.',
    },
  ],
}

const BANK = {
  groups: [
    {
      category: 'reputation', label: 'Reputation', automation: 'manual',
      automation_note: 'Needs the Places API.',
      items: [
        {
          snippet_id: 'rep.reviews.none', dimension: 'Reviews', variant: 'negative',
          text: 'You currently don’t have any online reputation whatsoever.',
          prompt: 'How many Google reviews and what average rating?',
          kind: 'manual', vars: [], hint: null, state: null,
        },
      ],
    },
    {
      category: 'website_business', label: 'Website (Business)', automation: 'semi',
      automation_note: 'Crawl plus judgement.',
      items: [
        {
          snippet_id: 'biz.service_pages.missing', dimension: 'Content', variant: 'negative',
          text: 'The dental service content is great, but they deserve to have their own page.',
          prompt: 'Does each service have its own page with real content?',
          kind: 'judgement', vars: ['service'],
          hint: {
            key: 'pages.service_pages', value: null,
            provenance: 'Cannot tell from the 4 pages crawled whether the site has dedicated service pages — no sitemap to count against',
          },
          state: null,
        },
      ],
    },
  ],
}

const calls: Array<{ url: string; init?: RequestInit }> = []

function mockFetch(overrides: Record<string, unknown> = {}) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.endsWith('/bank')) return new Response(JSON.stringify(BANK), { status: 200 })
    if (url.includes('/api/reviews/rev_1') && (!init || init.method === undefined)) {
      return new Response(JSON.stringify({ ...REVIEW, ...overrides }), { status: 200 })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }) as unknown as typeof fetch
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/review/rev_1']}>
      <Routes>
        <Route path="/review/:id" element={<ReviewDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  calls.length = 0
  vi.stubGlobal('fetch', mockFetch())
})
afterEach(() => vi.unstubAllGlobals())

describe('review workspace', () => {
  it('shows the practice, the eight-row summary and the finding count', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Stellar Smiles Dental' })).toBeInTheDocument()
    expect(screen.getByText('stellarsmiles.com.au')).toBeInTheDocument()
    expect(screen.getByText(/2 signals · 2 of 3 findings/)).toBeInTheDocument()
    const summary = screen.getByRole('table', { name: 'Score summary' })
    expect(within(summary).getByText('Website (Technical)')).toBeInTheDocument()
    expect(within(summary).getByText('Overall Score')).toBeInTheDocument()
  })

  /* The trust feature: a reviewer must be able to see, without leaving the
     page, the measurement that produced any given paragraph. */
  it('shows the collector’s own words as the evidence for a finding', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1 })

    const tech = screen.getByRole('region', { name: 'Website (Technical) findings' })
    await user.click(within(tech).getByText(/^Evidence \(1\)/))
    expect(
      within(tech).getByText(/resolved to http:\/\/stellarsmiles\.com\.au \(HTTP 200\)/),
    ).toBeInTheDocument()
    expect(within(tech).getByText('site.https')).toBeInTheDocument()
  })

  /* An unscored category must never read as five stars — see the engine's
     suggestScores. The picker shows "not scored" instead. */
  it('renders an uncollected category as unscored, not perfect', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    const summary = screen.getByRole('table', { name: 'Score summary' })
    const row = within(summary).getByText('Reputation').closest('tr')!
    expect(within(row).getByText('not scored')).toBeInTheDocument()
    expect(within(row).getByText(/Needs your input/)).toBeInTheDocument()
  })

  it('flags an accepted finding that still has a blank in it', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText(/Needs public_email before this can ship/)).toBeInTheDocument()
    expect(screen.getByText(/1 accepted finding still has a blank to fill/)).toBeInTheDocument()
  })

  it('marks an AHPRA finding so it cannot be skimmed past', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText('AHPRA breach')).toBeInTheDocument()
  })

  it('includes a candidate finding and posts the decision', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1 })

    await user.click(screen.getByRole('button', { name: 'Include' }))
    await waitFor(() => {
      const post = calls.find((c) => c.url === '/api/reviews/findings/fnd_1/decide')
      expect(post).toBeTruthy()
      expect(JSON.parse(post!.init!.body as string)).toMatchObject({ state: 'accepted' })
    })
  })

  it('edits house copy only on purpose, and says so', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1 })

    const tech = screen.getByRole('region', { name: 'Website (Technical) findings' })
    await user.click(within(tech).getByRole('button', { name: 'Edit' }))
    expect(within(tech).getByText(/House copy is the default/)).toBeInTheDocument()

    const box = within(tech).getByRole('textbox', { name: /Edit the finding text/ })
    await user.clear(box)
    await user.type(box, 'No SSL. Fix first.')
    await user.click(screen.getByRole('button', { name: 'Save and accept' }))

    await waitFor(() => {
      const post = calls.find((c) => c.url === '/api/reviews/findings/fnd_1/decide')
      expect(JSON.parse(post!.init!.body as string)).toMatchObject({
        state: 'accepted', editedText: 'No SSL. Fix first.',
      })
    })
  })

  it('offers the manual bank with what we did measure attached', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1 })

    const biz = screen.getByRole('region', { name: 'Website (Business) findings' })
    await user.click(within(biz).getByText(/Add from the bank/, { selector: 'summary' }))
    expect(within(biz).getByText(/Does each service have its own page/)).toBeInTheDocument()
    expect(within(biz).getByText(/We measured: Cannot tell from the 4 pages crawled/)).toBeInTheDocument()

    await user.click(within(biz).getByRole('button', { name: 'Add' }))
    await waitFor(() => {
      const post = calls.find((c) => c.url === '/api/reviews/rev_1/findings')
      expect(JSON.parse(post!.init!.body as string)).toMatchObject({ snippetId: 'biz.service_pages.missing' })
    })
  })

  it('saves a score override only when the reviewer changes one', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: 'Save scores' })).not.toBeInTheDocument()

    const summary = screen.getByRole('table', { name: 'Score summary' })
    const row = within(summary).getByText('Website (Technical)').closest('tr')!
    await user.click(within(row).getByRole('button', { name: '4 of 5' }))
    expect(within(row).getByText('suggested 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save scores' }))
    await waitFor(() => {
      const put = calls.find((c) => c.url === '/api/reviews/rev_1/scores')
      expect(JSON.parse(put!.init!.body as string).scores.website_technical).toBe(4)
    })
  })

  it('offers collection, and explains it, before any evidence exists', async () => {
    vi.stubGlobal('fetch', mockFetch({ review: { ...REVIEW.review, collected_at: null } }))
    renderPage()
    expect(await screen.findByText(/No evidence collected yet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collect evidence' })).toBeInTheDocument()
    expect(screen.queryByText('Overall Score')).not.toBeInTheDocument()
  })

  it('surfaces a collection failure rather than showing an empty report', async () => {
    vi.stubGlobal('fetch', mockFetch({
      review: { ...REVIEW.review, collected_at: null, collect_error: 'could not fetch https://stellarsmiles.com.au' },
    }))
    renderPage()
    expect(await screen.findByText(/Collection failed: could not fetch/)).toBeInTheDocument()
  })

  it('says so plainly when the review does not exist', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })) as unknown as typeof fetch)
    renderPage()
    expect(await screen.findByText(/That review doesn’t exist/)).toBeInTheDocument()
  })
})

/* §13.2 step 1.12b. The Competition section had no screen at all — the routes
   and the export existed but nothing could put a competitor in front of them. */
describe('competition', () => {
  it('says the section is left out until a competitor is added', async () => {
    renderPage()
    const panel = await screen.findByRole('region', { name: 'Competition' })
    expect(within(panel).getByText(/left out of the report until you add one/)).toBeInTheDocument()
  })

  it('adds a competitor with the name, website and threat typed', async () => {
    const user = userEvent.setup()
    renderPage()
    const panel = await screen.findByRole('region', { name: 'Competition' })

    await user.type(within(panel).getByLabelText('Name'), 'Chapel Gate Dental')
    await user.type(within(panel).getByLabelText('Website (optional)'), 'chapelgate.com.au')
    await user.type(within(panel).getByLabelText('Threat'), '7')
    await user.click(within(panel).getByRole('button', { name: 'Add competitor' }))

    await waitFor(() => {
      const post = calls.find((c) => c.init?.method === 'POST' && c.url.endsWith('/competitors'))
      expect(post, 'no POST to /competitors').toBeTruthy()
      expect(JSON.parse(String(post!.init!.body))).toEqual({
        name: 'Chapel Gate Dental', domain: 'chapelgate.com.au', threat: 7,
      })
    })
  })

  /* comp.row's note splits the facts in two, and a reviewer needs to know which
     half they are still on the hook for. */
  it('marks which facts were measured and which a human typed', async () => {
    vi.stubGlobal('fetch', mockFetch({
      competitors: [{
        id: 'cmp_1', name: 'Chapel Gate Dental', domain: 'chapelgate.com.au',
        facts: { https: false, serp_position: 1 }, threat: 7, position: 0,
      }],
    }))
    renderPage()
    const panel = await screen.findByRole('region', { name: 'Competition' })

    expect(within(panel).getByText('Chapel Gate Dental')).toBeInTheDocument()
    expect(within(panel).getByText('Threat 7/10')).toBeInTheDocument()
    // a yes/no fact reads as a phrase, not as "HTTPS: false"
    expect(within(panel).getByTitle('Collected from their website')).toHaveTextContent('Not secure')
    expect(within(panel).getByTitle('Entered by a reviewer')).toHaveTextContent('Google rank: 1')
  })

  it('removes a competitor', async () => {
    vi.stubGlobal('fetch', mockFetch({
      competitors: [{
        id: 'cmp_1', name: 'Chapel Gate Dental', domain: null,
        facts: {}, threat: null, position: 0,
      }],
    }))
    const user = userEvent.setup()
    renderPage()
    const panel = await screen.findByRole('region', { name: 'Competition' })
    await user.click(within(panel).getByRole('button', { name: 'Remove Chapel Gate Dental' }))

    await waitFor(() => {
      expect(calls.some((c) => c.init?.method === 'DELETE' && c.url.includes('/competitors/cmp_1'))).toBe(true)
    })
  })
})

/* §13.2 step 1.5b. */
describe('evidence images', () => {
  const EX = [{
    id: 'exh_1', finding_id: null, kind: 'screenshot',
    label: 'Homepage as it loads', width: 1440, height: 900, position: 0,
  }]

  it('explains where an unattached capture ends up', async () => {
    vi.stubGlobal('fetch', mockFetch({ exhibits: EX }))
    renderPage()
    const panel = await screen.findByRole('region', { name: 'Evidence images' })
    expect(within(panel).getByText('Homepage as it loads')).toBeInTheDocument()
    expect(within(panel).getByRole('combobox', { name: 'Attach Homepage as it loads' }))
      .toHaveValue('')
  })

  it('attaches a capture to an accepted finding', async () => {
    vi.stubGlobal('fetch', mockFetch({ exhibits: EX }))
    const user = userEvent.setup()
    renderPage()
    const panel = await screen.findByRole('region', { name: 'Evidence images' })
    // fnd_2 and fnd_3 are the accepted ones in the fixture
    await user.selectOptions(
      within(panel).getByRole('combobox', { name: 'Attach Homepage as it loads' }), 'fnd_3')

    await waitFor(() => {
      const patch = calls.find((c) => c.init?.method === 'PATCH' && c.url.includes('/exhibits/exh_1'))
      expect(patch, 'no PATCH to /exhibits').toBeTruthy()
      expect(JSON.parse(String(patch!.init!.body))).toEqual({ findingId: 'fnd_3' })
    })
  })

  it('only offers findings that are actually shipping', async () => {
    vi.stubGlobal('fetch', mockFetch({ exhibits: EX }))
    renderPage()
    const panel = await screen.findByRole('region', { name: 'Evidence images' })
    const select = within(panel).getByRole('combobox', { name: 'Attach Homepage as it loads' })
    const values = within(select).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)
    expect(values).toContain('fnd_3')   // accepted
    expect(values).not.toContain('fnd_1') // still a candidate
  })

  it('says so when there are no captures', async () => {
    renderPage()
    const panel = await screen.findByRole('region', { name: 'Evidence images' })
    expect(within(panel).getByText(/No captures yet/)).toBeInTheDocument()
  })
})
