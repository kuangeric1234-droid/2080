import { collectFetchLayer } from './collect.ts'
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
console.log(`\n${r.finalUrl} — ${r.signals.length} signals · ${r.pages.length} pages fetched · ${r.sitemap.length} in sitemap`)
if (r.errors.length) console.log(`errors: ${r.errors.join('; ')}`)

console.log('\nSIGNALS')
for (const s of r.signals) {
  console.log(`  ${s.key.padEnd(34)} ${String(s.value).slice(0, 40).padEnd(42)} ${s.provenance}`)
}

const signals = signalsToMap(r.signals)
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
