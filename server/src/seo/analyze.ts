import { parse } from 'node-html-parser'

/* Deterministic on-page + technical SEO analysis (SPEC-SEO §4.2 technical/indexation
   class). No LLM, no external API — it reads the real HTML. The seo-diagnose skill
   adds narrative + prioritisation on top once the model key lands; this is the
   evidence layer under it. */

export type Severity = 'critical' | 'warning' | 'good'

export interface Finding {
  id: string
  severity: Severity
  title: string
  detail: string
}

export interface Category {
  key: string
  label: string
  score: number // earned
  max: number
  findings: Finding[]
}

export interface AuditReport {
  score: number // 0–100
  grade: string
  categories: Category[]
  stats: Record<string, string | number | boolean | null>
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
const grade = (s: number) => (s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 55 ? 'D' : s >= 40 ? 'E' : 'F')

/** Analyse one page's HTML. `meta` carries what only the fetch knew. */
export function analyze(
  url: string,
  html: string,
  meta: { status: number; finalUrl: string; https: boolean } = { status: 200, finalUrl: url, https: url.startsWith('https') },
): AuditReport {
  const root = parse(html, { comment: false })
  const q = (sel: string) => root.querySelector(sel)
  const qa = (sel: string) => root.querySelectorAll(sel)

  const title = q('title')?.text.trim() ?? ''
  const metaDesc = q('meta[name="description"]')?.getAttribute('content')?.trim() ?? ''
  const h1s = qa('h1').map((h) => h.text.trim()).filter(Boolean)
  const h2s = qa('h2').length
  const canonical = q('link[rel="canonical"]')?.getAttribute('href') ?? null
  const viewport = q('meta[name="viewport"]')?.getAttribute('content') ?? null
  const robots = (q('meta[name="robots"]')?.getAttribute('content') ?? '').toLowerCase()
  const lang = q('html')?.getAttribute('lang') ?? null
  const jsonLd = qa('script[type="application/ld+json"]')
  const ogTags = qa('meta[property^="og:"]').length
  const imgs = qa('img')
  const imgsNoAlt = imgs.filter((i) => !(i.getAttribute('alt') ?? '').trim()).length
  const bodyText = (q('body')?.text ?? root.text ?? '').replace(/\s+/g, ' ')
  const wc = words(bodyText)
  const links = qa('a[href]')
  const host = safeHost(meta.finalUrl)
  const internal = links.filter((a) => isInternal(a.getAttribute('href') ?? '', host)).length
  const external = links.length - internal
  const htmlBytes = html.length
  const noindex = robots.includes('noindex')

  const cats: Category[] = []
  const cat = (key: string, label: string, max: number, build: (f: Finding[]) => number): void => {
    const findings: Finding[] = []
    const earned = clamp(build(findings), 0, max)
    cats.push({ key, label, score: Math.round(earned), max, findings })
  }
  const fail = (f: Finding[], id: string, sev: Severity, title: string, detail: string) => f.push({ id, severity: sev, title, detail })

  // ── Indexation & crawlability (25) ──
  cat('indexation', 'Indexation & crawlability', 25, (f) => {
    let s = 25
    if (meta.status !== 200) { fail(f, 'status', 'critical', `Page returned HTTP ${meta.status}`, 'Search engines skip non-200 pages. Fix the status before anything else.'); s -= 12 }
    else fail(f, 'status', 'good', 'Returns HTTP 200', 'The page loads cleanly for crawlers.')
    if (noindex) { fail(f, 'noindex', 'critical', 'Page is set to noindex', 'A robots “noindex” tag is blocking this page from Google entirely — likely an accident.'); s -= 12 }
    if (!meta.https) { fail(f, 'https', 'warning', 'Not served over HTTPS', 'HTTPS is a ranking signal and a trust signal. Move to https.'); s -= 5 } else fail(f, 'https', 'good', 'Served over HTTPS', 'Secure and trusted.')
    if (!canonical) { fail(f, 'canonical', 'warning', 'No canonical tag', 'Add a self-referential canonical to avoid duplicate-content confusion.'); s -= 4 }
    else fail(f, 'canonical', 'good', 'Canonical tag present', canonical)
    return s
  })

  // ── Content & keywords (30) ──
  cat('content', 'Content & on-page', 30, (f) => {
    let s = 30
    if (!title) { fail(f, 'title', 'critical', 'Missing page title', 'The title tag is the single biggest on-page signal. Add one, ~50–60 characters, with the money keyword and suburb.'); s -= 10 }
    else if (title.length < 30 || title.length > 65) { fail(f, 'title', 'warning', `Title is ${title.length} characters`, `“${title}” — aim for 30–65 so it isn’t truncated in search.`); s -= 4 }
    else fail(f, 'title', 'good', 'Title length is healthy', `“${title}”`)

    if (!metaDesc) { fail(f, 'meta', 'warning', 'Missing meta description', 'No meta description — Google will invent one. Write a 70–155 char summary with a call to action.'); s -= 5 }
    else if (metaDesc.length < 70 || metaDesc.length > 160) { fail(f, 'meta', 'warning', `Meta description is ${metaDesc.length} characters`, 'Aim for 70–155 characters so it displays fully.'); s -= 2 }
    else fail(f, 'meta', 'good', 'Meta description is healthy', metaDesc)

    if (h1s.length === 0) { fail(f, 'h1', 'critical', 'No H1 heading', 'Every page needs exactly one H1 stating what the page is about.'); s -= 8 }
    else if (h1s.length > 1) { fail(f, 'h1', 'warning', `${h1s.length} H1 headings`, 'Use exactly one H1; demote the rest to H2.'); s -= 3 }
    else fail(f, 'h1', 'good', 'Exactly one H1', `“${h1s[0]}”`)

    if (h2s === 0) { fail(f, 'headings', 'warning', 'No H2 subheadings', 'Structure the page with H2s — helps readers and rich results.'); s -= 2 }

    if (wc < 250) { fail(f, 'thin', 'warning', `Thin content — ${wc} words`, 'Under 250 words reads as thin to Google (20-80 rule: write more or don’t ship the page).'); s -= 6 }
    else fail(f, 'wordcount', 'good', `${wc} words of content`, 'Enough depth to rank for real queries.')
    return s
  })

  // ── Structured data & social (15) ──
  cat('structured', 'Structured data & social', 15, (f) => {
    let s = 15
    if (jsonLd.length === 0) { fail(f, 'jsonld', 'warning', 'No schema markup (JSON-LD)', 'Add LocalBusiness / Dentist schema so Google shows hours, reviews and location in results.'); s -= 8 }
    else fail(f, 'jsonld', 'good', `${jsonLd.length} schema block(s) found`, 'Structured data is present for rich results.')
    if (ogTags < 2) { fail(f, 'og', 'warning', 'Missing Open Graph tags', 'Add og:title/description/image so shared links look right on Facebook & messages.'); s -= 4 }
    else fail(f, 'og', 'good', 'Open Graph tags present', 'Shared links will render with a title and image.')
    return s
  })

  // ── Media (15) ──
  cat('media', 'Images & media', 15, (f) => {
    let s = 15
    if (imgs.length === 0) { fail(f, 'noimg', 'warning', 'No images on the page', 'Real photos of the team/premises build trust and add alt-text keyword surface.'); s -= 4 }
    else if (imgsNoAlt > 0) { fail(f, 'alt', imgsNoAlt > imgs.length / 2 ? 'warning' : 'good', `${imgsNoAlt}/${imgs.length} images missing alt text`, 'Alt text helps accessibility and image search. Describe each image plainly.'); s -= Math.min(10, imgsNoAlt) }
    else fail(f, 'alt', 'good', `All ${imgs.length} images have alt text`, 'Accessible and indexable.')
    return s
  })

  // ── Technical & mobile (15) ──
  cat('technical', 'Technical & mobile', 15, (f) => {
    let s = 15
    if (!viewport) { fail(f, 'viewport', 'critical', 'No mobile viewport tag', 'Without a viewport meta the site won’t render right on phones — most patients search on mobile.'); s -= 7 }
    else fail(f, 'viewport', 'good', 'Mobile viewport set', 'The page is mobile-responsive-ready.')
    if (!lang) { fail(f, 'lang', 'warning', 'No lang attribute on <html>', 'Set lang (e.g. en-AU) — helps accessibility and localisation.'); s -= 2 }
    if (htmlBytes > 200_000) { fail(f, 'weight', 'warning', `Large HTML payload (${Math.round(htmlBytes / 1024)} KB)`, 'Heavy pages hurt Core Web Vitals on mobile. Trim inline scripts/markup.'); s -= 3 }
    if (links.length === 0) { fail(f, 'links', 'warning', 'No links found', 'Internal links spread ranking power and help crawlers.'); s -= 3 }
    else fail(f, 'links', 'good', `${internal} internal · ${external} external links`, 'Linked into the site structure.')
    return s
  })

  const total = Math.round(cats.reduce((a, c) => a + c.score, 0))
  return {
    score: total,
    grade: grade(total),
    categories: cats,
    stats: {
      title, titleLength: title.length, metaDescription: metaDesc, metaLength: metaDesc.length,
      h1Count: h1s.length, h2Count: h2s, wordCount: wc, images: imgs.length, imagesMissingAlt: imgsNoAlt,
      hasViewport: !!viewport, hasCanonical: !!canonical, schemaBlocks: jsonLd.length, ogTags,
      internalLinks: internal, externalLinks: external, htmlBytes, https: meta.https, lang, noindex,
      status: meta.status, finalUrl: meta.finalUrl,
    },
  }
}

function safeHost(u: string): string {
  try { return new URL(u).host } catch { return '' }
}
function isInternal(href: string, host: string): boolean {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false
  if (href.startsWith('/')) return true
  try { return new URL(href).host === host } catch { return true }
}
