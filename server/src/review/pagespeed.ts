import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Signal } from './signals.ts'
import type { RenderExhibit } from './render.ts'

/* §13.2 step 1.16 — the performance exhibit.

   The template's own margin comment says "Use gtmetrix.com to test speed. Make
   sure you log in and test from Australia", and 10 of the 17 real reports carry
   the resulting paragraph: hosted in Australia, should load within 2 seconds.
   `review_exhibits.kind` has had `performance_report` in it since 1.2 with
   nothing ever producing one.

   Google's PageSpeed Insights runs Lighthouse and returns both the numbers and
   a rendered screenshot of the finished page. It is free with a key — unlike
   Places, which is billed — and it is an official API rather than a browser
   pointed at a page it was asked not to automate. */

export interface PageSpeedResult {
  score: number | null
  firstContentfulPaint: string | null
  largestContentfulPaint: string | null
  speedIndex: string | null
  totalBlockingTime: string | null
  cumulativeLayoutShift: string | null
  /** Lighthouse's own "what to fix", already ranked by impact. */
  opportunities: string[]
  /** data: URI of the finished render, if Lighthouse returned one. */
  screenshotDataUri: string | null
}

export interface PageSpeedProvider {
  readonly name: string
  readonly provisional: boolean
  run(url: string, strategy: 'mobile' | 'desktop'): Promise<PageSpeedResult | null>
}

/* PROVISIONAL: returns nothing. A guessed performance score would contradict
   the one measurement in this report a practice can check for themselves in
   thirty seconds. */
export class NoPageSpeedProvider implements PageSpeedProvider {
  readonly name = 'none'
  readonly provisional = true
  async run(): Promise<PageSpeedResult | null> { return null }
}

export class GooglePageSpeedProvider implements PageSpeedProvider {
  readonly name = 'pagespeed-insights'
  readonly provisional = false
  constructor(private key: string | null) {}

  async run(url: string, strategy: 'mobile' | 'desktop'): Promise<PageSpeedResult | null> {
    const q = new URLSearchParams({ url, strategy, category: 'performance' })
    /* Australia is where the patients are, and the template says to test from
       there. PSI has no region parameter, so this is recorded in provenance
       rather than claimed — the number is Google's, from Google's location. */
    if (this.key) q.set('key', this.key)
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`)
    const body = await res.json() as Record<string, any>
    if (body.error) {
      /* A quota or key failure must be loud: a missing performance section
         looks identical to a fast site. */
      throw new Error(`pagespeed: ${body.error.message ?? res.status}`)
    }
    const lr = body.lighthouseResult
    if (!lr) return null
    const audit = (k: string) => lr.audits?.[k]?.displayValue ?? null
    return {
      score: typeof lr.categories?.performance?.score === 'number'
        ? Math.round(lr.categories.performance.score * 100) : null,
      firstContentfulPaint: audit('first-contentful-paint'),
      largestContentfulPaint: audit('largest-contentful-paint'),
      speedIndex: audit('speed-index'),
      totalBlockingTime: audit('total-blocking-time'),
      cumulativeLayoutShift: audit('cumulative-layout-shift'),
      opportunities: Object.values(lr.audits ?? {})
        .filter((a: any) => a?.details?.type === 'opportunity' && typeof a.score === 'number' && a.score < 0.9)
        .sort((a: any, b: any) => (a.score ?? 1) - (b.score ?? 1))
        .map((a: any) => String(a.title))
        .slice(0, 5),
      screenshotDataUri: lr.audits?.['final-screenshot']?.details?.data ?? null,
    }
  }
}

export function defaultPageSpeedProvider(): PageSpeedProvider {
  const k = process.env.GOOGLE_PAGESPEED_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? null
  /* Keyless works but shares an anonymous quota that is usually exhausted, so
     it is only worth attempting when nothing better is configured. */
  return new GooglePageSpeedProvider(k)
}

/** Seconds out of a Lighthouse display value like "2.4 s" or "1,240 ms". */
function seconds(display: string | null): number | null {
  if (!display) return null
  const m = display.replace(/,/g, '').match(/([\d.]+)\s*(ms|s)/i)
  if (!m) return null
  const n = Number(m[1])
  return m[2].toLowerCase() === 'ms' ? Math.round(n / 100) / 10 : n
}

export interface PageSpeedCollected {
  signals: Signal[]
  exhibits: RenderExhibit[]
  errors: string[]
}

/**
 * Measure the homepage the way the template asks, and keep Lighthouse's own
 * screenshot as the performance exhibit the report embeds.
 */
export async function collectPageSpeed(
  provider: PageSpeedProvider,
  url: string,
  opts: { exhibitDir: string; reviewId?: string },
): Promise<PageSpeedCollected> {
  const signals: Signal[] = []
  const exhibits: RenderExhibit[] = []
  const errors: string[] = []
  if (provider.provisional) return { signals, exhibits, errors }

  let r: PageSpeedResult | null
  try {
    r = await provider.run(url, 'mobile')
  } catch (err) {
    errors.push((err as Error).message)
    return { signals, exhibits, errors }
  }
  if (!r) return { signals, exhibits, errors }

  const via = `Google PageSpeed Insights (Lighthouse, mobile) on ${url}`
  const push = (key: string, value: string | number | null, what: string) => {
    if (value === null) return
    signals.push({ key, value, source: 'provider', provenance: `${what} — ${via}` })
  }
  push('perf.score', r.score, `Lighthouse performance score ${r.score}/100`)
  push('perf.lcp_seconds', seconds(r.largestContentfulPaint),
    `Largest Contentful Paint ${r.largestContentfulPaint}`)
  push('perf.fcp_seconds', seconds(r.firstContentfulPaint),
    `First Contentful Paint ${r.firstContentfulPaint}`)
  push('perf.speed_index_seconds', seconds(r.speedIndex), `Speed Index ${r.speedIndex}`)
  if (r.opportunities.length > 0) {
    signals.push({
      key: 'perf.top_opportunity', value: r.opportunities[0], source: 'provider',
      provenance: `Lighthouse's highest-impact fix, ahead of ${r.opportunities.length - 1} others — ${via}`,
    })
  }

  if (r.screenshotDataUri) {
    const b64 = r.screenshotDataUri.replace(/^data:image\/[a-z]+;base64,/, '')
    const rel = opts.reviewId ? `${opts.reviewId}/performance.png` : 'performance.png'
    const abs = path.join(opts.exhibitDir, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, Buffer.from(b64, 'base64'))
    exhibits.push({
      kind: 'performance_report',
      label: r.score !== null
        ? `Lighthouse performance: ${r.score}/100 on mobile`
        : 'Lighthouse performance report',
      path: rel,
      width: 412, height: 823, // Lighthouse's mobile emulation viewport
    })
  }

  return { signals, exhibits, errors }
}
