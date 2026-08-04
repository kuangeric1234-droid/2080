import { describe, expect, it } from 'vitest'
import { PROFESSIONS, professionFor } from '../src/review/profession.ts'
import { practiceKeyword } from '../src/review/places.ts'
import { loadBank, render, variablesOf } from '../src/review/bank.ts'
import { varsFromSignals } from '../src/review/engine.ts'
import { toMap, type Signal } from '../src/review/signals.ts'

/* §13.2 step 1.15. The bank was mined from a dental template; the real reports
   are chiropractic and dermatology too. One paragraph with a variable, not one
   paragraph per trade. */
describe('one bank, every trade', () => {
  it('uses the same trade for the Google search and the wording', () => {
    // if these two disagreed, we would look for dentists and write about chiros
    for (const kw of Object.keys(PROFESSIONS)) {
      expect(professionFor(kw)).toBeTruthy()
    }
    expect(professionFor(practiceKeyword('Advanced Chiropractic', 'x.com.au')).adj).toBe('chiropractic')
    expect(professionFor(practiceKeyword('Novus Dermatology', 'x.com.au')).adj).toBe('dermatology')
    expect(professionFor(practiceKeyword(null, 'heartsdental.com.au')).adj).toBe('dental')
  })

  it('falls back to dental rather than leaving a hole', () => {
    expect(professionFor('astronaut').adj).toBe('dental')
  })

  const sig = (key: string, value: string): Signal =>
    ({ key, value, source: 'crawl', provenance: 'test' })

  it('fills every profession variable the bank asks for', () => {
    const bank = loadBank()
    const wanted = new Set<string>()
    for (const s of bank.snippets) {
      for (const v of variablesOf(s.text)) {
        if (['profession_adj', 'practitioners', 'condition_examples', 'treatment_example'].includes(v)) {
          wanted.add(v)
        }
      }
    }
    expect(wanted.size, 'no profession variables in the bank').toBeGreaterThan(0)
    const vars = varsFromSignals(toMap([sig('practice.profession', 'chiropractor')]), 'x.com.au')
    for (const w of wanted) expect(vars[w], `${w} unfilled`).toBeTruthy()
  })

  it('renders the same paragraph in each trade with no variable left showing', () => {
    const bank = loadBank()
    const video = bank.byId.get('social.video.opportunity')!
    for (const [kw, expected] of [['dentist', 'dental IQ'], ['chiropractor', 'chiropractic IQ']] as const) {
      const vars = varsFromSignals(toMap([sig('practice.profession', kw)]), 'x.com.au')
      const out = render(video.text, vars)
      expect(out).toContain(expected)
      expect(out, `${kw}: unfilled variable`).not.toMatch(/\{\{/)
    }
  })

  /* An unfilled {{variable}} blocks the export (1.7), so a trade we have never
     heard of must still produce shippable copy. */
  it('never leaves a profession variable unfilled, whatever the trade', () => {
    const bank = loadBank()
    const vars = varsFromSignals(toMap([sig('practice.profession', 'not-a-trade')]), 'x.com.au')
    for (const s of bank.snippets) {
      const out = render(s.text, { ...vars, count: 1, rating: 5, font_px: 12, load_seconds: 2 })
      const leftover = [...out.matchAll(/\{\{([a-z_]+)\}\}/g)].map((m) => m[1])
      const professionVars = leftover.filter((v) =>
        ['profession_adj', 'practitioners', 'condition_examples', 'treatment_example'].includes(v))
      expect(professionVars, `${s.id} left ${professionVars.join(', ')}`).toEqual([])
    }
  })
})
