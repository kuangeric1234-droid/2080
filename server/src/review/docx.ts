import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx'
import type pg from 'pg'
import { getReview } from './store.ts'
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

export interface ExportedReview {
  filename: string
  buffer: Buffer
}

/** Build the .docx for one review from its accepted findings. */
export async function exportReviewDocx(
  db: pg.Client | pg.Pool,
  workspaceId: string,
  reviewId: string,
  opts: { date?: Date } = {},
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
  if (review.summary_text) recommendations.push(body(review.summary_text))
  const closer = accepted.find((f) => f.snippet_id === 'summary.closer.optimistic')
  if (closer) recommendations.push(body(textOf(closer)))

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
    for (const f of ordered) sections.push(bullet(textOf(f)))
  }

  const competitors = data.competitors
  const competitorBlock: Paragraph[] = []
  if (competitors.length > 0) {
    const intro = bank.byId.get('comp.intro')
    competitorBlock.push(heading('Competition:', 2))
    if (intro) competitorBlock.push(body(intro.text))
    for (const comp of competitors) {
      const facts = Object.values((comp.facts ?? {}) as Record<string, string>).filter(Boolean)
      competitorBlock.push(bullet(
        `${comp.name}${facts.length ? ` - ${facts.join(', ')}` : ''}` +
        (comp.threat != null ? ` - Threat: ${comp.threat}/10.` : ''),
      ))
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: BODY_FONT, size: SZ.body } },
      },
    },
    sections: [{
      properties: {},
      children: [
        ...children,
        new Paragraph({ text: '', spacing: { after: 120 } }),
        heading('Summary:', 2),
        summary,
        new Paragraph({ text: '', spacing: { after: 120 } }),
        ...(recommendations.length ? [heading('Recommendations:', 2), ...recommendations] : []),
        ...sections,
        ...competitorBlock,
        new Paragraph({
          spacing: { before: 480 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({
            text: `Prepared by 20-80 Solutions · ${dateText}`,
            font: BODY_FONT, size: SZ.small, color: '8A9CA3',
          })],
        }),
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
