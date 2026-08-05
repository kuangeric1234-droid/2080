import { describe, expect, it } from 'vitest'
import { Document, Footer, ImageRun, Packer, PageNumber, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import { readDocx, type DocxDoc } from '../src/review/docx-read.ts'
import { compareToReference, normalise, score, summaryTable, type Gap, type ReferenceProfile } from '../src/review/fidelity.ts'
import { loadBank } from '../src/review/bank.ts'

/* §13.2 step 1.19. The harness measures the generated report against the
   seventeen real ones, so a wrong reading here does not fail loudly — it
   quietly reports a gap that is not there, or misses one that is. Both were
   caught by hand during the build:

     · severity ink read as absent, because the colour sits on the paragraph
       mark (`w:pPr/w:rPr`), which paints the list bullet, not on the runs
     · the footer's page number read as absent, because `<w:instrText>PAGE`
       has no whitespace around the word

   Those two are pinned below. The reference documents themselves live outside
   the repo on one machine, so nothing here reads them — the reader is checked
   by round-tripping documents this suite builds. */

async function build(children: (Paragraph | Table)[], opts: { footerPage?: boolean } = {}) {
  const doc = new Document({
    sections: [{
      children,
      footers: opts.footerPage
        ? { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ children: ['Page ', PageNumber.CURRENT] })] })] }) }
        : undefined,
    }],
  })
  return await readDocx(await Packer.toBuffer(doc))
}

/* A 1x1 PNG, so a document can carry an exhibit without a fixture file. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64')

function cell(text: string) {
  return new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, children: [new Paragraph(text)] })
}

/** A reference profile the checks can be driven against, without any .docx. */
function profile(over: Partial<ReferenceProfile> = {}): ReferenceProfile {
  const sections = ['Website (Business)', 'Website (Technical)', 'Website (Usability)',
    'Visibility (SEO)', 'Visibility (SEM)', 'Reputation', 'Social Media', 'Competition']
  return {
    docs: new Map(), sectionOrder: sections,
    sectionCount: new Map(sections.map((s) => [s, 17])),
    bulletInkCount: 1, fiveGlyphStarCount: 16, proseCommentsCount: 16,
    imageHeaderCount: 17, pageNumberCount: 17, legendCount: 1,
    mediaCounts: Array(17).fill(5), dateLines: Array(17).fill('Date: 31/07/2026'),
    corpus: [], total: 17, ...over,
  }
}

const find = (gaps: Gap[], id: string) => gaps.find((g) => g.id === id)

describe('reading a .docx back out', () => {
  it('reads the bullet colour off the paragraph mark, not the runs', async () => {
    const doc = await build([
      new Paragraph({
        bullet: { level: 0 },
        run: { color: 'FF9900' },                       // the bullet
        children: [new TextRun({ text: 'The website is not using the SSL/HTTPS protocol.' })],
      }),
      new Paragraph({ children: [new TextRun({ text: 'Coloured text instead.', color: '00FF00' })] }),
    ])

    const [onMark, onRun] = doc.paragraphs.filter((p) => p.text)
    expect(onMark.bulletColor, 'paragraph-mark colour missed').toBe('FF9900')
    expect(onMark.uniformColor, 'the text is black; nothing should be reported on the runs').toBeNull()
    expect(onMark.listed).toBe(true)
    expect(onRun.bulletColor).toBeNull()
    expect(onRun.uniformColor).toBe('00FF00')
  })

  it('finds a page number field with no whitespace around it', async () => {
    const withNum = await build([new Paragraph('body')], { footerPage: true })
    const without = await build([new Paragraph('body')])
    expect(withNum.footerHasPageNumber).toBe(true)
    expect(without.footerHasPageNumber).toBe(false)
  })

  it('keeps blocks in document order and reads table cells', async () => {
    const doc = await build([
      new Paragraph({ heading: 'Heading2', children: [new TextRun('Summary:')] }),
      new Table({ rows: [
        new TableRow({ children: [cell('Category'), cell('Score'), cell('Comments')] }),
        new TableRow({ children: [cell('Website (Business)'), cell('***'), cell('Needs work')] }),
      ] }),
      new Paragraph({ heading: 'Heading2', children: [new TextRun('Recommendations:')] }),
    ])
    expect(doc.blocks.map((b) => b.kind)).toEqual(['p', 'table', 'p'])
    expect(doc.paragraphs[0].style).toBe('Heading2')
    expect(summaryTable(doc)!.rows[1]).toEqual(['Website (Business)', '***', 'Needs work'])
  })
})

describe('scoring a generated report against the references', () => {
  /* The eight sections plus a table, so the structural checks have something
     to pass on and only the deliberate defect fails. */
  async function report(o: {
    stars?: string; comments?: (key: string, label: string) => string
    inkOnRuns?: boolean; date?: string; findingsPerSection?: number
  } = {}) {
    const bank = loadBank()
    const stars = o.stars ?? '*****'
    const kids: (Paragraph | Table)[] = [
      new Paragraph({ heading: 'Heading1', children: [new TextRun('Review of example.com.au:')] }),
      new Paragraph({ heading: 'Heading3', children: [new TextRun(o.date ?? 'Date: 31/07/2026')] }),
      new Paragraph({ heading: 'Heading2', children: [new TextRun('Summary:')] }),
      new Table({ rows: [
        new TableRow({ children: [cell('Category'), cell('Score'), cell('Comments')] }),
        ...bank.categories.map((c) => new TableRow({
          children: [cell(c.label), cell(stars),
            cell(o.comments ? o.comments(c.key, c.label) : 'A written verdict about this area')],
        })),
        new TableRow({ children: [cell('Overall Score'), cell(stars), cell('An overall verdict')] }),
      ] }),
    ]
    for (const c of bank.categories) {
      kids.push(new Paragraph({ heading: 'Heading2', children: [new TextRun(`${c.label}:`)] }))
      for (let i = 0; i < (o.findingsPerSection ?? 5); i++) {
        kids.push(new Paragraph({
          bullet: { level: 0 },
          run: o.inkOnRuns ? undefined : { color: 'FF9900' },
          children: [new TextRun({
            text: `A finding about ${c.label} that is long enough to count as prose, number ${i}.`,
            color: o.inkOnRuns ? 'FF9900' : undefined,
          })],
        }))
      }
    }
    kids.push(new Paragraph({ children: [new ImageRun({
      data: PIXEL, type: 'png', transformation: { width: 320, height: 180 },
    })] }))
    return await build(kids, { footerPage: true })
  }

  it('reports nothing on a report that matches', async () => {
    const gaps = compareToReference(await report(), profile({ imageHeaderCount: 0 }))
    expect(gaps.map((g) => g.id), 'a matching report should be clean').toEqual([])
    expect(score(gaps)).toBe(0)
  })

  it('catches a three-star cell where the references always print five', async () => {
    const gaps = compareToReference(await report({ stars: '***' }), profile({ imageHeaderCount: 0 }))
    expect(find(gaps, 'star-glyph-count')?.expected).toContain('16 of 17')
  })

  it('catches the dimension list standing in for a verdict', async () => {
    const bank = loadBank()
    const byKey = new Map(bank.categories.map((c) => [c.key, c.dimensions.join(', ')]))
    const gaps = compareToReference(
      await report({ comments: (key) => byKey.get(key)! }), profile({ imageHeaderCount: 0 }))
    const g = find(gaps, 'summary-comments-prose')
    expect(g, 'the template dimension list went unnoticed').toBeTruthy()
    expect(g!.severity).toBe('major')
  })

  it('catches severity painted on the text instead of the bullet', async () => {
    const gaps = compareToReference(await report({ inkOnRuns: true }), profile({ imageHeaderCount: 0 }))
    expect(find(gaps, 'severity-on-bullet')?.observed).toMatch(/coloured text/)
  })

  it('catches a missing section and a thin one', async () => {
    const full = await report()
    /* The thin check is a comparison against the references' own median, so
       it needs at least one reference document to compare with. */
    const ref = profile({ imageHeaderCount: 0, docs: new Map([['reference.docx', full]]) })
    /* Drop Competition entirely, and starve Social Media down to one line. */
    const thin: DocxDoc = { ...full, blocks: [], paragraphs: [] }
    let skipping: string | null = null
    let kept = 0
    for (const p of full.paragraphs) {
      if (p.style === 'Heading2') {
        skipping = /Competition/.test(p.text) ? 'drop' : /Social Media/.test(p.text) ? 'thin' : null
        kept = 0
        if (skipping === 'drop') continue
      } else if (skipping === 'drop') continue
      else if (skipping === 'thin' && ++kept > 1) continue
      thin.paragraphs.push(p)
    }
    const gaps = compareToReference(thin, ref)
    expect(find(gaps, 'section-missing:Competition')?.severity).toBe('critical')
    expect(find(gaps, 'thin-section:Social Media')).toBeTruthy()
    expect(find(gaps, 'thin-section:Competition'),
      'a missing section was also counted as thin').toBeUndefined()
  })

  it('does not score the legend, which only one reference report has', async () => {
    const gaps = compareToReference(await report(), profile({ imageHeaderCount: 0, legendCount: 1 }))
    expect(gaps.some((g) => /legend/i.test(g.title)), 'a 1-of-17 habit was scored as house style').toBe(false)
  })

  it('weights a critical gap above four minor ones', () => {
    const crit: Gap = { id: 'a', severity: 'critical', title: '', observed: '', expected: '', status: 'buildable' }
    const minor: Gap = { ...crit, severity: 'minor' }
    expect(score([crit])).toBeGreaterThan(score([minor, minor, minor, minor]))
    expect(score([{ ...crit, status: 'wontfix' }]), 'wontfix still counted').toBe(0)
  })
})

describe('normalising for comparison', () => {
  it('ignores case, curly quotes and unfilled variables', () => {
    expect(normalise('It’s Great — {{practice_name}} has 5 reviews'))
      .toBe(normalise("it's great has 5 reviews"))
  })
})
