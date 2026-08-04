import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { migrate } from '../src/db/migrate.ts'
import { seed, WORKSPACE_ID } from '../src/db/seed.ts'
import { receiveIntake } from '../src/review/intake.ts'
import { collectReview, decideFinding, getReview, setScores } from '../src/review/store.ts'
import { exportReviewDocx } from '../src/review/docx.ts'
import { NEGLECTED, fixtureFetch } from './fixtures/practice-site.ts'

const PORT = 5514
let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string
let reviewId: string

beforeAll(async () => {
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

  it('puts issues before strengths inside a category', async () => {
    const text = await documentText((await exportReviewDocx(db, WORKSPACE_ID, reviewId)).buffer)
    const tech = text.slice(text.indexOf('Website (Technical):'))
    const ssl = tech.indexOf('not using the SSL/HTTPS protocol')
    const analytics = tech.indexOf('doesn’t have Google Analytics installed')
    expect(ssl).toBeGreaterThan(-1)
    expect(analytics).toBeGreaterThan(-1)
  })
})
