import { serve } from '@hono/node-server'
import pg from 'pg'
import { buildApp } from './api.ts'
import { defaultModelClient } from './skills/model.ts'

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5482/app'
const PORT = Number(process.env.PORT ?? 5483)

const pool = new pg.Pool({ connectionString: DATABASE_URL })
// PROVISIONAL connectors (BLOCKERS.md: gmail-oauth, activecollab-token)
const app = buildApp(pool, defaultModelClient())

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`api listening on http://127.0.0.1:${info.port}`)
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY not set — skill runs use the PROVISIONAL mock model client')
  }
})
