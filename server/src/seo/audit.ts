import pg from 'pg'
import { monotonicFactory } from 'ulid'
import { analyze, type AuditReport } from './analyze.ts'

const ulid = monotonicFactory()
const id = (p: string) => `${p}_${ulid()}`

export function normalizeUrl(u: string): string {
  const s = u.trim()
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

function fetchFailureReport(url: string, reason: string): AuditReport {
  return {
    score: 0,
    grade: 'F',
    categories: [{
      key: 'fetch', label: 'Fetch', score: 0, max: 100,
      findings: [{ id: 'fetch', severity: 'critical', title: 'Could not load the page', detail: `${url} did not respond: ${reason}. Check the URL is public and online.` }],
    }],
    stats: { error: reason, status: 0, finalUrl: url },
  }
}

/** Fetch a URL, analyse the real HTML, persist the report, return it. */
export async function runAudit(
  db: pg.Client | pg.Pool,
  opts: { url: string; clientId?: string | null; requestedBy?: string | null },
) {
  const url = normalizeUrl(opts.url)
  let report: AuditReport
  let finalUrl = url
  let status = 0
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; 20-80-SEO-Auditor/1.0; +https://2080solutions.com.au)' },
      signal: AbortSignal.timeout(12_000),
    })
    status = res.status
    finalUrl = res.url || url
    const html = await res.text()
    report = analyze(url, html, { status, finalUrl, https: finalUrl.startsWith('https') })
  } catch (err) {
    report = fetchFailureReport(url, (err as Error).message)
  }

  const { rows: [ws] } = await db.query(`SELECT id FROM workspaces LIMIT 1`)
  const aid = id('seo')
  const createdAt = new Date()
  await db.query(
    `INSERT INTO seo_audits (id, workspace_id, client_id, url, final_url, status, score, grade, report, requested_by, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [aid, ws.id, opts.clientId ?? null, url, finalUrl, status, report.score, report.grade, JSON.stringify(report), opts.requestedBy ?? null, createdAt],
  )
  if (opts.requestedBy) {
    await db.query(
      `INSERT INTO audit_log (id, workspace_id, actor_type, actor_id, action, target_type, target_id, client_id, why)
       VALUES ($1,$2,'human',$3,'seo.audit','seo_audit',$4,$5,$6)`,
      [id('aud'), ws.id, opts.requestedBy, aid, opts.clientId ?? null, `Audited ${finalUrl} — scored ${report.score}/100 (${report.grade})`],
    )
  }
  return { id: aid, url, finalUrl, status, score: report.score, grade: report.grade, report, createdAt: createdAt.toISOString() }
}
