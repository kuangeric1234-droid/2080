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
import { loadBank } from './bank.ts'

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
const RULE = 'D9D9D9'
const HEADER_FILL = 'EAF0F7'

/** Half-points, matching the template's w:sz values. */
const SZ = { body: 22, small: 20, h1: 32, h2: 26, title: 40 }

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

function bullet(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 120, line: 276 },
    children: [new TextRun({ text, font: BODY_FONT, size: SZ.body })],
  })
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
function stars(score: number | null): string {
  return score === null ? '—' : '*'.repeat(score)
}

function cell(children: Paragraph[], opts: { width?: number; fill?: string } = {}) {
  return new TableCell({
    children,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
  })
}

function tableCellText(text: string, opts: { bold?: boolean; size?: number } = {}) {
  return new Paragraph({
    spacing: { after: 0 },
    children: [new TextRun({
      text, font: BODY_FONT, bold: opts.bold, size: opts.size ?? SZ.small,
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
  const when = opts.date ?? new Date()
  const dateText = new Intl.DateTimeFormat('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Melbourne',
  }).format(when)

  // ── header block ──
  const children: Paragraph[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({
        text: `Review of ${review.domain}:`, font: HEAD_FONT, bold: true, size: SZ.title, color: H1_BLUE,
      })],
    }),
    body(`Date: ${dateText}`),
    body(`Attention: ${review.contact_name ?? review.practice_name ?? review.domain}`),
  ]

  // ── summary table ──
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        cell([tableCellText('Category', { bold: true })], { width: 26, fill: HEADER_FILL }),
        cell([tableCellText('Score', { bold: true })], { width: 14, fill: HEADER_FILL }),
        cell([tableCellText('Comments', { bold: true })], { width: 60, fill: HEADER_FILL }),
      ],
    }),
    ...categories.map((cat) =>
      new TableRow({
        children: [
          cell([tableCellText(cat.label)], { width: 26 }),
          cell([tableCellText(stars(scores[cat.key] ?? null), { bold: true })], { width: 14 }),
          cell([tableCellText(cat.dimensions.join(', '))], { width: 60 }),
        ],
      }),
    ),
    new TableRow({
      children: [
        cell([tableCellText('Overall Score', { bold: true })], { width: 26, fill: HEADER_FILL }),
        cell([tableCellText(stars(review.overall_score ?? null), { bold: true })], { width: 14, fill: HEADER_FILL }),
        cell([tableCellText(review.overall_comment ?? '')], { width: 60, fill: HEADER_FILL }),
      ],
    }),
  ]

  const border = { style: BorderStyle.SINGLE, size: 4, color: RULE }
  const summary = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
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

  // ── one section per category, in the template's order ──
  const sections: Paragraph[] = []
  for (const cat of categories) {
    const mine = accepted.filter((f) => f.category === cat.key)
    if (mine.length === 0) continue
    sections.push(heading(`${cat.label}:`, 2))
    /* Issues before strengths inside a category: the practice is paying
       attention to what is wrong, and the template reads that way too. */
    const ordered = [
      ...mine.filter((f) => f.variant === 'negative'),
      ...mine.filter((f) => f.variant === 'neutral'),
      ...mine.filter((f) => f.variant === 'positive'),
    ]
    for (const f of ordered) {
      sections.push(bullet(textOf(f)))
      for (const ex of byFinding.get(f.id as string) ?? []) sections.push(...exhibit(ex, exhibitDir))
    }
  }

  /* An exhibit nobody attached to a finding still earned its place — the
     homepage capture is collected for every review. It goes at the back rather
     than being dropped or guessed into a section it may not belong to. */
  const loose = allExhibits.filter((ex) => !ex.finding_id)
  const appendix: Paragraph[] = []
  if (loose.length > 0) {
    appendix.push(heading('Evidence:', 2))
    for (const ex of loose) appendix.push(...exhibit(ex, exhibitDir))
  }

  const competitors = data.competitors
  const competitorBlock: Paragraph[] = []
  if (competitors.length > 0) {
    const intro = bank.byId.get('comp.intro')
    competitorBlock.push(heading('Competition:', 2))
    if (intro) competitorBlock.push(body(intro.text))
    /* The line is assembled from the bank's own comp.row template (1.12), not
       from an ad-hoc join here, so the wording and the order of the fragments
       stay the template's — "#1 in Google search, not secure, online booking,
       open 6 days" — rather than this file's. */
    const row = bank.byId.get('comp.row')
    for (const comp of competitors) {
      competitorBlock.push(bullet(renderCompetitorRow(row ?? {}, comp)))
    }
  }

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
        ...children,
        new Paragraph({ text: '', spacing: { after: 120 } }),
        heading('Summary:', 2),
        summary,
        new Paragraph({ text: '', spacing: { after: 120 } }),
        ...(recommendations.length ? [heading('Recommendations:', 2), ...recommendations] : []),
        ...sections,
        ...competitorBlock,
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
