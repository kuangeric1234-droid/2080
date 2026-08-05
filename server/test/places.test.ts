import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GooglePlacesProvider, NoPlacesProvider,
  practiceKeyword, researchPractice,
} from '../src/review/places.ts'

/* §13.2 step 1.14. The Reputation line — "44x 5.0* on GMB" — appears in 15 of
   17 real reports, and the competitor set in 15. Both come from Google Places,
   officially, or they do not come at all. */

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks() })

/* Keys are matched against the request URL. A `details` value may be a single
   response or a map of place_id → response: since 1.37 the top three
   competitors are hydrated with their own Details call, so a stub that answers
   every place_id with the same body would hand back three copies of one
   business and hide exactly the mistake worth catching. */
function stub(byPath: Record<string, unknown>) {
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url)
    const key = Object.keys(byPath).find((k) => u.includes(k))
    let body = key ? byPath[key] : { status: 'ZERO_RESULTS' }
    if (key === 'details' && body && !('status' in (body as object))) {
      const placeId = new URL(u).searchParams.get('place_id') ?? ''
      body = (body as Record<string, unknown>)[placeId] ?? { status: 'ZERO_RESULTS' }
    }
    return new Response(JSON.stringify(body),
      { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}

describe('practice keyword', () => {
  it('searches for the trade the practice actually is', () => {
    // the bank's copy is dental, the real reports are not
    expect(practiceKeyword('Advanced Chiropractic', 'advchiro.com.au')).toBe('chiropractor')
    expect(practiceKeyword('Novus Dermatology', 'novusderm.com.au')).toBe('dermatologist')
    expect(practiceKeyword('Smile Council Orthodontics', 'x.com.au')).toBe('orthodontist')
    expect(practiceKeyword(null, 'heartsdental.com.au')).toBe('dentist')
  })
})

describe('researching a practice on Google', () => {
  it('reads the rating and review count off the listing', async () => {
    stub({
      textsearch: { status: 'OK', results: [{ place_id: 'p1', name: 'Hearts Dental' }] },
      details: {
        status: 'OK',
        result: {
          place_id: 'p1', name: 'Hearts Dental', rating: 4.9, user_ratings_total: 79,
          geometry: { location: { lat: -37.8, lng: 145.1 } },
          website: 'https://heartsdental.com.au/',
        },
      },
      nearbysearch: { status: 'OK', results: [] },
    })
    const r = await researchPractice(new GooglePlacesProvider('k'),
      { practiceName: 'Hearts Dental', domain: 'heartsdental.com.au', keyword: 'dentist' })

    expect(r.practice?.reviewCount).toBe(79)
    const count = r.signals.find((s) => s.key === 'reputation.google_review_count')!
    const rating = r.signals.find((s) => s.key === 'reputation.google_rating')!
    expect(count.value).toBe(79)
    expect(rating.value).toBe(4.9)
    // provenance names the search, so a reviewer can repeat it by hand
    expect(count.provenance).toContain('Hearts Dental')
    expect(count.source).toBe('provider')
  })

  it('returns the nearby practices of the same trade, excluding the practice itself', async () => {
    stub({
      textsearch: { status: 'OK', results: [{ place_id: 'me', name: 'Me' }] },
      details: {
        /* The website has to be here and has to match: since the wrong-city
           bug, a listing that cannot be tied to the domain is refused. */
        me: {
          status: 'OK',
          result: {
            place_id: 'me', name: 'Me', website: 'https://me.com.au/',
            geometry: { location: { lat: -37.8, lng: 145.1 } },
          },
        },
        /* §13.2 1.37. Nearby Search carries neither of these, so the facts a
           competitor row is built from only exist after this call. */
        c1: {
          status: 'OK',
          result: {
            place_id: 'c1', name: 'Chapel Gate Dental', rating: 4.7, user_ratings_total: 23,
            website: 'https://chapelgate.com.au/',
            opening_hours: {
              periods: [0, 1, 2, 3, 4, 5].map((day) => ({ open: { day } })),
            },
          },
        },
        c2: {
          status: 'OK',
          result: {
            place_id: 'c2', name: 'Camberwell Dental', rating: 4.9, user_ratings_total: 79,
            website: 'https://camberwelldental.com.au/',
            // two blocks on one day must not read as two days
            opening_hours: {
              periods: [{ open: { day: 1 } }, { open: { day: 1 } }, { open: { day: 2 } }],
            },
          },
        },
      },
      nearbysearch: {
        status: 'OK',
        results: [
          { place_id: 'me', name: 'Me' }, // Google includes the origin; it must be dropped
          { place_id: 'c1', name: 'Chapel Gate Dental', rating: 4.7, user_ratings_total: 23 },
          { place_id: 'c2', name: 'Camberwell Dental', rating: 4.9, user_ratings_total: 79 },
        ],
      },
    })
    const r = await researchPractice(new GooglePlacesProvider('k'),
      { practiceName: 'Me', domain: 'me.com.au', keyword: 'dentist' })

    /* Strongest first, by review count: 13 of the 17 references name two or
       three competitors and never more, so which three is the whole decision.
       Nearest-first would put a quiet single-chair clinic above the busiest
       practice in the suburb. */
    expect(r.competitors.map((c) => c.name)).toEqual(['Camberwell Dental', 'Chapel Gate Dental'])
    const med = r.signals.find((s) => s.key === 'reputation.competitor_review_median')!
    expect(med.value).toBe(51) // (23 + 79) / 2

    /* Hydrated: without the Details call every one of these is null, which is
       why the Competition section printed a name and a review count. */
    expect(r.competitors.map((c) => c.website))
      .toEqual(['https://camberwelldental.com.au/', 'https://chapelgate.com.au/'])
    expect(r.competitors.map((c) => c.daysOpen)).toEqual([2, 6])
  })

  it('keeps a competitor whose Details lookup fails, minus the extra facts', async () => {
    stub({
      textsearch: { status: 'OK', results: [{ place_id: 'me', name: 'Me' }] },
      details: {
        me: {
          status: 'OK',
          result: {
            place_id: 'me', name: 'Me', website: 'https://me.com.au/',
            geometry: { location: { lat: -37.8, lng: 145.1 } },
          },
        },
        // c1 absent: the stub answers ZERO_RESULTS, so details() returns null
      },
      nearbysearch: {
        status: 'OK',
        results: [{ place_id: 'c1', name: 'Chapel Gate Dental', rating: 4.7, user_ratings_total: 23 }],
      },
    })
    const r = await researchPractice(new GooglePlacesProvider('k'),
      { practiceName: 'Me', domain: 'me.com.au', keyword: 'dentist' })

    expect(r.competitors.map((c) => c.name)).toEqual(['Chapel Gate Dental'])
    expect(r.competitors[0].reviewCount).toBe(23)
    expect(r.competitors[0].website).toBeNull()
  })

  /* The bug this guards against actually happened and reached the page.
     Searching "Oh Dental ohdental.com.au" returned One Week Dental in
     Melbourne — Google Text Search matches a string, not a business — and its
     five Melbourne neighbours printed on a South Australian practice's report
     as that practice's competitors. `website` was already being fetched for
     exactly this check and nothing was checking it. */
  it('refuses a listing whose website is not the site being audited', async () => {
    stub({
      textsearch: { status: 'OK', results: [{ place_id: 'wrong', name: 'One Week Dental' }] },
      details: {
        status: 'OK',
        result: {
          place_id: 'wrong', name: 'One Week Dental', rating: 4.8, user_ratings_total: 300,
          geometry: { location: { lat: -37.8, lng: 145.0 } },
          website: 'https://www.oneweekdental.com.au/',
        },
      },
      nearbysearch: { status: 'OK', results: [{ place_id: 'n1', name: 'A Melbourne practice' }] },
    })
    const r = await researchPractice(new GooglePlacesProvider('k'),
      { practiceName: 'Oh Dental', domain: 'ohdental.com.au', keyword: 'dentist' })

    expect(r.practice, 'accepted a listing for a different business').toBeNull()
    expect(r.competitors, 'competitors from the wrong city reached the report').toEqual([])
    expect(r.signals, 'a rating for the wrong practice was published').toEqual([])
    expect(r.errors.join(' '), 'the rejection was silent').toMatch(/One Week Dental/)
  })

  it('anchors the search on the suburb from the practice website', async () => {
    const queries: string[] = []
    globalThis.fetch = (async (url: string | URL) => {
      const u = new URL(String(url))
      if (u.pathname.includes('textsearch')) {
        const q = u.searchParams.get('query') ?? ''
        queries.push(q)
        /* Only the query carrying the suburb finds the right clinic — which is
           exactly how Google behaved on the real lookup. */
        return new Response(JSON.stringify(q.includes('Halloran')
          ? { status: 'OK', results: [{ place_id: 'right', name: "O'Halloran Hill Dental Clinic" }] }
          : { status: 'OK', results: [{ place_id: 'wrong', name: 'One Week Dental' }] }),
        { status: 200 })
      }
      if (u.pathname.includes('details')) {
        const id = u.searchParams.get('place_id')
        return new Response(JSON.stringify({
          status: 'OK',
          result: id === 'right'
            ? { place_id: 'right', name: "O'Halloran Hill Dental Clinic", rating: 5, user_ratings_total: 228,
                geometry: { location: { lat: -35.06, lng: 138.55 } }, website: 'https://ohdental.com.au/' }
            : { place_id: 'wrong', name: 'One Week Dental', website: 'https://www.oneweekdental.com.au/' },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ status: 'OK', results: [] }), { status: 200 })
    }) as typeof fetch

    const r = await researchPractice(new GooglePlacesProvider('k'), {
      practiceName: 'Oh Dental', domain: 'ohdental.com.au', keyword: 'dentist',
      locality: 'Halloran Hill SA 5158',
    })
    expect(queries[0], 'the suburb was not tried first').toContain('Halloran Hill')
    expect(r.practice?.reviewCount).toBe(228)
  })

  it('says so when Google has no listing rather than inventing one', async () => {
    stub({ textsearch: { status: 'ZERO_RESULTS', results: [] } })
    const r = await researchPractice(new GooglePlacesProvider('k'),
      { practiceName: 'Nowhere', domain: 'nowhere.test', keyword: 'dentist' })
    expect(r.practice).toBeNull()
    expect(r.signals).toEqual([])
    expect(r.errors.join(' ')).toMatch(/no Google listing/)
  })

  /* A bad key or a disabled API must be loud. Silently producing an empty
     Reputation section would look identical to a practice with no reviews. */
  it('surfaces a key or quota failure instead of an empty section', async () => {
    stub({ textsearch: { status: 'REQUEST_DENIED', error_message: 'API key not valid' } })
    const r = await researchPractice(new GooglePlacesProvider('bad'),
      { practiceName: 'X', domain: 'x.test', keyword: 'dentist' })
    expect(r.errors.join(' ')).toMatch(/REQUEST_DENIED/)
    expect(r.errors.join(' ')).toMatch(/API key not valid/)
    expect(r.signals).toEqual([])
  })

  it('does nothing at all without a key, and never a plausible rating', async () => {
    const r = await researchPractice(new NoPlacesProvider(),
      { practiceName: 'Hearts Dental', domain: 'heartsdental.com.au', keyword: 'dentist' })
    expect(r.practice).toBeNull()
    expect(r.competitors).toEqual([])
    expect(r.signals).toEqual([])
    expect(r.errors.join(' ')).toMatch(/no places provider/)
  })
})
