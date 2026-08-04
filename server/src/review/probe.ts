import { collectFetchLayer } from './collect.ts'
import { collectRenderLayer } from './render.ts'
import { selectFindings, signalsToMap, suggestOverall, suggestScores, varsFromSignals } from './engine.ts'

/* Dev probe: run the whole review pipeline against a live domain and print what
   it found. `npm run review:probe -- heartsdental.com.au`. Useful for checking a
   collector change against real markup before it reaches a client report. */

const domain = process.argv[2]
if (!domain) {
  console.error('usage: npm run review:probe -- <domain>')
  process.exit(1)
}

const r = await collectFetchLayer(domain, { maxPages: 10 })
const rend = await collectRenderLayer(r.finalUrl, {
  interiorUrl: r.pages.find((p) => p.url !== r.finalUrl)?.url,
})
const all = [...r.signals, ...rend.signals]

console.log(`\n${r.finalUrl} — ${all.length} signals (${r.signals.length} fetch · ${rend.signals.length} render) · ${r.pages.length} pages fetched · ${r.sitemap.length} in sitemap`)
const errs = [...r.errors, ...rend.errors]
if (errs.length) console.log(`errors: ${errs.join('; ')}`)

console.log('\nSIGNALS')
for (const s of all) {
  console.log(`  ${s.key.padEnd(34)} ${String(s.value).slice(0, 40).padEnd(42)} ${s.provenance}`)
}

if (rend.exhibits.length) {
  console.log('\nEXHIBITS')
  for (const e of rend.exhibits) {
    console.log(`  ${e.kind.padEnd(20)} ${e.path.padEnd(28)} ${e.width}×${e.height}  ${e.label}`)
  }
}

const signals = signalsToMap(all)
const found = selectFindings(signals, { vars: varsFromSignals(signals, r.target) })
console.log(`\nFINDINGS (${found.length})`)
for (const c of found) {
  console.log(`  ${c.snippet.variant.padEnd(8)} ${c.snippet.id.padEnd(30)} <- ${c.triggeredBy.join(', ') || '(unconditional)'}`)
  if (c.missingVars.length) console.log(`  ${''.padEnd(8)} needs: ${c.missingVars.join(', ')}`)
}

const scores = suggestScores(found)
console.log('\nSUGGESTED SCORES')
for (const s of scores) {
  const stars = s.suggested === null ? '  —  ' : '*'.repeat(s.suggested).padEnd(5)
  console.log(`  ${s.label.padEnd(22)} ${stars} ${s.note}`)
}
const overall = suggestOverall(scores)
console.log(`  ${'OVERALL'.padEnd(22)} ${overall === null ? '  —  ' : '*'.repeat(overall)}`)
