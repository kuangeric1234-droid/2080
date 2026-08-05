import { describe, expect, it } from 'vitest'
import { loadBank } from '../src/review/bank.ts'
import { selectFindings, signalsToMap, varsFromSignals } from '../src/review/engine.ts'
import type { Signal } from '../src/review/signals.ts'

/* §13.2 step 1.35 — the two sections that export empty, and which of them
   unconditional house copy actually fills.

   `sem.access.request` is 2/17 and stays where it is. `social.video.opportunity`
   is 13/17 — house copy by any reading — and had been sitting behind
   `when: "manual"`, which means a reviewer had to go and find it in the bank
   drawer on every single review. It is now proposed on every review instead. */

const bank = loadBank()
const sig = (key: string, value: unknown): Signal =>
  ({ key, value, source: 'crawl', provenance: 'test' }) as Signal

const fireOn = (domain: string, signals: Signal[] = []) => {
  const map = signalsToMap(signals)
  return selectFindings(map, { vars: varsFromSignals(map, domain) })
}

describe('1.35 · the educational-video line is proposed on every review', () => {
  it('fires with no signals at all', () => {
    expect(fireOn('example.com.au').map((f) => f.snippet.id))
      .toContain('social.video.opportunity')
  })

  it('carries no unfilled variable when it does', () => {
    const c = fireOn('example.com.au').find((f) => f.snippet.id === 'social.video.opportunity')!
    expect(c.missingVars).toEqual([])
    expect(c.renderedText).not.toMatch(/\{\{/)
  })

  it('says the trade it is talking to, not "dental" at a chiropractor', () => {
    const chiro = fireOn('spine.com.au', [sig('practice.profession', 'chiropractor')])
      .find((f) => f.snippet.id === 'social.video.opportunity')!
    expect(chiro.renderedText).toContain('chiropractic IQ')
    const dentist = fireOn('teeth.com.au', [sig('practice.profession', 'dentist')])
      .find((f) => f.snippet.id === 'social.video.opportunity')!
    expect(dentist.renderedText).toContain('dental IQ')
  })

  /* §13.4, and the reason the Social Media section still needs a person: an
     unconditional line is still a line nobody has read, and 1.8 keeps
     everything in this category behind a human. It reaches the reviewer's
     desk, not the client's inbox. */
  it('is not auto-accepted, because nothing in this category is', () => {
    expect(bank.byId.get('social.video.opportunity')!.auto_safe).toBe(false)
  })
})

describe('1.35 · the adwords access line stays manual at 2/17', () => {
  it('does not fire on its own', () => {
    expect(fireOn('example.com.au').map((f) => f.snippet.id))
      .not.toContain('sem.access.request')
  })

  it('is still in the bank for a reviewer to add', () => {
    expect(bank.byId.get('sem.access.request')!.when).toBe('manual')
  })
})
