import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { migrate } from '../src/db/migrate.ts'
import { seed, WORKSPACE_ID } from '../src/db/seed.ts'
import { buildApp } from '../src/api.ts'
import { MockActiveCollab, MockMailSender } from '../src/inbox/connectors.ts'
import { MockModelClient } from '../src/skills/model.ts'
import { claim, complete, enqueue, fail, getJob, recoverStale } from '../src/jobs/queue.ts'
import { startWorker } from '../src/jobs/worker.ts'
import { startManualReview } from '../src/review/intake.ts'
import { authed, freePort, stopPg } from './helpers.ts'

let PORT: number
let server: EmbeddedPostgres
let db: pg.Client
let dataDir: string
let app: ReturnType<typeof buildApp>

beforeAll(async () => {
  PORT = await freePort()
  dataDir = mkdtempSync(path.join(tmpdir(), 'pg2080job-'))
  server = new EmbeddedPostgres({
    databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PORT,
    // stopPg removes the directory; see helpers.ts
    persistent: true, initdbFlags: ['--encoding=UTF8', '--locale=C'],
  })
  await server.initialise()
  await server.start()
  await server.createDatabase('app')
  db = new pg.Client({ host: '127.0.0.1', port: PORT, user: 'postgres', password: 'postgres', database: 'app' })
  await db.connect()
  await migrate(db)
  await seed(db)
  app = buildApp(db, new MockModelClient(() => ({})), {
    mail: new MockMailSender(), tasks: new MockActiveCollab(),
  })
}, 180_000)

afterAll(async () => {
  await db?.end()
  await stopPg(server, dataDir)
}, 60_000)

/** A worker that never polls — tests drive it a tick at a time. */
function testWorker(handlers: Parameters<typeof startWorker>[1]['handlers'], deadlineMs = 5_000) {
  return startWorker(db, { handlers, deadlineMs, autoStart: false, workerId: 'test' })
}

/* Each test owns the queue. A leftover job from the previous test would be the
   one claimed next, and the assertion would be about the wrong row. */
beforeEach(async () => { await db.query('DELETE FROM jobs') })

async function settle() {
  // let the in-flight promise land; the worker does not await its own handlers
  for (let i = 0; i < 60; i++) await new Promise((r) => setTimeout(r, 25))
}

describe('the job queue', () => {
  it('enqueues, claims and completes', async () => {
    const { job } = await enqueue(db, { workspaceId: WORKSPACE_ID, kind: 'test.noop', payload: { a: 1 } })
    expect(job.state).toBe('queued')

    const claimed = await claim(db, 'w1')
    expect(claimed?.id).toBe(job.id)
    expect(claimed?.state).toBe('running')
    expect(claimed?.attempts).toBe(1)
    expect(claimed?.payload).toEqual({ a: 1 })

    await complete(db, job.id, { ok: true })
    expect((await getJob(db, job.id))?.state).toBe('done')
  })

  it('claims nothing when the queue is empty', async () => {
    expect(await claim(db, 'w1')).toBeNull()
  })

  /* A second press while one is running is a double-click, not a second
     instruction — two crawls of the same client's site is the failure. */
  it('will not queue a second live job for the same subject', async () => {
    const first = await enqueue(db, {
      workspaceId: WORKSPACE_ID, kind: 'test.dedupe', dedupeKey: 'subject-1',
    })
    const second = await enqueue(db, {
      workspaceId: WORKSPACE_ID, kind: 'test.dedupe', dedupeKey: 'subject-1',
    })
    expect(second.alreadyQueued).toBe(true)
    expect(second.job.id).toBe(first.job.id)

    // still deduped while running, not just while queued
    await claim(db, 'w1')
    const third = await enqueue(db, {
      workspaceId: WORKSPACE_ID, kind: 'test.dedupe', dedupeKey: 'subject-1',
    })
    expect(third.job.id).toBe(first.job.id)

    // but a finished one no longer blocks the next
    await complete(db, first.job.id, null)
    const fourth = await enqueue(db, {
      workspaceId: WORKSPACE_ID, kind: 'test.dedupe', dedupeKey: 'subject-1',
    })
    expect(fourth.alreadyQueued).toBe(false)
    expect(fourth.job.id).not.toBe(first.job.id)
    await complete(db, fourth.job.id, null)
  })

  it('backs off on failure and dies after max attempts', async () => {
    const { job } = await enqueue(db, {
      workspaceId: WORKSPACE_ID, kind: 'test.flaky', maxAttempts: 2,
    })
    const a = (await claim(db, 'w1'))!
    const first = await fail(db, a, 'boom')
    expect(first.state).toBe('queued')
    expect(first.retryInSeconds).toBe(15)

    // due in the future, so not claimable yet
    expect(await claim(db, 'w1')).toBeNull()
    await db.query(`UPDATE jobs SET run_after = now() WHERE id = $1`, [job.id])

    const b = (await claim(db, 'w1'))!
    expect(b.attempts).toBe(2)
    const second = await fail(db, b, 'boom again')
    expect(second.state).toBe('dead')

    const dead = (await getJob(db, job.id))!
    expect(dead.last_error).toBe('boom again')
    expect(dead.finished_at).not.toBeNull()
  })

  /* A NUC reboot mid-crawl leaves the row 'running' forever. */
  it('requeues a job whose worker died mid-flight', async () => {
    const { job } = await enqueue(db, { workspaceId: WORKSPACE_ID, kind: 'test.orphan' })
    await claim(db, 'w-doomed')
    await db.query(`UPDATE jobs SET locked_at = now() - interval '1 hour' WHERE id = $1`, [job.id])

    expect(await recoverStale(db, 60)).toBe(1)
    const back = (await getJob(db, job.id))!
    expect(back.state).toBe('queued')
    expect(back.last_error).toMatch(/worker died mid-job/)
    await db.query(`DELETE FROM jobs WHERE id = $1`, [job.id])
  })
})

describe('the worker', () => {
  it('runs a handler and stores its result', async () => {
    const w = testWorker({ 'test.echo': async (_db, payload) => ({ echoed: payload.value }) })
    const { job } = await enqueue(db, {
      workspaceId: WORKSPACE_ID, kind: 'test.echo', payload: { value: 42 },
    })
    expect(await w.tick()).toBe(1)
    await settle()
    await w.stop()

    const done = (await getJob(db, job.id))!
    expect(done.state).toBe('done')
    expect(done.result).toEqual({ echoed: 42 })
  })

  /* A site that accepts the connection then never finishes sending would hold
     the only worker slot forever. The deadline is what stops one bad practice
     site wedging the box. */
  it('kills a handler that overruns its deadline', async () => {
    const w = startWorker(db, {
      handlers: { 'test.hang': () => new Promise(() => {}) },
      deadlineMs: 150, autoStart: false, workerId: 'test',
    })
    const { job } = await enqueue(db, {
      workspaceId: WORKSPACE_ID, kind: 'test.hang', maxAttempts: 1,
    })
    await w.tick()
    await settle()
    await w.stop()

    const dead = (await getJob(db, job.id))!
    expect(dead.state).toBe('dead')
    expect(dead.last_error).toMatch(/timed out after/)
  })

  it('respects its concurrency ceiling', async () => {
    let peak = 0
    let live = 0
    const w = startWorker(db, {
      handlers: {
        'test.slow': async () => {
          live++; peak = Math.max(peak, live)
          await new Promise((r) => setTimeout(r, 60))
          live--
          return null
        },
      },
      concurrency: 1, autoStart: false, workerId: 'test',
    })
    for (let i = 0; i < 3; i++) {
      await enqueue(db, { workspaceId: WORKSPACE_ID, kind: 'test.slow' })
    }
    expect(await w.tick()).toBe(1) // one slot, one claim
    await settle()
    expect(await w.tick()).toBe(1)
    await settle()
    await w.stop()
    expect(peak).toBe(1)
  })

  it('kills a job whose kind has no handler rather than looping on it', async () => {
    const w = testWorker({})
    const { job } = await enqueue(db, {
      workspaceId: WORKSPACE_ID, kind: 'test.unknown', maxAttempts: 1,
    })
    await w.tick()
    await settle()
    await w.stop()
    expect((await getJob(db, job.id))?.last_error).toMatch(/no handler registered/)
  })

  /* Silently dead work is how a practice waits a week for a report nobody
     knows failed. */
  it('raises a notification when a job gives up', async () => {
    const before = await db.query(`SELECT count(*)::int AS n FROM notifications`)
    const w = testWorker({ 'test.doomed': async () => { throw new Error('nope') } })
    await enqueue(db, { workspaceId: WORKSPACE_ID, kind: 'test.doomed', maxAttempts: 1 })
    await w.tick()
    await settle()
    await w.stop()

    const after = await db.query(`SELECT count(*)::int AS n FROM notifications`)
    expect(after.rows[0].n).toBeGreaterThan(before.rows[0].n)
    const { rows } = await db.query(
      `SELECT title, body FROM notifications ORDER BY created_at DESC LIMIT 1`)
    expect(rows[0].title).toMatch(/Background job failed: test.doomed/)
    expect(rows[0].body).toMatch(/nope/)
  })
})

describe('collection through the queue', () => {
  it('queues rather than crawling inside the request', async () => {
    const get = await authed(app)
    const created = await get('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'queued-example.test' }),
    })
    const { reviewId } = await created.json() as { reviewId: string }

    const res = await get(`/api/reviews/${reviewId}/collect`, { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json() as { jobId: string; state: string; alreadyQueued: boolean }
    expect(body.jobId).toMatch(/^job_/)

    // the review reads as collecting immediately, before any crawling happens
    const { rows } = await db.query(`SELECT status::text FROM reviews WHERE id = $1`, [reviewId])
    expect(rows[0].status).toBe('collecting')

    // pressing again returns the same job, not a second crawl
    const again = await get(`/api/reviews/${reviewId}/collect`, { method: 'POST' })
    const againBody = await again.json() as { jobId: string; alreadyQueued: boolean }
    expect(againBody.jobId).toBe(body.jobId)
    expect(againBody.alreadyQueued).toBe(true)

    const status = await get(`/api/jobs/${body.jobId}`)
    expect((await status.json() as { state: string }).state).toBe('queued')
    await db.query(`DELETE FROM jobs WHERE id = $1`, [body.jobId])
  })

  it('refuses to queue a review with no domain', async () => {
    const get = await authed(app)
    const { rows } = await db.query(
      `INSERT INTO reviews (id, workspace_id, domain, status)
       VALUES ('rev_nodomain', $1, '(not supplied)', 'requested') RETURNING id`, [WORKSPACE_ID])
    const res = await get(`/api/reviews/${rows[0].id}/collect`, { method: 'POST' })
    expect(res.status).toBe(422)
    expect((await res.json() as { error: string }).error).toMatch(/no domain/)
  })

  /* The box is awake so the evidence is usually there before Wally opens the
     review — that is the whole point of it being awake. */
  it('auto-queues collection the moment a request arrives', async () => {
    const r = await startManualReview(db, {
      workspaceId: WORKSPACE_ID, url: 'autocollect.test', actor: 'WC',
    })
    expect(r.jobId).toMatch(/^job_/)
    const { rows } = await db.query(`SELECT status::text FROM reviews WHERE id = $1`, [r.reviewId])
    expect(rows[0].status).toBe('collecting')
    await db.query(`DELETE FROM jobs WHERE id = $1`, [r.jobId])
  })

  it('leaves a review with no domain alone instead of queueing a doomed job', async () => {
    const { rows: before } = await db.query(`SELECT count(*)::int AS n FROM jobs`)
    const { receiveIntake } = await import('../src/review/intake.ts')
    const r = await receiveIntake(db, {
      workspaceId: WORKSPACE_ID, source: 'manual', externalId: 'nodomain-autocollect',
      payload: { message: 'audit me' }, notify: false,
    })
    expect(r.jobId).toBeNull()
    const { rows: after } = await db.query(`SELECT count(*)::int AS n FROM jobs`)
    expect(after[0].n).toBe(before[0].n)
  })
})
