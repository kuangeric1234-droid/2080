import { describe, expect, it } from 'vitest'
import {
  GOOD_ENGAGEMENT, MetaGraphProvider, MockSocialProvider,
  collectSocialSignals, handleFrom,
} from '../src/review/social.ts'

/* §13.2 step 1.11. The provider seam exists because the numbers cannot be
   measured from here: reading a prospect's page needs Meta's Page Public
   Content Access. Everything below is about the seam behaving honestly while
   that is true. */
describe('social provider', () => {
  it('reads the handle out of a profile URL', () => {
    expect(handleFrom('https://www.facebook.com/heartsdental.melbourne/')).toBe('heartsdental.melbourne')
    expect(handleFrom('https://www.instagram.com/heartsdental?igshid=abc')).toBe('heartsdental')
    expect(handleFrom('not a url')).toBeNull()
  })

  it('keeps the mock deterministic so a re-collect does not move the numbers', async () => {
    const p = new MockSocialProvider()
    const a = await p.fetch('https://facebook.com/x', 'facebook')
    const b = await p.fetch('https://facebook.com/x', 'facebook')
    expect(a).toEqual(b)
    const c = await p.fetch('https://facebook.com/y', 'facebook')
    expect(c).not.toEqual(a)
  })

  it('emits nothing when the site links no profile', async () => {
    const { signals } = await collectSocialSignals(new MockSocialProvider(), [
      { network: 'facebook', url: null },
      { network: 'instagram', url: null },
    ])
    // absent beats zero: a zero reads as "measured, and it was none"
    expect(signals).toEqual([])
  })

  it('says PROVISIONAL in the provenance of every stood-in number', async () => {
    const { signals } = await collectSocialSignals(new MockSocialProvider(), [
      { network: 'facebook', url: 'https://facebook.com/heartsdental' },
    ])
    expect(signals.length).toBeGreaterThan(0)
    for (const s of signals) {
      expect(s.source).toBe('provider')
      expect(s.provenance, s.key).toContain('PROVISIONAL')
      expect(s.provenance, s.key).toContain('heartsdental')
    }
    expect(signals.map((s) => s.key)).toContain('social.facebook.fans')
  })

  it('carries the template’s own engagement bar into the provenance', async () => {
    const { signals } = await collectSocialSignals(new MockSocialProvider(), [
      { network: 'instagram', url: 'https://instagram.com/x' },
    ])
    const eng = signals.find((s) => s.key === 'social.instagram.engagement_avg')!
    expect(eng.provenance).toContain(String(GOOD_ENGAGEMENT))
  })

  /* The case that actually matters in production: a prospect's page is not
     readable, and the honest answer is no number rather than a guessed one. */
  it('returns null when Meta refuses the page, so no signal is emitted', async () => {
    const provider = new MetaGraphProvider('token')
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response(
      JSON.stringify({ error: { code: 100, message: 'missing permission or reviewable feature' } }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch
    try {
      expect(await provider.fetch('https://facebook.com/someprospect', 'facebook')).toBeNull()
      const { signals } = await collectSocialSignals(provider, [
        { network: 'facebook', url: 'https://facebook.com/someprospect' },
      ])
      expect(signals).toEqual([])
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('reports a real audience when the page is reachable', async () => {
    const provider = new MetaGraphProvider('token')
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response(
      JSON.stringify({ fan_count: 2 }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch
    try {
      const m = await provider.fetch('https://facebook.com/hexahub', 'facebook')
      expect(m?.audience).toBe(2)
      // insights need the same permission wall, so they stay null not guessed
      expect(m?.posts_last_30d).toBeNull()
      expect(m?.avg_engagement).toBeNull()

      const { signals } = await collectSocialSignals(provider, [
        { network: 'facebook', url: 'https://facebook.com/hexahub' },
      ])
      expect(signals).toHaveLength(1)
      expect(signals[0].provenance).not.toContain('PROVISIONAL')
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
