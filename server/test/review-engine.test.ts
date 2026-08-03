import { describe, expect, it } from 'vitest'
import { collectFetchLayer } from '../src/review/collect.ts'
import { evaluate, manualWorklist, selectFindings, signalsToMap, suggestOverall, suggestScores } from '../src/review/engine.ts'
import { loadBank } from '../src/review/bank.ts'
import { SIGNAL_CATALOG } from '../src/review/signals.ts'
import { HEALTHY, NEGLECTED, OPAQUE, fixtureFetch } from './fixtures/practice-site.ts'

const bank = loadBank()

async function collect(site: typeof HEALTHY, origin: string) {
  return collectFetchLayer(origin, {
    fetchImpl: fixtureFetch(site, origin),
    networkProbes: false,
  })
}

describe('fetch-layer collector', () => {
  it('reads a healthy practice site into typed signals with provenance', async () => {
    const r = await collect(HEALTHY, 'https://heartsdental.test')
    const s = signalsToMap(r.signals)

    expect(r.errors).toEqual([])
    expect(s.get('site.https')?.value).toBe(true)
    expect(s.get('site.cms')?.value).toBe('wordpress')
    expect(s.get('site.analytics.ga4')?.value).toBe(true)
    expect(s.get('site.booking.present')?.value).toBe(true)
    expect(s.get('blog.present')?.value).toBe(true)
    expect(s.get('pages.service_pages')?.value).toBe(2)
    expect(s.get('pages.bio_pages')?.value).toBe(1)
    expect(s.get('pages.conditions_pages')?.value).toBe(1)
    expect(s.get('content.testimonials_present')?.value).toBe(false)
    expect(s.get('onpage.title_ok')?.value).toBe(true)
    expect(s.get('onpage.meta_ok')?.value).toBe(true)
    expect(s.get('render.mobile_ok')?.value).toBe(true)
    expect(s.get('render.tel_links')?.value).toBeGreaterThan(0)
    expect(s.get('render.nav_has_home')?.value).toBe(false)
    expect(s.get('social.facebook_url')?.value).toContain('facebook.com/heartsdental')
  })

  it('reads a neglected site into the opposite signals', async () => {
    const r = await collect(NEGLECTED, 'http://stellarsmiles.test')
    const s = signalsToMap(r.signals)

    expect(s.get('site.https')?.value).toBe(false)
    expect(s.get('site.cms')?.value).toBe('static')
    expect(s.get('site.analytics.ga4')?.value).toBe(false)
    expect(s.get('site.analytics.gtm')?.value).toBe(false)
    expect(s.get('site.booking.present')?.value).toBe(false)
    expect(s.get('blog.present')?.value).toBe(false)
    expect(s.get('pages.bio_pages')?.value).toBe(0)
    expect(s.get('content.testimonials_present')?.value).toBe(true)
    expect(s.get('onpage.title_ok')?.value).toBe(false)
    expect(s.get('onpage.meta_ok')?.value).toBe(false)
    expect(s.get('render.mobile_ok')?.value).toBe(false)
    expect(s.get('render.nav_item_count')?.value).toBe(11)
    expect(s.get('render.nav_has_home')?.value).toBe(true)
    expect(s.get('render.tel_links')?.value).toBe(0)
    expect(s.get('render.captcha_legacy')?.value).toBe(true)
    expect(s.get('site.contact.email_domain_public')?.value).toBe(true)
    expect(s.get('site.contact.email')?.value).toBe('stellar_smiles@yahoo.com')
  })

  /* Module 1.3 DoD: a real practice site yields enough typed, sourced evidence
     that the report is grounded rather than asserted. */
  it('produces at least 25 signals, every one carrying provenance', async () => {
    const r = await collect(NEGLECTED, 'http://stellarsmiles.test')
    expect(r.signals.length).toBeGreaterThanOrEqual(25)
    for (const s of r.signals) {
      expect(s.provenance, s.key).toBeTruthy()
      expect(s.provenance.length, s.key).toBeGreaterThan(10)
      expect(s.source, s.key).toBeTruthy()
    }
  })

  it('only emits signals the catalog documents', async () => {
    const r = await collect(HEALTHY, 'https://heartsdental.test')
    for (const s of r.signals) {
      expect(SIGNAL_CATALOG[s.key], `undocumented signal "${s.key}"`).toBeTruthy()
    }
  })
})

describe('trigger evaluation', () => {
  const s = signalsToMap([
    { key: 'site.https', value: false, source: 'http', provenance: 'served over http' },
    { key: 'render.body_font_px', value: 13, source: 'render', provenance: 'computed 13px' },
    { key: 'site.cms', value: 'squarespace', source: 'crawl', provenance: 'squarespace assets' },
  ])

  it('handles eq, lt and in', () => {
    expect(evaluate({ all: [{ signal: 'site.https', eq: false }] }, s).fires).toBe(true)
    expect(evaluate({ all: [{ signal: 'render.body_font_px', lt: 15 }] }, s).fires).toBe(true)
    expect(evaluate({ all: [{ signal: 'site.cms', in: ['squarespace', 'wix'] }] }, s).fires).toBe(true)
  })

  it('does not fire on an absent signal', () => {
    expect(evaluate({ all: [{ signal: 'site.analytics.ga4', eq: false }] }, s).fires).toBe(false)
    expect(evaluate({ all: [{ signal: 'site.analytics.ga4', missing: true }] }, s).fires).toBe(true)
  })

  it('reports which signals fired an any-trigger', () => {
    const r = evaluate({ any: [{ signal: 'site.https', eq: false }, { signal: 'site.cms', eq: 'wordpress' }] }, s)
    expect(r.fires).toBe(true)
    expect(r.triggeredBy).toEqual(['site.https'])
  })
})

describe('finding selection', () => {
  it('never emits a finding without the signal that earned it', async () => {
    const r = await collect(NEGLECTED, 'http://stellarsmiles.test')
    const found = selectFindings(signalsToMap(r.signals))
    expect(found.length).toBeGreaterThan(8)
    for (const c of found) {
      if (typeof c.snippet.when === 'string') continue
      expect(c.triggeredBy.length, c.snippet.id).toBeGreaterThan(0)
      expect(c.evidence.every((e) => e.length > 0), c.snippet.id).toBe(true)
    }
  })

  it('picks the negative half of each pair on the neglected site', async () => {
    const r = await collect(NEGLECTED, 'http://stellarsmiles.test')
    const ids = selectFindings(signalsToMap(r.signals)).map((c) => c.snippet.id)

    expect(ids).toContain('tech.https.absent')
    expect(ids).toContain('tech.cms.static_html')
    expect(ids).toContain('tech.analytics.absent')
    expect(ids).toContain('biz.booking.absent')
    expect(ids).toContain('biz.blog.absent')
    expect(ids).toContain('biz.ahpra.testimonials')
    expect(ids).toContain('biz.email.public_domain')
    expect(ids).toContain('seo.onpage.missing')
    expect(ids).toContain('use.mobile.absent')
    expect(ids).toContain('use.nav.too_many')
    expect(ids).toContain('use.nav.home_item')
    expect(ids).toContain('use.captcha.legacy')
    expect(ids).toContain('use.cta.not_tappable')

    expect(ids).not.toContain('tech.https.present')
    expect(ids).not.toContain('tech.analytics.present')
    expect(ids).not.toContain('biz.booking.present')
  })

  it('picks the positive half on the healthy site', async () => {
    const r = await collect(HEALTHY, 'https://heartsdental.test')
    const ids = selectFindings(signalsToMap(r.signals)).map((c) => c.snippet.id)

    expect(ids).toContain('tech.https.present')
    expect(ids).toContain('tech.cms.wordpress')
    expect(ids).toContain('tech.analytics.present')
    expect(ids).toContain('biz.booking.present')
    expect(ids).toContain('seo.onpage.optimised')
    expect(ids).toContain('use.mobile.ok')

    expect(ids).not.toContain('tech.https.absent')
    expect(ids).not.toContain('biz.ahpra.testimonials')
    expect(ids).not.toContain('use.nav.too_many')
  })

  it('never ships both halves of a conflicting pair', async () => {
    for (const [site, origin] of [[HEALTHY, 'https://heartsdental.test'], [NEGLECTED, 'http://stellarsmiles.test']] as const) {
      const r = await collect(site, origin)
      const ids = new Set(selectFindings(signalsToMap(r.signals)).map((c) => c.snippet.id))
      for (const id of ids) {
        for (const c of bank.byId.get(id)?.conflicts ?? []) {
          expect(ids.has(c), `${id} shipped alongside its conflict ${c}`).toBe(false)
        }
      }
    }
  })

  it('holds manual and judgement snippets back until the reviewer answers', async () => {
    const r = await collect(NEGLECTED, 'http://stellarsmiles.test')
    const s = signalsToMap(r.signals)
    expect(selectFindings(s).map((c) => c.snippet.id)).not.toContain('rep.reviews.none')

    const withManual = selectFindings(s, { manualAccepted: ['rep.reviews.none'] })
    expect(withManual.map((c) => c.snippet.id)).toContain('rep.reviews.none')
  })

  it('flags variables the reviewer still has to supply', async () => {
    const r = await collect(NEGLECTED, 'http://stellarsmiles.test')
    const found = selectFindings(signalsToMap(r.signals))
    const email = found.find((c) => c.snippet.id === 'biz.email.public_domain')!
    expect(email.missingVars).toContain('public_email')

    const filled = selectFindings(signalsToMap(r.signals), {
      vars: { public_email: 'stellar_smiles@yahoo.com', lookalike_email: 'stellar-smiles@yahoo.com' },
    }).find((c) => c.snippet.id === 'biz.email.public_domain')!
    expect(filled.missingVars).toEqual([])
    expect(filled.renderedText).toContain('such as stellar_smiles@yahoo.com')
  })
})

describe('scoring', () => {
  it('scores the neglected site well below the healthy one', async () => {
    const bad = suggestScores(selectFindings(signalsToMap((await collect(NEGLECTED, 'http://stellarsmiles.test')).signals)))
    const good = suggestScores(selectFindings(signalsToMap((await collect(HEALTHY, 'https://heartsdental.test')).signals)))

    const tech = (rows: typeof bad) => rows.find((r) => r.category === 'website_technical')!.suggested!
    expect(tech(bad)).toBeLessThan(tech(good))
    expect(suggestOverall(bad)!).toBeLessThan(suggestOverall(good)!)
    expect(suggestOverall(bad)!).toBeGreaterThanOrEqual(1)
    expect(suggestOverall(good)!).toBeLessThanOrEqual(5)
  })

  it('returns a row for all eight categories, scored 1..5', async () => {
    const rows = suggestScores(selectFindings(signalsToMap((await collect(HEALTHY, 'https://heartsdental.test')).signals)))
    expect(rows).toHaveLength(8)
    for (const r of rows) {
      if (r.suggested !== null) {
        expect(r.suggested).toBeGreaterThanOrEqual(1)
        expect(r.suggested).toBeLessThanOrEqual(5)
      }
      expect(r.note).toBeTruthy()
    }
  })

  /* A category nobody has looked at must read as unscored. Defaulting an empty
     Reputation row to five stars would tell a practice with zero Google reviews
     that its reputation is flawless. */
  it('leaves an uncollected category unscored rather than perfect', async () => {
    const rows = suggestScores(selectFindings(signalsToMap((await collect(HEALTHY, 'https://heartsdental.test')).signals)))
    const reputation = rows.find((r) => r.category === 'reputation')!
    expect(reputation.suggested).toBeNull()
    expect(reputation.note).toMatch(/needs your input/)
    expect(suggestScores([])).toEqual(
      expect.arrayContaining([expect.objectContaining({ suggested: null })]),
    )
    expect(suggestOverall(suggestScores([]))).toBeNull()
  })

  /* Counting pages from a nav-only crawl once reported "no service pages" on a
     practice that had a dozen — they simply were not in the top menu. Without a
     sitemap the count is unknowable, so the signal is null and the finding
     stays silent instead of accusing. */
  it('reports unknown rather than zero when there is no sitemap to count', async () => {
    const opaque = await collect(OPAQUE, 'https://smiletogo.test')
    const s = signalsToMap(opaque.signals)
    expect(opaque.sitemap).toEqual([])
    expect(s.get('pages.service_pages')?.value).toBeNull()
    expect(s.get('pages.service_pages')?.provenance).toMatch(/Cannot tell/)
    expect(s.get('pages.bio_pages')?.value).toBeNull()
    expect(s.get('blog.present')?.value).toBeNull()

    // the findings that would have accused them do not fire
    const ids = selectFindings(s).map((c) => c.snippet.id)
    expect(ids).not.toContain('biz.service_pages.missing')
    expect(ids).not.toContain('biz.bio_pages.missing')
    expect(ids).not.toContain('biz.blog.absent')
  })

  it('counts against the sitemap when the site publishes one', async () => {
    const r = await collect(NEGLECTED, 'http://stellarsmiles.test')
    const s = signalsToMap(r.signals)
    expect(r.sitemap).toHaveLength(11)
    expect(s.get('pages.total')?.value).toBe(11)
    expect(s.get('pages.service_pages')?.value).toBe(0)
    expect(s.get('pages.service_pages')?.provenance).toContain('11-page sitemap')
  })

  /* Classifying page types from URLs told heartsdental.com.au it had no service
     pages when it has a dozen at top-level URLs like /dental-implants/. No URL
     pattern gets this right, so the count informs the reviewer instead of
     accusing the practice. */
  it('routes page-type calls through the reviewer, carrying the measurement', async () => {
    const s = signalsToMap((await collect(NEGLECTED, 'http://stellarsmiles.test')).signals)
    expect(selectFindings(s).map((c) => c.snippet.id)).not.toContain('biz.service_pages.missing')

    const confirmed = selectFindings(s, { manualAccepted: ['biz.service_pages.missing'] })
      .find((c) => c.snippet.id === 'biz.service_pages.missing')!
    expect(confirmed.hint).toEqual({
      signal: 'pages.service_pages',
      value: 0,
      provenance: expect.stringContaining('11-page sitemap'),
    })
  })

  /* AHPRA is a blocking gate, so accusing a practice of a breach on a stray word
     is expensive. The claim needs a heading, a component or a page — not text. */
  it('only claims a testimonial breach on structural evidence', async () => {
    const neglected = signalsToMap((await collect(NEGLECTED, 'http://stellarsmiles.test')).signals)
    const hit = neglected.get('content.testimonials_present')!
    expect(hit.value).toBe(true)
    expect(hit.provenance).toMatch(/Heading "what our patients say"/)

    const healthy = signalsToMap((await collect(HEALTHY, 'https://heartsdental.test')).signals)
    expect(healthy.get('content.testimonials_present')?.value).toBe(false)
  })

  it('says plainly which categories need manual input', () => {
    const groups = manualWorklist()
    const cats = groups.map((g) => g.category)
    expect(cats).toContain('reputation')
    expect(cats).toContain('visibility_sem')
    expect(groups.find((g) => g.category === 'reputation')!.items.length).toBe(5)
  })
})
