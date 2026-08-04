import type { Signal } from './signals.ts'

/* §13.2 step 1.14 — the research half.

   "Go on Google, search their business, find the reviews, find the
   competitors." Google's own Places API does exactly that, officially: Text
   Search finds the practice, Place Details returns its rating and review
   count, and Nearby Search returns the same-category businesses around it —
   which is what a competitor set *is*.

   Scraping Google would breach its terms and produce a report 20-80 could not
   defend, so this uses the paid API or it returns nothing. There is no third
   option worth shipping. */

export interface PlaceRecord {
  placeId: string
  name: string
  rating: number | null
  reviewCount: number | null
  address: string | null
  lat: number | null
  lng: number | null
  website: string | null
}

export interface PlacesProvider {
  readonly name: string
  readonly provisional: boolean
  /** The practice itself — searched the way a person would, by name and suburb. */
  findPractice(query: string): Promise<PlaceRecord | null>
  /** The same-category businesses around it, nearest first, excluding itself. */
  nearby(place: PlaceRecord, keyword: string, radiusMetres: number): Promise<PlaceRecord[]>
}

/* PROVISIONAL. Returns nothing — never a plausible rating.
   A fabricated "4.7 stars from 23 reviews" about a real practice, or a
   competitor that does not exist, is defamation-adjacent and would be printed
   on 20-80 letterhead. Absent is the only honest stand-in. */
export class NoPlacesProvider implements PlacesProvider {
  readonly name = 'none'
  readonly provisional = true
  async findPractice(): Promise<PlaceRecord | null> { return null }
  async nearby(): Promise<PlaceRecord[]> { return [] }
}

const FIELDS = 'place_id,name,rating,user_ratings_total,formatted_address,geometry,website'

function toRecord(r: Record<string, unknown>): PlaceRecord {
  const geo = (r.geometry as { location?: { lat?: number; lng?: number } } | undefined)?.location
  return {
    placeId: String(r.place_id ?? ''),
    name: String(r.name ?? ''),
    rating: typeof r.rating === 'number' ? r.rating : null,
    reviewCount: typeof r.user_ratings_total === 'number' ? r.user_ratings_total : null,
    address: typeof r.formatted_address === 'string' ? r.formatted_address
      : typeof r.vicinity === 'string' ? r.vicinity : null,
    lat: typeof geo?.lat === 'number' ? geo.lat : null,
    lng: typeof geo?.lng === 'number' ? geo.lng : null,
    website: typeof r.website === 'string' ? r.website : null,
  }
}

/** Google Maps Platform. One key, three calls, no terms breached. */
export class GooglePlacesProvider implements PlacesProvider {
  readonly name = 'google-places'
  readonly provisional = false
  constructor(private key: string) {}

  private async get(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
    const q = new URLSearchParams({ ...params, key: this.key })
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/${path}/json?${q}`)
    const body = await res.json() as Record<string, unknown>
    const status = String(body.status ?? '')
    /* ZERO_RESULTS is an answer, not a failure. Anything else is a real problem
       — a bad key, a quota, a disabled API — and must be loud rather than
       silently producing an empty Reputation section. */
    if (status !== 'OK' && status !== 'ZERO_RESULTS') {
      throw new Error(`places ${path}: ${status}${body.error_message ? ` — ${body.error_message}` : ''}`)
    }
    return body
  }

  async findPractice(query: string): Promise<PlaceRecord | null> {
    const found = await this.get('textsearch', { query })
    const first = (found.results as Record<string, unknown>[] | undefined)?.[0]
    if (!first) return null
    // textsearch omits `website`; details fills it so we can match the domain
    const det = await this.get('details', { place_id: String(first.place_id), fields: FIELDS })
    return toRecord((det.result as Record<string, unknown>) ?? first)
  }

  async nearby(place: PlaceRecord, keyword: string, radiusMetres: number): Promise<PlaceRecord[]> {
    if (place.lat === null || place.lng === null) return []
    const found = await this.get('nearbysearch', {
      location: `${place.lat},${place.lng}`,
      radius: String(radiusMetres),
      keyword,
    })
    return ((found.results as Record<string, unknown>[]) ?? [])
      .map(toRecord)
      .filter((r) => r.placeId && r.placeId !== place.placeId)
  }
}

/* What to search "nearby" for. The bank's wording is dental but the real
   reports cover chiropractic and dermatology too, and a chiropractor's
   competitors are not dentists. Inferred from the name and domain, which is
   where a practice says what it is. */
export function practiceKeyword(practiceName: string | null, domain: string): string {
  const hay = `${practiceName ?? ''} ${domain}`.toLowerCase()
  if (/chiro/.test(hay)) return 'chiropractor'
  if (/derma|skin/.test(hay)) return 'dermatologist'
  if (/ortho/.test(hay)) return 'orthodontist'
  if (/physio/.test(hay)) return 'physiotherapist'
  if (/podia/.test(hay)) return 'podiatrist'
  if (/vet/.test(hay)) return 'veterinarian'
  return 'dentist'
}

export function defaultPlacesProvider(): PlacesProvider {
  const k = process.env.GOOGLE_MAPS_API_KEY
  return k ? new GooglePlacesProvider(k) : new NoPlacesProvider()
}

/* ── what the research produces ─────────────────────────────────────────────
   Reputation signals fill rep.reviews.* — the {{count}}x {{rating}}* line that
   appears in 15 of 17 real reports — and the competitor set feeds comp.row. */

export interface ResearchResult {
  practice: PlaceRecord | null
  competitors: PlaceRecord[]
  signals: Signal[]
  errors: string[]
}

/** How a competitor is described when nothing but Google knows about it. */
export const COMPETITOR_RADIUS_M = 5000
export const COMPETITOR_LIMIT = 5

export async function researchPractice(
  provider: PlacesProvider,
  input: { practiceName: string | null; domain: string; keyword: string },
): Promise<ResearchResult> {
  const signals: Signal[] = []
  const errors: string[] = []
  if (provider.provisional) {
    return { practice: null, competitors: [], signals, errors: ['no places provider configured'] }
  }

  const query = [input.practiceName, input.domain].filter(Boolean).join(' ')
  let practice: PlaceRecord | null = null
  try {
    practice = await provider.findPractice(query)
  } catch (err) {
    errors.push((err as Error).message)
    return { practice: null, competitors: [], signals, errors }
  }
  if (!practice) {
    errors.push(`no Google listing found for "${query}"`)
    return { practice: null, competitors: [], signals, errors }
  }

  const via = `Google Places, searched as "${query}" → ${practice.name}`
  if (practice.reviewCount !== null) {
    signals.push({
      key: 'reputation.google_review_count', value: practice.reviewCount, source: 'provider',
      provenance: `${practice.reviewCount} Google reviews — ${via}`,
    })
  }
  if (practice.rating !== null) {
    signals.push({
      key: 'reputation.google_rating', value: practice.rating, source: 'provider',
      provenance: `${practice.rating}★ average on Google — ${via}`,
    })
  }

  let competitors: PlaceRecord[] = []
  try {
    competitors = (await provider.nearby(practice, input.keyword, COMPETITOR_RADIUS_M))
      .slice(0, COMPETITOR_LIMIT)
  } catch (err) {
    errors.push((err as Error).message)
  }
  if (competitors.length > 0) {
    signals.push({
      key: 'reputation.competitor_review_median',
      value: median(competitors.map((c) => c.reviewCount).filter((n): n is number => n !== null)),
      source: 'provider',
      provenance: `median Google review count across ${competitors.length} `
        + `${input.keyword} practices within ${COMPETITOR_RADIUS_M / 1000}km — Google Places`,
    })
  }

  return { practice, competitors, signals, errors }
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}
