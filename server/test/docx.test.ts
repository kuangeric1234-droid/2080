import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { freePort } from './helpers.ts'
import { migrate } from '../src/db/migrate.ts'
import { seed, WORKSPACE_ID } from '../src/db/seed.ts'
import { receiveIntake } from '../src/review/intake.ts'
import { addCompetitor, attachExhibit, collectReview, decideFinding, getReview, removeCompetitor, setScores } from '../src/review/store.ts'
import { exportReviewDocx } from '../src/review/docx.ts'
import { loadBank } from '../src/review/bank.ts'
import { summariseReview } from '../src/review/summarise.ts'
import { MockModelClient } from '../src/skills/model.ts'
import { mockReviewSummary } from '../src/inbox/mockResponders.ts'
import { NEGLECTED, fixtureFetch } from './fixtures/practice-site.ts'

let PORT: number
let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string
let reviewId: string

beforeAll(async () => {
  PORT = await freePort()
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080dx-'))
  server = new EmbeddedPostgres({
    databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PORT,
    persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'],
  })
  await server.initialise()
  await server.start()
  await server.createDatabase('app')
  db = new pg.Client({ host: '127.0.0.1', port: PORT, user: 'postgres', password: 'postgres', database: 'app' })
  await db.connect()
  await migrate(db)
  await seed(db)

  const r = await receiveIntake(db, {
    workspaceId: WORKSPACE_ID, source: 'manual', externalId: 'docx-1',
    payload: {
      practice: 'Stellar Smiles Dental', website: 'stellarsmiles.test',
      name: 'Amy Nguyen', email: 'amy@stellarsmiles.test',
    },
  })
  reviewId = r.reviewId
  await collectReview(db, WORKSPACE_ID, reviewId, {
    fetchImpl: fixtureFetch(NEGLECTED, 'http://stellarsmiles.test'),
    networkProbes: false,
  })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await server?.stop()
  try { rmSync(dataDir, { recursive: true, force: true }) } catch { /* win file locks */ }
}, 60_000)

/** A .docx is a zip containing [Content_Types].xml and word/document.xml.
    Entry order is not guaranteed, so search the whole archive. */
function isDocx(buf: Buffer): boolean {
  const zip = buf[0] === 0x50 && buf[1] === 0x4b
  const names = buf.toString('latin1')
  return zip && names.includes('[Content_Types].xml') && names.includes('word/document.xml')
}

/** Unpack the .docx and return every part name plus the header/footer xml. */
async function docxParts(buf: Buffer): Promise<{ parts: string[]; header: string; footer: string }> {
  const { execFileSync } = await import('node:child_process')
  const { writeFileSync, readFileSync, readdirSync, existsSync } = await import('node:fs')
  const dir = mkdtempSync(path.join(tmpdir(), 'dxp-'))
  const file = path.join(dir, 'out.zip')
  writeFileSync(file, buf)
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Expand-Archive -LiteralPath '${file}' -DestinationPath '${dir}\\x' -Force`])
  const root = path.join(dir, 'x')
  const walk = (d: string, prefix = ''): string[] =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`])
  const parts = walk(root)
  const read = (rel: string) =>
    existsSync(path.join(root, rel)) ? readFileSync(path.join(root, rel), 'utf8') : ''
  const headerName = parts.find((p) => /^word\/header\d*\.xml$/.test(p)) ?? ''
  const footerName = parts.find((p) => /^word\/footer\d*\.xml$/.test(p)) ?? ''
  const out = { parts, header: read(headerName), footer: read(footerName) }
  rmSync(dir, { recursive: true, force: true })
  return out
}

/** Pull the document body text out without a full OOXML parse. */
async function documentText(buf: Buffer): Promise<string> {
  const { execFileSync } = await import('node:child_process')
  const dir = mkdtempSync(path.join(tmpdir(), 'dx-'))
  const file = path.join(dir, 'out.zip') // Expand-Archive insists on the extension
  const { writeFileSync, readFileSync } = await import('node:fs')
  writeFileSync(file, buf)
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Expand-Archive -LiteralPath '${file}' -DestinationPath '${dir}\\x' -Force`])
  const xml = readFileSync(path.join(dir, 'x', 'word', 'document.xml'), 'utf8')
  rmSync(dir, { recursive: true, force: true })
  return xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
}

describe('exporting the review as .docx', () => {
  /* §13.2 step 1.9 DoD. Runs first, before any test accepts anything by hand,
     so what it sees is purely what the collector decided on its own. */
  it('auto-accepts the measurements and leaves judgement to a human', async () => {
    const bank = loadBank()
    const full = (await getReview(db, WORKSPACE_ID, reviewId))!
    const accepted = full.findings.filter((f) => f.state === 'accepted')
    const candidates = full.findings.filter((f) => f.state === 'candidate')

    expect(accepted.length, 'nothing was auto-accepted — the report would be empty').toBeGreaterThan(0)
    expect(candidates.length, 'everything was auto-accepted — §13.4 breached').toBeGreaterThan(0)

    for (const f of accepted) {
      const s = bank.byId.get(f.snippet_id)!
      expect(s.auto_safe, `${f.snippet_id}: auto-accepted but not auto_safe`).toBe(true)
      expect(s.ahpra_blocking ?? false, `${f.snippet_id}: AHPRA finding auto-accepted`).toBe(false)
      expect(typeof s.when, `${f.snippet_id}: non-trigger snippet auto-accepted`).not.toBe('string')
      expect(f.decided_by, `${f.snippet_id}: no auto attribution`).toBe('auto')
      expect(f.rendered_text, `${f.snippet_id}: unfilled variable auto-accepted`).not.toMatch(/\{\{/)
    }

    /* The document that falls out with zero human input: carries the
       measurements, carries nothing anyone still has to rule on. */
    const text = await documentText((await exportReviewDocx(db, WORKSPACE_ID, reviewId)).buffer)
    expect(text).toContain('The website is not using the SSL/HTTPS protocol')
    for (const f of candidates) {
      const probe = f.rendered_text.replace(/\{\{[^}]*\}\}/g, '').trim().slice(0, 45)
      if (probe.length < 30) continue // too short to attribute safely
      expect(text, `${f.snippet_id} reached the client unreviewed`).not.toContain(probe)
    }
  })

  /* §13.2 step 1.10 DoD: the unattended pipeline ends with a written opening,
     and the document opens on it rather than on its closing sentence. */
  it('writes the Recommendations opening from the accepted findings', async () => {
    const model = new MockModelClient((req) =>
      mockReviewSummary(req.input as Parameters<typeof mockReviewSummary>[0]))
    const res = await summariseReview(db, model, WORKSPACE_ID, reviewId)

    expect(res, 'nothing accepted, so nothing to summarise').not.toBeNull()
    expect(res!.unsourced, `summariser invented: ${res!.unsourced.join(', ')}`).toEqual([])
    expect(res!.summary_text.length).toBeGreaterThan(30)

    const { rows } = await db.query(
      `SELECT summary_text, overall_comment FROM reviews WHERE id = $1`, [reviewId])
    expect(rows[0].summary_text).toBe(res!.summary_text)
    expect(rows[0].overall_comment).toBe(res!.overall_comment)

    const text = await documentText((await exportReviewDocx(db, WORKSPACE_ID, reviewId)).buffer)
    expect(text).toContain('Recommendations:')
    expect(text).toContain(res!.summary_text)
  })

  it('refuses to ship a paragraph with an unfilled variable', async () => {
    const full = (await getReview(db, WORKSPACE_ID, reviewId))!
    const email = full.findings.find((f) => f.snippet_id === 'biz.email.public_domain')
    // the fixture's yahoo address fills this one; force the failure with a raw snippet
    await db.query(
      `INSERT INTO review_findings
         (id, workspace_id, review_id, snippet_id, category, dimension, variant, weight,
          state, rendered_text, triggered_by)
       VALUES ('fnd_unfilled',$1,$2,'tech.wpadmin.default','website_technical','Hosting','negative',2,
               'accepted','Having the default admin login URL as {{domain}}/wp-admin …','["x"]')`,
      [WORKSPACE_ID, reviewId],
    )
    await expect(exportReviewDocx(db, WORKSPACE_ID, reviewId)).rejects.toThrow(/unfilled variable/)
    await expect(exportReviewDocx(db, WORKSPACE_ID, reviewId)).rejects.toThrow(/tech\.wpadmin\.default/)
    await db.query(`DELETE FROM review_findings WHERE id = 'fnd_unfilled'`)
    expect(email).toBeTruthy()
  })

  it('produces a real .docx named after the practice', async () => {
    const full = (await getReview(db, WORKSPACE_ID, reviewId))!
    for (const f of full.findings) {
      if (/\{\{/.test(f.rendered_text)) continue
      await decideFinding(db, WORKSPACE_ID, f.id, { state: 'accepted', actor: 'WC' })
    }
    await setScores(db, WORKSPACE_ID, reviewId,
      { website_business: 2, website_technical: 1, website_usability: 2, visibility_seo: 2, reputation: null },
      2, 'WC')

    const out = await exportReviewDocx(db, WORKSPACE_ID, reviewId, { date: new Date('2026-08-04T00:00:00Z') })
    expect(out.filename).toBe('Online Presence Review - Stellar-Smiles-Dental.docx')
    expect(isDocx(out.buffer)).toBe(true)
    expect(out.buffer.length).toBeGreaterThan(3000)
  })

  it('lays the document out like the template', async () => {
    const out = await exportReviewDocx(db, WORKSPACE_ID, reviewId, { date: new Date('2026-08-04T00:00:00Z') })
    const text = await documentText(out.buffer)

    expect(text).toContain('Review of stellarsmiles.test:')
    expect(text).toContain('Date: 4 August 2026')
    expect(text).toContain('Attention: Amy Nguyen')
    expect(text).toContain('Summary:')

    // all eight summary rows, in the template's order
    for (const label of [
      'Website (Business)', 'Website (Technical)', 'Website (Usability)',
      'Visibility (SEO)', 'Visibility (SEM)', 'Reputation', 'Social Media', 'Competition',
    ]) {
      expect(text, `${label} missing from the summary table`).toContain(label)
    }
    expect(text).toContain('Overall Score')
  })

  it('prints scores as asterisks and an unscored row as a dash', async () => {
    const text = await documentText((await exportReviewDocx(db, WORKSPACE_ID, reviewId)).buffer)
    expect(text).toMatch(/\*{1,5}/)
    expect(text).toContain('—') // Reputation, deliberately unscored
  })

  it('carries the accepted house copy verbatim', async () => {
    const text = await documentText((await exportReviewDocx(db, WORKSPACE_ID, reviewId)).buffer)
    expect(text).toContain('The website is not using the SSL/HTTPS protocol')
    expect(text).toContain('doesn’t have Google Analytics installed')
    // the fixture is static HTML, so the WordPress praise must be absent
    expect(text).not.toContain('the industry standard platform')
  })

  it('includes only accepted findings', async () => {
    const full = (await getReview(db, WORKSPACE_ID, reviewId))!
    const captcha = full.findings.find((f) => f.snippet_id === 'use.captcha.legacy')!
    await decideFinding(db, WORKSPACE_ID, captcha.id, { state: 'rejected', actor: 'WC' })

    const text = await documentText((await exportReviewDocx(db, WORKSPACE_ID, reviewId)).buffer)
    expect(text).not.toContain('old fashion CAPTCHA')
    expect(text).toContain('The website is not using the SSL/HTTPS protocol')
  })

  it('uses the reviewer’s edit over the house copy', async () => {
    const full = (await getReview(db, WORKSPACE_ID, reviewId))!
    const cms = full.findings.find((f) => f.snippet_id === 'tech.cms.static_html')!
    await decideFinding(db, WORKSPACE_ID, cms.id, {
      state: 'accepted', editedText: 'Static HTML. Move to WordPress before anything else.', actor: 'WC',
    })
    const text = await documentText((await exportReviewDocx(db, WORKSPACE_ID, reviewId)).buffer)
    expect(text).toContain('Static HTML. Move to WordPress before anything else.')
    expect(text).not.toContain('will make the website hard to maintain')
  })

  /* 1.7 DoD: the letterhead carries the ABN, phone and street address, and the
     template's screenshots sit beside the finding they evidence. */
  it('ships the letterhead, the page footer and an exhibit attached to its finding', async () => {
    const full = (await getReview(db, WORKSPACE_ID, reviewId))!
    /* Must be a finding that actually renders: `recommendations` findings are
       handled by the summary block, not the category sections. */
    const target = full.findings.find(
      (f) => f.state === 'accepted' && f.category === 'website_technical')!
    await db.query(
      `INSERT INTO review_exhibits
         (id, workspace_id, review_id, finding_id, kind, label, path, width, height, position)
       VALUES ('exh_t1',$1,$2,$3,'screenshot','Homepage as it loads at 1440×900','2080-logo.png',2048,218,0)`,
      [WORKSPACE_ID, reviewId, target.id],
    )
    /* A distinct image, not the logo: docx stores media by content hash, so
       reusing the logo would dedupe to one part and prove nothing. */
    const { writeFileSync } = await import('node:fs')
    const exDir = mkdtempSync(path.join(tmpdir(), 'exh-'))
    writeFileSync(path.join(exDir, '2080-logo.png'), Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'))

    const out = await exportReviewDocx(db, WORKSPACE_ID, reviewId, { exhibitDir: exDir })
    const { parts, header, footer } = await docxParts(out.buffer)

    expect(parts.some((p) => /^word\/header\d*\.xml$/.test(p)), 'no header part').toBe(true)
    expect(parts.some((p) => /^word\/footer\d*\.xml$/.test(p)), 'no footer part').toBe(true)
    expect(header).toContain('<w:drawing') // the letterhead image
    expect(footer).toContain('2080solutions.com.au')
    expect(footer).toMatch(/PAGE|NUMPAGES/) // page N of M fields

    // logo in the header + the exhibit in the body = at least two images
    const media = parts.filter((p) => p.startsWith('word/media/'))
    expect(media.length, `media parts: ${media.join(', ')}`).toBeGreaterThanOrEqual(2)

    const text = await documentText(out.buffer)
    expect(text).toContain('Homepage as it loads at 1440×900') // the caption
    await db.query(`DELETE FROM review_exhibits WHERE id = 'exh_t1'`)
  })

  /* §13.2 step 1.12 DoD. Nothing had ever written to review_competitors and
     there was no route to, so this section of the template could never render
     at all — not a formatting bug, an absent feature. */
  it('renders a competitor added by hand via the comp.row template', async () => {
    const added = await addCompetitor(db, WORKSPACE_ID, reviewId, {
      name: 'Chapel Gate Dental',
      facts: { serp_position: 1, map_position: 1, https: false, booking: true, days_open: 6 },
      threat: 7,
    })
    try {
      const text = await documentText((await exportReviewDocx(db, WORKSPACE_ID, reviewId)).buffer)
      expect(text).toContain('Competition:')
      expect(text).toContain('The primary competitors in the local area are:')
      expect(text).toContain('Chapel Gate Dental')
      expect(text).toContain('#1 in Google search')
      expect(text).toContain('not secure')
      expect(text).toContain('open 6 days')
      expect(text).toContain('Threat: 7/10.')
      expect(text).not.toMatch(/\{\{/)
    } finally {
      await removeCompetitor(db, WORKSPACE_ID, added.competitor.id)
    }
  })

  /* comp.intro and comp.row are scaffolding for the block this exporter
     assembles, not paragraphs of their own. addCompetitor writes the
     manual.competitors.count signal and re-runs the findings pass, so both land
     on the review as candidates the moment a competitor is entered — accepting
     them printed the Competition heading and its intro twice, and shipped
     comp.row's worked Chapel Gate example into the client's report verbatim. */
  it('prints Competition once when the structural snippets also fired', async () => {
    const bank = loadBank()
    const added = await addCompetitor(db, WORKSPACE_ID, reviewId, {
      name: 'Elwood Dental Group',
      facts: { serp_position: 2, https: false, booking: true, days_open: 6 },
      threat: 6,
    })
    try {
      const full = (await getReview(db, WORKSPACE_ID, reviewId))!
      const scaffolding = full.findings.filter((f) => ['comp.intro', 'comp.row'].includes(f.snippet_id))
      expect(scaffolding.length, 'the structural snippets did not fire').toBe(2)
      for (const f of scaffolding) {
        await decideFinding(db, WORKSPACE_ID, f.id, { state: 'accepted', actor: 'WC' })
      }

      const text = await documentText((await exportReviewDocx(db, WORKSPACE_ID, reviewId)).buffer)
      const count = (needle: string) => text.split(needle).length - 1
      expect(count('Competition:'), 'the Competition heading printed twice').toBe(1)
      expect(count(bank.byId.get('comp.intro')!.text), 'the competitor intro printed twice').toBe(1)
      expect(text).toContain('Elwood Dental Group')
      expect(text, 'comp.row’s worked example reached the client').not.toContain('Chapel Gate Dental')
    } finally {
      await db.query(
        `DELETE FROM review_findings WHERE review_id = $1 AND snippet_id IN ('comp.intro','comp.row')`,
        [reviewId])
      await removeCompetitor(db, WORKSPACE_ID, added.competitor.id)
    }
  })

  /* The summary table lists all eight categories in every report. A section the
     review has nothing for used to vanish from the body, leaving the table
     promising eight and the document delivering three. */
  it('prints all eight sections, saying so where there is nothing to report', async () => {
    const bank = loadBank()
    const text = await documentText((await exportReviewDocx(db, WORKSPACE_ID, reviewId)).buffer)

    for (const cat of bank.categories) {
      expect(text, `${cat.label} section missing from the body`).toContain(`${cat.label}:`)
    }
    // no provider, no competitor typed — these four have nothing to say yet
    for (const key of ['visibility_sem', 'reputation', 'social_media', 'competition']) {
      const cat = bank.categories.find((c) => c.key === key)!
      const section = text.slice(text.indexOf(`${cat.label}:`))
      expect(section.slice(0, 400), `${cat.label} rendered empty and silent`)
        .toContain(cat.empty_note)
    }
    // …while a section that does have findings never carries the note
    const tech = bank.categories.find((c) => c.key === 'website_technical')!
    const techSection = text.slice(
      text.indexOf('Website (Technical):'), text.indexOf('Website (Usability):'))
    expect(techSection).not.toContain(tech.empty_note)
  })

  /* §13.2 step 1.5b. The exporter has placed a picture beside its finding since
     1.7; until now nothing could say which finding, so every capture fell to
     the back. */
  it('prints an attached exhibit beside its finding, not at the back', async () => {
    const { writeFileSync } = await import('node:fs')
    const exDir = mkdtempSync(path.join(tmpdir(), 'exh2-'))
    writeFileSync(path.join(exDir, 'shot.png'), Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'))
    const full = (await getReview(db, WORKSPACE_ID, reviewId))!
    const target = full.findings.find((f) => f.state === 'accepted' && f.category === 'website_technical')!
    await db.query(
      `INSERT INTO review_exhibits (id, workspace_id, review_id, kind, label, path, width, height, position)
       VALUES ('exh_att',$1,$2,'screenshot','Homepage capture','shot.png',1440,900,0)`,
      [WORKSPACE_ID, reviewId])

    try {
      /* Unattached: it falls to the back, behind the last section. The template
         has no Evidence heading, so position is the only thing that says so. */
      let text = await documentText(
        (await exportReviewDocx(db, WORKSPACE_ID, reviewId, { exhibitDir: exDir })).buffer)
      expect(text).not.toContain('Evidence:')
      expect(text.indexOf('Homepage capture')).toBeGreaterThan(text.indexOf('Competition:'))

      // attached: it moves up beside the paragraph it proves
      await attachExhibit(db, WORKSPACE_ID, 'exh_att', target.id)
      text = await documentText(
        (await exportReviewDocx(db, WORKSPACE_ID, reviewId, { exhibitDir: exDir })).buffer)
      expect(text).not.toContain('Evidence:')
      const finding = text.indexOf(target.rendered_text.slice(0, 40))
      const caption = text.indexOf('Homepage capture')
      expect(finding).toBeGreaterThan(-1)
      expect(caption).toBeGreaterThan(finding)
      expect(caption).toBeLessThan(text.indexOf('Competition:'))
    } finally {
      await db.query(`DELETE FROM review_exhibits WHERE id = 'exh_att'`)
      rmSync(exDir, { recursive: true, force: true })
    }
  })

  it('refuses to attach an exhibit to a finding from another review', async () => {
    await db.query(
      `INSERT INTO review_exhibits (id, workspace_id, review_id, kind, label, path, position)
       VALUES ('exh_x',$1,$2,'screenshot','x','x.png',0)`, [WORKSPACE_ID, reviewId])
    try {
      await expect(attachExhibit(db, WORKSPACE_ID, 'exh_x', 'fnd_not_in_this_review'))
        .rejects.toThrow(/not in this review/)
    } finally {
      await db.query(`DELETE FROM review_exhibits WHERE id = 'exh_x'`)
    }
  })

  /* §13.2 step 1.17. Every real report colours its findings and prints a legend
     saying what the colours mean — Oh Dental's is Positive 00FF00, Negative
     (Moderate) FF9900, Negative (Critical) FF0000. */
  it('prints the legend and colours each finding by severity', async () => {
    const { execFileSync } = await import('node:child_process')
    const { writeFileSync, readFileSync } = await import('node:fs')
    const out = await exportReviewDocx(db, WORKSPACE_ID, reviewId)
    const dir = mkdtempSync(path.join(tmpdir(), 'lg-'))
    const file = path.join(dir, 'out.zip')
    writeFileSync(file, out.buffer)
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Expand-Archive -LiteralPath '${file}' -DestinationPath '${dir}\\x' -Force`])
    const xml = readFileSync(path.join(dir, 'x', 'word', 'document.xml'), 'utf8')
    rmSync(dir, { recursive: true, force: true })

    const text = xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
    expect(text).toContain('Legend:')
    expect(text).toContain('Negative (Moderate)')
    expect(text).toContain('Negative (Critical)')

    // the template's exact inks, not an approximation
    expect(xml).toContain('w:val="00FF00"')
    expect(xml).toContain('w:val="FF9900"')

    /* A shipped positive finding must actually carry the positive ink, not just
       appear somewhere in the legend. */
    const bank = loadBank()
    const full = (await getReview(db, WORKSPACE_ID, reviewId))!
    const shipped = full.findings.filter((f) => f.state === 'accepted' || f.state === 'edited')
    /* A named one, not "the first positive": the competition verdicts are also
       positive and are assembled rather than bulleted, so picking by sort order
       tests a different code path depending on the fixture. */
    const green = shipped.find((f) => f.snippet_id === 'tech.https.absent'
      || f.snippet_id === 'tech.https.present')!
    expect(green, 'no https finding shipped').toBeTruthy()
    expect(bank.byId.get(green.snippet_id)?.severity).toBeTruthy()
    expect(green, 'no positive finding shipped').toBeTruthy()
    /* filter, not find: the Recommendations opening quotes the same wording and
       is deliberately uncoloured, so the first match is the wrong paragraph. */
    const paras = xml.split('</w:p>').filter((p) => p.includes(green.rendered_text.slice(0, 40)))
    expect(paras.length, 'positive finding not found in the document').toBeGreaterThan(0)
    const INK = { positive: '00FF00', moderate: 'FF9900', critical: 'FF0000' } as const
    const ink = INK[bank.byId.get(green.snippet_id)!.severity]
    expect(paras.some((p) => p.includes(`w:val="${ink}"`)),
      `the ${green.snippet_id} bullet carries no severity ink`).toBe(true)
  })

  /* §13.2 step 1.18. The Comments column is a verdict per category in every
     real report — "Great performance and diversified email/server" — not the
     dimension list, which is only what the blank template carries. */
  it('prints the summariser’s verdict in the Comments column', async () => {
    const model = new MockModelClient((req) =>
      mockReviewSummary(req.input as Parameters<typeof mockReviewSummary>[0]))
    const res = await summariseReview(db, model, WORKSPACE_ID, reviewId)
    expect(res!.category_comments.length, 'no per-category verdicts').toBeGreaterThan(0)

    const { rows } = await db.query(
      `SELECT category_comments FROM reviews WHERE id = $1`, [reviewId])
    const stored = rows[0].category_comments as Record<string, string>
    expect(Object.keys(stored).length).toBe(res!.category_comments.length)

    const text = await documentText((await exportReviewDocx(db, WORKSPACE_ID, reviewId)).buffer)
    /* `recommendations` is a finding category but has no row in the summary
       table, so pin to one the table actually prints. */
    const bank = loadBank()
    const one = res!.category_comments.find(
      (c) => bank.categories.some((cat) => cat.key === c.category))!
    expect(one, 'no verdict for any table row').toBeTruthy()
    expect(text, 'the verdict never reached the table').toContain(one.comment)
    // and the placeholder it replaces is gone for that category
    const cat = bank.categories.find((c) => c.key === one.category)!
    expect(text).not.toContain(cat.dimensions.join(', '))
  })

  it('puts issues before strengths inside a category', async () => {
    const text = await documentText((await exportReviewDocx(db, WORKSPACE_ID, reviewId)).buffer)
    const tech = text.slice(text.indexOf('Website (Technical):'))
    const ssl = tech.indexOf('not using the SSL/HTTPS protocol')
    const analytics = tech.indexOf('doesn’t have Google Analytics installed')
    expect(ssl).toBeGreaterThan(-1)
    expect(analytics).toBeGreaterThan(-1)
  })
})
