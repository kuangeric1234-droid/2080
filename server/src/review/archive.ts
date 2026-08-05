import type { Signal } from './signals.ts'

/* §13.2 step 1.26 — when the homepage last changed.

   `biz.website.stale` — "The website looks like it hasn't been updated since
   {{year}}, according to {{web_archive}}" — appears in **7 of the 17** real
   reports, and its trigger has been waiting on a signal nothing produced. The
   reviewers get it by eye: open the Wayback Machine, scrub back, see when the
   design last changed.

   The Internet Archive's CDX API answers the same question without a browser
   and without touching anyone's terms of service. `collapse=digest` returns one
   row per *content change* rather than one per crawl, so the timestamp of the
   final row is when the page last became what it is now.

   What this deliberately does NOT do: guess. A site with a rotating banner or a
   date in the footer gets a new digest on every crawl, so its "last change" is
   always yesterday and no finding fires. That is the right failure — the claim
   "your website has not been touched since 2017" is one a practice will check,
   and being wrong about it costs more than being silent. */

export interface ArchiveResult {
  /** Year the homepage last changed content, or null if it changes constantly. */
  lastChangedYear: number | null
  /** Months since that change. */
  monthsSince: number | null
  /** The capture a reviewer can open to see it — goes in the report. */
  snapshotUrl: string | null
  /** Distinct content versions the archive holds. */
  versions: number
}

export interface ArchiveProvider {
  readonly name: string
  readonly provisional: boolean
  lastChange(domain: string): Promise<ArchiveResult | null>
}

/* PROVISIONAL: returns nothing rather than a plausible year. */
export class NoArchiveProvider implements ArchiveProvider {
  readonly name = 'none'
  readonly provisional = true
  async lastChange(): Promise<ArchiveResult | null> { return null }
}

/** A CDX timestamp is `yyyyMMddHHmmss`. */
function parseStamp(ts: string): Date | null {
  const m = ts.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return Number.isNaN(d.getTime()) ? null : d
}

export class WaybackProvider implements ArchiveProvider {
  readonly name = 'web.archive.org'
  readonly provisional = false
  constructor(private fetchImpl: typeof fetch = fetch, private now: () => Date = () => new Date()) {}

  async lastChange(domain: string): Promise<ArchiveResult | null> {
    const q = new URLSearchParams({
      url: domain, output: 'json', fl: 'timestamp,digest',
      collapse: 'digest', filter: 'statuscode:200', limit: '400',
    })
    const res = await this.fetchImpl(`https://web.archive.org/cdx/search/cdx?${q}`)
    if (!res.ok) throw new Error(`web archive: HTTP ${res.status}`)
    const body = await res.json() as string[][]
    /* Row 0 is the header. No rows means the archive has never seen the site,
       which is a fact about the archive and not about the practice. */
    if (!Array.isArray(body) || body.length < 2) return null

    const rows = body.slice(1).filter((r) => Array.isArray(r) && r[0])
    if (rows.length === 0) return null

    const last = rows[rows.length - 1]
    const when = parseStamp(last[0])
    if (!when) return null

    const months = Math.floor((this.now().getTime() - when.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    return {
      lastChangedYear: when.getUTCFullYear(),
      monthsSince: months,
      snapshotUrl: `https://web.archive.org/web/${last[0]}/${domain}`,
      versions: rows.length,
    }
  }
}

export function defaultArchiveProvider(): ArchiveProvider {
  /* No key, no account, no quota worth worrying about at audit volumes. */
  return new WaybackProvider()
}

/* Two years is the report's own standard — "websites should be refreshed every
   2 to 3 years" — so a site that changed more recently than that is not stale
   and the finding must not fire. */
const STALE_AFTER_MONTHS = 24

export async function collectArchive(
  provider: ArchiveProvider,
  domain: string,
): Promise<{ signals: Signal[]; errors: string[] }> {
  const signals: Signal[] = []
  const errors: string[] = []
  if (provider.provisional) return { signals, errors }

  let r: ArchiveResult | null
  try {
    r = await provider.lastChange(domain)
  } catch (err) {
    errors.push((err as Error).message)
    return { signals, errors }
  }
  if (!r || r.lastChangedYear === null || r.monthsSince === null) return { signals, errors }

  const via = `${r.versions} distinct captures of ${domain} — web.archive.org CDX`
  signals.push({
    key: 'archive.last_change_months', value: r.monthsSince, source: 'provider',
    provenance: `homepage content last changed ${r.monthsSince} months ago — ${via}`,
  })
  if (r.snapshotUrl) {
    signals.push({
      key: 'archive.snapshot_url', value: r.snapshotUrl, source: 'provider',
      provenance: `the capture showing that state — ${via}`,
    })
  }
  /* The year only exists as a signal when the site is actually stale, because
     the snippet that reads it says "hasn't been updated since" — publishing the
     year for a site refreshed last month would fire a finding that is false. */
  if (r.monthsSince >= STALE_AFTER_MONTHS) {
    signals.push({
      key: 'archive.last_major_update_year', value: r.lastChangedYear, source: 'provider',
      provenance: `no content change since ${r.lastChangedYear} — ${via}`,
    })
  }
  return { signals, errors }
}
