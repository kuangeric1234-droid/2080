import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadBank, literalSegments, render, variablesOf } from '../src/review/bank.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(HERE, '../../review-bank/v1/source-paragraphs.txt')
/* §13.2 1.34. The blank template ships only one half of some pairs — it has
   "took 4.4 seconds to load which isn't ideal" and nothing for a site that is
   fast. Where a completed report carries the other half in three or more of
   the seventeen, the wording is quoted from that report rather than written,
   and recorded here with its count. A second source, not a looser one: the
   file names where every line came from. */
const REPORTS = path.join(HERE, '../../review-bank/v1/source-reports.txt')

/** Straight quotes/dashes/spacing differences must not fail a match. */
function norm(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–|—/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** A snippet covers a source paragraph when every literal run of the snippet
    appears in the paragraph, in order. Variables may differ; wording may not. */
function covers(snippetText: string, paragraph: string): boolean {
  const hay = norm(paragraph)
  let at = 0
  for (const seg of literalSegments(snippetText)) {
    const i = hay.indexOf(norm(seg), at)
    if (i === -1) return false
    at = i + norm(seg).length
  }
  return true
}

const bank = loadBank()
const lines = (file: string) =>
  readFileSync(file, 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
const sourceParagraphs = lines(SOURCE)
const reportParagraphs = lines(REPORTS)

describe('snippet bank v1', () => {
  it('loads with no duplicate ids, unknown categories or dangling conflicts', () => {
    expect(bank.snippets.length).toBeGreaterThan(60)
    expect(bank.categories).toHaveLength(8)
    expect(bank.byId.size).toBe(bank.snippets.length)
  })

  /* The DoD for module 1.1: nothing in the source template may be silently
     dropped. Three of the 73 source paragraphs are the worked competitor-row
     examples, which collapse into the single comp.row template. */
  it('covers every paragraph of the source template', () => {
    const COMPETITOR_ROW_EXAMPLES = 2 // comp.row keeps the first of the three verbatim
    const uncovered = sourceParagraphs.filter(
      (p) => !bank.snippets.some((s) => covers(s.text, p)),
    )
    expect(uncovered, `uncovered source paragraphs:\n${uncovered.join('\n\n')}`).toHaveLength(
      COMPETITOR_ROW_EXAMPLES,
    )
    // and the two that are uncovered must be competitor rows, not real losses
    for (const p of uncovered) expect(p).toMatch(/Threat: \d+\/10\.$/)
  })

  it('every snippet text traces back to the template or to a named report', () => {
    const GENERATED = new Set(['summary.opening'])
    const sources = [...sourceParagraphs, ...reportParagraphs]
    const orphans = bank.snippets
      .filter((s) => !GENERATED.has(s.id))
      .filter((s) => !sources.some((p) => covers(s.text, p)))
      .map((s) => s.id)
    expect(orphans, `snippets with invented wording: ${orphans.join(', ')}`).toEqual([])
  })

  /* The second source is the narrower one, so it must not become a place to
     put anything that will not fit the template: every line has to be a
     paragraph some snippet actually says, and has to name where it came from. */
  it('quotes nothing from a report that no snippet uses', () => {
    const unused = reportParagraphs.filter((p) => !bank.snippets.some((s) => covers(s.text, p)))
    expect(unused, `quoted but unused:\n${unused.join('\n')}`).toEqual([])
  })

  it('attributes every quoted report paragraph to its reports', () => {
    const raw = readFileSync(REPORTS, 'utf8')
    // each quoted line is preceded by a comment block naming reports and count
    expect(raw).toMatch(/#.*\d+\/17/)
  })

  it('pairs both halves of every conflict', () => {
    for (const s of bank.snippets) {
      for (const id of s.conflicts ?? []) {
        const other = bank.byId.get(id)!
        expect(other.conflicts ?? [], `${id} must list ${s.id} back`).toContain(s.id)
      }
    }
  })

  it('declares a category, dimension and trigger on every snippet', () => {
    for (const s of bank.snippets) {
      expect(s.category, s.id).toBeTruthy()
      expect(s.dimension, s.id).toBeTruthy()
      expect(s.when, s.id).toBeTruthy()
      const cat = bank.categories.find((c) => c.key === s.category)
      if (cat) {
        const ok = cat.dimensions.some((d) => d.startsWith(s.dimension) || s.dimension === 'Overall')
        expect(ok, `${s.id}: dimension "${s.dimension}" not in ${s.category}`).toBe(true)
      }
    }
  })

  it('names a real signal in every automatic trigger', () => {
    for (const s of bank.snippets) {
      if (typeof s.when === 'string') continue
      const conds = [...(s.when.all ?? []), ...(s.when.any ?? [])]
      expect(conds.length, `${s.id}: empty trigger`).toBeGreaterThan(0)
      for (const c of conds) {
        expect(c.signal, s.id).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/)
      }
    }
  })

  it('renders variables and leaves unknown ones visible', () => {
    const s = bank.byId.get('use.font.small')!
    expect(variablesOf(s.text)).toEqual(['font_px'])
    expect(render(s.text, { font_px: 13 })).toContain('too small at 13px')
    expect(render(s.text, {})).toContain('{{font_px}}')
  })

  it('marks the AHPRA testimonial finding as blocking', () => {
    expect(bank.byId.get('biz.ahpra.testimonials')?.ahpra_blocking).toBe(true)
  })

  /* §13.2 step 1.8. auto_safe is permission to put a paragraph in front of a
     practice with nobody having read it, so every guard here is about keeping
     that set small and deliberate rather than letting it drift wider. */
  describe('auto_safe', () => {
    it('is answered for every snippet', () => {
      for (const s of bank.snippets) {
        expect(typeof s.auto_safe, `${s.id}: auto_safe missing`).toBe('boolean')
      }
    })

    it('is never true for an AHPRA-blocking snippet', () => {
      for (const s of bank.snippets) {
        if (s.ahpra_blocking) {
          expect(s.auto_safe, `${s.id}: AHPRA snippet must stay human-reviewed`).toBe(false)
        }
      }
      // the guard is worthless if the fixture it guards ever disappears
      expect(bank.snippets.some((s) => s.ahpra_blocking)).toBe(true)
    })

    it('is never true for a judgement, manual, generated or always snippet', () => {
      for (const s of bank.snippets) {
        if (typeof s.when === 'string') {
          expect(s.auto_safe, `${s.id}: '${s.when}' cannot be auto-accepted`).toBe(false)
        }
      }
    })

    it('is never true for a summary snippet', () => {
      for (const s of bank.snippets) {
        if (s.category === 'recommendations') {
          expect(s.auto_safe, `${s.id}: summaries are written, not measured`).toBe(false)
        }
      }
    })

    /* Pinned on purpose. Widening auto_safe is a decision about what reaches a
       client unread, so it should require editing this number and saying why —
       not fall out of an unrelated bank edit. */
    it('covers exactly the 19 measurements signed off in 1.8 and 1.34', () => {
      const safe = bank.snippets.filter((s) => s.auto_safe).map((s) => s.id).sort()
      expect(safe).toEqual([
        'tech.analytics.absent', 'tech.analytics.present',
        'tech.cms.squarespace', 'tech.cms.static_html', 'tech.cms.wordpress',
        'tech.email.same_server', 'tech.email.separate_server', 'tech.email.unknown',
        /* 1.34 added the fast half. Its twin has been auto_safe since 1.8 and
           it is the same measurement read the other way round — the load event
           in a real browser and the practice's own server in reverse DNS. A
           list that will ship "took 4.4 seconds, which isn't ideal" unread and
           holds back "took 1.6 seconds, which is great" is not being careful,
           it is being pessimistic. */
        'tech.hosting.speed', 'tech.hosting.speed_ok',
        'tech.https.absent', 'tech.https.present',
        'use.captcha.legacy', 'use.contrast.fail', 'use.cta.not_tappable',
        'use.font.small', 'use.mobile.absent', 'use.mobile.ok', 'use.nav.not_sticky',
      ])
    })
  })
})
