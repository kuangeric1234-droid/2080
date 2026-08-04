import pg from 'pg'
import { claim, complete, fail, recoverStale, type Job } from './queue.ts'
import { route } from '../notify.ts'

/* The worker: poll, claim, run, record. One in-process loop inside the API,
   because a NUC running several headless browsers while serving the dashboard
   does both badly — concurrency is 1 by default and should stay low.

   Every handler runs under a deadline. A practice site that accepts the
   connection and then never finishes sending would otherwise hold the only
   worker slot indefinitely, and the queue behind it would look like a hang
   with no explanation. */

export type JobHandler = (
  db: pg.Client | pg.Pool,
  payload: Record<string, unknown>,
  job: Job,
) => Promise<unknown>

export interface WorkerOptions {
  handlers: Record<string, JobHandler>
  /** How long a handler may run before it is abandoned. */
  deadlineMs?: number
  pollMs?: number
  concurrency?: number
  workerId?: string
  /** Off to drive the worker by hand — tests call tick() rather than waiting on
      a timer, and a polling loop would race them for the same job. */
  autoStart?: boolean
  onEvent?: (e: { level: 'info' | 'warn' | 'error'; message: string }) => void
}

export interface Worker {
  stop(): Promise<void>
  /** Run one tick synchronously — the whole loop, minus the waiting. Tests use
      this so they never depend on a timer. */
  tick(): Promise<number>
}

const DEFAULTS = { deadlineMs: 180_000, pollMs: 1_000, concurrency: 1 }

export function startWorker(db: pg.Client | pg.Pool, opts: WorkerOptions): Worker {
  const deadlineMs = opts.deadlineMs ?? DEFAULTS.deadlineMs
  const pollMs = opts.pollMs ?? DEFAULTS.pollMs
  const concurrency = opts.concurrency ?? DEFAULTS.concurrency
  const workerId = opts.workerId ?? `w_${process.pid}`
  const log = opts.onEvent ?? (() => {})

  let running = true
  let inFlight = 0
  let timer: NodeJS.Timeout | null = null

  async function runOne(job: Job): Promise<void> {
    const handler = opts.handlers[job.kind]
    if (!handler) {
      await fail(db, job, `no handler registered for "${job.kind}"`)
      log({ level: 'error', message: `job ${job.id}: no handler for ${job.kind}` })
      return
    }

    let timeoutHandle: NodeJS.Timeout | undefined
    try {
      const result = await Promise.race([
        handler(db, job.payload ?? {}, job),
        new Promise((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`timed out after ${Math.round(deadlineMs / 1000)}s`)),
            deadlineMs,
          )
        }),
      ])
      await complete(db, job.id, result)
      log({ level: 'info', message: `job ${job.id} (${job.kind}) done` })
    } catch (err) {
      const message = (err as Error).message ?? String(err)
      const outcome = await fail(db, job, message)
      log({
        level: outcome.state === 'dead' ? 'error' : 'warn',
        message: outcome.state === 'dead'
          ? `job ${job.id} (${job.kind}) dead after ${job.attempts} attempts: ${message}`
          : `job ${job.id} (${job.kind}) failed, retrying in ${outcome.retryInSeconds}s: ${message}`,
      })

      /* A job that has given up must surface. Silently dead work is how a
         practice waits a week for a report nobody knows failed. */
      if (outcome.state === 'dead') {
        try {
          await route(db, {
            event_class: 'monitor',
            severity: 'red',
            title: `Background job failed: ${job.kind}`,
            body: `${message}\n\nJob ${job.id} gave up after ${job.attempts} attempts.`,
            link: '/review',
          })
        } catch { /* the notification failing must not mask the job failure */ }
      }
    } finally {
      clearTimeout(timeoutHandle)
    }
  }

  async function tick(): Promise<number> {
    let started = 0
    while (running && inFlight < concurrency) {
      const job = await claim(db, workerId)
      if (!job) break
      started++
      inFlight++
      void runOne(job).finally(() => { inFlight-- })
    }
    return started
  }

  async function loop(): Promise<void> {
    // anything a dead worker left mid-flight goes back on the queue
    try {
      const recovered = await recoverStale(db, Math.ceil(deadlineMs / 1000) * 2)
      if (recovered) log({ level: 'warn', message: `requeued ${recovered} stale job(s)` })
    } catch { /* first poll will try again */ }

    const step = async () => {
      if (!running) return
      try {
        await tick()
      } catch (err) {
        log({ level: 'error', message: `worker tick failed: ${(err as Error).message}` })
      }
      if (running) timer = setTimeout(() => void step(), pollMs)
    }
    void step()
  }

  if (opts.autoStart !== false) void loop()

  return {
    tick,
    async stop() {
      running = false
      if (timer) clearTimeout(timer)
      // let anything in flight land rather than orphaning its row
      const deadline = Date.now() + deadlineMs
      while (inFlight > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50))
      }
    },
  }
}
