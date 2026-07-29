import { describe, expect, it } from 'vitest'
import { analyze } from '../src/seo/analyze.ts'

const page = (head: string, body: string, opts: { status?: number; https?: boolean } = {}) =>
  analyze('https://x.test', `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`,
    { status: opts.status ?? 200, finalUrl: 'https://x.test/', https: opts.https ?? true })

const allFindings = (r: ReturnType<typeof analyze>) => r.categories.flatMap((c) => c.findings)
const ids = (r: ReturnType<typeof analyze>, sev: string) => allFindings(r).filter((f) => f.severity === sev).map((f) => f.id)

describe('SEO analyze (SPEC-SEO §4.2)', () => {
  it('scores a well-optimised page highly with no critical issues', () => {
    const head = `<title>Family & Cosmetic Dentist in Preston — Hearts Dental</title>
      <meta name="description" content="Gentle family and cosmetic dentistry in Preston. Check-ups, whitening, Invisalign and emergency care. Bupa and HCF preferred provider with HiCaps.">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="canonical" href="https://x.test/">
      <meta property="og:title" content="Hearts Dental"><meta property="og:description" content="Preston dentist">
      <script type="application/ld+json">{"@type":"Dentist"}</script>`
    const body = `<h1>Gentle dentistry in Preston</h1><h2>Services</h2><p>${'word '.repeat(400)}</p>
      <img src="a.jpg" alt="the team"><a href="/services">Services</a>`
    const r = page(head, body)
    expect(r.score).toBeGreaterThanOrEqual(85)
    expect(['A', 'B']).toContain(r.grade)
    expect(ids(r, 'critical')).toHaveLength(0)
    expect(r.stats.h1Count).toBe(1)
    expect(r.stats.schemaBlocks).toBe(1)
    expect(r.categories).toHaveLength(5)
  })

  it('flags the critical problems on a broken page', () => {
    const r = page('<meta name="robots" content="noindex">', '<p>too short</p>')
    const crit = ids(r, 'critical')
    expect(crit).toContain('noindex')
    expect(crit).toContain('viewport')
    expect(crit).toContain('h1')
    expect(crit).toContain('title')
    expect(r.score).toBeLessThan(45)
    expect(r.grade).toBe('F')
  })

  it('treats a missing meta description and thin content as warnings', () => {
    const r = page(`<title>${'a'.repeat(50)}</title><meta name="viewport" content="x">`,
      `<h1>One</h1><p>${'word '.repeat(100)}</p>`)
    const warn = ids(r, 'warning')
    expect(warn).toContain('meta') // no description
    expect(warn).toContain('thin') // 100 words < 250
  })

  it('counts images missing alt text', () => {
    const r = page(`<title>${'a'.repeat(40)}</title><meta name="viewport" content="x">`,
      `<h1>h</h1><p>${'w '.repeat(300)}</p><img src="1.jpg"><img src="2.jpg" alt="ok">`)
    expect(r.stats.images).toBe(2)
    expect(r.stats.imagesMissingAlt).toBe(1)
  })
})
