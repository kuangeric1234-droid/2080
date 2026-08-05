import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/* The snippet bank is 20-80's IP: ~70 canonical paragraphs from the Online
   Presence Review template, most in matched positive/negative pairs. Nothing
   here generates prose. A collected signal fires a trigger, the trigger selects
   a snippet, and the only thing a model may touch is a {{variable}}.

   Bank data lives in /review-bank/<version>/ so Wally can edit the wording
   without a code change. Triggers travel with the text because a paragraph and
   the condition that earns it are one decision, not two. */

const BANK_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../review-bank')

export type Variant = 'positive' | 'negative' | 'neutral'
/* How alarmed the reader should be. The template prints a legend for exactly
   these three and colours every finding to match, which is not the same thing
   as `weight` (scoring impact): biz.website.dated is weight 3 but moderate,
   biz.conditions_content.missing is weight 2 but critical. */
export type Severity = 'positive' | 'moderate' | 'critical'
export type WhenKind = 'manual' | 'judgement' | 'generated' | 'always'

export interface Condition {
  signal: string
  eq?: unknown
  ne?: unknown
  gt?: number
  gte?: number
  lt?: number
  lte?: number
  in?: unknown[]
  contains?: string
  exists?: boolean
  missing?: boolean
}

export interface Trigger {
  all?: Condition[]
  any?: Condition[]
}

export interface Snippet {
  id: string
  category: string
  dimension: string
  variant: Variant
  severity: Severity
  weight: number
  /* Permission to ship this paragraph into a client's report with no human
     having read it (§13.2 step 1.8). True only for pure measurements of the
     practice's own site plumbing. Anything manual, judgement-driven,
     AHPRA-adjacent, or about a third party — competitors, reviews, social —
     is false, because those are the sentences a practice would be harmed by
     getting wrong. Required, not optional: a snippet with no answer here is a
     snippet nobody has decided about. */
  auto_safe: boolean
  when: Trigger | WhenKind
  text: string
  vars?: string[]
  links?: string[]
  conflicts?: string[]
  note?: string
  structural?: boolean
  generated?: boolean
  repeats_per?: string
  row_template?: string[]
  row_suffix?: string
  generation_contract?: string
  /** A measured signal shown beside a judgement call — informs the reviewer,
      never decides for them. Used where a heuristic is too unreliable to accuse
      on its own (page-type classification from URLs). */
  hint_signal?: string
  judgement_prompt?: string
  manual_prompt?: string
  requires_exhibit?: boolean
  exhibit_kind?: string
  ahpra_blocking?: boolean
}

export interface CategoryDef {
  key: string
  label: string
  dimensions: string[]
  automation: 'full' | 'semi' | 'manual'
  automation_note: string
  /** Printed under the heading when the section has nothing accepted in it.
      The template carries all eight sections in every report, so a section with
      no findings still appears — saying so, rather than vanishing and leaving
      the summary table promising a section the document never delivers. */
}

export interface Bank {
  version: string
  snippets: Snippet[]
  categories: CategoryDef[]
  byId: Map<string, Snippet>
  byCategory: Map<string, Snippet[]>
}

let cached: Bank | null = null

export function loadBank(version = 'v1', dir = BANK_DIR): Bank {
  if (cached && cached.version === version) return cached

  const read = <T>(file: string): T =>
    JSON.parse(readFileSync(path.join(dir, version, file), 'utf8')) as T

  const snippets = read<{ snippets: Snippet[] }>('snippets.json').snippets
  const categories = read<{ categories: CategoryDef[] }>('categories.json').categories

  const byId = new Map<string, Snippet>()
  for (const s of snippets) {
    if (byId.has(s.id)) throw new Error(`duplicate snippet id: ${s.id}`)
    byId.set(s.id, s)
  }

  const known = new Set([...categories.map((c) => c.key), 'recommendations'])
  for (const s of snippets) {
    if (!known.has(s.category)) throw new Error(`${s.id}: unknown category "${s.category}"`)
    for (const c of s.conflicts ?? []) {
      if (!byId.has(c)) throw new Error(`${s.id}: conflicts with unknown snippet "${c}"`)
    }
  }

  const byCategory = new Map<string, Snippet[]>()
  for (const s of snippets) {
    const list = byCategory.get(s.category) ?? []
    list.push(s)
    byCategory.set(s.category, list)
  }

  cached = { version, snippets, categories, byId, byCategory }
  return cached
}

/** The literal runs of a snippet, i.e. everything a model may NOT change. */
export function literalSegments(text: string): string[] {
  return text
    .split(/\{\{[^}]+\}\}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** Variable names a snippet expects, in order of appearance. */
export function variablesOf(text: string): string[] {
  return [...text.matchAll(/\{\{([^}?:]+)[^}]*\}\}/g)].map((m) => m[1].trim())
}

/** Fill {{vars}} and nothing else. An unknown variable is left visible so a
    half-filled snippet is obvious in review rather than silently shipped. */
export function render(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (whole, name: string) => {
    const key = name.split(/[?:]/)[0].trim()
    const v = values[key]
    return v === undefined || v === '' ? whole : String(v)
  })
}
