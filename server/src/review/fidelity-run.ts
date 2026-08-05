import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { receiveIntake } from './intake.ts'
import { collectReview, setScores } from './store.ts'
import { summariseReview } from './summarise.ts'
import { exportReviewDocx } from './docx.ts'
import { readDocx } from './docx-read.ts'
import { compareToReference, coverageReport, profileReferences, score, type Gap } from './fidelity.ts'
import { MockModelClient } from '../skills/model.ts'
import { mockReviewSummary } from '../inbox/mockResponders.ts'
import { WORKSPACE_ID } from '../db/seed.ts'

/* The harness: audit a real practice unattended, export the document, and put
   it beside the report a human wrote about the same practice.

   Default target is Oh Dental, because `Oh Dental Online Presence Review.docx`
   is the canonical reference and comparing two reports about the *same*
   practice removes the obvious objection — that any difference is just a
   different site rather than a different writer.

   Run: npm run review:fidelity [-- --domain x.com.au --ref "Name.docx" --live]
   Writes docs/FIDELITY-LEDGER.md. */

const REF_DIR = process.env.FIDELITY_REF_DIR ?? 'C:/Users/61406/Downloads/presence'
const ROOT = path.resolve(import.meta.dirname, '../../..')

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

async function main() {
  const domain = arg('domain', 'ohdental.com.au')
  const refFile = arg('ref', 'Oh Dental Online Presence Review.docx')
  const practice = arg('practice', 'Oh Dental')
  const live = process.argv.includes('--live')

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required (npm run db:dev first)')
  const db = new pg.Client({ connectionString: url })
  await db.connect()

  try {
    console.log(`profiling references in ${REF_DIR} …`)
    const ref = await profileReferences(REF_DIR)
    console.log(`  ${ref.total} reports · sections: ${ref.sectionOrder.join(', ')}`)
    console.log(`  coloured findings ${ref.bulletInkCount}/${ref.total} · legend ${ref.legendCount}/${ref.total}`
      + ` · five-glyph stars ${ref.fiveGlyphStarCount}/${ref.total} · written comments ${ref.proseCommentsCount}/${ref.total}`
      + ` · exhibits ${ref.mediaCounts.filter((n) => n > 0).length}/${ref.total}`)

    console.log(`\nauditing ${domain} unattended …`)
    const { reviewId } = await receiveIntake(db, {
      workspaceId: WORKSPACE_ID, source: 'fidelity-harness',
      externalId: `fidelity:${domain}:${Date.now()}`,
      payload: { practice, website: domain, name: 'Fidelity Harness', email: 'noreply@2080solutions.com.au' },
      notify: false,
    })
    const collected = await collectReview(db, WORKSPACE_ID, reviewId, {})
    console.log(`  signals ${collected.signals ?? '?'} · findings ${collected.findings ?? '?'}`)

    /* Scores are a human judgement the platform does not make yet; without
       them every star cell is empty and the table checks measure nothing.
       Middling scores across the board, so the harness is testing the shape of
       the table rather than flattering the site. */
    const bank = (await import('./bank.ts')).loadBank()
    await setScores(db, WORKSPACE_ID, reviewId,
      Object.fromEntries(bank.categories.map((c) => [c.key, 3])), 3, 'fidelity-harness')

    if (live) {
      const { AnthropicModelClient } = await import('../skills/model.ts')
      await summariseReview(db, new AnthropicModelClient(), WORKSPACE_ID, reviewId)
    } else {
      await summariseReview(db, new MockModelClient((req) =>
        mockReviewSummary(req.input as Parameters<typeof mockReviewSummary>[0])), WORKSPACE_ID, reviewId)
    }

    const out = await exportReviewDocx(db, WORKSPACE_ID, reviewId)
    const outDir = path.join(ROOT, 'docs', 'fidelity')
    mkdirSync(outDir, { recursive: true })
    const outPath = path.join(outDir, `generated-${domain}.docx`)
    writeFileSync(outPath, out.buffer)
    console.log(`  wrote ${outPath}`)

    const gen = await readDocx(out.buffer)
    const gaps = compareToReference(gen, ref)
    const coverage = coverageReport(ref)

    writeFileSync(path.join(ROOT, 'docs', 'FIDELITY-LEDGER.md'),
      ledger({ domain, refFile, ref, gen, gaps, coverage }))
    console.log(`\nscore ${score(gaps)} · ${gaps.length} gaps`
      + ` · bank covers ${coverage.covered}/${coverage.recurring} recurring paragraphs`)
    for (const g of gaps) console.log(`  [${g.severity}] ${g.title} — ${g.observed}`)
  } finally {
    await db.end()
  }
}

function ledger(a: {
  domain: string; refFile: string
  ref: Awaited<ReturnType<typeof profileReferences>>
  gen: Awaited<ReturnType<typeof readDocx>>
  gaps: Gap[]; coverage: ReturnType<typeof coverageReport>
}): string {
  const open = a.gaps.filter((g) => g.status !== 'wontfix')
  const rank = { critical: 0, major: 1, minor: 2 }
  const sorted = [...open].sort((x, y) => rank[x.severity] - rank[y.severity])
  const L: string[] = []

  L.push('# FIDELITY-LEDGER.md — how far the generated report is from a real one')
  L.push('')
  L.push('Generated by `npm run review:fidelity`. Do not hand-edit the tables — edit the checks in')
  L.push('`server/src/review/fidelity.ts` and re-run, so every line here stays something that was measured.')
  L.push('')
  L.push(`**Score ${score(a.gaps)}** — weighted open gaps (critical 10 · major 4 · minor 1). Zero means`)
  L.push('indistinguishable on everything this harness knows how to check, which is not the same as')
  L.push('indistinguishable. The human pass is what catches the rest.')
  L.push('')
  L.push(`- Generated: \`${a.domain}\`, unattended · ${a.gen.paragraphs.length} paragraphs · ${a.gen.tables.length} table(s) · ${a.gen.bodyImages} exhibit(s)`)
  L.push(`- Reference set: ${a.ref.total} reports in \`Downloads/presence\` · canonical \`${a.refFile}\``)
  L.push('')
  L.push('Structure only. What a *read* catches — a section that admits it has nothing to say, a')
  L.push('paragraph that contradicts itself — is in `FIDELITY-OBSERVATIONS.md`, which is written by')
  L.push('hand and not overwritten by this run.')
  L.push('')
  L.push('## Open gaps')
  L.push('')
  if (sorted.length === 0) L.push('_None. Every structural check passes._')
  else {
    L.push('| # | Severity | Gap | Generated | References | Status |')
    L.push('|---|---|---|---|---|---|')
    sorted.forEach((g, i) => L.push(
      `| ${i + 1} | ${g.severity} | ${g.title} | ${g.observed} | ${g.expected} | ${g.status}${g.blocker ? ` — ${g.blocker}` : ''} |`))
  }
  L.push('')
  L.push('## Uncovered recurring paragraphs')
  L.push('')
  L.push('Paragraphs that appear in three or more reference reports with no equivalent in the snippet bank.')
  L.push('Below three is one client\'s bespoke prose, not house copy, and mining it would overfit.')
  L.push('')
  const c = a.coverage
  L.push(`${c.paragraphs} body paragraphs across the reference set reduce to **${c.clusters} distinct** ones.`)
  L.push(`**${c.recurring}** of those recur in three or more reports — that is the house copy — and the bank`)
  L.push(`already says **${c.covered}** of them. The other ${c.bespoke} clusters appear in exactly one report:`)
  L.push('prose written for one practice, correctly absent from a bank of house paragraphs.')
  L.push('')
  if (c.misses.length === 0) L.push('_No recurring paragraph is missing from the bank._')
  else {
    L.push('| Reports | Paragraph |')
    L.push('|---|---|')
    for (const m of c.misses.slice(0, 40)) {
      L.push(`| ${m.reports} | ${m.text.replace(/\|/g, '\\|').slice(0, 260)} |`)
    }
    if (c.misses.length > 40) L.push(`| … | ${c.misses.length - 40} more |`)
  }
  L.push('')
  L.push('## What the references do')
  L.push('')
  L.push(`- Sections, in order: ${a.ref.sectionOrder.join(' → ')}`)
  L.push(`- Findings carrying a severity colour at all: ${a.ref.bulletInkCount}/${a.ref.total}`)
  L.push(`- Five star glyphs always, unearned ones tinted: ${a.ref.fiveGlyphStarCount}/${a.ref.total}`)
  L.push(`- Comments column written rather than the dimension list: ${a.ref.proseCommentsCount}/${a.ref.total}`)
  L.push(`- Image-only letterhead in the header: ${a.ref.imageHeaderCount}/${a.ref.total}`)
  L.push(`- Page number in the footer: ${a.ref.pageNumberCount}/${a.ref.total}`)
  L.push(`- Screenshots in the body: ${a.ref.mediaCounts.filter((n) => n > 0).length}/${a.ref.total}`)
  L.push('')
  L.push('### Deliberate divergences')
  L.push('')
  L.push(`Coloured findings and the colour legend appear in **${a.ref.legendCount} of ${a.ref.total}** reference`)
  L.push('reports — Oh Dental alone. They are in the product because they were asked for by name, not because')
  L.push('they are house style, and they are not scored as gaps. Where Oh Dental puts the ink (on the list')
  L.push('bullet, text left black) is worth matching; that one **is** scored.')
  L.push('')
  return L.join('\n') + '\n'
}

main().catch((err) => { console.error(err); process.exitCode = 1 })
