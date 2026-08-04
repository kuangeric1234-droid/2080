import pg from 'pg'
import { monotonicFactory } from 'ulid'
import { collectFetchLayer } from './collect.ts'
import pathMod from 'node:path'
import { collectRenderLayer, defaultExhibitDir } from './render.ts'
import { collectSocialSignals, defaultSocialProvider, type SocialProvider } from './social.ts'
import { collectCompetitorFacts } from './competitors.ts'
import { selectFindings, signalsToMap, suggestOverall, suggestScores, varsFromSignals } from './engine.ts'
import { loadBank, render, type Snippet } from './bank.ts'

const ulid = monotonicFactory()
const id = (p: string) => `${p}_${ulid()}`

/* Persistence for a review. Collection is append-only: re-running it writes a
   new generation of signals rather than editing the old ones, so a delivered
   report stays explicable against the measurements that produced it.

   Findings behave differently — they carry the reviewer's decisions, so a
   re-collect updates a candidate in place but never silently overwrites an
   accepted, rejected or edited one. Losing a reviewer's work to a background
   re-crawl would be the fastest way to make this tool untrusted. */

export interface ReviewRow {
  id: string
  domain: string
  practice_name: string | null
  contact_name: string | null
  contact_email: string | null
  status: string
  overall_score: number | null
  findings_accepted: number
  findings_candidate: number
  source: string
  requested_at: string
  updated_at: string
}

export async function listReviews(db: pg.Client | pg.Pool, workspaceId: string): Promise<ReviewRow[]> {
  const { rows } = await db.query<ReviewRow>(
    `SELECT r.id, r.domain, r.practice_name, r.contact_name, r.contact_email,
            r.status::text, r.overall_score, r.requested_at, r.updated_at,
            COALESCE(ir.source, 'manual') AS source,
            COUNT(f.id) FILTER (WHERE f.state IN ('accepted','edited'))::int AS findings_accepted,
            COUNT(f.id)::int AS findings_candidate
       FROM reviews r
       LEFT JOIN intake_requests ir ON ir.id = r.intake_request_id
       LEFT JOIN review_findings f  ON f.review_id = r.id
      WHERE r.workspace_id = $1
      GROUP BY r.id, ir.source
      ORDER BY r.requested_at DESC
      LIMIT 200`,
    [workspaceId],
  )
  return rows
}

export async function getReview(db: pg.Client | pg.Pool, workspaceId: string, reviewId: string) {
  const { rows } = await db.query(
    `SELECT * FROM reviews WHERE id = $1 AND workspace_id = $2`, [reviewId, workspaceId],
  )
  if (rows.length === 0) return null
  const review = rows[0]

  /* Latest generation only: DISTINCT ON keeps the newest measurement per key
     while the history stays on the table for provenance. */
  const { rows: signals } = await db.query(
    `SELECT DISTINCT ON (target, key) target, key, value, source::text, provenance, collected_at
       FROM review_signals WHERE review_id = $1
      ORDER BY target, key, collected_at DESC`,
    [reviewId],
  )
  const { rows: findings } = await db.query(
    `SELECT id, snippet_id, category, dimension, variant, weight, state::text,
            rendered_text, edited_text, vars, triggered_by, ahpra_blocking, position,
            decided_by, decided_at
       FROM review_findings WHERE review_id = $1
      ORDER BY category, position, snippet_id`,
    [reviewId],
  )
  const { rows: competitors } = await db.query(
    `SELECT id, name, domain, facts, threat, position FROM review_competitors
      WHERE review_id = $1 ORDER BY position`,
    [reviewId],
  )
  const { rows: exhibits } = await db.query(
    `SELECT id, finding_id, kind, label, path, width, height, position
       FROM review_exhibits WHERE review_id = $1 ORDER BY position`,
    [reviewId],
  )

  const bank = loadBank(review.bank_version)
  return { review, signals, findings, competitors, exhibits, categories: bank.categories }
}

/* §13.2 step 1.9. Whether a freshly collected finding may go straight to
   'accepted' with nobody having read it.

   Three conditions, deliberately redundant. `auto_safe` is the bank's own
   judgement (1.8) and the bank test already proves no AHPRA snippet carries it
   — but this is the last code between a paragraph and a practice's inbox, so it
   re-checks rather than trusting an upstream invariant. An unfilled {{variable}}
   is disqualifying because the export would refuse it anyway, and a finding
   parked in 'accepted' that can never ship is worse than one awaiting review.

   `=== true` on purpose: a bank version that has never heard of auto_safe reads
   as undefined, and undefined must mean "ask a human". */
function autoAccepts(c: { snippet: Snippet; renderedText: string }): boolean {
  return c.snippet.auto_safe === true
    && c.snippet.ahpra_blocking !== true
    && !/\{\{/.test(c.renderedText)
}

/** Crawl the domain, store the evidence, and refresh the candidate findings. */
export async function collectReview(
  db: pg.Client | pg.Pool,
  workspaceId: string,
  reviewId: string,
  opts: { fetchImpl?: typeof fetch; networkProbes?: boolean; socialProvider?: SocialProvider } = {},
) {
  const { rows } = await db.query(
    `SELECT id, domain FROM reviews WHERE id = $1 AND workspace_id = $2`, [reviewId, workspaceId],
  )
  if (rows.length === 0) throw new Error('review not found')
  const domain = rows[0].domain as string
  if (!domain || domain === '(not supplied)') throw new Error('this review has no domain yet')

  await db.query(`UPDATE reviews SET status = 'collecting', collect_error = NULL WHERE id = $1`, [reviewId])

  let result
  try {
    result = await collectFetchLayer(domain, opts)
  } catch (err) {
    await db.query(`UPDATE reviews SET status = 'failed', collect_error = $2 WHERE id = $1`,
      [reviewId, (err as Error).message])
    throw err
  }

  /* The render layer needs a real browser, so it is skipped wherever the fetch
     layer's network probes are — fixture-backed tests must not launch Chromium.
     Its failure is never fatal: a review with fetch signals and no render ones
     is a smaller report, not a broken one. */
  let renderResult: Awaited<ReturnType<typeof collectRenderLayer>> =
    { signals: [], exhibits: [], errors: [] }
  if (opts.networkProbes !== false) {
    renderResult = await collectRenderLayer(result.finalUrl, {
      // Banner height is an interior-page measurement; the homepage is expected
      // to lead with a big image.
      interiorUrl: result.pages.find((p) => p.url !== result.finalUrl)?.url,
      reviewId,
    })
  }

  /* Social audience and engagement come from a credentialed third-party API,
     so they are gated the same way the browser layer is. The provider is
     injectable: the real Meta provider when META_GRAPH_TOKEN is set, the
     PROVISIONAL mock otherwise. Either way its numbers only fill the bank's
     {{fans}}/{{followers}} and sit beside the reviewer's manual call — every
     social snippet stays `when: manual`, so nothing sourced this way can
     auto-accept its way into a report (1.9). */
  let socialResult: Awaited<ReturnType<typeof collectSocialSignals>> = { signals: [], errors: [] }
  if (opts.networkProbes !== false) {
    const urlOf = (key: string) => {
      const s = result.signals.find((x) => x.key === key)
      return typeof s?.value === 'string' ? s.value : null
    }
    socialResult = await collectSocialSignals(opts.socialProvider ?? defaultSocialProvider(), [
      { network: 'facebook', url: urlOf('social.facebook_url') },
      { network: 'instagram', url: urlOf('social.instagram_url') },
    ])
  }

  /* Render after fetch: toMap() is last-wins, so where both layers measure the
     same key the browser's answer is the one that survives. */
  const allSignals = [...result.signals, ...renderResult.signals, ...socialResult.signals]

  for (const s of allSignals) {
    await db.query(
      `INSERT INTO review_signals (id, workspace_id, review_id, target, key, value, source, provenance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id('sig'), workspaceId, reviewId, result.target, s.key, JSON.stringify(s.value), s.source, s.provenance],
    )
  }

  /* Exhibits are replaced wholesale on re-collect: a screenshot of a page as it
     looked two crawls ago is worse than none, and the finding it was attached
     to may no longer fire. */
  await db.query(`DELETE FROM review_exhibits WHERE review_id = $1`, [reviewId])
  for (const [i, ex] of renderResult.exhibits.entries()) {
    await db.query(
      `INSERT INTO review_exhibits
         (id, workspace_id, review_id, kind, label, path, width, height, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id('exh'), workspaceId, reviewId, ex.kind, ex.label, ex.path, ex.width, ex.height, i],
    )
  }

  const signals = signalsToMap(allSignals)
  const vars = varsFromSignals(signals, result.target)

  /* Manual and judgement snippets the reviewer already confirmed stay confirmed
     across a re-collect — the crawl learning something new must not silently
     discard a call a human already made. */
  const { rows: confirmed } = await db.query(
    `SELECT snippet_id FROM review_findings
      WHERE review_id = $1 AND state IN ('accepted','edited')`,
    [reviewId],
  )
  const candidates = selectFindings(signals, {
    vars,
    manualAccepted: confirmed.map((r) => r.snippet_id as string),
  })

  for (const [i, c] of candidates.entries()) {
    await db.query(
      `INSERT INTO review_findings
         (id, workspace_id, review_id, snippet_id, category, dimension, variant, weight,
          rendered_text, vars, triggered_by, ahpra_blocking, position,
          state, decided_by, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
               $14,$15, CASE WHEN $15::text IS NULL THEN NULL ELSE now() END)
       ON CONFLICT (review_id, snippet_id) DO UPDATE SET
         rendered_text = CASE WHEN review_findings.state = 'candidate'
                              THEN EXCLUDED.rendered_text ELSE review_findings.rendered_text END,
         triggered_by  = EXCLUDED.triggered_by,
         vars          = CASE WHEN review_findings.state = 'candidate'
                              THEN EXCLUDED.vars ELSE review_findings.vars END,
         /* A human's ruling is final. Only an untouched candidate may be
            promoted by the auto-accept pass, and a rejection is never
            resurrected by a later crawl. */
         state         = CASE WHEN review_findings.state = 'candidate'
                              THEN EXCLUDED.state ELSE review_findings.state END,
         decided_by    = CASE WHEN review_findings.state = 'candidate'
                              THEN EXCLUDED.decided_by ELSE review_findings.decided_by END,
         decided_at    = CASE WHEN review_findings.state = 'candidate'
                              THEN EXCLUDED.decided_at ELSE review_findings.decided_at END`,
      [id('fnd'), workspaceId, reviewId, c.snippet.id, c.snippet.category, c.snippet.dimension,
        c.snippet.variant, c.snippet.weight, c.renderedText, JSON.stringify(c.vars),
        JSON.stringify(c.triggeredBy), c.snippet.ahpra_blocking ?? false, i,
        autoAccepts(c) ? 'accepted' : 'candidate', autoAccepts(c) ? 'auto' : null],
    )
  }

  /* A finding that no longer fires is withdrawn only if nobody has ruled on it.
     A reviewer's accept survives the signal that first suggested it. */
  const liveIds = candidates.map((c) => c.snippet.id)
  await db.query(
    `DELETE FROM review_findings
      WHERE review_id = $1 AND state = 'candidate' AND NOT (snippet_id = ANY($2))`,
    [reviewId, liveIds],
  )

  const scores = suggestScores(candidates)
  await db.query(
    `UPDATE reviews SET status = 'draft', collected_at = now(),
            category_scores = $2, overall_score = $3
      WHERE id = $1`,
    [reviewId,
      JSON.stringify(Object.fromEntries(scores.map((s) => [s.category, s.suggested]))),
      suggestOverall(scores)],
  )

  return {
    signals: allSignals.length,
    pages: result.pages.length,
    sitemap: result.sitemap.length,
    exhibits: renderResult.exhibits.length,
    findings: candidates.length,
    errors: [...result.errors, ...renderResult.errors],
    scores,
  }
}

/* The manual worklist: snippets that need Wally rather than a crawler, with
   whatever the collectors did measure attached as a hint. Grouped by category
   so the hand-entry pass is one focused sweep instead of a hunt, and marked
   with what is already on the review so nothing gets added twice. */
export async function manualBank(db: pg.Client | pg.Pool, workspaceId: string, reviewId: string) {
  const { rows: review } = await db.query(
    `SELECT bank_version FROM reviews WHERE id = $1 AND workspace_id = $2`, [reviewId, workspaceId])
  if (review.length === 0) throw new Error('review not found')
  const bank = loadBank(review[0].bank_version)

  const { rows: existing } = await db.query(
    `SELECT snippet_id, state::text FROM review_findings WHERE review_id = $1`, [reviewId])
  const onReview = new Map(existing.map((r) => [r.snippet_id as string, r.state as string]))

  const { rows: signalRows } = await db.query(
    `SELECT DISTINCT ON (key) key, value, provenance FROM review_signals
      WHERE review_id = $1 ORDER BY key, collected_at DESC`, [reviewId])
  const signals = new Map(signalRows.map((r) => [r.key as string, r]))

  return bank.categories
    .map((cat) => ({
      category: cat.key,
      label: cat.label,
      automation: cat.automation,
      automation_note: cat.automation_note,
      items: (bank.byCategory.get(cat.key) ?? [])
        .filter((s) => s.when === 'manual' || s.when === 'judgement')
        .map((s) => ({
          snippet_id: s.id,
          dimension: s.dimension,
          variant: s.variant,
          text: s.text,
          prompt: s.manual_prompt ?? s.judgement_prompt ?? null,
          kind: s.when as string,
          vars: s.vars ?? [],
          conflicts: s.conflicts ?? [],
          hint: s.hint_signal ? (signals.get(s.hint_signal) ?? null) : null,
          state: onReview.get(s.id) ?? null,
        })),
    }))
    .filter((g) => g.items.length > 0)
}

/** Add a manual or judgement finding the reviewer has confirmed. */
export async function addManualFinding(
  db: pg.Client | pg.Pool,
  workspaceId: string,
  reviewId: string,
  snippetId: string,
  vars: Record<string, string | number>,
  actor: string,
) {
  const { rows: review } = await db.query(
    `SELECT bank_version FROM reviews WHERE id = $1 AND workspace_id = $2`, [reviewId, workspaceId])
  if (review.length === 0) throw new Error('review not found')
  const bank = loadBank(review[0].bank_version)
  const snippet = bank.byId.get(snippetId)
  if (!snippet) throw new Error(`unknown snippet "${snippetId}"`)

  /* Both halves of a pair can never ship together. Adding one withdraws the
     other rather than leaving the report to contradict itself. */
  if (snippet.conflicts?.length) {
    await db.query(
      `DELETE FROM review_findings WHERE review_id = $1 AND snippet_id = ANY($2)`,
      [reviewId, snippet.conflicts],
    )
  }

  const rendered = render(snippet.text, vars)
  const findingId = id('fnd')
  await db.query(
    `INSERT INTO review_findings
       (id, workspace_id, review_id, snippet_id, category, dimension, variant, weight,
        state, rendered_text, vars, triggered_by, ahpra_blocking, decided_by, decided_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'accepted',$9,$10,$11,$12,$13,now())
     ON CONFLICT (review_id, snippet_id) DO UPDATE SET
       state = 'accepted', rendered_text = EXCLUDED.rendered_text, vars = EXCLUDED.vars,
       decided_by = EXCLUDED.decided_by, decided_at = now()`,
    [findingId, workspaceId, reviewId, snippetId, snippet.category, snippet.dimension,
      snippet.variant, snippet.weight, rendered, JSON.stringify(vars),
      JSON.stringify([`reviewer:${snippet.when}`]), snippet.ahpra_blocking ?? false, actor],
  )

  await db.query(
    `INSERT INTO audit_log (id, workspace_id, actor_type, actor_id, action, target_type, target_id, why)
     VALUES ($1,$2,'human',$3,'finding.added','review',$4,$5)`,
    [id('aud'), workspaceId, actor, reviewId, `${snippetId} entered by hand`],
  )
  return { ok: true, snippetId, rendered }
}

/** Accept, reject or edit one finding. Every decision is attributed. */
export async function decideFinding(
  db: pg.Client | pg.Pool,
  workspaceId: string,
  findingId: string,
  decision: { state: 'accepted' | 'rejected' | 'candidate'; editedText?: string; actor: string },
) {
  const state = decision.editedText ? 'edited' : decision.state
  const { rows } = await db.query(
    `UPDATE review_findings
        SET state = $3, edited_text = COALESCE($4, edited_text),
            decided_by = $5, decided_at = now()
      WHERE id = $1 AND workspace_id = $2
      RETURNING review_id, snippet_id, state::text`,
    [findingId, workspaceId, state, decision.editedText ?? null, decision.actor],
  )
  if (rows.length === 0) throw new Error('finding not found')

  await db.query(
    `INSERT INTO audit_log (id, workspace_id, actor_type, actor_id, action, target_type, target_id, why)
     VALUES ($1,$2,'human',$3,$4,'review_finding',$5,$6)`,
    [id('aud'), workspaceId, decision.actor, `finding.${state}`, findingId,
      `${rows[0].snippet_id} on review ${rows[0].review_id}`],
  )
  return rows[0]
}

/** Set the star scores the report ships with. The reviewer's number always wins
    over the engine's suggestion. */
export async function setScores(
  db: pg.Client | pg.Pool,
  workspaceId: string,
  reviewId: string,
  scores: Record<string, number | null>,
  overall: number | null,
  actor: string,
) {
  for (const [k, v] of Object.entries(scores)) {
    if (v !== null && (v < 1 || v > 5)) throw new Error(`score for ${k} must be 1..5 or null`)
  }
  const { rows } = await db.query(
    `UPDATE reviews SET category_scores = $3, overall_score = $4, status = 'in_review'
      WHERE id = $1 AND workspace_id = $2 RETURNING id`,
    [reviewId, workspaceId, JSON.stringify(scores), overall],
  )
  if (rows.length === 0) throw new Error('review not found')

  await db.query(
    `INSERT INTO audit_log (id, workspace_id, actor_type, actor_id, action, target_type, target_id, why)
     VALUES ($1,$2,'human',$3,'review.scored','review',$4,$5)`,
    [id('aud'), workspaceId, actor, reviewId, `overall ${overall ?? '—'}`],
  )
  return { ok: true }
}

/* ── competitors (§13.2 step 1.12) ──────────────────────────────────────────
   comp.intro and comp.row both trigger on `manual.competitors.count > 0`, so
   adding a competitor has to write that signal or the Competition section stays
   invisible no matter how many rows are in the table. That is exactly why this
   section has never rendered: nothing wrote the row, and nothing wrote the
   count. */

async function refreshCompetitorCount(
  db: pg.Client | pg.Pool, workspaceId: string, reviewId: string,
): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM review_competitors WHERE review_id = $1`, [reviewId])
  const n = Number(rows[0].n)
  const { rows: r } = await db.query(`SELECT domain FROM reviews WHERE id = $1`, [reviewId])
  await db.query(
    `INSERT INTO review_signals (id, workspace_id, review_id, target, key, value, source, provenance)
     VALUES ($1,$2,$3,$4,'manual.competitors.count',$5,'manual',$6)`,
    [id('sig'), workspaceId, reviewId, r[0]?.domain ?? '', JSON.stringify(n),
      `${n} competitor${n === 1 ? '' : 's'} entered by the reviewer`],
  )
  return n
}

/** Re-run the findings pass so comp.intro/comp.row appear or disappear. */
async function refreshFindingsFor(
  db: pg.Client | pg.Pool, workspaceId: string, reviewId: string,
): Promise<void> {
  const data = await getReview(db, workspaceId, reviewId)
  if (!data) return
  const signals = signalsToMap(data.signals as never)
  const vars = varsFromSignals(signals, String((data.review as Record<string, unknown>).domain ?? ''))
  const { rows: confirmed } = await db.query(
    `SELECT snippet_id FROM review_findings WHERE review_id = $1 AND state IN ('accepted','edited')`,
    [reviewId])
  const candidates = selectFindings(signals, {
    vars, manualAccepted: confirmed.map((r) => r.snippet_id as string),
  })
  for (const [i, c] of candidates.entries()) {
    await db.query(
      `INSERT INTO review_findings
         (id, workspace_id, review_id, snippet_id, category, dimension, variant, weight,
          rendered_text, vars, triggered_by, ahpra_blocking, position, state, decided_by, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
               CASE WHEN $15::text IS NULL THEN NULL ELSE now() END)
       ON CONFLICT (review_id, snippet_id) DO UPDATE SET
         rendered_text = CASE WHEN review_findings.state = 'candidate'
                              THEN EXCLUDED.rendered_text ELSE review_findings.rendered_text END,
         triggered_by  = EXCLUDED.triggered_by`,
      [id('fnd'), workspaceId, reviewId, c.snippet.id, c.snippet.category, c.snippet.dimension,
        c.snippet.variant, c.snippet.weight, c.renderedText, JSON.stringify(c.vars),
        JSON.stringify(c.triggeredBy), c.snippet.ahpra_blocking ?? false, i,
        autoAccepts(c) ? 'accepted' : 'candidate', autoAccepts(c) ? 'auto' : null],
    )
  }
}

export async function listCompetitors(
  db: pg.Client | pg.Pool, workspaceId: string, reviewId: string,
) {
  const { rows } = await db.query(
    `SELECT c.id, c.name, c.domain, c.facts, c.threat, c.position
       FROM review_competitors c JOIN reviews r ON r.id = c.review_id
      WHERE c.review_id = $1 AND r.workspace_id = $2 ORDER BY c.position`,
    [reviewId, workspaceId])
  return rows
}

/**
 * Add a competitor. Naming a domain earns the technical facts automatically —
 * comp.row's own note says so — while the SERP, review and social fields stay
 * the reviewer's to type until somebody buys a provider.
 */
export async function addCompetitor(
  db: pg.Client | pg.Pool,
  workspaceId: string,
  reviewId: string,
  input: { name: string; domain?: string | null; facts?: Record<string, unknown>; threat?: number | null },
  opts: { fetchImpl?: typeof fetch; networkProbes?: boolean } = {},
) {
  if (!input.name?.trim()) throw new Error('a competitor needs a name')
  if (input.threat != null && (input.threat < 1 || input.threat > 10)) {
    throw new Error('threat must be between 1 and 10')
  }
  const { rows: own } = await db.query(
    `SELECT id FROM reviews WHERE id = $1 AND workspace_id = $2`, [reviewId, workspaceId])
  if (own.length === 0) throw new Error('review not found')

  let facts: Record<string, unknown> = { ...(input.facts ?? {}) }
  const errors: string[] = []
  if (input.domain) {
    try {
      const auto = await collectCompetitorFacts(input.domain, opts)
      // the reviewer's own entry wins over anything measured
      facts = { ...auto.facts, ...facts }
      errors.push(...auto.errors)
    } catch (err) {
      errors.push(`could not collect ${input.domain}: ${(err as Error).message}`)
    }
  }

  const { rows: pos } = await db.query<{ n: string }>(
    `SELECT COALESCE(MAX(position) + 1, 0)::text AS n FROM review_competitors WHERE review_id = $1`,
    [reviewId])
  const { rows } = await db.query(
    `INSERT INTO review_competitors (id, workspace_id, review_id, name, domain, facts, threat, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, name, domain, facts, threat, position`,
    [id('cmp'), workspaceId, reviewId, input.name.trim(), input.domain ?? null,
      JSON.stringify(facts), input.threat ?? null, Number(pos[0].n)])

  await refreshCompetitorCount(db, workspaceId, reviewId)
  await refreshFindingsFor(db, workspaceId, reviewId)
  return { competitor: rows[0], errors }
}

export async function updateCompetitor(
  db: pg.Client | pg.Pool, workspaceId: string, competitorId: string,
  patch: { name?: string; domain?: string | null; facts?: Record<string, unknown>; threat?: number | null },
) {
  if (patch.threat != null && (patch.threat < 1 || patch.threat > 10)) {
    throw new Error('threat must be between 1 and 10')
  }
  const { rows } = await db.query(
    `UPDATE review_competitors SET
       name   = COALESCE($3, name),
       domain = COALESCE($4, domain),
       facts  = COALESCE($5::jsonb, facts),
       threat = COALESCE($6, threat)
     WHERE id = $1 AND workspace_id = $2
     RETURNING id, review_id, name, domain, facts, threat, position`,
    [competitorId, workspaceId, patch.name ?? null, patch.domain ?? null,
      patch.facts ? JSON.stringify(patch.facts) : null, patch.threat ?? null])
  if (rows.length === 0) throw new Error('competitor not found')
  await refreshFindingsFor(db, workspaceId, rows[0].review_id as string)
  return rows[0]
}

export async function removeCompetitor(
  db: pg.Client | pg.Pool, workspaceId: string, competitorId: string,
) {
  const { rows } = await db.query(
    `DELETE FROM review_competitors WHERE id = $1 AND workspace_id = $2 RETURNING review_id`,
    [competitorId, workspaceId])
  if (rows.length === 0) throw new Error('competitor not found')
  const reviewId = rows[0].review_id as string
  await refreshCompetitorCount(db, workspaceId, reviewId)
  await refreshFindingsFor(db, workspaceId, reviewId)
  return { ok: true }
}

/* ── exhibits (§13.2 step 1.5b) ─────────────────────────────────────────────
   The template puts a screenshot beside the finding it evidences, and the
   exporter has supported that since 1.7 — but nothing ever set `finding_id`,
   so every capture landed in the Evidence block at the back instead. This is
   the missing half: letting a reviewer say which paragraph a picture is for. */

export async function attachExhibit(
  db: pg.Client | pg.Pool,
  workspaceId: string,
  exhibitId: string,
  findingId: string | null,
) {
  if (findingId) {
    /* An exhibit may only point at a finding in the same review — otherwise a
       screenshot of one practice could be filed against another's paragraph. */
    const { rows } = await db.query(
      `SELECT 1 FROM review_exhibits e
         JOIN review_findings f ON f.review_id = e.review_id
        WHERE e.id = $1 AND f.id = $2 AND e.workspace_id = $3`,
      [exhibitId, findingId, workspaceId])
    if (rows.length === 0) throw new Error('that finding is not in this review')
  }
  const { rows } = await db.query(
    `UPDATE review_exhibits SET finding_id = $3
      WHERE id = $1 AND workspace_id = $2
      RETURNING id, review_id, finding_id, kind, label, path, width, height, position`,
    [exhibitId, workspaceId, findingId])
  if (rows.length === 0) throw new Error('exhibit not found')
  return rows[0]
}

/** The bytes, for the workspace preview. Kept behind the session like the rest. */
export async function exhibitFile(
  db: pg.Client | pg.Pool, workspaceId: string, exhibitId: string,
): Promise<{ absolute: string; label: string } | null> {
  const { rows } = await db.query(
    `SELECT path, label FROM review_exhibits WHERE id = $1 AND workspace_id = $2`,
    [exhibitId, workspaceId])
  if (rows.length === 0) return null
  const rel = String(rows[0].path)
  /* The path came out of our own collector, but it is still a path being joined
     onto a root — resolve it and refuse anything that climbs out. */
  const root = pathMod.resolve(defaultExhibitDir())
  const abs = pathMod.resolve(root, rel)
  if (!abs.startsWith(root + pathMod.sep)) throw new Error('exhibit path escapes the store')
  return { absolute: abs, label: String(rows[0].label) }
}
