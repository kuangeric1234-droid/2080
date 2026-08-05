import { describe, expect, it } from 'vitest'
import { australianHostMarker } from '../src/review/collect.ts'
import { loadBank } from '../src/review/bank.ts'
import { selectFindings, signalsToMap, varsFromSignals } from '../src/review/engine.ts'
import type { Signal } from '../src/review/signals.ts'

/* §13.2 step 1.34 — the hosting and speed paragraph, which 14 of 17 references
   carry and which had never once reached a document.

   Two faults, and the first hid the second. `site.host.country` was in the
   catalogue from 1.3a with nothing emitting it, so `{{host_country}}` never
   filled, the export refused the paragraph for holding a variable, and 1.9
   never accepted it — silently, because a refused paragraph looks exactly like
   a paragraph that did not fire. Underneath that, only the negative half
   existed: had the country ever filled, a site loading in 1.6 seconds would
   have been told it "took 1.6 seconds to load which isn't ideal". */

describe('1.34 · placing the origin server from its reverse DNS', () => {
  it('reads the city code out of the PTR the reference itself quoted', () => {
    // ohdental.com.au → 43.250.142.92 → this name, and the human read it too.
    expect(australianHostMarker('syn03ge.syd5.hostyourservices.net')).toBe('syd5')
  })

  it('accepts the .au ccTLD', () => {
    expect(australianHostMarker('ws1.2080solutions.com.au')).toBe('.au')
  })

  it('reads the spelt-out cities', () => {
    expect(australianHostMarker('web.melbourne.hostingco.net')).toBe('melbourne')
    expect(australianHostMarker('n2-bne.provider.net')).toBe('bne')
  })

  it('does not find a city inside an ordinary word', () => {
    // "per" in "super", "mel" in "caramel" — the markers are delimited.
    expect(australianHostMarker('super.example.net')).toBeNull()
    expect(australianHostMarker('caramel.example.net')).toBeNull()
  })

  it('says nothing about a host it cannot place', () => {
    // Cloudflare and the US clouds carry no locality, and a guess about where
    // a practice's server lives is not worth having.
    expect(australianHostMarker('one.one.one.one')).toBeNull()
    expect(australianHostMarker('ec2-54-1-2-3.compute-1.amazonaws.com')).toBeNull()
  })
})

describe('1.34 · the paragraph splits on the two-second rule', () => {
  const bank = loadBank()
  const sig = (key: string, value: unknown): Signal =>
    ({ key, value, source: 'dns', provenance: 'test' }) as Signal

  const fire = (loadSeconds: number, country: string | null) => {
    const signals = [
      sig('site.load_seconds', loadSeconds),
      ...(country ? [sig('site.host.country', country)] : []),
    ]
    const map = signalsToMap(signals)
    return selectFindings(map, { vars: varsFromSignals(map, 'example.com.au') })
      .map((f) => f.snippet.id)
  }

  it('tells a fast site it is fast', () => {
    expect(fire(1.6, 'Australia')).toContain('tech.hosting.speed_ok')
    expect(fire(1.6, 'Australia')).not.toContain('tech.hosting.speed')
  })

  it('tells a slow site it is slow', () => {
    expect(fire(4.4, 'Australia')).toContain('tech.hosting.speed')
    expect(fire(4.4, 'Australia')).not.toContain('tech.hosting.speed_ok')
  })

  it('treats the two-second line as the references write it', () => {
    // "A website should load within 2 seconds" — 2.0 is within.
    expect(fire(2, 'Australia')).toContain('tech.hosting.speed_ok')
    expect(fire(2.1, 'Australia')).toContain('tech.hosting.speed')
  })

  it('says nothing at all when the origin cannot be placed', () => {
    // Both halves open on "hosted in {{host_country}} which is good". With no
    // country there is no sentence, and the overseas wording is 1/17 — one
    // reviewer's phrasing three different ways, below the threshold.
    const ids = fire(1.6, null)
    expect(ids).not.toContain('tech.hosting.speed_ok')
    expect(ids).not.toContain('tech.hosting.speed')
  })

  it('leaves no unfilled variable in either half — the fault that hid it', () => {
    for (const [id, load] of [['tech.hosting.speed', 4.4], ['tech.hosting.speed_ok', 1.6]] as const) {
      expect(bank.byId.get(id)!.vars).toContain('host_country')
      const map = signalsToMap([sig('site.load_seconds', load), sig('site.host.country', 'Australia')])
      const c = selectFindings(map, { vars: varsFromSignals(map, 'example.com.au') })
        .find((f) => f.snippet.id === id)!
      expect(c.missingVars).toEqual([])
      expect(c.renderedText).not.toMatch(/\{\{/)
      expect(c.renderedText).toContain('hosted in Australia')
    }
  })
})
