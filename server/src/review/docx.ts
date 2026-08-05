import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, PageNumber,
  Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx'
import type pg from 'pg'
import { getReview } from './store.ts'
import { defaultExhibitDir } from './render.ts'
import { renderCompetitorRow } from './competitors.ts'
import { loadBank, type Severity } from './bank.ts'

/* The deliverable. Layout, fonts and colours are lifted from
   new/1. Online Presence Review/_Online Presence Review Template.docx so the
   exported file lands in Word looking like the one the practice already gets —
   Cambria body, Calibri headings in the template's own blues, the eight-row
   summary table, then a section per category.

   Everything here is assembly. No wording is generated at export time: the text
   is whatever the reviewer accepted, and a finding that is not accepted does
   not appear. */

const BODY_FONT = 'Cambria'
const HEAD_FONT = 'Calibri'
const H1_BLUE = '335B8A'
const H2_BLUE = '4F81BD'
const MUTED = '8A9CA3'

/* The summary table is the template's `Table1` style, read out of its own
   styles.xml: a 4F81BD header row in white bold, 7BA0CD rules, D3DFEE banding
   on alternate data rows, and a bold first column throughout. */
const TABLE_RULE = '7BA0CD'
const HEADER_FILL = '4F81BD'
const HEADER_INK = 'FFFFFF'
const BAND_FILL = 'D3DFEE'

/** Half-points, matching the template's w:sz values. */
const SZ = { body: 22, small: 20, h1: 32, h2: 26 }

/* The template's own w:gridCol widths — 2518 / 1559 / 4439 of 8516 twips. */
const COL = { category: 30, score: 18, comments: 52 }

const ASSET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets')

/* Page geometry read out of the template's own sectPr: A4 portrait, 1" top and
   bottom, 1.25" left and right, header and footer 708 twips from the edge. */
const PAGE = {
  width: 11900, height: 16840,
  top: 1440, bottom: 1440, left: 1800, right: 1800,
  headerDist: 708, footerDist: 708,
}

/* The letterhead banner carries the company name, ABN, phone, email and street
   address, which is why the template has no separate address block — the header
   image is the only place any of them appear. Sized from the template's own
   wp:extent (6803390 x 723265 EMU = 7.44" x 0.79"), so it spans into the side
   margins exactly as the original does. */
const LOGO = { file: path.join(ASSET_DIR, '2080-logo.png'), width: 714, height: 76 }

/* An exhibit must fit the text column and still leave room for words on the
   page, so it scales down to whichever bound binds first. */
const EXHIBIT_MAX_W = 560
const EXHIBIT_MAX_H = 620

interface ExhibitRow {
  finding_id: string | null
  kind: string
  label: string
  path: string
  width: number | null
  height: number | null
}

function body(text: string, opts: { italics?: boolean; color?: string; size?: number } = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 276 },
    children: [new TextRun({
      text, font: BODY_FONT, size: opts.size ?? SZ.body,
      italics: opts.italics, color: opts.color,
    })],
  })
}

/* The template's own legend, read out of its runs: every finding is coloured by
   how alarmed the reader should be, and the legend is printed so the colours
   mean something rather than being decoration. */
const SEVERITY_INK: Record<Severity, string> = {
  positive: '00FF00',
  moderate: 'FF9900',
  critical: 'FF0000',
}
const SEVERITY_LABEL: Record<Severity, string> = {
  positive: 'Positive',
  moderate: 'Negative (Moderate)',
  critical: 'Negative (Critical)',
}

/* The severity colour goes on the paragraph mark (`run:`), which is what Word
   paints the list BULLET with. The finding itself stays black.

   Oh Dental is the only reference report that colours its findings at all, and
   this is how it does it — 36 coloured bullets over black text. Colouring the
   text instead turns thirty paragraphs of a client's report orange and red,
   which reads as a warning notice rather than a professional document, and
   makes the moderate findings genuinely harder to read. The dot carries the
   signal; the sentence carries the meaning. */
function bullet(text: string, severity?: Severity) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 120, line: 276 },
    run: severity ? { color: SEVERITY_INK[severity], font: BODY_FONT, size: SZ.body } : undefined,
    children: [new TextRun({ text, font: BODY_FONT, size: SZ.body })],
  })
}

/* A report with an empty section is not a finished report.

   All 17 references fill all eight sections — not one of them contains a
   sentence like "Not assessed in this review", which is what this export used
   to print under an empty heading. That sentence is the single most
   machine-written thing a reader could find: it is the document admitting it
   was assembled rather than written, in the middle of the page, in the same
   voice as the findings around it.

   Incompleteness is a fact about the document's *status*, not a finding. So it
   is stated once, at the top, in a form no one could mistake for part of the
   report — and it disappears the moment a reviewer fills the gaps. A client who
   receives this by accident sees a loud warning instead of a quiet hole. */
function draftNotice(empty: { label: string }[]): Paragraph[] {
  if (empty.length === 0) return []
  const names = empty.map((c) => c.label).join(', ')
  return [
    new Paragraph({
      spacing: { after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: SEVERITY_INK.critical, space: 4 } },
      children: [new TextRun({
        text: 'DRAFT — not ready to send', font: HEAD_FONT, bold: true,
        size: SZ.body, color: SEVERITY_INK.critical,
      })],
    }),
    new Paragraph({
      spacing: { after: 320 },
      children: [new TextRun({
        text: `${empty.length} section${empty.length === 1 ? '' : 's'} still need a reviewer: ${names}.`,
        font: BODY_FONT, size: SZ.small, italics: true, color: MUTED,
      })],
    }),
  ]
}

/** Prints between Recommendations and the first section, as Oh Dental does. */
function legend(): Paragraph[] {
  const out = [new Paragraph({
    spacing: { before: 240, after: 60 },
    children: [new TextRun({ text: 'Legend:', font: HEAD_FONT, bold: true, size: SZ.body })],
  })]
  /* Bulleted, with the ink on the bullet, so the legend is a sample of the
     thing it explains rather than a differently-styled description of it. */
  for (const sev of ['positive', 'moderate', 'critical'] as Severity[]) {
    out.push(new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 40 },
      run: { color: SEVERITY_INK[sev], font: BODY_FONT, size: SZ.body },
      children: [new TextRun({ text: SEVERITY_LABEL[sev], font: BODY_FONT, size: SZ.body })],
    }))
  }
  return out
}

function heading(text: string, level: 1 | 2) {
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    spacing: { before: level === 1 ? 480 : 200, after: 120 },
    children: [new TextRun({
      text, font: HEAD_FONT, bold: true,
      size: level === 1 ? SZ.h1 : SZ.h2,
      color: level === 1 ? H1_BLUE : H2_BLUE,
    })],
  })
}

/* The template prints scores as literal asterisks, so that is what ships. An
   unscored row prints an em dash rather than five stars — the same rule the
   engine and the workspace hold to. */
/* A score is five glyphs, always — the earned ones black, the rest tinted.
   Every reference report does this (16 of 17 exactly; the seventeenth has one
   four-glyph cell, a slip rather than a different convention), and the reason
   is legibility: five cells of equal width let a reader compare rows down the
   column at a glance. Printing three asterisks for a 3 gives a ragged column
   and hides the denominator — three out of what?

   b8cce4 is the tint in 122 of the 141 pale runs across the references; the
   other 19 are c6d9f1, one row of one template generation that got copied
   forward. Use the one they actually settled on. */
const STAR_UNEARNED = 'B8CCE4'
const STAR_MAX = 5

function stars(score: number | null): TextRun[] {
  const common = { font: BODY_FONT, size: SZ.small, bold: true }
  if (score === null) return [new TextRun({ ...common, text: '—' })]
  const earned = Math.max(0, Math.min(STAR_MAX, Math.round(score)))
  return [
    new TextRun({ ...common, text: '*'.repeat(earned) }),
    ...(earned < STAR_MAX
      ? [new TextRun({ ...common, text: '*'.repeat(STAR_MAX - earned), color: STAR_UNEARNED })]
      : []),
  ]
}

function cell(children: Paragraph[], opts: { width?: number; fill?: string } = {}) {
  return new TableCell({
    children,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
  })
}

function tableCellText(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) {
  return new Paragraph({
    spacing: { after: 0 },
    children: [new TextRun({
      text, font: BODY_FONT, bold: opts.bold, size: opts.size ?? SZ.small, color: opts.color,
    })],
  })
}

/* The letterhead. A missing asset must never fail an export — the words are the
   deliverable and a logo is presentation, so the header degrades to empty. */
function letterhead(): Header {
  if (!existsSync(LOGO.file)) return new Header({ children: [new Paragraph({ text: '' })] })
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new ImageRun({
        type: 'png',
        data: readFileSync(LOGO.file),
        transformation: { width: LOGO.width, height: LOGO.height },
      })],
    })],
  })
}

/** Footer: the template prints the domain and "Page N of M", so this does too. */
function pageFooter(): Footer {
  const grey = { font: BODY_FONT, size: SZ.small, color: '8A9CA3' }
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: '2080solutions.com.au', ...grey }),
        new TextRun({ text: '     ', ...grey }),
        new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], ...grey }),
      ],
    })],
  })
}

/* One exhibit: the picture, then its caption. Scaled to whichever of width or
   height binds first so a tall screenshot cannot run off the page. */
function exhibit(ex: ExhibitRow, dir: string): Paragraph[] {
  const abs = path.join(dir, ex.path)
  if (!existsSync(abs)) return [] // collected on another machine, or cleaned up
  const w = Number(ex.width) || EXHIBIT_MAX_W
  const h = Number(ex.height) || Math.round(EXHIBIT_MAX_W * 0.62)
  const scale = Math.min(1, EXHIBIT_MAX_W / w, EXHIBIT_MAX_H / h)
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 40 },
      children: [new ImageRun({
        type: 'png',
        data: readFileSync(abs),
        transformation: { width: Math.round(w * scale), height: Math.round(h * scale) },
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: ex.label, font: BODY_FONT, size: SZ.small, italics: true, color: '8A9CA3' })],
    }),
  ]
}

export interface ExportedReview {
  filename: string
  buffer: Buffer
}

/** Build the .docx for one review from its accepted findings. */
export async function exportReviewDocx(
  db: pg.Client | pg.Pool,
  workspaceId: string,
  reviewId: string,
  opts: { date?: Date; exhibitDir?: string } = {},
): Promise<ExportedReview> {
  const data = await getReview(db, workspaceId, reviewId)
  if (!data) throw new Error('review not found')
  const { review, findings, categories } = data
  const bank = loadBank(review.bank_version)

  const accepted = findings.filter((f) => f.state === 'accepted' || f.state === 'edited')
  const textOf = (f: (typeof findings)[number]) => (f.edited_text ?? f.rendered_text) as string

  /* A paragraph with an unfilled variable would reach the practice reading
     "such as {{public_email}}". Refuse the export and name them. */
  const unfilled = accepted.filter((f) => /\{\{/.test(textOf(f)))
  if (unfilled.length > 0) {
    throw new Error(
      `${unfilled.length} accepted finding${unfilled.length === 1 ? ' has' : 's have'} an unfilled variable: ` +
      unfilled.map((f) => f.snippet_id).join(', '),
    )
  }

  const scores: Record<string, number | null> = review.category_scores ?? {}
  const categoryComments: Record<string, string> = review.category_comments ?? {}
  const when = opts.date ?? new Date()
  /* dd/mm/yyyy, zero-padded — all 17 reference reports date this way (11 with a
     four-digit year, 6 with two). "5 August 2026" is correct Australian English
     and is not what any of them writes. `2-digit` rather than `numeric` so the
     column of dates in a folder of reports lines up. */
  const dateText = new Intl.DateTimeFormat('en-AU', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Australia/Melbourne',
  }).format(when)

  /* ── header block ──
     The template styles these three as Heading1 / Heading3 / Heading3 with no
     direct run overrides, so they inherit Calibri bold in the heading blues and
     carry outline levels into Word's navigation pane. Matched here rather than
     drawn as loose bold runs. */
  const titleLine = (text: string, level: 1 | 3) =>
    new Paragraph({
      heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_3,
      spacing: { after: 60 },
      children: [new TextRun({
        text, font: HEAD_FONT, bold: true,
        size: level === 1 ? SZ.h1 : SZ.body,
        color: level === 1 ? H1_BLUE : H2_BLUE,
      })],
    })

  const children: Paragraph[] = [
    titleLine(`Review of ${review.domain}:`, 1),
    titleLine(`Date: ${dateText}`, 3),
    titleLine(`Attention: ${review.contact_name ?? review.practice_name ?? review.domain}`, 3),
  ]

  /* ── summary table ──
     Data rows band D3DFEE / none the way the template's tblLook turns on
     horizontal banding, and the first column is bold in every row (its
     `firstCol` conditional format). The Overall row is a data row like the
     rest — the template gives it no fill of its own. */
  const dataRow = (label: string, score: TextRun[], comment: string, index: number) =>
    new TableRow({
      children: [
        cell([tableCellText(label, { bold: true })],
          { width: COL.category, fill: index % 2 === 0 ? BAND_FILL : undefined }),
        cell([new Paragraph({ spacing: { after: 0 }, children: score })],
          { width: COL.score, fill: index % 2 === 0 ? BAND_FILL : undefined }),
        cell([tableCellText(comment)],
          { width: COL.comments, fill: index % 2 === 0 ? BAND_FILL : undefined }),
      ],
    })

  const headerCell = (text: string, width: number) =>
    cell([tableCellText(text, { bold: true, color: HEADER_INK })], { width, fill: HEADER_FILL })

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell('Category', COL.category),
        headerCell('Score', COL.score),
        headerCell('Comments', COL.comments),
      ],
    }),
    /* The Comments column is a verdict, not a contents list. Every real report
       writes a short line per category — "Great performance and diversified
       email/server", "Abandoned social media" — and where nothing was assessed
       it prints "N/A": 13 of the 17 do, and not one of their 153 Comments cells
       is left empty.

       The dimension list ("UVP, Content, Personal, Frequency, AHPRA…") is what
       the *blank* template carries as a prompt to the writer. It used to be the
       fallback here, which meant a review the summariser had not covered went
       out with the question printed where the answer belongs. N/A is the honest
       fallback: nothing was assessed, so there is nothing to report. */
    ...categories.map((cat, i) =>
      dataRow(cat.label, stars(scores[cat.key] ?? null),
        categoryComments[cat.key] ?? 'N/A', i)),
    dataRow('Overall Score', stars(review.overall_score ?? null),
      review.overall_comment ?? '', categories.length),
  ]

  const rule = { style: BorderStyle.SINGLE, size: 8, color: TABLE_RULE }
  const hairline = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const summary = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: rule, bottom: rule, left: rule, right: rule,
      insideHorizontal: rule, insideVertical: hairline,
    },
    rows,
  })

  // ── recommendations ──
  const recommendations: Paragraph[] = []
  /* The template opens Recommendations with a paragraph and closes with the
     optimistic one. The opening is the model's tailored summary where it wrote
     one, and the bank's house copy otherwise — without this fallback an
     accepted `summary.opening` was silently dropped from the document. */
  const opening = accepted.find((f) => f.snippet_id === 'summary.opening')
  if (review.summary_text) recommendations.push(body(review.summary_text))
  else if (opening) recommendations.push(body(textOf(opening)))
  const closer = accepted.find((f) => f.snippet_id === 'summary.closer.optimistic')
  if (closer) recommendations.push(body(textOf(closer)))

  /* Exhibits print beside the finding they evidence, which is how the template
     reads — a GTmetrix report sits under the load-time paragraph, a screenshot
     under the one about photos — not gathered into a gallery at the back. */
  const exhibitDir = opts.exhibitDir ?? defaultExhibitDir()
  const allExhibits = (data.exhibits ?? []) as ExhibitRow[]
  const byFinding = new Map<string, ExhibitRow[]>()
  for (const ex of allExhibits) {
    if (!ex.finding_id) continue
    const list = byFinding.get(ex.finding_id) ?? []
    list.push(ex)
    byFinding.set(ex.finding_id, list)
  }

  /* Some snippets are scaffolding for a block this file assembles rather than
     paragraphs in their own right: `comp.intro` is the sentence the competitor
     block opens with, `comp.row` is the shape of a competitor line. Printing
     them as ordinary findings gave the Competition section two headings and its
     intro twice over. The bank marks them; this honours the mark. */
  const isAssembled = (snippetId: string) => {
    const s = bank.byId.get(snippetId)
    return s?.structural === true || s?.row_template !== undefined
  }

  const competitors = data.competitors
  /* The competitor lines are assembled from the bank's own comp.row template
     (1.12), not from an ad-hoc join here, so the wording and the order of the
     fragments stay the template's — "#1 in Google search, not secure, online
     booking, open 6 days" — rather than this file's. */
  const competitorBlock = (): Paragraph[] => {
    if (competitors.length === 0) return []
    const out: Paragraph[] = []
    const intro = bank.byId.get('comp.intro')
    if (intro) out.push(body(intro.text))
    const row = bank.byId.get('comp.row')
    for (const comp of competitors) out.push(bullet(renderCompetitorRow(row ?? {}, comp)))
    return out
  }

  /* ── one section per category, in the template's order ──
     All eight print, every time. The summary table above lists all eight rows,
     and a document whose table promises a section its body never delivers is
     the one that stops looking like the template. */
  const empty: typeof categories = []
  const sections: Paragraph[] = []
  for (const cat of categories) {
    sections.push(heading(`${cat.label}:`, 2))

    const mine = accepted.filter((f) => f.category === cat.key && !isAssembled(f.snippet_id))
    /* Issues before strengths inside a category: the practice is paying
       attention to what is wrong, and the template reads that way too. */
    const ordered = [
      ...mine.filter((f) => f.variant === 'negative'),
      ...mine.filter((f) => f.variant === 'neutral'),
      ...mine.filter((f) => f.variant === 'positive'),
    ]
    /* Competition opens with its assembled intro and competitor lines, then the
       reviewer's verdict paragraph — the order the template reads in. */
    const assembled = cat.key === 'competition' ? competitorBlock() : []
    sections.push(...assembled)
    for (const f of ordered) {
      sections.push(bullet(textOf(f), bank.byId.get(f.snippet_id as string)?.severity))
      for (const ex of byFinding.get(f.id as string) ?? []) sections.push(...exhibit(ex, exhibitDir))
    }
    /* A section with nothing in it used to print "Not assessed in this
       review." — see the draft notice at the top of the document for why it
       no longer does. The heading stays: all eight are in every reference
       report, and a missing heading reads as a report that never considered
       the category, which is a different and worse claim. */
    if (ordered.length === 0 && assembled.length === 0) empty.push(cat)
  }

  /* An exhibit nobody attached to a finding still earned its place — the
     homepage capture is collected for every review. It goes at the back, under
     no heading of its own: the template has no Evidence section, and guessing
     it into a category it may not belong to would be worse than a bare plate. */
  const loose = allExhibits.filter((ex) => !ex.finding_id)
  const appendix: Paragraph[] = loose.flatMap((ex) => exhibit(ex, exhibitDir))

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: BODY_FONT, size: SZ.body } },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE.width, height: PAGE.height },
          margin: {
            top: PAGE.top, bottom: PAGE.bottom, left: PAGE.left, right: PAGE.right,
            header: PAGE.headerDist, footer: PAGE.footerDist,
          },
        },
      },
      headers: { default: letterhead() },
      footers: { default: pageFooter() },
      children: [
        ...draftNotice(empty),
        ...children,
        new Paragraph({ text: '', spacing: { after: 120 } }),
        heading('Summary:', 2),
        summary,
        new Paragraph({ text: '', spacing: { after: 120 } }),
        ...(recommendations.length ? [heading('Recommendations:', 2), ...recommendations] : []),
        ...legend(),
        ...sections,
        ...appendix,
      ],
    }],
  })

  const slug = (review.practice_name ?? review.domain)
    .replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  return {
    filename: `Online Presence Review - ${slug}.docx`,
    buffer: await Packer.toBuffer(doc),
  }
}
