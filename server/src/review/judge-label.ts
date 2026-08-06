import type pg from 'pg'
import type { ModelClient } from '../skills/model.ts'
import { runSkill } from '../skills/runner.ts'
import { loadBank } from './bank.ts'
import { normalise, profileReferences } from './fidelity.ts'
import type { GoldenCase, GoldenSet } from './judge-golden.ts'

/* Labelling the exam by meaning rather than by wording.
 *
 * `judge-golden.ts` extracted the same labels by trigram overlap and got them
 * wrong: about a third of every reference report is rewritten in the writer's
 * own words — Paladin is 23% house voice — so string matching scored Paladin
 * 0 of 9 when it plainly makes at least five of the nine calls. The labels are
 * real; the method could not see them.
 *
 * So a model reads each report and says which findings it makes. That is a
 * weaker thing to ask than the judgement itself: deciding "does this paragraph
 * say the same as that one" is checkable against the report in front of you,
 * and the skill has to quote the paragraph it matched. A quote that does not
 * appear in the report is thrown away here rather than trusted.
 *
 * It is still a model building the exam that will grade a model, so the
 * agreement between this and a hand reading is reported and has to be looked
 * at before the exam is used for anything. */

export interface LabelledCase extends GoldenCase {
  /** Per snippet, the sentence the labeller matched — the audit trail. */
  quotes: Record<string, string | null>
  /** Verdicts thrown away because the quote was not in the report. */
  rejected: string[]
}

export interface LabelRun {
  set: GoldenSet & { cases: LabelledCase[] }
  /** Cases where this disagrees with the trigram extraction, for spot-checking. */
  disagreements: { report: string; snippet: string; strings: boolean; model: boolean }[]
}

/** Is the quote genuinely from this report? */
function quoted(paragraphs: string[], quote: string | null): boolean {
  if (!quote) return false
  const hay = paragraphs.map(normalise).join(' ¶ ')
  const needle = normalise(quote)
  /* Ten words is enough to be a real citation and short enough to survive the
     labeller trimming or re-punctuating what it copied. */
  return needle.split(' ').length >= 6 && hay.includes(needle)
}

export async function labelReferences(
  db: pg.Client | pg.Pool,
  model: ModelClient,
  refDir: string,
  strings: GoldenSet,
  opts: { skillsDir?: string } = {},
): Promise<LabelRun> {
  const bank = loadBank()
  const candidates = bank.snippets
    .filter((s) => s.when === 'judgement')
    .map((s) => ({ id: s.id, text: s.text }))

  const ref = await profileReferences(refDir)
  const cases: LabelledCase[] = []
  const disagreements: LabelRun['disagreements'] = []

  for (const base of strings.cases) {
    const doc = ref.docs.get(base.report)
    if (!doc) continue
    const paragraphs = doc.paragraphs
      .filter((p) => p.text.length >= 60 && p.style !== 'Heading1' && p.style !== 'Heading2')
      .map((p) => p.text)

    const run = await runSkill(db, model, {
      skill: 'review-judge-labeller',
      clientId: null,
      trigger: `golden:${base.report}`,
      skillsDir: opts.skillsDir,
      input: { practice: base.practice, paragraphs, candidates },
    })
    if (run.error || !run.output) throw new Error(`${base.report}: ${run.error ?? 'no output'}`)

    const out = run.output as {
      verdicts: { id: string; present: boolean; quote?: string | null; note?: string | null }[]
    }
    const labels: Record<string, boolean> = {}
    const quotes: Record<string, string | null> = {}
    const rejected: string[] = []

    for (const c of candidates) {
      const v = out.verdicts.find((x) => x.id === c.id)
      /* A `true` without a quote from the report is an assertion, not a
         finding. Downgrade it and record that it happened — if this list is
         long the labeller is guessing and the exam is not worth having. */
      const ok = v?.present === true && quoted(paragraphs, v.quote ?? null)
      if (v?.present === true && !ok) rejected.push(c.id)
      labels[c.id] = ok
      quotes[c.id] = ok ? (v?.quote ?? null) : null

      if (base.labels[c.id] !== ok) {
        disagreements.push({
          report: base.report, snippet: c.id, strings: base.labels[c.id], model: ok,
        })
      }
    }
    cases.push({ ...base, labels, quotes, rejected })
  }

  return {
    set: { ...strings, cases },
    disagreements,
  }
}
