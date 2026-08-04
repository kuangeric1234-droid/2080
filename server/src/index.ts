import { serve } from '@hono/node-server'
import pg from 'pg'
import { buildApp } from './api.ts'
import { defaultModelClient } from './skills/model.ts'
import { startWorker } from './jobs/worker.ts'
import { HANDLERS } from './jobs/handlers.ts'

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5482/app'
const PORT = Number(process.env.PORT ?? 5483)

const pool = new pg.Pool({ connectionString: DATABASE_URL })
// PROVISIONAL connectors (BLOCKERS.md: gmail-oauth, activecollab-token)
const app = buildApp(pool, defaultModelClient())

/* The job worker runs inside the API process. Concurrency stays at 1: this box
   also serves the dashboard, and a NUC running several headless browsers while
   doing that does both badly. Raise it only with evidence. */
const worker = startWorker(pool, {
  handlers: HANDLERS,
  concurrency: Number(process.env.JOB_CONCURRENCY ?? 1),
  deadlineMs: Number(process.env.JOB_DEADLINE_MS ?? 180_000),
  onEvent: ({ level, message }) => console[level === 'info' ? 'log' : level](`[jobs] ${message}`),
})

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`api listening on http://127.0.0.1:${info.port}`)
  console.log(`job worker started (concurrency ${process.env.JOB_CONCURRENCY ?? 1})`)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY not set — skill runs use the PROVISIONAL mock model client')
  }
})

/* Let a running crawl finish rather than orphaning its row as 'running' and
   making the next start recover it. */
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log('shutting down — waiting for in-flight jobs')
    void (async () => {
      await worker.stop()
      server.close()
      await pool.end()
      process.exit(0)
    })()
  })
}
