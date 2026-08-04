import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  GooglePageSpeedProvider, NoPageSpeedProvider, collectPageSpeed,
} from '../src/review/pagespeed.ts'

/* §13.2 step 1.16. `review_exhibits.kind` has had `performance_report` in it
   since 1.2 with nothing producing one, and 10 of the 17 real reports carry the
   "should load within 2 seconds" paragraph. */
const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks() })

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function stub(body: unknown) {
  globalThis.fetch = (async () => new Response(JSON.stringify(body),
    { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch
}

const LIGHTHOUSE = {
  lighthouseResult: {
    categories: { performance: { score: 0.42 } },
    audits: {
      'first-contentful-paint': { displayValue: '2.1 s' },
      'largest-contentful-paint': { displayValue: '4.8 s' },
      'speed-index': { displayValue: '3.0 s' },
      'total-blocking-time': { displayValue: '420 ms' },
      'render-blocking-resources': { title: 'Eliminate render-blocking resources', score: 0.2, details: { type: 'opportunity' } },
      'unused-javascript': { title: 'Reduce unused JavaScript', score: 0.5, details: { type: 'opportunity' } },
      'final-screenshot': { details: { data: `data:image/png;base64,${PNG}` } },
    },
  },
}

describe('performance measurement', () => {
  it('reads the score and the timings, in seconds', async () => {
    stub(LIGHTHOUSE)
    const dir = mkdtempSync(path.join(tmpdir(), 'psi-'))
    try {
      const r = await collectPageSpeed(new GooglePageSpeedProvider('k'),
        'https://heartsdental.com.au', { exhibitDir: dir })
      const by = Object.fromEntries(r.signals.map((s) => [s.key, s.value]))
      expect(by['perf.score']).toBe(42)
      expect(by['perf.lcp_seconds']).toBe(4.8)
      expect(by['perf.fcp_seconds']).toBe(2.1)
      // the fix Lighthouse ranks worst comes first, not whichever we saw first
      expect(by['perf.top_opportunity']).toBe('Eliminate render-blocking resources')
      for (const s of r.signals) expect(s.provenance).toContain('PageSpeed Insights')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('writes Lighthouse’s own render as the performance exhibit', async () => {
    stub(LIGHTHOUSE)
    const dir = mkdtempSync(path.join(tmpdir(), 'psi-'))
    try {
      const r = await collectPageSpeed(new GooglePageSpeedProvider('k'),
        'https://x.test', { exhibitDir: dir, reviewId: 'rev_1' })
      expect(r.exhibits).toHaveLength(1)
      const ex = r.exhibits[0]
      expect(ex.kind).toBe('performance_report')       // the kind the schema always had
      expect(ex.label).toContain('42/100')
      const bytes = readFileSync(path.join(dir, ex.path))
      expect(bytes.subarray(1, 4).toString()).toBe('PNG')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  /* A quota failure must not look like a fast site. */
  it('surfaces a quota or key failure rather than reporting nothing', async () => {
    stub({ error: { message: "Quota exceeded for quota metric 'Queries'" } })
    const dir = mkdtempSync(path.join(tmpdir(), 'psi-'))
    try {
      const r = await collectPageSpeed(new GooglePageSpeedProvider(null),
        'https://x.test', { exhibitDir: dir })
      expect(r.signals).toEqual([])
      expect(r.errors.join(' ')).toMatch(/Quota exceeded/)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('does nothing without a provider, and never a guessed score', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'psi-'))
    try {
      const r = await collectPageSpeed(new NoPageSpeedProvider(), 'https://x.test', { exhibitDir: dir })
      expect(r.signals).toEqual([])
      expect(r.exhibits).toEqual([])
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
