import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadBank, literalSegments, render, variablesOf } from '../src/review/bank.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(HERE, '../../review-bank/v1/source-paragraphs.txt')

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
const sourceParagraphs = readFileSync(SOURCE, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)

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

  it('every snippet text traces back to the source template', () => {
    const GENERATED = new Set(['summary.opening'])
    const orphans = bank.snippets
      .filter((s) => !GENERATED.has(s.id))
      .filter((s) => !sourceParagraphs.some((p) => covers(s.text, p)))
      .map((s) => s.id)
    expect(orphans, `snippets with invented wording: ${orphans.join(', ')}`).toEqual([])
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
})
