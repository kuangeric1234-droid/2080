import pg from 'pg'
import { monotonicFactory } from 'ulid'

const ulid = monotonicFactory()
const id = (p: string) => `${p}_${ulid()}`

/* A jobs table and one in-process worker. Deliberately not Redis, not a second
   service: this is one box doing a handful of audits a day, and a queue that
   needs its own daemon is another thing to keep alive for no gain.

   The properties that actually matter here:
   - a job survives a restart, because it is a row, not a promise
   - a double-click cannot become two crawls of a client's site
   - a job that hangs is killed by its own deadline rather than wedging the box
   - a job that dies three times raises a notification instead of vanishing */

export type JobState = 'queued' | 'running' | 'done' | 'failed' | 'dead'

export interface Job {
  id: string
  workspace_id: string
  kind: string
  payload: Record<string, unknown>
  state: JobState
  attempts: number
  max_attempts: number
  last_error: string | null
  result: unknown
  created_at: string
  finished_at: string | null
}

export interface EnqueueOptions {
  workspaceId: string
  kind: string
  payload?: Record<string, unknown>
  /** One live job per subject. A second request while the first runs is a
      double-click, not a second instruction — it returns the running job. */
  dedupeKey?: string
  maxAttempts?: number
  runAfter?: Date
}

export async function enqueue(
  db: pg.Client | pg.Pool,
  opts: EnqueueOptions,
): Promise<{ job: Job; alreadyQueued: boolean }> {
  if (opts.dedupeKey) {
    const { rows } = await db.query<Job>(
      `SELECT * FROM jobs WHERE dedupe_key = $1 AND state IN ('queued','running')`,
      [opts.dedupeKey],
    )
    if (rows.length) return { job: rows[0], alreadyQueued: true }
  }

  const { rows } = await db.query<Job>(
    `INSERT INTO jobs (id, workspace_id, kind, payload, dedupe_key, max_attempts, run_after)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, now()))
     RETURNING *`,
    [id('job'), opts.workspaceId, opts.kind, JSON.stringify(opts.payload ?? {}),
      opts.dedupeKey ?? null, opts.maxAttempts ?? 3, opts.runAfter ?? null],
  )
  return { job: rows[0], alreadyQueued: false }
}

/** Take the next due job. SKIP LOCKED so two workers never take the same one. */
export async function claim(db: pg.Client | pg.Pool, workerId: string): Promise<Job | null> {
  const { rows } = await db.query<Job>(
    `UPDATE jobs SET state = 'running', locked_at = now(), locked_by = $1, attempts = attempts + 1
      WHERE id = (
        SELECT id FROM jobs
         WHERE state = 'queued' AND run_after <= now()
         ORDER BY run_after, created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1)
      RETURNING *`,
    [workerId],
  )
  return rows[0] ?? null
}

export async function complete(db: pg.Client | pg.Pool, jobId: string, result: unknown): Promise<void> {
  await db.query(
    `UPDATE jobs SET state = 'done', result = $2, finished_at = now(), last_error = NULL
      WHERE id = $1`,
    [jobId, JSON.stringify(result ?? null)],
  )
}

/** Exponential-ish backoff, capped. Dead after max_attempts. */
export async function fail(
  db: pg.Client | pg.Pool,
  job: Job,
  error: string,
): Promise<{ state: JobState; retryInSeconds: number | null }> {
  const exhausted = job.attempts >= job.max_attempts
  if (exhausted) {
    await db.query(
      `UPDATE jobs SET state = 'dead', last_error = $2, finished_at = now() WHERE id = $1`,
      [job.id, error],
    )
    return { state: 'dead', retryInSeconds: null }
  }
  const delay = Math.min(300, 15 * 2 ** (job.attempts - 1)) // 15s, 30s, 60s… capped at 5min
  await db.query(
    `UPDATE jobs SET state = 'queued', last_error = $2, locked_at = NULL, locked_by = NULL,
            run_after = now() + ($3 || ' seconds')::interval
      WHERE id = $1`,
    [job.id, error, String(delay)],
  )
  return { state: 'queued', retryInSeconds: delay }
}

/* A worker killed mid-job (NUC reboot, power cut) leaves its row 'running'
   forever. Anything locked longer than any job could legitimately take is
   put back on the queue rather than silently lost. */
export async function recoverStale(
  db: pg.Client | pg.Pool,
  olderThanSeconds: number,
): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE jobs SET state = 'queued', locked_at = NULL, locked_by = NULL,
            last_error = 'worker died mid-job; requeued'
      WHERE state = 'running' AND locked_at < now() - ($1 || ' seconds')::interval`,
    [String(olderThanSeconds)],
  )
  return rowCount ?? 0
}

export async function getJob(db: pg.Client | pg.Pool, jobId: string): Promise<Job | null> {
  const { rows } = await db.query<Job>(`SELECT * FROM jobs WHERE id = $1`, [jobId])
  return rows[0] ?? null
}

export async function listJobs(db: pg.Client | pg.Pool, limit = 50): Promise<Job[]> {
  const { rows } = await db.query<Job>(
    `SELECT * FROM jobs ORDER BY created_at DESC LIMIT $1`, [limit])
  return rows
}
