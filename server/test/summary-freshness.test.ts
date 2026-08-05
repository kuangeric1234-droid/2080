import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { freePort, stopPg } from './helpers.ts'
import { migrate } from '../src/db/migrate.ts'
import { seed, WORKSPACE_ID } from '../src/db/seed.ts'
import { receiveIntake } from '../src/review/intake.ts'
import { collectReview, decideFinding, getReview } from '../src/review/store.ts'
import { acceptedBasis, resummariseIfStale, summariseReview } from '../src/review/summarise.ts'
import { MockModelClient } from '../src/skills/model.ts'
import { mockReviewSummary } from '../src/inbox/mockResponders.ts'
import { NEGLECTED, fixtureFetch } from './fixtures/practice-site.ts'

/* §13.2 step 1.36 — the summary was written once and went stale.

   It ran at collect time over whatever 1.9 had auto-accepted by then, and
   never again. Every finding a reviewer accepted afterwards was invisible to
   it, so the 05/08 export of ohdental.com.au printed `N/A` in the Comments
   cell for Website (Business) while the Business section of the same document
   carried two bullets, and the Recommendations paragraph described a thinner
   report than the one it opened. */

let PORT: number
let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string
let reviewId: string

const model = new MockModelClient((req) =>
  mockReviewSummary(req.input as Parameters<typeof mockReviewSummary>[0]))

beforeAll(async () => {
  PORT = await freePort()
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080fresh-'))
  server = new EmbeddedPostgres({
    databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PORT,
    persistent: true, initdbFlags: ['--encoding=UTF8', '--locale=C'],
  })
  await server.initialise()
  await server.start()
  await server.createDatabase('app')
  db = new pg.Client({ host: '127.0.0.1', port: PORT, user: 'postgres', password: 'postgres', database: 'app' })
  await db.connect()
  await migrate(db)
  await seed(db)

  const r = await receiveIntake(db, {
    workspaceId: WORKSPACE_ID, source: 'manual', externalId: 'fresh-1',
    payload: { practice: 'Stellar Smiles Dental', website: 'stellarsmiles.test', name: 'Amy', email: 'a@b.test' },
  })
  reviewId = r.reviewId
  await collectReview(db, WORKSPACE_ID, reviewId, {
    fetchImpl: fixtureFetch(NEGLECTED, 'http://stellarsmiles.test'),
    networkProbes: false,
  })
  await summariseReview(db, model, WORKSPACE_ID, reviewId)
}, 180_000)

afterAll(async () => {
  await db?.end()
  await stopPg(server, dataDir)
})

const reviewRow = async () => (await getReview(db, WORKSPACE_ID, reviewId))!.review as Record<string, unknown>

describe('1.36 · the summary catches up with what is shipping', () => {
  it('records what the stored summary was written from', async () => {
    const r = await reviewRow()
    expect(r.summary_text).toBeTruthy()
    expect(r.summary_basis).toBeTruthy()
  })

  it('does nothing when the accepted set has not moved', async () => {
    expect(await resummariseIfStale(db, model, WORKSPACE_ID, reviewId)).toBeNull()
  })

  it('re-writes when a reviewer accepts a finding the summary never saw', async () => {
    const before = await reviewRow()
    const full = (await getReview(db, WORKSPACE_ID, reviewId))!
    const candidate = full.findings.find((f: { state: string }) => f.state === 'candidate')
    expect(candidate, 'fixture produced no candidate to accept').toBeTruthy()

    await decideFinding(db, WORKSPACE_ID, candidate.id, { state: 'accepted', actor: 'wally' })
    const result = await resummariseIfStale(db, model, WORKSPACE_ID, reviewId)
    expect(result, 'the summary did not notice a newly accepted finding').not.toBeNull()

    const after = await reviewRow()
    expect(after.summary_basis).not.toBe(before.summary_basis)
  })

  /* The specific failure the reference comparison surfaced: a category with
     bullets in the body and N/A in the summary table. */
  it('stops printing N/A for a category that now has an accepted finding', async () => {
    const full = (await getReview(db, WORKSPACE_ID, reviewId))!
    const candidate = full.findings.find(
      (f: { state: string; category: string }) =>
        f.state === 'candidate' && f.category === 'website_business')

    /* An assertion, not a skip: the NEGLECTED fixture fires four business
       candidates and none is auto_safe, which is exactly the shape that
       produced the N/A. A fixture change that removed them would otherwise
       turn this test green by making it test nothing. */
    expect(candidate, 'no website_business candidate — this test proves nothing').toBeTruthy()
    await decideFinding(db, WORKSPACE_ID, candidate.id, { state: 'accepted', actor: 'wally' })
    await resummariseIfStale(db, model, WORKSPACE_ID, reviewId)

    const comments = (await reviewRow()).category_comments as Record<string, string>
    expect(comments.website_business, 'a category with bullets still reads N/A')
      .not.toBe('N/A')
  })

  it('is stable across a re-run, so two exports of an untouched review match', async () => {
    await resummariseIfStale(db, model, WORKSPACE_ID, reviewId)
    const first = await reviewRow()
    expect(await resummariseIfStale(db, model, WORKSPACE_ID, reviewId)).toBeNull()
    const second = await reviewRow()
    expect(second.summary_text).toBe(first.summary_text)
    expect(second.category_comments).toEqual(first.category_comments)
  })
})

describe('1.36 · the fingerprint', () => {
  const f = (snippet_id: string, state: string, edited_text: string | null = null) =>
    ({ snippet_id, state, edited_text })

  it('ignores findings that are not shipping', () => {
    expect(acceptedBasis([f('a', 'accepted'), f('b', 'candidate')]))
      .toBe(acceptedBasis([f('a', 'accepted'), f('b', 'rejected')]))
  })

  it('does not depend on the order they come back in', () => {
    expect(acceptedBasis([f('a', 'accepted'), f('b', 'accepted')]))
      .toBe(acceptedBasis([f('b', 'accepted'), f('a', 'accepted')]))
  })

  it('moves when a reviewer edits the words', () => {
    expect(acceptedBasis([f('a', 'edited', 'one')]))
      .not.toBe(acceptedBasis([f('a', 'edited', 'two')]))
  })

  it('moves when a finding is accepted', () => {
    expect(acceptedBasis([f('a', 'accepted')]))
      .not.toBe(acceptedBasis([f('a', 'accepted'), f('b', 'accepted')]))
  })
})
