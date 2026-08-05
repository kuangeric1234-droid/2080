import type pg from 'pg'
import type { ModelClient } from '../skills/model.ts'
import { runSkill } from '../skills/runner.ts'
import { getReview } from './store.ts'

/* §13.2 step 1.10 — the two written paragraphs of the review.

   Everything else in this module is house copy: a signal fires a trigger and a
   canonical paragraph ships verbatim. These two are the exception, and the
   exception is where a model can hurt a practice — by stating something about
   their business that nothing measured.

   So the skill is allowed to compress and re-order what the reviewer accepted,
   and nothing else. The check below is what makes that enforceable rather than
   a line in a prompt. */

export interface CategoryComment { category: string; comment: string }

export interface SummaryResult {
  summary_text: string
  overall_comment: string
  /** The summary table's Comments column — one short verdict per category. */
  category_comments: CategoryComment[]
  /** Non-empty means the output was refused and nothing was written. */
  unsourced: string[]
  runId: string
}

/* Digits and domains, because those are the fabrications that read as authority:
   "loads in 8.4 seconds", "behind 90% of practices", "three competitors on
   page one". A wrong adjective is a bad sentence; a wrong number is a false
   statement about someone's business. Prose claims need a judge with a real
   golden set — see BLOCKERS.md — so this catches the dangerous half now rather
   than waiting to catch everything later. */
const NUMBER = /\d+(?:[.,]\d+)?%?/g
const DOMAINY = /\b[a-z0-9-]+(?:\.[a-z]{2,})+\b/gi

export function groundingViolations(text: string, evidence: string): string[] {
  const hay = evidence.toLowerCase()
  const bad = new Set<string>()

  for (const m of text.matchAll(NUMBER)) {
    const raw = m[0]
    const bare = raw.replace(/[%,]/g, '')
    if (!hay.includes(bare.toLowerCase()) && !hay.includes(raw.toLowerCase())) bad.add(raw)
  }
  for (const m of text.matchAll(DOMAINY)) {
    if (!hay.includes(m[0].toLowerCase())) bad.add(m[0])
  }
  return [...bad]
}

/** Everything the summary is allowed to know. */
function evidenceFor(
  findings: { rendered_text: string; edited_text: string | null }[],
  review: Record<string, unknown>,
): string {
  const scores = Object.values((review.category_scores ?? {}) as Record<string, unknown>)
  return [
    ...findings.map((f) => f.edited_text ?? f.rendered_text),
    String(review.practice_name ?? ''),
    String(review.domain ?? ''),
    String(review.overall_score ?? ''),
    ...scores.map((s) => String(s ?? '')),
  ].join('\n')
}

/** Write the review's opening and overall comment from its accepted findings. */
export async function summariseReview(
  db: pg.Client | pg.Pool,
  model: ModelClient,
  workspaceId: string,
  reviewId: string,
  opts: { skillsDir?: string } = {},
): Promise<SummaryResult | null> {
  const data = await getReview(db, workspaceId, reviewId)
  if (!data) throw new Error('review not found')

  const accepted = data.findings.filter(
    (f: { state: string }) => f.state === 'accepted' || f.state === 'edited',
  )
  /* Nothing accepted means nothing to summarise. Writing an opening for an
     empty report would be the model filling a silence with invention. */
  if (accepted.length === 0) return null

  const review = data.review as Record<string, unknown>
  const run = await runSkill(db, model, {
    skill: 'review-summariser',
    clientId: null,
    trigger: `review:${reviewId}`,
    skillsDir: opts.skillsDir,
    input: {
      practice_name: review.practice_name ?? review.domain,
      domain: review.domain,
      overall_score: review.overall_score ?? null,
      category_scores: review.category_scores ?? {},
      /* The dimensions each category is assessed against. 7 of the 17 real
         reports write the Comments cell as a walk through this list — "UVP
         needs to be added, Need more content, Good photos, Online booking is
         missing" — so the skill needs to know what the list is. */
      categories: data.categories.map((c: { key: string; label: string; dimensions: string[] }) => ({
        key: c.key, label: c.label, dimensions: c.dimensions,
      })),
      findings: accepted.map((f: Record<string, unknown>) => ({
        category: f.category,
        variant: f.variant,
        text: f.edited_text ?? f.rendered_text,
      })),
    },
  })

  if (run.error || !run.output) throw new Error(run.error ?? 'summariser produced no output')
  const out = run.output as { summary_text: string; overall_comment: string; category_comments?: CategoryComment[] }

  const evidence = evidenceFor(accepted as never, review)
  const comments = out.category_comments ?? []
  const unsourced = [
    ...groundingViolations(out.summary_text, evidence),
    ...groundingViolations(out.overall_comment, evidence),
    /* The Comments column is prose about the practice like any other, so it is
       checked the same way — "Rank #1 for local suburb" needs a finding. */
    ...comments.flatMap((c) => groundingViolations(c.comment, evidence)),
  ]

  /* Refuse rather than repair. A summary trimmed of its invented number still
     came from a run that invented one, and the reviewer should see that the
     skill misfired instead of a quietly patched paragraph. */
  if (unsourced.length > 0) {
    return { ...out, category_comments: comments, unsourced: [...new Set(unsourced)], runId: run.runId }
  }

  await db.query(
    `UPDATE reviews SET summary_text = $2, overall_comment = $3, category_comments = $4
      WHERE id = $1`,
    [reviewId, out.summary_text, out.overall_comment,
      JSON.stringify(Object.fromEntries(comments.map((c) => [c.category, c.comment])))],
  )
  return { ...out, category_comments: comments, unsourced: [], runId: run.runId }
}
