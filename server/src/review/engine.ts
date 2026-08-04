import { loadBank, render, type Bank, type Condition, type Snippet, type Trigger } from './bank.ts'
import type { Signal, SignalMap } from './signals.ts'
import { professionFor } from './profession.ts'

/* Signals in, candidate findings out. The whole of the judgement lives in the
   bank's triggers, so this file has no opinions about SEO — it evaluates
   conditions, resolves the positive/negative pairs, and suggests a star score.

   The hard rule it enforces: an automatic finding must name at least one signal
   that fired it. A finding with an empty `triggeredBy` is a bug, not a warning,
   and `selectFindings` will not emit one. */

export interface Candidate {
  snippet: Snippet
  /** Signal keys that satisfied the trigger. The "why does it say that?" answer. */
  triggeredBy: string[]
  /** Provenance strings for those signals, in the same order. */
  evidence: string[]
  /** Variables the snippet still needs before it reads correctly. */
  missingVars: string[]
  renderedText: string
  vars: Record<string, string | number>
  /** For judgement calls backed by an unreliable heuristic: what we measured,
      shown to the reviewer so the decision is informed rather than blind. */
  hint?: { signal: string; value: unknown; provenance: string }
}

export interface CategoryScore {
  category: string
  label: string
  /** null means nothing was collected — an unscored row, never a five-star one. */
  suggested: number | null
  positives: number
  negatives: number
  note: string
}

// ──────────────────────────────────────────────────────── trigger evaluation

function testCondition(c: Condition, signals: SignalMap): boolean {
  const s = signals.get(c.signal)
  const has = s !== undefined && s.value !== null

  if (c.exists !== undefined) return has === c.exists
  if (c.missing !== undefined) return has === !c.missing
  if (!has) return false // an absent signal never satisfies a value comparison

  const v = s!.value
  if (c.eq !== undefined) return v === c.eq
  if (c.ne !== undefined) return v !== c.ne
  if (c.in !== undefined) return c.in.includes(v)
  if (c.contains !== undefined) return String(v).toLowerCase().includes(c.contains.toLowerCase())
  if (typeof v !== 'number') return false
  if (c.gt !== undefined) return v > c.gt
  if (c.gte !== undefined) return v >= c.gte
  if (c.lt !== undefined) return v < c.lt
  if (c.lte !== undefined) return v <= c.lte
  return false
}

export function evaluate(
  trigger: Trigger,
  signals: SignalMap,
): { fires: boolean; triggeredBy: string[] } {
  if (trigger.all?.length) {
    const ok = trigger.all.every((c) => testCondition(c, signals))
    return { fires: ok, triggeredBy: ok ? trigger.all.map((c) => c.signal) : [] }
  }
  if (trigger.any?.length) {
    const hits = trigger.any.filter((c) => testCondition(c, signals))
    return { fires: hits.length > 0, triggeredBy: hits.map((c) => c.signal) }
  }
  return { fires: false, triggeredBy: [] }
}

// ──────────────────────────────────────────────────────────── selection

export interface SelectOptions {
  /** Variable values: crawl-derived, reviewer-entered, or model-filled. */
  vars?: Record<string, string | number>
  /** Snippet ids the reviewer has answered for `manual` / `judgement` triggers. */
  manualAccepted?: string[]
  bank?: Bank
}

export function selectFindings(signals: SignalMap, opts: SelectOptions = {}): Candidate[] {
  const bank = opts.bank ?? loadBank()
  const vars = opts.vars ?? {}
  const manual = new Set(opts.manualAccepted ?? [])
  const out: Candidate[] = []

  for (const snippet of bank.snippets) {
    let triggeredBy: string[] = []

    if (typeof snippet.when === 'string') {
      // manual / judgement fire only when the reviewer has said so; `always`
      // is unconditional; `generated` is written elsewhere from accepted findings
      if (snippet.when === 'generated') continue
      if (snippet.when !== 'always' && !manual.has(snippet.id)) continue
      triggeredBy = snippet.when === 'always' ? [] : [`reviewer:${snippet.when}`]
    } else {
      const r = evaluate(snippet.when, signals)
      if (!r.fires) continue
      // the invariant: an automatic finding without evidence does not exist
      if (r.triggeredBy.length === 0) continue
      triggeredBy = r.triggeredBy
    }

    const renderedText = render(snippet.text, vars)
    const hintSignal = snippet.hint_signal ? signals.get(snippet.hint_signal) : undefined
    out.push({
      snippet,
      triggeredBy,
      evidence: triggeredBy.map((k) => signals.get(k)?.provenance ?? k),
      missingVars: [...renderedText.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1].split(/[?:]/)[0].trim()),
      renderedText,
      vars,
      hint: hintSignal
        ? { signal: hintSignal.key, value: hintSignal.value, provenance: hintSignal.provenance }
        : undefined,
    })
  }

  return resolveConflicts(out)
}

/* Both halves of a pair firing means the signals disagree with themselves —
   keep the one with more evidence, and on a tie keep the negative, because a
   review that under-reports a problem costs the practice more than one that
   over-reports it. */
function resolveConflicts(candidates: Candidate[]): Candidate[] {
  const byId = new Map(candidates.map((c) => [c.snippet.id, c]))
  const dropped = new Set<string>()

  for (const c of candidates) {
    if (dropped.has(c.snippet.id)) continue
    for (const otherId of c.snippet.conflicts ?? []) {
      const other = byId.get(otherId)
      if (!other || dropped.has(otherId)) continue
      const loser =
        c.triggeredBy.length !== other.triggeredBy.length
          ? (c.triggeredBy.length < other.triggeredBy.length ? c : other)
          : (c.snippet.variant === 'negative' ? other : c)
      dropped.add(loser.snippet.id)
    }
  }

  return candidates.filter((c) => !dropped.has(c.snippet.id))
}

// ──────────────────────────────────────────────────────────────── scoring

/** Suggest a star score per category. A suggestion only — the reviewer's
    override is what ships, per review-bank/v1/categories.json. */
export function suggestScores(accepted: Candidate[], bank: Bank = loadBank()): CategoryScore[] {
  return bank.categories.map((cat) => {
    const mine = accepted.filter((c) => c.snippet.category === cat.key)
    const negWeight = mine.filter((c) => c.snippet.variant === 'negative').reduce((a, c) => a + c.snippet.weight, 0)
    const posWeight = mine.filter((c) => c.snippet.variant === 'positive').reduce((a, c) => a + c.snippet.weight, 0)
    const positives = mine.filter((c) => c.snippet.variant === 'positive').length
    const negatives = mine.filter((c) => c.snippet.variant === 'negative').length

    /* An empty category is unscored, not perfect. Defaulting to five stars
       would have told a practice its reputation was flawless when the truth was
       that nobody had looked at it yet. */
    if (mine.length === 0) {
      return {
        category: cat.key,
        label: cat.label,
        suggested: null,
        positives: 0,
        negatives: 0,
        note: cat.automation === 'manual'
          ? `Not scored — ${cat.label} needs your input`
          : `Not scored — no findings fired for ${cat.label}`,
      }
    }

    const raw = 5 - negWeight + posWeight / 2
    const suggested = Math.max(1, Math.min(5, Math.round(raw)))
    const note = `${negatives} issue${negatives === 1 ? '' : 's'}, ${positives} strength${positives === 1 ? '' : 's'}`

    return { category: cat.key, label: cat.label, suggested, positives, negatives, note }
  })
}

/** The Overall Score row: the mean of the scored categories. Null while none
    have been scored — the report cannot claim an overall verdict it hasn't earned. */
export function suggestOverall(scores: CategoryScore[]): number | null {
  const scored = scores.filter((s): s is CategoryScore & { suggested: number } => s.suggested !== null)
  if (scored.length === 0) return null
  return Math.max(1, Math.min(5, Math.round(scored.reduce((a, s) => a + s.suggested, 0) / scored.length)))
}

/** Snippets the reviewer must still answer for — the manual worklist, grouped
    so the five minutes of hand-entry is one focused pass, not a hunt. */
export function manualWorklist(bank: Bank = loadBank()): Array<{ category: string; label: string; items: Snippet[] }> {
  return bank.categories
    .map((cat) => ({
      category: cat.key,
      label: cat.label,
      items: (bank.byCategory.get(cat.key) ?? []).filter(
        (s) => s.when === 'manual' || s.when === 'judgement',
      ),
    }))
    .filter((g) => g.items.length > 0)
}

export function signalsToMap(signals: Signal[]): SignalMap {
  return new Map(signals.map((s) => [s.key, s]))
}

/* Variables a measurement already knows the answer to. Asking the reviewer to
   retype a number the crawler just measured is the kind of friction that makes
   people stop using the tool. Everything not derivable stays absent and shows
   up in the finding's `missingVars`. */
export function varsFromSignals(signals: SignalMap, target: string): Record<string, string | number> {
  const v: Record<string, string | number> = { domain: target, website: target }
  const num = (key: string) => {
    const s = signals.get(key)
    return typeof s?.value === 'number' ? s.value : undefined
  }
  const str = (key: string) => {
    const s = signals.get(key)
    return typeof s?.value === 'string' ? s.value : undefined
  }

  const load = num('site.load_seconds')
  if (load !== undefined) v.load_seconds = load
  const font = num('render.body_font_px')
  if (font !== undefined) v.font_px = font
  const country = str('site.host.country')
  if (country !== undefined) v.host_country = country

  /* The social snippets have carried unfilled {{fans}}/{{followers}}/{{posts}}
     since 1.1 because nothing measured them. The provider (1.11) does. */
  const fans = num('social.facebook.fans')
  if (fans !== undefined) v.fans = fans
  const followers = num('social.instagram.followers')
  if (followers !== undefined) v.followers = followers
  const igPosts = num('social.instagram.posts_30d')
  if (igPosts !== undefined) v.posts = igPosts

  /* rep.reviews.few / rep.reviews.good_diversify print "{{count}}x {{rating}}*"
     — the line 15 of 17 real reports carry. Google Places supplies both. */
  const revCount = num('reputation.google_review_count')
  if (revCount !== undefined) v.count = revCount
  const revRating = num('reputation.google_rating')
  if (revRating !== undefined) v.rating = revRating

  /* One bank, every trade (§13.2 1.15): the six paragraphs mined from a dental
     template carry these instead of hard-coded "dental". */
  const trade = str('practice.profession')
  const prof = professionFor(trade ?? 'dentist')
  v.profession_adj = prof.adj
  v.practitioners = prof.practitioners
  v.condition_examples = prof.condition_examples
  v.treatment_example = prof.treatment_example

  const email = str('site.contact.email')
  if (email && signals.get('site.contact.email_domain_public')?.value === true) {
    v.public_email = email
    // the lookalike the snippet warns about: same address, one separator swapped
    const [local, dom] = email.split('@')
    v.lookalike_email = `${local.includes('_') ? local.replace(/_/g, '-') : local.replace(/[.-]/g, '_')}@${dom}`
  }
  return v
}
