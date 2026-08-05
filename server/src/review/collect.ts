import { parse, type HTMLElement } from 'node-html-parser'
import dns from 'node:dns/promises'
import net from 'node:net'
import tls from 'node:tls'
import type { Signal, SignalValue } from './signals.ts'

/* The fetch layer: everything measurable from the HTML, the DNS records and the
   TLS handshake — no browser, no paid API, no key. It produces ~25 of the ~35
   signals the bank triggers on, which is the whole of Website (Technical) and
   most of the markup-visible half of Website (Usability).

   What it deliberately cannot do: computed styles, sticky behaviour, contrast,
   real render timing, screenshots. Those need a browser and arrive in the
   render layer; the signals they own simply stay absent, and a trigger over an
   absent signal does not fire. A missing signal is silence, never a guess. */

const UA = '20-80 Online Presence Review (+https://2080solutions.com.au)'
const PUBLIC_MAIL = [
  'gmail.com', 'yahoo.com', 'yahoo.com.au', 'hotmail.com', 'outlook.com', 'live.com',
  'bigpond.com', 'bigpond.net.au', 'optusnet.com.au', 'iinet.net.au', 'icloud.com', 'aol.com',
]
const BOOKING_HINTS = [
  'book-online', 'book-now', 'bookings', 'booking', 'appointment', 'make-an-appointment',
  'healthengine', 'cliniko', 'nookal', 'praktika', 'dentalhub', 'setmore', 'calendly',
]
const CONDITION_HINTS = [
  'condition', 'problem', 'symptom', 'pain', 'ache', 'injur', 'concern', 'issues',
]
const BLOG_HINTS = ['blog', 'news', 'article', 'insights', 'resources']
const TEAM_HINTS = ['team', 'our-team', 'about-us', 'staff', 'doctors', 'dentists', 'practitioners', 'meet-']
const TESTIMONIAL_HINTS = ['testimonial', 'what our patients say', 'patient reviews', 'client reviews']

export interface CrawlOptions {
  maxPages?: number
  timeoutMs?: number
  /** Injectable for tests — same contract as global fetch. */
  fetchImpl?: typeof fetch
  /** DNS and TLS lookups go to the real network. Off for fixture-backed tests. */
  networkProbes?: boolean
}

export interface Page {
  url: string
  status: number
  html: string
  root: HTMLElement
}

export interface CollectResult {
  target: string
  finalUrl: string
  signals: Signal[]
  pages: Page[]
  /** Every URL the site publishes, from its sitemap. Empty when there is none. */
  sitemap: string[]
  errors: string[]
}

const sig = (key: string, value: SignalValue, source: Signal['source'], provenance: string): Signal =>
  ({ key, value, source, provenance })

/** Run the fetch-layer collectors against one domain. */
export async function collectFetchLayer(input: string, opts: CrawlOptions = {}): Promise<CollectResult> {
  const maxPages = opts.maxPages ?? 12
  const timeoutMs = opts.timeoutMs ?? 15_000
  const doFetch = opts.fetchImpl ?? fetch
  const errors: string[] = []
  const signals: Signal[] = []

  const start = normaliseUrl(input)
  const host = new URL(start).host
  const target = host.replace(/^www\./, '')

  /* ── homepage ──
     Try https first, then fall back to http. The fallback is not politeness:
     an http-only practice site is exactly the one that earns the "not using
     SSL" finding, and without this we would fail to collect the sites that
     most need the report. */
  let home = await get(start, doFetch, timeoutMs)
  let insecureFallback = false
  if (!home && start.startsWith('https://')) {
    home = await get(start.replace(/^https:/, 'http:'), doFetch, timeoutMs)
    insecureFallback = home !== null
  }
  if (!home) {
    errors.push(`could not fetch ${start} over https or http`)
    return { target, finalUrl: start, signals, pages: [], sitemap: [], errors }
  }
  const finalUrl = home.url
  const finalHost = new URL(finalUrl).host
  const secure = finalUrl.startsWith('https:') && !insecureFallback

  /* site.load_seconds is deliberately NOT emitted here. Document-download time
     flattered sites that transfer fast and then spend seconds rendering, which
     is the opposite of what a visitor experiences. The render layer measures it
     properly against the load event (render.ts). */
  signals.push(
    sig('site.https', secure, 'http',
      insecureFallback
        ? `${start} did not answer over https; the site served ${finalUrl} over plain http (HTTP ${home.status})`
        : `GET ${start} resolved to ${finalUrl} (HTTP ${home.status})`),
  )

  const pages: Page[] = [home.page]
  const homeRoot = home.page.root

  /* Page counts are only meaningful over the whole site. Classifying from a
     nav-only crawl reported "no service pages" on a practice that has a dozen
     of them, purely because they were not in the top menu — a false accusation
     in a client-facing report. The sitemap is the authority; the nav crawl is
     only for reading markup we then measure. */
  const sitemap = await fetchSitemap(finalUrl, finalHost, doFetch, timeoutMs)

  const navRoot = pickNav(homeRoot)
  const origin = new URL(finalUrl).origin
  const navLinks = collectNavLinks(navRoot ?? homeRoot, origin)
  for (const url of navLinks.slice(0, maxPages - 1)) {
    const p = await get(url, doFetch, timeoutMs)
    if (p) pages.push(p.page)
    else errors.push(`could not fetch ${url}`)
  }
  signals.push(sig('pages.total', sitemap.length || pages.length, 'crawl',
    sitemap.length
      ? `Sitemap lists ${sitemap.length} pages; ${pages.length} fetched for markup analysis`
      : `No sitemap found — crawled ${pages.length} pages reachable from the primary navigation`))

  signals.push(...navSignals(navRoot, navLinks))
  signals.push(...platformSignals(homeRoot, home.headers))
  signals.push(...analyticsSignals(homeRoot))
  signals.push(...structureSignals(pages, sitemap))
  signals.push(...onPageSignals(homeRoot, pages))
  signals.push(...linkSignals(pages, origin))
  signals.push(...socialSignals(pages))

  /* Where the practice is. Google's Text Search fuzzy-matches a name to any
     business that sounds similar — "Oh Dental" returned "One Week Dental" in
     Melbourne for a practice in South Australia — so the Places lookup needs a
     place to anchor on, and the site's own footer is where it says. */
  const locality = postalLocality(pages)
  if (locality) {
    signals.push(sig('site.contact.locality', locality, 'crawl',
      `Address found in the page content: "${locality}"`))
  }

  const contact = contactEmail(pages)
  if (contact) {
    const domain = contact.split('@')[1].toLowerCase()
    signals.push(
      sig('site.contact.email', contact, 'crawl', `Found "${contact}" in the page content`),
      sig('site.contact.email_domain_public', PUBLIC_MAIL.includes(domain), 'crawl',
        `Contact address is on ${domain}`),
    )
  }

  // ── DNS + TLS ──
  if (opts.networkProbes !== false) {
    signals.push(...(await emailHostingSignals(target, finalHost, errors)))
    if (secure) {
      const cert = await tlsInfo(finalHost, errors)
      if (cert) {
        signals.push(sig('site.tls_days_left', cert.daysLeft, 'tls',
          `Certificate issued by ${cert.issuer}, expires ${cert.validTo}`))
      }
    }
  }
  if (await wpAdminOpen(finalUrl, doFetch, timeoutMs)) {
    signals.push(sig('site.wp_admin_default', true, 'http',
      `GET ${new URL('/wp-admin/', finalUrl).href} returned a login page at the default path`))
  }

  return { target, finalUrl, signals, pages, sitemap, errors }
}

/** All URLs the site publishes. Follows one level of sitemap index. */
async function fetchSitemap(
  finalUrl: string,
  host: string,
  doFetch: typeof fetch,
  timeoutMs: number,
): Promise<string[]> {
  const seen = new Set<string>()
  const read = async (url: string): Promise<string> => {
    const r = await get(url, doFetch, timeoutMs)
    return r && r.status === 200 && r.page.html.includes('<') ? r.page.html : ''
  }
  const locs = (xml: string) =>
    [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1])

  for (const candidate of ['/sitemap_index.xml', '/sitemap.xml', '/wp-sitemap.xml']) {
    const xml = await read(new URL(candidate, finalUrl).href)
    if (!xml) continue
    const found = locs(xml)
    if (found.length === 0) continue

    if (/<sitemapindex/i.test(xml)) {
      for (const child of found.slice(0, 10)) {
        for (const u of locs(await read(child))) addIfInternal(u, host, seen)
      }
    } else {
      for (const u of found) addIfInternal(u, host, seen)
    }
    if (seen.size) break
  }
  return [...seen]
}

function addIfInternal(u: string, host: string, into: Set<string>): void {
  try {
    const parsed = new URL(u)
    if (parsed.host !== host) return
    if (/\.(jpe?g|png|gif|webp|svg|pdf|docx?|xml)$/i.test(parsed.pathname)) return
    parsed.hash = ''
    into.add(parsed.href)
  } catch { /* malformed loc */ }
}

// ────────────────────────────────────────────────────────────── fetch helpers

function normaliseUrl(input: string): string {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed.replace(/^\/+/, '')}`
}

async function get(
  url: string,
  doFetch: typeof fetch,
  timeoutMs: number,
): Promise<{ url: string; status: number; headers: Headers; page: Page } | null> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await doFetch(url, {
      redirect: 'follow',
      signal: ac.signal,
      headers: { 'user-agent': UA, accept: 'text/html,*/*' },
    })
    const html = await res.text()
    return {
      url: res.url || url,
      status: res.status,
      headers: res.headers,
      page: { url: res.url || url, status: res.status, html, root: parse(html, { comment: false }) },
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ─────────────────────────────────────────────────────────────── collectors

function pickNav(root: HTMLElement): HTMLElement | null {
  const candidates = [
    ...root.querySelectorAll('nav'),
    ...root.querySelectorAll('[role="navigation"]'),
    ...root.querySelectorAll('header ul'),
  ]
  // the primary nav is the one with the most links, ignoring footers
  let best: HTMLElement | null = null
  let bestCount = 0
  for (const c of candidates) {
    if (c.closest('footer')) continue
    const n = c.querySelectorAll('a[href]').length
    if (n > bestCount) { best = c; bestCount = n }
  }
  return bestCount >= 3 ? best : null
}

function collectNavLinks(scope: HTMLElement, base: string): string[] {
  const out = new Set<string>()
  for (const a of scope.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') ?? ''
    const abs = absolute(href, base)
    if (abs) out.add(abs)
  }
  return [...out]
}

function navSignals(nav: HTMLElement | null, links: string[]): Signal[] {
  if (!nav) return []
  // top-level items only: direct <li> children of the outermost list
  const list = nav.tagName === 'UL' ? nav : nav.querySelector('ul')
  const items = list
    ? list.childNodes.filter((n) => (n as HTMLElement).tagName === 'LI')
    : nav.querySelectorAll('a[href]')
  const count = items.length
  const labels = nav.querySelectorAll('a[href]').map((a) => a.text.trim().toLowerCase())
  return [
    sig('render.nav_item_count', count, 'crawl',
      `Primary navigation has ${count} top-level items (${links.length} links in total)`),
    sig('render.nav_has_home', labels.includes('home'), 'crawl',
      labels.includes('home') ? 'Navigation contains a "Home" item' : 'No "Home" item in the navigation'),
  ]
}

function platformSignals(root: HTMLElement, headers: Headers): Signal[] {
  const html = root.toString()
  const generator = root.querySelector('meta[name="generator"]')?.getAttribute('content') ?? ''
  const poweredBy = headers.get('x-powered-by') ?? ''
  let cms = 'unknown'
  let why = ''

  if (/wp-content|wp-includes|wp-json/i.test(html) || /wordpress/i.test(generator)) {
    cms = 'wordpress'; why = 'wp-content / wp-json references in the markup'
  } else if (/squarespace/i.test(html) || /squarespace/i.test(generator)) {
    cms = 'squarespace'; why = 'Squarespace assets in the markup'
  } else if (/wix\.com|_wixCssImports|static\.parastorage/i.test(html)) {
    cms = 'wix'; why = 'Wix runtime assets in the markup'
  } else if (/cdn\.shopify\.com|Shopify\.theme/i.test(html)) {
    cms = 'shopify'; why = 'Shopify CDN references in the markup'
  } else if (!/<script/i.test(html) || html.length < 40_000) {
    cms = 'static'; why = 'No CMS fingerprint and a hand-authored document structure'
  }
  if (generator) why += why ? `; generator meta "${generator}"` : `generator meta "${generator}"`
  if (poweredBy) why += `; X-Powered-By: ${poweredBy}`

  return [sig('site.cms', cms, 'crawl', why || 'No platform fingerprint found')]
}

function analyticsSignals(root: HTMLElement): Signal[] {
  const html = root.toString()
  const ga4 = /gtag\/js\?id=G-|googletagmanager\.com\/gtag/i.test(html)
  const gtm = /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/i.test(html)
  return [
    sig('site.analytics.ga4', ga4, 'crawl',
      ga4 ? 'gtag.js with a G- measurement id is loaded' : 'No GA4 gtag found in the homepage markup'),
    sig('site.analytics.gtm', gtm, 'crawl',
      gtm ? 'A Google Tag Manager container is loaded' : 'No GTM container found in the homepage markup'),
  ]
}

function structureSignals(pages: Page[], sitemap: string[]): Signal[] {
  /* Count over the sitemap when there is one — a nav-only view undercounts and
     produces false "you have no service pages" findings. Where there is no
     sitemap the counts are unknowable from a 12-page crawl, so they are emitted
     as null: the trigger then does not fire and the report stays silent rather
     than accusing. */
  const haveFullView = sitemap.length > 0
  const universe = haveFullView ? sitemap : pages.map((p) => p.url)
  const paths = universe.map((u) => {
    try { return new URL(u).pathname.toLowerCase() } catch { return '' }
  })
  const basis = haveFullView ? `the ${sitemap.length}-page sitemap` : `the ${pages.length} pages crawled`
  const allHtml = pages.map((p) => p.root.toString()).join('\n').toLowerCase()

  const servicePages = paths.filter(
    (p) => /\/(service|treatment|procedure)s?\/[^/]+\/?$/.test(p) || /\/(dental-|our-)?services?\/[^/]+\/?$/.test(p),
  ).length
  const bioPages = paths.filter(
    (p) => /\/(dr|doctor|team|about-us|our-team|staff|practitioners?|meet)[^/]*\/[^/]+\/?$/.test(p) || /\/(dr|doctor)-[a-z-]+\/?$/.test(p),
  ).length
  const conditionPages = paths.filter((p) => CONDITION_HINTS.some((h) => p.includes(h))).length
  const blogPresent = paths.some((p) => BLOG_HINTS.some((h) => p.includes(`/${h}`)))
  const booking =
    paths.some((p) => BOOKING_HINTS.some((h) => p.includes(h))) ||
    BOOKING_HINTS.some((h) => allHtml.includes(h))

  const unknown = (n: number): number | null => (haveFullView || n > 0 ? n : null)
  const unknownNote = (what: string) =>
    `Cannot tell from ${basis} whether the site has ${what} — no sitemap to count against`

  const out: Signal[] = [
    sig('pages.service_pages', unknown(servicePages), 'crawl',
      unknown(servicePages) === null ? unknownNote('dedicated service pages')
        : `${servicePages} dedicated service pages in ${basis}`),
    sig('pages.bio_pages', unknown(bioPages), 'crawl',
      unknown(bioPages) === null ? unknownNote('individual practitioner pages')
        : bioPages ? `${bioPages} individual practitioner pages in ${basis}`
        : `No individual practitioner biography pages in ${basis}`),
    sig('pages.conditions_pages', unknown(conditionPages), 'crawl',
      unknown(conditionPages) === null ? unknownNote('condition-led pages')
        : conditionPages ? `${conditionPages} pages address a patient problem rather than a treatment`
        : `No condition- or symptom-led pages in ${basis}`),
    sig('blog.present', haveFullView || blogPresent ? blogPresent : null, 'crawl',
      blogPresent ? `A blog or news section appears in ${basis}`
        : haveFullView ? `No blog or news section in ${basis}`
        : unknownNote('a blog')),
    sig('site.booking.present', booking, 'crawl',
      booking ? 'An online booking link or third-party booking widget was found' : 'No online booking link or widget found'),
    ...testimonialSignal(pages),
  ]

  const teamPage = pages.find((p) => TEAM_HINTS.some((h) => new URL(p.url).pathname.toLowerCase().includes(h)))
  if (teamPage) {
    const imgs = teamPage.root.querySelectorAll('img')
    const linked = imgs.some((img) => !!img.closest('a'))
    out.push(sig('render.team_images_linked', linked, 'crawl',
      `Practitioner photos on ${new URL(teamPage.url).pathname} are ${linked ? '' : 'not '}wrapped in a link`))
  }
  return out
}

/* AHPRA is a hard blocking gate, so a false positive here is expensive — it
   accuses a practice of a compliance breach. Require the word in a heading, a
   class name or a URL, not merely somewhere in the page text (a blog post
   *about* the testimonial rule would otherwise trip it). */
function testimonialSignal(pages: Page[]): Signal[] {
  for (const p of pages) {
    const path = new URL(p.url).pathname.toLowerCase()
    if (/testimonial|patient-review|review(s)?-page/.test(path)) {
      return [sig('content.testimonials_present', true, 'crawl',
        `${path} is a testimonials page — AHPRA prohibits reviews on a practice's own site`)]
    }
    const headings = p.root.querySelectorAll('h1,h2,h3').map((h) => h.text.trim().toLowerCase())
    const hit = headings.find((h) => TESTIMONIAL_HINTS.some((t) => h.includes(t)))
    if (hit) {
      return [sig('content.testimonials_present', true, 'crawl',
        `Heading "${hit}" on ${path} — AHPRA prohibits reviews or testimonials on a practice's own site`)]
    }
    const classHit = /class="[^"]*(testimonial|patient-review)[^"]*"/i.test(p.root.toString())
    if (classHit) {
      return [sig('content.testimonials_present', true, 'crawl',
        `A testimonial component is rendered on ${path} — AHPRA prohibits reviews on a practice's own site`)]
    }
  }
  return [sig('content.testimonials_present', false, 'crawl',
    `No testimonial heading, component or page found across ${pages.length} pages`)]
}

function onPageSignals(home: HTMLElement, pages: Page[]): Signal[] {
  const title = home.querySelector('title')?.text.trim() ?? ''
  const meta = home.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? ''
  const generic = /^(home|welcome|untitled|new page)\b/i.test(title)
  let altMissing = 0
  let imgs = 0
  for (const p of pages) {
    for (const img of p.root.querySelectorAll('img')) {
      imgs++
      if (!(img.getAttribute('alt') ?? '').trim()) altMissing++
    }
  }
  const viewport = !!home.querySelector('meta[name="viewport"]')
  return [
    sig('onpage.title_ok', title.length >= 20 && title.length <= 70 && !generic, 'crawl',
      title ? `Homepage title is "${title}" (${title.length} characters)` : 'Homepage has no title tag'),
    sig('onpage.meta_ok', meta.length >= 70 && meta.length <= 165, 'crawl',
      meta ? `Meta description is ${meta.length} characters` : 'Homepage has no meta description'),
    sig('onpage.alt_missing', altMissing, 'crawl',
      `${altMissing} of ${imgs} images across ${pages.length} pages have no alt text`),
    sig('render.mobile_ok', viewport, 'crawl',
      viewport ? 'A mobile viewport meta tag is set' : 'No mobile viewport meta tag — the page will not scale on a phone'),
  ]
}

/* Where a same-tab external link goes, not how many anchors point there.

   Two things were wrong with counting anchors. A social icon and a footer
   credit sit in the header and footer of every page, so one destination was
   counted once per page crawled — ohdental.com.au scored 60 against four
   distinct destinations, and the number would have grown with the crawl rather
   than with the problem. And the booking system was in that count: the
   paragraph warns the visitor will "not come back to your website to make the
   necessary inquiry", but sending them to the booking page *is* that inquiry,
   and the template treats third-party booking in a paragraph of its own. Its
   own examples are social profiles and footer vendor links (§13.2 1.33). */
function sameTabDestinations(pages: Page[], base: string): Set<string> {
  const hosts = new Set<string>()
  for (const p of pages) {
    for (const a of p.root.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') ?? ''
      if (!isExternal(href, base) || (a.getAttribute('target') ?? '') === '_blank') continue
      if (BOOKING_HINTS.some((h) => href.toLowerCase().includes(h))) continue
      try { hosts.add(new URL(href, base).host.replace(/^www\./, '')) } catch { /* not a URL */ }
    }
  }
  return hosts
}

function linkSignals(pages: Page[], base: string): Signal[] {
  let tel = 0
  let mailto = 0
  let legacyCaptcha = false
  for (const p of pages) {
    for (const a of p.root.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') ?? ''
      if (href.startsWith('tel:')) tel++
      else if (href.startsWith('mailto:')) mailto++
    }
    const html = p.root.toString()
    if (/captcha/i.test(html) && !/recaptcha|hcaptcha|turnstile/i.test(html)) legacyCaptcha = true
  }
  const sameTab = sameTabDestinations(pages, base)
  return [
    sig('render.external_links_same_tab', sameTab.size, 'crawl',
      sameTab.size
        ? `${sameTab.size} third-party destination${sameTab.size === 1 ? '' : 's'} open in the same tab (${[...sameTab].join(', ')})`
        : 'Every third-party link opens in a new tab'),
    sig('render.tel_links', tel, 'crawl',
      tel ? `${tel} tappable tel: links found` : 'No tappable tel: links — phone numbers are plain text'),
    sig('render.mailto_links', mailto, 'crawl',
      mailto ? `${mailto} mailto: links found` : 'No mailto: links — email addresses are plain text'),
    sig('render.captcha_legacy', legacyCaptcha, 'crawl',
      legacyCaptcha ? 'A CAPTCHA is present that is not reCAPTCHA, hCaptcha or Turnstile' : 'No legacy CAPTCHA found'),
  ]
}

function socialSignals(pages: Page[]): Signal[] {
  const out: Signal[] = []
  const find = (re: RegExp) => {
    for (const p of pages) {
      for (const a of p.root.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href') ?? ''
        if (re.test(href)) return href
      }
    }
    return null
  }
  const fb = find(/facebook\.com\//i)
  const ig = find(/instagram\.com\//i)
  if (fb) out.push(sig('social.facebook_url', fb, 'crawl', `Facebook page linked from the site: ${fb}`))
  if (ig) out.push(sig('social.instagram_url', ig, 'crawl', `Instagram profile linked from the site: ${ig}`))
  return out
}

/* "O'Halloran Hill SA 5158" — suburb, state, postcode. Australian addresses
   end this way and practice sites put one in the footer of every page. Take
   the whole tail rather than just the suburb: two suburbs share a name across
   states often enough to matter, and the postcode settles it. */
const AU_LOCALITY = /([A-Z][A-Za-z'\-]*(?:[ ][A-Z][A-Za-z'\-]*){0,3}),?\s+(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\s+(\d{4})\b/

function postalLocality(pages: Page[]): string | null {
  for (const p of pages) {
    /* Not `root.text`: the parser concatenates text nodes with no separator,
       so a footer of `<span>O'Halloran Hill</span><span>SA 5158</span>` comes
       out as "O'Halloran HillSA 5158" and no address regex will ever match it.
       Strip the tags to spaces the way a browser renders them. */
    const text = p.html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
      .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
    const m = text.match(AU_LOCALITY)
    if (m) return `${m[1]} ${m[2]} ${m[3]}`
  }
  return null
}

function contactEmail(pages: Page[]): string | null {
  for (const p of pages) {
    for (const a of p.root.querySelectorAll('a[href^="mailto:"]')) {
      const addr = (a.getAttribute('href') ?? '').replace(/^mailto:/i, '').split('?')[0].trim()
      if (addr.includes('@')) return addr
    }
    const m = p.root.text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
    if (m) return m[0]
  }
  return null
}

async function emailHostingSignals(domain: string, webHost: string, errors: string[]): Promise<Signal[]> {
  let mx: Array<{ exchange: string; priority: number }>
  try {
    mx = await dns.resolveMx(domain)
  } catch {
    return [sig('site.email.mx_host', null, 'dns', `No MX records published for ${domain}`)]
  }
  if (mx.length === 0) return [sig('site.email.mx_host', null, 'dns', `No MX records published for ${domain}`)]

  const primary = mx.sort((a, b) => a.priority - b.priority)[0].exchange
  const out: Signal[] = [
    sig('site.email.mx_host', primary, 'dns',
      `Primary MX for ${domain} is ${primary} (priority ${mx[0].priority})`),
  ]
  try {
    const [mailIps, webIps] = await Promise.all([resolveAny(primary), resolveAny(webHost)])
    if (mailIps.length && webIps.length) {
      const shared = mailIps.some((ip) => webIps.includes(ip))
      out.push(sig('site.email.same_server', shared, 'dns',
        shared
          ? `${primary} and ${webHost} both resolve to ${mailIps.find((ip) => webIps.includes(ip))}`
          : `${primary} resolves to ${mailIps[0]}, ${webHost} resolves to ${webIps[0]} — separate servers`))
    }
  } catch (e) {
    errors.push(`mail/web host comparison failed: ${(e as Error).message}`)
  }
  return out
}

async function resolveAny(host: string): Promise<string[]> {
  if (net.isIP(host)) return [host]
  try {
    return (await dns.resolve4(host)).slice(0, 4)
  } catch {
    return []
  }
}

async function tlsInfo(host: string, errors: string[]): Promise<{ daysLeft: number; issuer: string; validTo: string } | null> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 8000 }, () => {
      const cert = socket.getPeerCertificate()
      socket.end()
      if (!cert?.valid_to) return resolve(null)
      resolve({
        daysLeft: Math.round((new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000),
        issuer: [cert.issuer?.O].flat().filter(Boolean)[0] ?? 'unknown issuer',
        validTo: cert.valid_to,
      })
    })
    socket.on('error', (e) => { errors.push(`TLS check failed: ${e.message}`); resolve(null) })
    socket.on('timeout', () => { socket.destroy(); resolve(null) })
  })
}

async function wpAdminOpen(finalUrl: string, doFetch: typeof fetch, timeoutMs: number): Promise<boolean> {
  const url = new URL('/wp-admin/', finalUrl).href
  const res = await get(url, doFetch, timeoutMs)
  if (!res) return false
  return res.status === 200 && /user_login|wp-submit|loginform/i.test(res.page.html)
}

// ───────────────────────────────────────────────────────────────── url utils

/* `base` is the site's own origin, scheme included. Resolving against a
   hardcoded https:// meant every interior page of an http-only site was
   fetched over a scheme it does not serve — so the sites that most need the
   report were crawled one page deep. */
function absolute(href: string, base: string): string | null {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null
  if (href.startsWith('javascript:')) return null
  try {
    const u = new URL(href, base)
    if (u.host !== new URL(base).host) return null
    u.hash = ''
    return u.href
  } catch {
    return null
  }
}

function isExternal(href: string, base: string): boolean {
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('?')) return false
  try {
    return new URL(href, base).host !== new URL(base).host
  } catch {
    return false
  }
}
