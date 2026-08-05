import { readFileSync } from 'node:fs'
import JSZip from 'jszip'

/* Reading a .docx back out, so the report this platform writes can be compared
   against the seventeen a human wrote.

   Everything before this point has been checked by asking "did the code do what
   I told it to". That cannot answer the only question that matters — whether the
   document reads like one of Wally's. For that the two documents have to be
   turned into the same shape and put side by side, which means parsing OOXML.

   This is deliberately not a general OOXML parser. It reads the handful of
   things a reviewer would actually look at: the run of text, what is a heading,
   what colour a paragraph is, the tables, the header and footer, and how many
   images there are. */

export interface DocxRun {
  text: string
  /** Hex without the hash, uppercased — 'FF0000'. Null where the run is default ink. */
  color: string | null
  bold: boolean
}

export interface DocxParagraph {
  text: string
  /** The w:pStyle value: 'Heading1', 'Heading3', 'ListParagraph', … */
  style: string | null
  runs: DocxRun[]
  /** True where every non-blank run carries the same non-default colour. */
  uniformColor: string | null
  /** A numbered/bulleted list item. */
  listed: boolean
  /* The colour on the paragraph-mark run properties (`w:pPr/w:rPr/w:color`).
     In a list this is what Word paints the BULLET with, leaving the text
     black — which is how Oh Dental, the one reference report that colours its
     findings at all, carries severity. */
  bulletColor: string | null
}

export interface DocxTable {
  /** Row-major cell text. */
  rows: string[][]
}

export interface DocxDoc {
  /** Body paragraphs and tables in document order. */
  blocks: Array<{ kind: 'p'; p: DocxParagraph } | { kind: 'table'; table: DocxTable }>
  paragraphs: DocxParagraph[]
  tables: DocxTable[]
  headerText: string
  footerText: string
  /** Names of image parts under word/media/. */
  media: string[]
  /* Images the BODY references, which is what an exhibit is. A letterhead is
     an image too, so a raw part count says a report with no evidence in it has
     one piece of evidence in it. */
  bodyImages: number
  /** Does the footer carry a PAGE field? */
  footerHasPageNumber: boolean
  /** The reference letterhead is an image with no text runs at all. */
  headerHasImage: boolean
}

/** Decode the five XML entities Word actually emits. */
function unescape(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** All the w:t inside a fragment, with tabs and breaks flattened to spaces. */
function runsIn(xml: string): DocxRun[] {
  const out: DocxRun[] = []
  for (const m of xml.matchAll(/<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g)) {
    const body = m[1]
    const text = [...body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((t) => unescape(t[1])).join('')
      + (/<w:tab\b/.test(body) ? ' ' : '')
    if (!text) continue
    const color = body.match(/<w:color\s[^>]*w:val="([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase() ?? null
    out.push({
      text,
      /* Word writes 'auto' for default ink; treat it as absent. */
      color: color === '000000' ? null : color,
      bold: /<w:b\/>|<w:b\s[^>]*w:val="(?:1|true)"/.test(body),
    })
  }
  return out
}

function parseParagraph(xml: string): DocxParagraph {
  /* Everything inside w:pPr describes the paragraph, not its content — read it
     first and then take the runs from what is left, or the paragraph mark's own
     rPr would be counted as a run of text. */
  const pPr = xml.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/)?.[1] ?? ''
  const rest = pPr ? xml.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, '') : xml
  const runs = runsIn(rest)
  const text = runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim()
  const coloured = runs.filter((r) => r.text.trim())
  const first = coloured[0]?.color ?? null
  const mark = pPr.match(/<w:rPr>[\s\S]*?<w:color\s[^>]*w:val="([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase() ?? null
  return {
    text,
    style: pPr.match(/<w:pStyle\s[^>]*w:val="([^"]+)"/)?.[1] ?? null,
    runs,
    uniformColor: first && coloured.every((r) => r.color === first) ? first : null,
    listed: /<w:numPr>/.test(pPr),
    bulletColor: mark === '000000' ? null : mark,
  }
}

function parseTable(xml: string): DocxTable {
  const rows: string[][] = []
  for (const tr of xml.matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)) {
    const cells: string[] = []
    for (const tc of tr[1].matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)) {
      cells.push([...tc[1].matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)]
        .map((p) => parseParagraph(p[1]).text).filter(Boolean).join(' ').trim())
    }
    if (cells.length) rows.push(cells)
  }
  return { rows }
}

/**
 * Read a .docx into paragraphs, tables and chrome.
 *
 * Nested tables are read as part of their containing cell rather than as
 * separate tables — the regex is non-greedy per row and Word does not nest
 * tables in either the template or the seventeen references, so the simple
 * scan is honest here. If that ever changes the block list will show it as a
 * cell with a wall of text in it, not as silently missing content.
 */
export async function readDocx(fileOrBuffer: string | Buffer): Promise<DocxDoc> {
  const buf = typeof fileOrBuffer === 'string' ? readFileSync(fileOrBuffer) : fileOrBuffer
  const zip = await JSZip.loadAsync(buf)
  const read = async (name: string) => {
    const f = zip.file(name)
    return f ? await f.async('string') : ''
  }
  const doc = await read('word/document.xml')
  const body = doc.match(/<w:body>([\s\S]*)<\/w:body>/)?.[1] ?? doc

  /* One pass in document order: a section's position relative to a table is
     the whole point, so paragraphs and tables cannot be collected separately. */
  const blocks: DocxDoc['blocks'] = []
  const topLevel = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g
  for (const m of body.matchAll(topLevel)) {
    if (m[0].startsWith('<w:tbl')) blocks.push({ kind: 'table', table: parseTable(m[0]) })
    else blocks.push({ kind: 'p', p: parseParagraph(m[0]) })
  }

  const headerNames = Object.keys(zip.files).filter((n) => /^word\/header\d*\.xml$/.test(n))
  const footerNames = Object.keys(zip.files).filter((n) => /^word\/footer\d*\.xml$/.test(n))
  const chrome = async (names: string[]) => {
    const parts = await Promise.all(names.map(read))
    return { xml: parts.join('\n'), text: parts.map((x) => runsIn(x).map((r) => r.text).join('')).join(' ').replace(/\s+/g, ' ').trim() }
  }
  const header = await chrome(headerNames)
  const footer = await chrome(footerNames)

  const bodyRels = await read('word/_rels/document.xml.rels')
  const bodyImages = [...bodyRels.matchAll(/Target="([^"]*media\/[^"]+)"/g)].length

  return {
    blocks,
    paragraphs: blocks.flatMap((b) => (b.kind === 'p' ? [b.p] : [])),
    tables: blocks.flatMap((b) => (b.kind === 'table' ? [b.table] : [])),
    headerText: header.text,
    footerText: footer.text,
    /* `word/media/` is itself an entry in the archive. Counting the folder as
       an image makes a document with no exhibits look like it has one. */
    media: Object.keys(zip.files)
      .filter((n) => n.startsWith('word/media/') && !zip.files[n].dir),
    bodyImages,
    /* `<w:instrText>PAGE</w:instrText>` has no space around the word, so a
       \s-anchored match misses the field entirely and reports a footer with
       page numbers as one without. */
    footerHasPageNumber: /\bPAGE\b/.test(footer.xml),
    headerHasImage: /<(?:w:drawing|w:pict|v:imagedata)\b/.test(header.xml),
  }
}
