import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { loadBank } from './bank.ts'
import { normalise, profileReferences } from './fidelity.ts'

/* The exam for a judgement skill, read off the reports rather than invented.
 *
 * Nine bank paragraphs are `judgement` triggers: whether the UVP is generic,
 * whether the banner earns its space, whether the site looks dated, whether
 * there are bio pages, conditions content, real team photos. They are the core
 * of Website (Business) — the section where this platform produces 2 findings
 * against a reference average of 10 — and every one is a call about something
 * the collector already has in hand.
 *
 * Before writing a skill to make those calls, find out whether a model can. The
 * labels for that already exist: for each of the 17 completed reports, the
 * human either included a given paragraph or did not. That is a real yes/no per
 * paragraph per practice, decided by the person whose judgement we are trying
 * to match, and it cost nothing to collect.
 *
 * What this file does NOT do is decide the input side — whether the model is
 * shown today's site or the Wayback capture from the report's own date. That is
 * a separate question and the labels are worth having either way. */

/** One practice's verdicts: snippet id → did the human include it. */
export interface GoldenCase {
  report: string
  practice: string
  /** dd/mm/yyyy as written, so a stale-site case can be spotted. */
  date: string | null
  domain: string | null
  labels: Record<string, boolean>
}

export interface GoldenSet {
  version: 1
  extracted_from: string
  snippets: string[]
  cases: GoldenCase[]
}

/* Word trigrams. A reviewer edits a house paragraph as they paste it — swaps a
   name, drops a clause — so equality would find almost nothing. */
function shingles(s: string): Set<string> {
  const w = normalise(s).split(' ').filter(Boolean)
  const out = new Set<string>()
  for (let i = 0; i + 2 < w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`)
  return out
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let hit = 0
  for (const s of a) if (b.has(s)) hit++
  return hit / Math.min(a.size, b.size)
}

/* 0.45 is the threshold the coverage report already uses to decide whether the
   bank says a reference paragraph, and it was checked there against a hand
   reading: 46 of 47 recurring paragraphs matched, and the one miss was real. */
const MATCH = 0.45

/**
 * Read the 17 reports and record, per practice, which judgement paragraphs the
 * human chose to include.
 */
export async function extractGolden(refDir: string): Promise<GoldenSet> {
  const bank = loadBank()
  const judged = bank.snippets.filter((s) => s.when === 'judgement')
  const wanted = judged.map((s) => ({ id: s.id, sh: shingles(s.text) }))

  const ref = await profileReferences(refDir)
  const cases: GoldenCase[] = []

  for (const [file, doc] of ref.docs) {
    /* Every body paragraph long enough to be one of these. Comparing against
       the whole document rather than just Website (Business) on purpose: a
       reviewer sometimes files the readability paragraph under Usability, and
       a label of "did they say this at all" is the honest question. */
    const paras = doc.paragraphs
      .filter((p) => p.text.length >= 60)
      .map((p) => shingles(p.text))

    const labels: Record<string, boolean> = {}
    for (const w of wanted) {
      labels[w.id] = paras.some((p) => overlap(w.sh, p) > MATCH)
    }

    const title = doc.paragraphs.find((p) => /^Review of /i.test(p.text))?.text ?? ''
    cases.push({
      report: file,
      practice: file.replace(/\s*Online Presence Review.*$/i, '').replace(/\.docx$/i, ''),
      date: doc.paragraphs.find((p) => /^Date:/.test(p.text))?.text.replace(/^Date:\s*/, '') ?? null,
      domain: title.replace(/^Review of\s*/i, '').replace(/:$/, '').trim() || null,
      labels,
    })
  }

  return {
    version: 1,
    extracted_from: refDir,
    snippets: judged.map((s) => s.id),
    cases,
  }
}

/** Per-snippet counts, which is what says whether the exam is worth sitting. */
export function labelStats(set: GoldenSet) {
  return set.snippets.map((id) => {
    const yes = set.cases.filter((c) => c.labels[id]).length
    return { id, yes, no: set.cases.length - yes, total: set.cases.length }
  })
}

export async function writeGolden(refDir: string, outFile: string): Promise<GoldenSet> {
  const set = await extractGolden(refDir)
  mkdirSync(path.dirname(outFile), { recursive: true })
  writeFileSync(outFile, `${JSON.stringify(set, null, 2)}\n`)
  return set
}
