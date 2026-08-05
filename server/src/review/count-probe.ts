import { profileReferences, normalise } from './fidelity.ts'

/* The 3-of-17 threshold, counted honestly for paired paragraphs.

   A plain overlap count cannot tell "The navigation bar floats down" from "The
   navigation bar should float down": the two differ by one word in forty and
   score 0.89 against each other, so counting the positive alone credits it with
   every report that carries the negative. Camberwell was doing exactly that.
   Each probe is therefore a GROUP of variants, and a matching paragraph is
   awarded to whichever variant it sits closest to — so a report votes once, for
   the half it actually says.

   Run: npx tsx src/review/count-probe.ts */

const REF_DIR = process.env.FIDELITY_REF_DIR ?? 'C:/Users/61406/Downloads/presence'

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

interface Group { name: string; variants: { id: string; text: string }[] }

const GROUPS: Group[] = [
  { name: 'nav sticky', variants: [
    { id: 'use.nav.sticky (+)',
      text: 'The navigation bar floats down as the user scrolls the website so they don’t need to keep coming back to the top of the page to move onto other pages.' },
    { id: 'use.nav.not_sticky (−, in bank)',
      text: 'The navigation bar should float down as the user scrolls the website so they don’t need to keep coming back to the top of page to move onto other pages.' },
  ] },
  { name: 'third-party links', variants: [
    { id: 'use.external_links.new_tab (+)',
      text: 'Links to 3rd party websites (eg, Facebook) opens to a new tab which is good as visitors won’t get side tracked.' },
    { id: 'use.external_links.same_tab (−, in bank)',
      text: 'Links to 3rd party websites (eg, Facebook, Twitter, footer vendor links, etc) should open to a new tab otherwise visitors will get distracted and not come back to your website to make the necessary inquiry.' },
  ] },
  { name: 'navigation legibility', variants: [
    { id: 'use.contrast.ok (+)',
      text: 'The main navigation is easy to see and click on so is good for even those who are visually/colour impaired.' },
    { id: 'use.contrast.fail (−, in bank)',
      text: 'The main navigation has a big accessibility issue for those who are visual/colour impaired as blue text on a blue background is very difficult to read.' },
  ] },
  { name: 'font size', variants: [
    { id: 'use.font.ok (+)',
      text: 'The text is of sufficient size but the font seems to change a lot within the same page.' },
    { id: 'use.font.small (−, in bank)',
      text: 'The fonts are too small at 13px. Recommend increasing it to 16px to cater for the visually impaired or elder population.' },
  ] },
  { name: 'admin login URL', variants: [
    { id: 'tech.wpadmin.changed (+)',
      text: 'Your wordpress website doesn’t use the default admin login URL https://ohdental.com.au/wp-admin/ which is great as it makes it harder for hackers.' },
    { id: 'tech.wpadmin.default (−, in bank)',
      text: 'Having the default admin login URL as ohdental.com.au/wp-admin might cause security issues. We suggest changing the URL to something else to make it harder for hackers.' },
  ] },
  { name: 'hosting and load time', variants: [
    { id: 'tech.hosting.speed_ok (+)',
      text: 'The website is hosted in Australia which is good, as it should improve website performance. A website should load within 2 seconds to reduce the chance of losing a patient. Your website only took 0.395 seconds to load which is fantastic.' },
    { id: 'tech.hosting.speed (−, in bank)',
      text: 'The website is hosted in Australia which is good, as it should improve website performance. A website should load within 2 seconds to reduce the chance of losing a patient. Your website took 4.4 seconds to load which isn’t ideal.' },
  ] },
  { name: 'adwords access', variants: [
    { id: 'sem.access.request',
      text: 'If we get access to your google adwords we can look into this in more detail to inform you of patient demographics, interests, and behaviors, thus creating more laser focus AdWords campaigns.' },
  ] },
  { name: 'educational videos', variants: [
    { id: 'social.video.opportunity',
      text: 'Consider doing some short educational videos to increase the dental IQ of your patients (as well as attract new higher quality patients via social media).' },
  ] },
  /* Read these three with Oh Dental discounted. Its Competition section
     carries **all three** verdicts at once — they contradict each other — which
     is what an untouched template block looks like, and is why the section was
     excluded from the report comparison that produced 1.32–1.38 in the first
     place. Counting it as a vote credits every verdict with a report that
     chose none of them: `leading` is 3/17 with it and 2/17 without, which is
     the difference between clearing the threshold and not (§13.2 1.38). */
  { name: 'competition verdict', variants: [
    { id: 'comp.verdict.open_field',
      text: 'The good news is that they don’t dominate the local market yet, according to their online presence, social media followers and online reputation which means your practice has a real chance at being the leader if the cards are played right with the right type of guidance.' },
    { id: 'comp.verdict.leading',
      text: 'The good news is you’re the leader of the pack currently. However, it’s important to keep the lead by improving on areas that you’re weaker in such as social media.' },
    { id: 'comp.verdict.behind',
      text: 'Your practice will be playing catch up to the strong competitors judging by their website, social media and online reputation. It’s critical that you do something about it ASAP to have a chance to remain in the competition.' },
  ] },
]

const ref = await profileReferences(REF_DIR)
console.log(`${ref.total} reference reports in ${REF_DIR}\n`)

for (const g of GROUPS) {
  const shs = g.variants.map((v) => ({ ...v, sh: shingles(v.text), files: new Set<string>() }))
  for (const { file, text } of ref.corpus) {
    if (text.length < 40) continue
    const t = shingles(text)
    let best = -1
    let score = 0.55
    shs.forEach((v, i) => { const o = overlap(v.sh, t); if (o > score) { score = o; best = i } })
    if (best >= 0) shs[best].files.add(file)
  }
  console.log(`■ ${g.name}`)
  for (const v of shs) {
    const n = v.files.size
    console.log(`  ${String(n).padStart(2)}/${ref.total}  ${(n >= 3 ? 'BUILD' : 'WONTFIX').padEnd(7)} ${v.id}`)
    for (const f of v.files) console.log(`            ${f.replace(' Online Presence Review', '').replace('.docx', '')}`)
  }
  console.log()
}
