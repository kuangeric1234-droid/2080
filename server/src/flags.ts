import type pg from 'pg'
import { WORKSPACE_ID, id } from './skills/gates.ts'

/* Flag ranking + actions for the Today feed (§13 1.6). Ranking is
   deterministic platform code: severity dominates, age and client risk
   break ties. The judgement-tier flag-ranker skill can replace the scorer
   later without touching the surface. */

export interface RankedFlag {
  id: string
  client_id: string
  client_name: string
  client_slug: string
  workflow: string
  severity: 'info' | 'amber' | 'red'
  state: string
  title: string
  diagnosis: Record<string, unknown>
  opened_at: string
  task_id: string | null
  score: number
}

const SEVERITY_WEIGHT: Record<string, number> = { red: 100, amber: 40, info: 10 }

export async function rankFlags(db: pg.Client | pg.Pool): Promise<RankedFlag[]> {
  const { rows } = await db.query(
    `SELECT f.id, f.client_id, c.name AS client_name, c.slug AS client_slug,
            f.workflow, f.severity, f.state, f.title, f.diagnosis, f.opened_at, f.task_id,
            c.lifecycle, c.health_score,
            EXTRACT(EPOCH FROM (now() - f.opened_at)) / 3600 AS age_hours
     FROM flags f JOIN clients c ON c.id = f.client_id
     WHERE f.state IN ('open', 'watching')`,
  )
  return rows
    .map((r) => {
      const age = Math.min(Number(r.age_hours), 48)
      let score = (SEVERITY_WEIGHT[r.severity] ?? 0) + age * 0.5
      if (r.lifecycle === 'at_risk') score += 25
      if (r.health_score != null && r.health_score < 60) score += 15
      return { ...r, score: Math.round(score * 10) / 10 }
    })
    .sort((a, b) => b.score - a.score)
    .map(({ lifecycle, health_score, age_hours, ...flag }) => flag as RankedFlag)
}

async function actOnFlag(
  db: pg.Client | pg.Pool,
  flagId: string,
  actor: string,
  state: 'resolved' | 'snoozed',
  why: string,
): Promise<void> {
  const { rows } = await db.query(
    `UPDATE flags SET state = $1::flag_state,
            resolved_at = CASE WHEN $2::text = 'resolved' THEN now() ELSE resolved_at END
     WHERE id = $3 AND state IN ('open', 'watching') RETURNING client_id`,
    [state, state, flagId],
  )
  if (rows.length === 0) throw new Error(`flag ${flagId} not found or not actionable`)
  await db.query(
    `INSERT INTO audit_log (id, workspace_id, actor_type, actor_id, action, target_type, target_id, client_id, why)
     VALUES ($1, $2, 'human', $3, $4, 'flag', $5, $6, $7)`,
    [id('aud'), WORKSPACE_ID, actor, `flag.${state === 'resolved' ? 'resolve' : 'snooze'}`, flagId, rows[0].client_id, why],
  )
}

export const resolveFlag = (db: pg.Client | pg.Pool, flagId: string, actor: string, why: string) =>
  actOnFlag(db, flagId, actor, 'resolved', why)
export const snoozeFlag = (db: pg.Client | pg.Pool, flagId: string, actor: string, why: string) =>
  actOnFlag(db, flagId, actor, 'snoozed', why)

/* ── Today tiles, read from metrics_daily only (§2: never live APIs) ────── */

export interface Tile {
  label: string
  value: string
  unit: string
  delta: string
  deltaTone: 'up' | 'down' | 'down-good' | 'flat'
  spark: number[]
}

async function series(db: pg.Client | pg.Pool, source: string, metric: string, days: number): Promise<number[]> {
  const { rows } = await db.query(
    `SELECT date, sum(value)::float AS v FROM metrics_daily
     WHERE source = $1 AND metric = $2 AND date > current_date - $3::int
     GROUP BY date ORDER BY date`,
    [source, metric, days],
  )
  return rows.map((r) => r.v)
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export async function todayTiles(db: pg.Client | pg.Pool): Promise<Tile[]> {
  const [enquiries, cost, conversions] = await Promise.all([
    series(db, 'forms', 'enquiries', 28),
    series(db, 'ads', 'cost_cents', 28),
    series(db, 'ads', 'conversions', 28),
  ])
  const last7 = (xs: number[]) => sum(xs.slice(-7))
  const prior7 = (xs: number[]) => sum(xs.slice(-14, -7))

  const enqNow = last7(enquiries)
  const enqDelta = enqNow - prior7(enquiries)

  const cpeNow = last7(conversions) > 0 ? last7(cost) / last7(conversions) / 100 : 0
  const cpePrior = prior7(conversions) > 0 ? prior7(cost) / prior7(conversions) / 100 : 0
  const cpeDelta = cpeNow - cpePrior

  const spendNow = last7(cost) / 100
  const spendDelta = spendNow - prior7(cost) / 100

  const { rows: [health] } = await db.query(
    `SELECT round(avg(health_score))::int AS avg,
            count(*) FILTER (WHERE health_score >= 75)::int AS healthy,
            count(*) FILTER (WHERE health_score BETWEEN 60 AND 74)::int AS watch,
            count(*) FILTER (WHERE health_score < 60)::int AS at_risk
     FROM clients WHERE archived_at IS NULL AND health_score IS NOT NULL`,
  )
  const { rows: healthSpark } = await db.query(
    `SELECT date, avg(value)::float AS v FROM metrics_daily
     WHERE metric = 'avg_position' GROUP BY date ORDER BY date`,
  )

  return [
    {
      label: 'New patient enquiries · portfolio (7d)',
      value: String(enqNow), unit: '',
      delta: `${enqDelta >= 0 ? '▲' : '▼'} ${Math.abs(enqDelta)} vs prior week`,
      deltaTone: enqDelta > 0 ? 'up' : enqDelta < 0 ? 'down' : 'flat',
      spark: enquiries,
    },
    {
      label: 'Cost per enquiry · avg (7d)',
      value: `$${cpeNow.toFixed(2)}`, unit: '',
      delta: `${cpeDelta <= 0 ? '▼' : '▲'} $${Math.abs(cpeDelta).toFixed(2)} — cheaper is better`,
      deltaTone: cpeDelta < 0 ? 'down-good' : cpeDelta > 0 ? 'down' : 'flat',
      spark: conversions.length && cost.length ? cost.map((c, i) => (conversions[i] ? c / conversions[i] / 100 : 0)) : [],
    },
    {
      label: 'Ads spend · portfolio (7d)',
      value: `$${Math.round(spendNow).toLocaleString('en-AU')}`, unit: '',
      delta: `${spendDelta >= 0 ? '▲' : '▼'} $${Math.abs(Math.round(spendDelta))} vs prior week`,
      deltaTone: 'flat',
      spark: cost.map((c) => c / 100),
    },
    {
      label: 'Portfolio health',
      value: String(health.avg ?? '—'), unit: '/100',
      delta: `${health.healthy} healthy · ${health.watch} watch · ${health.at_risk} at-risk`,
      deltaTone: health.at_risk > 0 ? 'down' : 'flat',
      spark: healthSpark.map((r) => Number(r.v)),
    },
  ]
}
