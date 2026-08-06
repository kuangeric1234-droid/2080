import type pg from 'pg'
import type { ModelClient } from '../skills/model.ts'
import { runSkill } from '../skills/runner.ts'
import { loadBank } from './bank.ts'
import type { JudgeInput } from './judge-input.ts'

/* The judgement half of Website (Business).
 *
 * That section produces 2 findings against a reference average of 10, and the
 * shortfall is entirely calls a person has to make by looking: is the UVP
 * generic, does the banner earn its space, is the writing readable. This asks a
 * model for those calls.
 *
 * Everything it produces is a candidate. §13.4 is not touched: `auto_safe`
 * stays false on all nine snippets, so a verdict from here reaches a reviewer
 * and stops. The value is that the reviewer arrives at a decision already made
 * with its reason attached, instead of a list of thirty-three paragraphs to
 * pick from. */

export interface JudgeVerdict {
  id: string
  present: boolean
  evidence: string | null
  reason: string
}

export const JUDGEMENT_IDS = () =>
  loadBank().snippets.filter((s) => s.when === 'judgement').map((s) => s.id)

/** Ask for a verdict on every judgement snippet for one site view. */
export async function judgeSite(
  db: pg.Client | pg.Pool,
  model: ModelClient,
  input: JudgeInput & { practice: string },
  opts: { skillsDir?: string; trigger?: string } = {},
): Promise<{ verdicts: JudgeVerdict[]; runId: string }> {
  const bank = loadBank()
  const candidates = bank.snippets
    .filter((s) => s.when === 'judgement')
    .map((s) => ({ id: s.id, text: s.text }))

  const run = await runSkill(db, model, {
    skill: 'review-judge',
    clientId: null,
    trigger: opts.trigger ?? `judge:${input.domain}`,
    skillsDir: opts.skillsDir,
    input: {
      practice: input.practice,
      domain: input.domain,
      title: input.title,
      homepage_text: input.homepageText,
      paths: input.paths,
      pages: input.pages,
      image_alts: input.imageAlts,
      candidates,
    },
  })
  if (run.error || !run.output) throw new Error(run.error ?? 'judge produced no output')

  const out = run.output as { verdicts: JudgeVerdict[] }
  /* Anything the model skipped is absent, not missing: a verdict list shorter
     than the candidate list must not silently shrink the exam. */
  const byId = new Map(out.verdicts.map((v) => [v.id, v]))
  return {
    verdicts: candidates.map((c) => byId.get(c.id) ?? {
      id: c.id, present: false, evidence: null, reason: 'no verdict returned',
    }),
    runId: run.runId,
  }
}

/* ── scoring ──────────────────────────────────────────────────────────────
   Accuracy is the wrong headline here and the exam already knows why: three of
   the nine calls are lopsided enough that always-yes scores 82%. So every
   number below is reported per class, against both trivial baselines, and a
   skill that cannot beat "always answer the majority" has not earned its
   place. */

export interface Scored {
  id: string
  truePos: number
  falsePos: number
  trueNeg: number
  falseNeg: number
  n: number
}

export const precision = (s: Scored) => (s.truePos + s.falsePos === 0 ? null : s.truePos / (s.truePos + s.falsePos))
export const recall = (s: Scored) => (s.truePos + s.falseNeg === 0 ? null : s.truePos / (s.truePos + s.falseNeg))
export const accuracy = (s: Scored) => (s.n === 0 ? null : (s.truePos + s.trueNeg) / s.n)
/** What always answering the commoner label would score. Beat this or stop. */
export const majorityBaseline = (s: Scored) =>
  (s.n === 0 ? null : Math.max(s.truePos + s.falseNeg, s.trueNeg + s.falsePos) / s.n)

export function scoreVerdicts(
  cases: { labels: Record<string, boolean>; scorable: string[]; verdicts: JudgeVerdict[] }[],
  ids: string[],
): Scored[] {
  return ids.map((id) => {
    const s: Scored = { id, truePos: 0, falsePos: 0, trueNeg: 0, falseNeg: 0, n: 0 }
    for (const c of cases) {
      if (!c.scorable.includes(id)) continue
      const v = c.verdicts.find((x) => x.id === id)
      if (!v) continue
      const truth = c.labels[id]
      s.n++
      if (v.present && truth) s.truePos++
      else if (v.present && !truth) s.falsePos++
      else if (!v.present && truth) s.falseNeg++
      else s.trueNeg++
    }
    return s
  })
}
