/* Boots a persistent local Postgres (embedded binaries — no install needed),
   migrates and seeds, then stays up for the app. Ctrl+C to stop.
   Connection: postgres://postgres:postgres@127.0.0.1:5482/app */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { migrate } from './migrate.ts'
import { seed } from './seed.ts'

const PORT = 5482
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../.pgdata')

const server = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})

const fresh = !(await import('node:fs')).existsSync(path.join(dataDir, 'PG_VERSION'))
if (fresh) await server.initialise()
await server.start()
if (fresh) await server.createDatabase('app')

const client = new pg.Client({
  host: '127.0.0.1', port: PORT, user: 'postgres', password: 'postgres', database: 'app',
})
await client.connect()
const ran = await migrate(client)
if (ran.length) console.log(`migrations applied: ${ran.join(', ')}`)
if (fresh || process.argv.includes('--reseed')) {
  await seed(client)
  console.log('demo portfolio seeded')
}
await client.end()

console.log(`dev postgres ready on postgres://postgres:postgres@127.0.0.1:${PORT}/app`)

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await server.stop()
    process.exit(0)
  })
}
