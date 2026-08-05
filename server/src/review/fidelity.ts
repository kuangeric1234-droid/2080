import { readdirSync } from 'node:fs'
import path from 'node:path'
import { readDocx, type DocxDoc, type DocxParagraph } from './docx-read.ts'
import { loadBank } from './bank.ts'

/* Measuring the gap between the report this platform writes and the seventeen
   a human wrote.

   The bar is not "the tests pass". The bar is that a partner cannot tell which
   report the machine produced. Nothing that has been built so far can answer
   that, because every check so far compares the code to my own intention. This
   compares the output to the seventeen documents in Downloads/presence.

   Every finding here is a count over those documents, never an impression:
   "15 of 17 do X" is actionable and arguable, "the tone feels off" is not. A
   gap that shows up in fewer than three reports is one person's bespoke prose
   for one client, not house style, and copying it would be overfitting. */

export type Severity = 'critical' | 'major' | 'minor'

export interface Gap {
  id: string
  severity: Severity
  title: string
  /** What the generated document does. */
  observed: string
  /** What the references do, and in how many of them. */
  expected: string
  /** 'buildable' means nothing outside this repo is stopping it. */
  status: 'buildable' | 'blocked' | 'wontfix'
  blocker?: string
}

const WEIGHT: Record<Severity, number> = { critical: 10, major: 4, minor: 1 }

/** Lower is better; 0 is indistinguishable on everything measured here. */
export function score(gaps: Gap[]): number {
  return gaps.filter((g) => g.status !== 'wontfix').reduce((n, g) => n + WEIGHT[g.severity], 0)
}

/* ---------------------------------------------------------------- profile -- */

export interface ReferenceProfile {
  /** File name → parsed document, for the reports that parsed. */
  docs: Map<string, DocxDoc>
  /** Section headings in the order they most commonly appear. */
  sectionOrder: string[]
  /** How many reports carry each Heading2. */
  sectionCount: Map<string, number>
  /** Reports whose severity ink is on the bullet rather than the text. */
  bulletInkCount: number
  /** Reports whose score cells always hold five glyphs. */
  fiveGlyphStarCount: number
  /** Reports whose Comments column is written prose, not the dimension list. */
  proseCommentsCount: number
  /** Reports with an image-only header. */
  imageHeaderCount: number
  /** Reports with a page-number field in the footer. */
  pageNumberCount: number
  /** Reports printing the colour legend. */
  legendCount: number
  /** Images the body references, per report — the exhibits. */
  mediaCounts: number[]
  /** Date strings as written, one per report that has one. */
  dateLines: string[]
  /** Every body paragraph across every report, normalised. */
  corpus: { file: string; text: string }[]
  total: number
}

/** Squash to the form two paragraphs can be compared in. */
export function normalise(s: string): string {
  return s.toLowerCase()
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/\{\{[^}]*\}\}/g, ' ')       // unfilled variables match anything
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

/** The dimension lists the blank template ships in its Comments column. */
function isDimensionList(cell: string): boolean {
  const bank = loadBank()
  const n = normalise(cell)
  /* "N/A" is the honest answer for a category nothing was assessed in, and 13
     of the 17 references print it — but it is also, literally, Visibility
     (SEM)'s entire dimension list in the blank template, because there is
     nothing to prompt a writer with when no campaign is running. Matching on
     the text alone therefore counted every deliberate N/A as an unfilled
     placeholder, which flagged the reference reports themselves. */
  if (n === 'n a') return false
  return bank.categories.some((c) => normalise(c.dimensions.join(', ')) === n)
    || n === 'overall comment'
}

const HEADING_RE = /^(Website \(Business\)|Website \(Technical\)|Website \(Usability\)|Visibility \(SEO\)|Visibility \(SEM\)|Reputation|Social Media|Competition):?$/

export function summaryTable(doc: DocxDoc) {
  return doc.tables.find((t) => normalise(t.rows[0]?.[0] ?? '') === 'category') ?? null
}

/** Read every reference report once and reduce it to what can be compared. */
export async function profileReferences(dir: string): Promise<ReferenceProfile> {
  /* The blank template is in the same folder and is not a written report — it
     is the thing a written report is made FROM. Counting it as evidence would
     let the unfilled dimension lists and placeholder prose vote on what the
     house style is, which is exactly backwards. */
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.docx') && !f.startsWith('~$'))
    .filter((f) => !/template/i.test(f))
  const docs = new Map<string, DocxDoc>()
  const sectionCount = new Map<string, number>()
  const orderVotes: string[][] = []
  const corpus: ReferenceProfile['corpus'] = []
  const dateLines: string[] = []
  let bulletInkCount = 0, fiveGlyphStarCount = 0, proseCommentsCount = 0
  let imageHeaderCount = 0, pageNumberCount = 0, legendCount = 0
  const mediaCounts: number[] = []

  for (const f of files) {
    const doc = await readDocx(path.join(dir, f))
    docs.set(f, doc)

    const order: string[] = []
    for (const p of doc.paragraphs) {
      const h = p.text.replace(/:$/, '').trim()
      if (p.style === 'Heading2' && HEADING_RE.test(p.text.trim())) {
        if (!order.includes(h)) order.push(h)
      }
      if (p.text) corpus.push({ file: f, text: p.text })
      if (/^Date:/.test(p.text)) dateLines.push(p.text)
    }
    for (const h of order) sectionCount.set(h, (sectionCount.get(h) ?? 0) + 1)
    orderVotes.push(order)

    if (doc.paragraphs.filter((p) => p.bulletColor || p.uniformColor).length >= 3) bulletInkCount++
    if (doc.headerHasImage) imageHeaderCount++
    if (doc.footerHasPageNumber) pageNumberCount++
    if (doc.paragraphs.some((p) => /^legend/i.test(p.text.trim()))) legendCount++
    mediaCounts.push(doc.bodyImages)

    const t = summaryTable(doc)
    if (t) {
      const scoreCells = t.rows.slice(1).map((r) => r[1] ?? '').filter((c) => c.includes('*'))
      if (scoreCells.length > 0 && scoreCells.every((c) => c.replace(/[^*]/g, '').length === 5)) {
        fiveGlyphStarCount++
      }
      const comments = t.rows.slice(1).map((r) => r[2] ?? '').filter(Boolean)
      /* One unfilled cell is a reviewer who skipped it; a whole column of them
         is a document that was never written. Judge on the majority. */
      const written = comments.filter((c) => !isDimensionList(c)).length
      if (comments.length > 0 && written > comments.length / 2) proseCommentsCount++
    }
  }

  /* The order every report agrees on, taken from the longest run of headings
     rather than averaged — an average of orderings is not an ordering. */
  const sectionOrder = orderVotes.slice().sort((a, b) => b.length - a.length)[0] ?? []

  return {
    docs, sectionOrder, sectionCount, bulletInkCount, fiveGlyphStarCount,
    proseCommentsCount, imageHeaderCount, pageNumberCount, legendCount,
    mediaCounts, dateLines, corpus, total: files.length,
  }
}

/* ------------------------------------------------------------------ diff -- */

const of = (n: number, total: number) => `${n} of ${total}`

function starGlyphs(cell: string): number {
  return cell.replace(/[^*★☆]/g, '').length
}

/**
 * Compare a generated report against what the references do.
 *
 * Each check states the reference count, so a gap can be argued with rather
 * than merely believed.
 */
export function compareToReference(gen: DocxDoc, ref: ReferenceProfile): Gap[] {
  const gaps: Gap[] = []
  const T = ref.total
  const add = (g: Gap) => gaps.push(g)

  /* -- chrome ------------------------------------------------------------ */
  if (ref.imageHeaderCount > T / 2 && !gen.headerHasImage) {
    add({
      id: 'header-image', severity: 'critical', status: 'buildable',
      title: 'Letterhead missing from the header',
      observed: 'the generated header carries no image',
      expected: `an image-only letterhead in ${of(ref.imageHeaderCount, T)}`,
    })
  }
  if (ref.pageNumberCount > T / 2 && !gen.footerHasPageNumber) {
    add({
      id: 'footer-page-number', severity: 'major', status: 'buildable',
      title: 'Footer has no page number field',
      observed: 'no PAGE field in the footer',
      expected: `a page number in ${of(ref.pageNumberCount, T)}`,
    })
  }

  /* -- section order ----------------------------------------------------- */
  const genSections: string[] = []
  for (const p of gen.paragraphs) {
    const h = p.text.replace(/:$/, '').trim()
    if (p.style === 'Heading2' && HEADING_RE.test(p.text.trim()) && !genSections.includes(h)) {
      genSections.push(h)
    }
  }
  for (const [h, n] of ref.sectionCount) {
    if (n > T / 2 && !genSections.includes(h)) {
      add({
        id: `section-missing:${h}`, severity: 'critical', status: 'buildable',
        title: `Section "${h}" is absent`,
        observed: 'the generated report has no such heading',
        expected: `present in ${of(n, T)}`,
      })
    }
  }
  const common = ref.sectionOrder.filter((h) => genSections.includes(h))
  const genCommon = genSections.filter((h) => ref.sectionOrder.includes(h))
  if (common.join('|') !== genCommon.join('|')) {
    add({
      id: 'section-order', severity: 'major', status: 'buildable',
      title: 'Sections are in a different order',
      observed: genCommon.join(' → '),
      expected: common.join(' → '),
    })
  }

  /* -- summary table ----------------------------------------------------- */
  const gt = summaryTable(gen)
  const rt = summaryTable([...ref.docs.values()].find((d) => summaryTable(d)) ?? gen)
  if (!gt) {
    add({
      id: 'summary-table', severity: 'critical', status: 'buildable',
      title: 'No summary table',
      observed: 'no table whose first cell is "Category"',
      expected: `a Category/Score/Comments table in ${of(T, T)}`,
    })
  } else {
    if (rt && gt.rows.length !== rt.rows.length) {
      add({
        id: 'summary-rows', severity: 'major', status: 'buildable',
        title: 'Summary table has the wrong number of rows',
        observed: `${gt.rows.length} rows`,
        expected: `${rt.rows.length} rows (header + eight categories + Overall Score)`,
      })
    }
    const last = gt.rows[gt.rows.length - 1]?.[0] ?? ''
    if (!/overall/i.test(last)) {
      add({
        id: 'summary-overall-row', severity: 'major', status: 'buildable',
        title: 'Summary table has no Overall Score row',
        observed: `last row is "${last}"`,
        expected: `an "Overall Score" row in ${of(T, T)}`,
      })
    }
    const scored = gt.rows.slice(1).map((r) => r[1] ?? '').filter((c) => c.includes('*'))
    const wrong = scored.filter((c) => starGlyphs(c) !== 5)
    if (ref.fiveGlyphStarCount > T / 2 && wrong.length > 0) {
      add({
        id: 'star-glyph-count', severity: 'major', status: 'buildable',
        title: 'Star scores print fewer than five glyphs',
        observed: `${wrong.length} score cells with ${[...new Set(wrong.map(starGlyphs))].join('/')} glyphs`,
        expected: `always five glyphs, the unearned ones tinted pale, in ${of(ref.fiveGlyphStarCount, T)}`,
      })
    }
    const comments = gt.rows.slice(1).map((r) => r[2] ?? '').filter(Boolean)
    const canned = comments.filter(isDimensionList)
    if (ref.proseCommentsCount > T / 2 && canned.length > comments.length / 2) {
      add({
        id: 'summary-comments-prose', severity: 'major', status: 'buildable',
        title: 'Comments column prints the dimension list, not a verdict',
        observed: `${canned.length} of ${comments.length} cells are the template's dimension list`,
        expected: `written verdicts in ${of(ref.proseCommentsCount, T)}`,
      })
    }
  }

  /* -- exhibits ---------------------------------------------------------- */
  /* Every image the body references is evidence the reviewer pasted in — the
     banner, the search result, the speed test. A report with none of that is
     an opinion; the references argue with pictures. */
  const withExhibits = ref.mediaCounts.filter((n) => n > 0).length
  if (withExhibits > T / 2 && gen.bodyImages === 0) {
    add({
      id: 'exhibits', severity: 'critical', status: 'buildable',
      title: 'No exhibits — nothing but the letterhead',
      observed: 'the body references no images',
      expected: `screenshots in the body of ${of(withExhibits, T)}`
        + ` (median ${median(ref.mediaCounts.filter((n) => n > 0))})`,
    })
  }

  /* -- severity ink ------------------------------------------------------ */
  /* Only Oh Dental colours its findings, and only Oh Dental prints the legend
     — 1 of 17. By this harness's own rule that is one reviewer's choice on one
     report, not house style. It is in the product because it was asked for
     specifically, so it is recorded as a deliberate divergence rather than
     scored as a gap: the ledger should not quietly reward matching a habit
     sixteen reports do not have. What IS worth matching is where Oh Dental put
     the ink — on the list bullet, leaving the text black. */
  const genBullet = gen.paragraphs.filter((p) => p.bulletColor).length
  const genRunInk = gen.paragraphs.filter((p) => p.uniformColor && !p.bulletColor).length
  if (genRunInk > 0 && genBullet === 0) {
    add({
      id: 'severity-on-bullet', severity: 'major', status: 'buildable',
      title: 'Severity colours the finding text instead of the bullet',
      observed: `${genRunInk} paragraphs with coloured text and no coloured bullet`,
      expected: 'the colour on the list bullet, text left black — how Oh Dental does it'
        + `, the only reference that colours findings at all (${of(ref.bulletInkCount, T)})`,
    })
  }

  /* -- date format ------------------------------------------------------- */
  const genDate = gen.paragraphs.find((p) => /^Date:/.test(p.text))?.text ?? null
  const slash = ref.dateLines.filter((d) => /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(d)).length
  if (!genDate) {
    add({
      id: 'date-line', severity: 'minor', status: 'buildable',
      title: 'No date line',
      observed: 'absent',
      expected: `"Date: …" in ${of(ref.dateLines.length, T)}`,
    })
  } else if (slash > ref.dateLines.length / 2 && !/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(genDate)) {
    add({
      id: 'date-format', severity: 'minor', status: 'buildable',
      title: 'Date is written in a different format',
      observed: genDate,
      expected: `dd/mm/yyyy — ${of(slash, ref.dateLines.length)} dated reports`,
    })
  }

  /* -- findings per section --------------------------------------------- */
  const genPerSection = countPerSection(gen)
  const refPerSection = new Map<string, number[]>()
  for (const doc of ref.docs.values()) {
    for (const [k, v] of countPerSection(doc)) {
      refPerSection.set(k, [...(refPerSection.get(k) ?? []), v])
    }
  }
  for (const [h, counts] of refPerSection) {
    /* A section that is absent is already reported as absent. Saying it is
       also thin is the same defect counted twice, which inflates the score
       and makes closing one gap look like closing two. */
    if (!genSections.includes(h)) continue
    const med = median(counts.filter((c) => c > 0))
    const got = genPerSection.get(h) ?? 0
    /* Thin is the failure mode that matters: a section with one line in it
       reads as a section the writer had nothing to say about. */
    if (med >= 3 && got < Math.ceil(med / 2)) {
      const blocker = BLOCKED_SECTIONS[h]
      add({
        id: `thin-section:${h}`, severity: got === 0 ? 'major' : 'minor',
        status: blocker ? 'blocked' : 'buildable',
        blocker,
        title: `"${h}" is thin`,
        observed: `${got} finding${got === 1 ? '' : 's'}`,
        expected: `median ${med} across the references that filled it`,
      })
    }
  }

  return gaps
}

/* Which sections cannot be filled without something from outside this repo.
   A ledger that labels every gap "buildable" is telling the reader to go and
   build something that no amount of code will produce, and it hides the fact
   that the real next step is a purchase or an application. Each of these
   points at the BLOCKERS.md entry that would release it. */
const BLOCKED_SECTIONS: Record<string, string> = {
  'Social Media': 'Meta Page Public Content Access — App Review + Business Verification.'
    + ' A token alone does not unblock it; tested live 2026-08-04.',
  'Visibility (SEO)': 'SERP provider (SerpAPI or DataForSEO, ~USD $50-100/mo).'
    + ' Reopens the free-sources-only decision of 2026-08-03.',
  'Visibility (SEM)': 'SERP provider, or SEMrush access as the template\'s own margin notes describe.',
  Competition: 'Google Maps Platform key (Places API) for competitor discovery,'
    + ' and a SERP provider for their rankings.',
  Reputation: 'Google Maps Platform key (Places API) — rating and review count.',
}

function countPerSection(doc: DocxDoc): Map<string, number> {
  const out = new Map<string, number>()
  let current: string | null = null
  for (const p of doc.paragraphs) {
    if (p.style === 'Heading2') {
      const h = p.text.replace(/:$/, '').trim()
      current = HEADING_RE.test(p.text.trim()) ? h : null
      if (current) out.set(current, out.get(current) ?? 0)
      continue
    }
    if (current && p.text.length > 25) out.set(current, (out.get(current) ?? 0) + 1)
  }
  return out
}

function median(ns: number[]): number {
  if (ns.length === 0) return 0
  const s = [...ns].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/* --------------------------------------------------- paragraph coverage -- */

export interface CoverageMiss {
  text: string
  /** How many of the reference reports carry a paragraph like this. */
  reports: number
}

/** Word trigrams, for comparing two paragraphs that were typed years apart. */
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

/**
 * Reference paragraphs that recur across reports but have no snippet in the bank.
 *
 * The threshold is three reports: below that it is prose written for one
 * practice, and putting it in the bank would be teaching the house voice to say
 * something it only ever said once.
 */
export interface CoverageReport {
  /** Body paragraphs long enough to be prose. */
  paragraphs: number
  /** Distinct paragraphs after merging near-identical ones. */
  clusters: number
  /** Clusters appearing in `minReports` or more reports — the house copy. */
  recurring: number
  /** Of those, how many the bank already says. */
  covered: number
  /** Clusters seen in exactly one report — bespoke, correctly not in the bank. */
  bespoke: number
  misses: CoverageMiss[]
}

export function coverageMisses(ref: ReferenceProfile, minReports = 3): CoverageMiss[] {
  return coverageReport(ref, minReports).misses
}

export function coverageReport(ref: ReferenceProfile, minReports = 3): CoverageReport {
  const bank = loadBank()
  const bankShingles = bank.snippets.map((s) => shingles(s.text))

  /* Cluster the corpus so the same paragraph written in two reports counts once. */
  const clusters: { text: string; sh: Set<string>; files: Set<string> }[] = []
  for (const { file, text } of ref.corpus) {
    if (text.length < 60) continue                 // headings, labels, table noise
    const sh = shingles(text)
    if (sh.size < 4) continue
    const hit = clusters.find((c) => overlap(c.sh, sh) > 0.55)
    if (hit) hit.files.add(file)
    else clusters.push({ text, sh, files: new Set([file]) })
  }

  const recurring = clusters.filter((c) => c.files.size >= minReports)
  const misses = recurring
    .filter((c) => !bankShingles.some((b) => overlap(c.sh, b) > 0.45))
    .map((c) => ({ text: c.text, reports: c.files.size }))
    .sort((a, b) => b.reports - a.reports)

  return {
    paragraphs: ref.corpus.filter((c) => c.text.length >= 60).length,
    clusters: clusters.length,
    recurring: recurring.length,
    covered: recurring.length - misses.length,
    bespoke: clusters.filter((c) => c.files.size === 1).length,
    misses,
  }
}
