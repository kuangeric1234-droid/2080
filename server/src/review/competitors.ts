import { collectFetchLayer } from './collect.ts'
import { signalsToMap } from './engine.ts'
import type { Snippet } from './bank.ts'

/* §13.2 step 1.12 — the Competition section.

   §13.2 called this "guided manual entry", but even the manual half was never
   built: nothing has ever written to `review_competitors` and there was no
   route to add one, so this section of the template could never render at all.
   That is what this module fixes first.

   comp.row's note describes the split the template already assumes: "Technical
   and usability facts are collected automatically once the domain is named; the
   SERP, review and social facts are entered by hand." So naming a competitor's
   domain runs the same fetch collectors we run on the practice, and the counts
   a human would look up stay a human's to type — or a SERP provider's, once
   somebody decides to buy one. */

export interface CompetitorFacts {
  [key: string]: string | number | boolean | null | undefined
}

/* ── row rendering ──────────────────────────────────────────────────────────
   comp.row is a list of fragments joined with ', ', empty ones dropped, in the
   template's own order. Three forms appear in it and `render()` in bank.ts
   handles only the first, which is why this lives here:

     {{name}}                  value, or the whole fragment is dropped
     {{corporate?Corporate}}   the word when true, fragment dropped when not
     {{https?secure:not secure}}  either word — never dropped, always says something
*/
const TOKEN = /\{\{([^}]+)\}\}/g

function truthy(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return false
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v.toLowerCase() !== 'false' && v.toLowerCase() !== 'no'
  return Boolean(v)
}

/** One fragment, or null when it has nothing to say. */
export function renderFragment(fragment: string, facts: CompetitorFacts): string | null {
  let dropped = false
  const out = fragment.replace(TOKEN, (_whole, expr: string) => {
    const [rawKey, rest] = expr.split('?', 2) as [string, string | undefined]
    const key = rawKey.trim()
    const value = facts[key]

    if (rest === undefined) {
      if (value === undefined || value === null || value === '') { dropped = true; return '' }
      return String(value)
    }
    /* Not measured is not the same as measured false. With no fact at all,
       "{{https?secure:not secure}}" would otherwise print "not secure" about a
       competitor nobody checked — a claim about a named third party that
       nothing behind it supports. Absent drops; only an actual false prints
       the negative word. */
    if (value === undefined || value === null || value === '') { dropped = true; return '' }
    const [whenTrue, whenFalse] = rest.split(':', 2) as [string, string | undefined]
    if (truthy(value)) return whenTrue
    if (whenFalse !== undefined) return whenFalse
    dropped = true // a bare {{x?Word}} that is false says nothing at all
    return ''
  })
  if (dropped) return null
  const trimmed = out.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Assemble one competitor's line from the bank's own comp.row template, so the
 * wording and the order stay the template's rather than this file's.
 */
export function renderCompetitorRow(
  snippet: Pick<Snippet, 'row_template' | 'row_suffix'>,
  competitor: { name: string; facts?: CompetitorFacts | null; threat?: number | null },
): string {
  const facts: CompetitorFacts = {
    name: competitor.name,
    ...(competitor.facts ?? {}),
    threat: competitor.threat ?? undefined,
  }
  const parts = (snippet.row_template ?? ['{{name}}'])
    .map((f) => renderFragment(f, facts))
    .filter((f): f is string => f !== null)

  let line = parts.join(', ')
  if (snippet.row_suffix) {
    const suffix = renderFragment(snippet.row_suffix, facts)
    if (suffix) line += suffix.startsWith('-') ? ` ${suffix}` : suffix
  }
  return line
}

/* ── the automatic half ─────────────────────────────────────────────────────
   Naming a competitor's domain earns the same technical and usability facts we
   measure on the practice itself. Anything a human would have to look up is
   left alone. */
export async function collectCompetitorFacts(
  domain: string,
  opts: { fetchImpl?: typeof fetch; networkProbes?: boolean } = {},
): Promise<{ facts: CompetitorFacts; errors: string[] }> {
  const r = await collectFetchLayer(domain, { ...opts, maxPages: 4 })
  const s = signalsToMap(r.signals)
  const val = (k: string) => s.get(k)?.value

  const facts: CompetitorFacts = {}
  const https = val('site.https')
  if (typeof https === 'boolean') facts.https = https
  const booking = val('site.booking.present')
  if (booking === true) facts.booking = true
  const cms = val('site.cms')
  if (typeof cms === 'string' && cms !== 'unknown') facts.platform = cms

  /* The template's own vocabulary: "generic content", "old website". A page
     count is the honest proxy we can measure — how thin the site is — and it
     stays a number rather than pretending to judge quality. */
  const pages = val('pages.total')
  if (typeof pages === 'number') facts.content_volume = `${pages} pages`

  return { facts, errors: r.errors }
}

/* ── the half that needs buying ─────────────────────────────────────────────
   SERP position, map position, review count and rating are what the template's
   margin comments describe a human looking up (SEMrush for ads, Google for
   rankings). §13.2 recorded a free-sources-only decision on 2026-08-03, so this
   interface exists to make that decision reversible with an adapter rather than
   a rewrite — it does not override it. */
export interface SerpFacts {
  serp_position?: number
  map_position?: number
  review_count?: number
  review_rating?: number
  sem?: boolean
}

export interface SerpProvider {
  readonly name: string
  readonly provisional: boolean
  lookup(domain: string, suburb: string | null): Promise<SerpFacts | null>
}

/* PROVISIONAL (BLOCKERS.md: serp-provider-decision). Returns nothing, on
   purpose. A mock that invented a rank would put "#1 in Google search" into a
   client's report next to a real competitor's name — the single most
   defamatory-adjacent thing this system could fabricate. Absent is correct
   until somebody buys a real source. */
export class NoSerpProvider implements SerpProvider {
  readonly name = 'none'
  readonly provisional = true
  async lookup(): Promise<SerpFacts | null> {
    return null
  }
}

export function defaultSerpProvider(): SerpProvider {
  return new NoSerpProvider()
}
