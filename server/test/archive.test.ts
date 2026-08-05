import { describe, expect, it } from 'vitest'
import { NoArchiveProvider, WaybackProvider, collectArchive } from '../src/review/archive.ts'
import { selectFindings, signalsToMap, varsFromSignals } from '../src/review/engine.ts'

/* §13.2 step 1.26. `biz.website.stale` says "your website hasn't been updated
   since 2017" on 20-80 letterhead. That is a claim a practice will check in
   thirty seconds, so the rules here are about what the collector refuses to
   say, as much as what it says. */

const NOW = () => new Date('2026-08-05T00:00:00Z')

/** A CDX response: header row, then [timestamp, digest] per content change. */
function cdx(rows: [string, string][]): typeof fetch {
  return (async () => new Response(
    JSON.stringify([['timestamp', 'digest'], ...rows]),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )) as unknown as typeof fetch
}

describe('when the homepage last changed', () => {
  it('reads the year from the newest distinct capture', async () => {
    const p = new WaybackProvider(cdx([
      ['20140312091500', 'AAA'], ['20170621103000', 'BBB'],
    ]), NOW)
    const r = (await p.lastChange('example.com.au'))!
    expect(r.lastChangedYear).toBe(2017)
    expect(r.versions).toBe(2)
    expect(r.snapshotUrl).toBe('https://web.archive.org/web/20170621103000/example.com.au')
    expect(r.monthsSince).toBeGreaterThan(100)
  })

  it('publishes the year only once the site is genuinely stale', async () => {
    const fresh = await collectArchive(
      new WaybackProvider(cdx([['20200101000000', 'AAA'], ['20260401000000', 'BBB']]), NOW),
      'example.com.au')
    const keys = fresh.signals.map((s) => s.key)
    expect(keys, 'a site refreshed four months ago is not stale')
      .not.toContain('archive.last_major_update_year')
    /* …but the measurement itself is still recorded, so a reviewer can see it. */
    expect(keys).toContain('archive.last_change_months')

    const stale = await collectArchive(
      new WaybackProvider(cdx([['20170621103000', 'BBB']]), NOW), 'example.com.au')
    const year = stale.signals.find((s) => s.key === 'archive.last_major_update_year')
    expect(year?.value).toBe(2017)
    expect(year?.provenance, 'no provenance to check the claim against').toMatch(/web\.archive\.org/)
  })

  it('says nothing when the archive has never seen the site', async () => {
    const r = await collectArchive(
      new WaybackProvider(cdx([]), NOW), 'brand-new-practice.com.au')
    expect(r.signals, 'absence of archive data became a claim about the practice').toEqual([])
    expect(r.errors).toEqual([])
  })

  it('reports a failed lookup instead of swallowing it', async () => {
    const down = (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch
    const r = await collectArchive(new WaybackProvider(down, NOW), 'example.com.au')
    expect(r.signals).toEqual([])
    expect(r.errors.join(' '), 'a 503 looked identical to a fresh website').toMatch(/503/)
  })

  it('is silent while provisional', async () => {
    expect((await collectArchive(new NoArchiveProvider(), 'example.com.au')).signals).toEqual([])
  })

  /* The point of the step: the paragraph fires, and it fires filled in. An
     unfilled {{year}} would be worse than no finding — 7 of 17 references carry
     this line and two paste the capture URL in full. */
  it('fires biz.website.stale with the year and the capture URL', async () => {
    const { signals } = await collectArchive(
      new WaybackProvider(cdx([['20150101000000', 'AAA'], ['20170621103000', 'BBB']]), NOW),
      'example.com.au')

    const map = signalsToMap(signals)
    const findings = selectFindings(map, { vars: varsFromSignals(map, 'example.com.au') })
    const stale = findings.find((f) => f.snippet.id === 'biz.website.stale')
    expect(stale, 'the paragraph did not fire on a nine-year-old site').toBeTruthy()
    expect(stale!.renderedText, 'shipped with an unfilled variable').not.toMatch(/\{\{/)
    expect(stale!.renderedText).toContain('2017')
    expect(stale!.renderedText).toContain('web.archive.org')
  })
})
