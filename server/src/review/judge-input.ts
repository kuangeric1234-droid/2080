import { parse } from 'node-html-parser'
import { classifyPaths } from './collect.ts'

/* The other half of the exam: what the model is shown.
 *
 * The labels (1.39) say what the reviewer concluded. They were written about a
 * site as it stood on the report's own date, and 10 of the 17 reports are from
 * 2024 or earlier. Scoring a model on today's homepage against a 2019 verdict
 * would measure how much the practice has changed, not how well the model
 * judges — and it would score every correct answer as wrong wherever the site
 * has since been rebuilt, which is exactly the case those reports describe.
 *
 * So each case is reconstructed from the Wayback capture nearest its report
 * date. The `id_` suffix asks the archive for the original bytes rather than
 * the replay page, so there is no archive toolbar in the HTML and no archive
 * chrome in a screenshot.
 *
 * The page-type counts come from `classifyPaths`, the same function the live
 * collector uses. If the exam classified pages its own way it would be
 * measuring the classifier rather than the model. */

export interface JudgeInput {
  domain: string
  /** The capture actually used: yyyyMMddHHmmss. */
  timestamp: string
  /** How far the capture is from the report date, in days. */
  driftDays: number | null
  /** The archive URL a human can open to see what the model saw. */
  replayUrl: string
  title: string
  /** Visible homepage text, tags stripped the way a browser renders them. */
  homepageText: string
  /** Internal paths reachable from the homepage. */
  paths: string[]
  pages: ReturnType<typeof classifyPaths>
  /** Images on the homepage, by alt text — thin, but it is what a crawler sees. */
  imageAlts: string[]
}

/** dd/mm/yyyy or dd/mm/yy, as the reports write it. */
export function reportDate(s: string | null): Date | null {
  const m = (s ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (!m) return null
  const yy = Number(m[3])
  const year = yy < 100 ? 2000 + yy : yy
  const d = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1])))
  return Number.isNaN(d.getTime()) ? null : d
}

const stamp = (d: Date) =>
  d.toISOString().replace(/[-:T]/g, '').slice(0, 14)

function parseStamp(ts: string): Date | null {
  const m = ts.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

/** Strip a URL down to the host we are auditing. */
function hostOf(s: string): string {
  try {
    return new URL(s.includes('://') ? s : `https://${s}`).hostname.toLowerCase().replace(/^www\./, '')
  } catch { return s.toLowerCase().replace(/^www\./, '') }
}

/**
 * The capture closest to `when`, preferring one taken before it.
 *
 * Before, because the report describes a site the reviewer had already looked
 * at. A capture from three months later can show a rebuild the report is the
 * reason for, which would score the model wrong for agreeing with the reviewer.
 */
export async function captureNear(
  domain: string, when: Date, fetchImpl: typeof fetch = fetch,
): Promise<{ timestamp: string; driftDays: number } | null> {
  const host = hostOf(domain)
  const q = new URLSearchParams({
    url: host, output: 'json', fl: 'timestamp', filter: 'statuscode:200',
    collapse: 'timestamp:6', limit: '600',
  })
  /* The CDX endpoint rate-limits with a 503 under any sustained use, and this
     runs 17 times back to back. Retry rather than lose a case to it. */
  let res: Response | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetchImpl(`https://web.archive.org/cdx/search/cdx?${q}`)
    if (res.ok) break
    if (res.status !== 503 && res.status !== 429) break
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
  }
  if (!res || !res.ok) throw new Error(`web archive: HTTP ${res?.status ?? '?'}`)
  const body = await res.json() as string[][]
  if (!Array.isArray(body) || body.length < 2) return null

  const target = when.getTime()
  const stamps = body.slice(1).map((r) => r[0]).filter(Boolean)
  const before = stamps.filter((t) => { const d = parseStamp(t); return d && d.getTime() <= target })
  const pool = before.length > 0 ? before : stamps
  let best: string | null = null
  let bestGap = Infinity
  for (const t of pool) {
    const d = parseStamp(t)
    if (!d) continue
    const gap = Math.abs(d.getTime() - target)
    if (gap < bestGap) { bestGap = gap; best = t }
  }
  if (!best) return null
  return { timestamp: best, driftDays: Math.round(bestGap / 86_400_000) }
}

/** Visible text, with tags stripped to spaces the way a browser renders them. */
export function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Build one exam case from the archive. */
export async function buildJudgeInput(
  domain: string, when: Date, fetchImpl: typeof fetch = fetch,
  known?: { timestamp: string; driftDays: number },
): Promise<JudgeInput | null> {
  /* The caller usually has the capture already. Re-querying CDX per case
     doubled the request rate and the endpoint started 503-ing, which the
     catch below turned into "no archive available" — so cases whose archive
     capture was seven days from the report silently fell back to a live site
     eighteen months adrift. A rate limit became a data-quality problem. */
  const cap = known ?? await captureNear(domain, when, fetchImpl)
  if (!cap) return null
  const host = hostOf(domain)

  /* `id_` = the original bytes. Without it the archive returns its replay
     wrapper, whose injected toolbar and rewritten links would both pollute the
     text and turn every internal path into a web.archive.org URL. */
  const raw = `https://web.archive.org/web/${cap.timestamp}id_/https://${host}/`
  const res = await fetchImpl(raw)
  if (!res.ok) throw new Error(`archive replay: HTTP ${res.status} for ${raw}`)
  const html = await res.text()
  return extract(html, host, {
    timestamp: cap.timestamp,
    driftDays: cap.driftDays,
    replayUrl: `https://web.archive.org/web/${cap.timestamp}/https://${host}/`,
  })
}

/** Pull the exam's view of a homepage out of its HTML. */
function extract(
  html: string, host: string,
  meta: { timestamp: string; driftDays: number | null; replayUrl: string },
): JudgeInput {
  const root = parse(html)

  const paths = [...new Set(
    root.querySelectorAll('a[href]')
      .map((a) => a.getAttribute('href') ?? '')
      .map((href) => {
        /* The archive rewrites some links even under id_; unwrap those back to
           the original before deciding what kind of page they are. */
        const unwrapped = href.replace(/^https?:\/\/web\.archive\.org\/web\/\d+\w*\//, '')
        try {
          const u = new URL(unwrapped, `https://${host}/`)
          return hostOf(u.hostname) === host ? u.pathname.toLowerCase() : ''
        } catch { return '' }
      })
      .filter((p) => p && p !== '/'),
  )]

  return {
    domain: host,
    ...meta,
    title: root.querySelector('title')?.text?.trim() ?? '',
    homepageText: visibleText(html).slice(0, 12_000),
    paths,
    pages: classifyPaths(paths),
    imageAlts: root.querySelectorAll('img')
      .map((i) => (i.getAttribute('alt') ?? '').trim())
      .filter(Boolean)
      .slice(0, 60),
  }
}

/** The same extraction against the site as it stands now. */
export async function buildLiveInput(
  domain: string, fetchImpl: typeof fetch = fetch,
): Promise<JudgeInput | null> {
  const host = hostOf(domain)
  const res = await fetchImpl(`https://${host}/`, { redirect: 'follow' })
  if (!res.ok) throw new Error(`live fetch: HTTP ${res.status} for ${host}`)
  const html = await res.text()
  return extract(html, host, { timestamp: 'live', driftDays: null, replayUrl: `https://${host}/` })
}

/**
 * Whichever view of the site is closest to the day the report was written.
 *
 * Measured across the 17: the archive wins 15 times, usually by a wide margin
 * — median drift around a month, and five cases inside a fortnight. It loses
 * twice, both on reports written so recently that the archive has not caught
 * up: Oh Dental was reported six days ago and its nearest capture is 513 days
 * old. Picking per case rather than globally is the difference between an exam
 * that shows the model the site the reviewer saw and one that shows it a
 * rebuild the report is the reason for.
 */
export async function buildCaseInput(
  domain: string, when: Date, opts: { now?: Date; fetchImpl?: typeof fetch } = {},
): Promise<{ input: JudgeInput; source: 'archive' | 'live' } | null> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const now = opts.now ?? new Date()
  const liveDrift = Math.round((now.getTime() - when.getTime()) / 86_400_000)

  let cap: Awaited<ReturnType<typeof captureNear>> = null
  let capError: string | null = null
  try { cap = await captureNear(domain, when, fetchImpl) } catch (e) { capError = (e as Error).message }

  const archive = async () => {
    if (!cap) return null
    const i = await buildJudgeInput(domain, when, fetchImpl, cap)
    return i && usable(i) ? { input: i, source: 'archive' as const } : null
  }
  const live = async () => {
    const i = await buildLiveInput(domain, fetchImpl)
    return i && usable(i) ? { input: { ...i, driftDays: liveDrift }, source: 'live' as const } : null
  }

  /* Closest first, but a thin page is not an exam case however close it is:
     two of the seventeen returned homepages of 24 and 50 characters, which is
     a JavaScript shell, not a site. Fall through to the other source rather
     than scoring a model on an empty string. */
  const order = cap && cap.driftDays <= liveDrift ? [archive, live] : [live, archive]
  for (const attempt of order) {
    try {
      const got = await attempt()
      if (got) return got
    } catch { /* try the other source */ }
  }
  if (capError) throw new Error(`no usable view of ${domain}: ${capError}`)
  return null
}

/* Enough of a page to judge. A homepage under 400 visible characters is a
   client-rendered shell or an error page; the model would be marked against
   Wally's verdict on a site it never saw. */
export function usable(i: JudgeInput): boolean {
  return i.homepageText.length >= 400
}
