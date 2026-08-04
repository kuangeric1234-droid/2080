import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ReviewStatus = 'requested' | 'collecting' | 'draft' | 'in_review' | 'delivered' | 'failed'

export interface ReviewRow {
  id: string
  domain: string
  practice_name: string | null
  contact_name: string | null
  contact_email: string | null
  status: ReviewStatus
  overall_score: number | null
  findings_accepted: number
  findings_candidate: number
  source: string
  requested_at: string
  updated_at: string
}

const STATUS: Record<ReviewStatus, { chip: string; dot: string; label: string }> = {
  requested: { chip: 'bg-blue-tint text-info', dot: 'bg-info', label: 'Requested' },
  collecting: { chip: 'bg-warn-tint text-warn', dot: 'bg-warn', label: 'Collecting' },
  draft: { chip: 'bg-canvas text-ink-muted', dot: 'bg-ink-faint', label: 'Draft' },
  in_review: { chip: 'bg-teal-tint text-teal', dot: 'bg-teal', label: 'In review' },
  delivered: { chip: 'bg-ok-tint text-ok', dot: 'bg-ok', label: 'Delivered' },
  failed: { chip: 'bg-crit-tint text-crit', dot: 'bg-crit', label: 'Failed' },
}

function Tile({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-surface px-4 py-3.5 shadow-card">
      <div className="text-[11.5px] text-ink-muted">{label}</div>
      <div className={cn('num mt-1 font-display text-[26px] font-bold leading-none', tone)}>{value}</div>
    </div>
  )
}

function Stars({ score }: { score: number | null }) {
  if (score == null) return <span className="text-[11px] text-ink-faint">—</span>
  const filled = Math.round(score)
  return (
    <span className="text-[12px] tracking-[1px]" aria-label={`${filled} of 5`}>
      <span className="text-teal">{'★'.repeat(filled)}</span>
      <span className="text-ink-faint">{'★'.repeat(5 - filled)}</span>
    </span>
  )
}

function since(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}

/* Type a URL and audit it. Most reviews start here rather than from an enquiry
   — an existing client, a prospect, a competitor — so this sits above the queue
   rather than behind a menu. */
function AuditUrlBar() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    if (!url.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const json = (await res.json()) as { reviewId?: string; duplicate?: boolean; error?: string }
      if (!res.ok || !json.reviewId) {
        setError(json.error ?? 'Could not start that review.')
        return
      }
      /* An open review of the same site is handed back rather than duplicated;
         go to it, but do not re-crawl what is already collected. */
      navigate(`/review/${json.reviewId}${json.duplicate ? '' : '?collect=1'}`)
    } catch {
      setError('The API is not reachable.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-[14px] border border-line bg-surface px-5 py-4 shadow-card">
      <label htmlFor="audit-url" className="text-[11.5px] font-semibold text-ink">
        Audit a website
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="audit-url"
          type="text"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') void start() }}
          placeholder="heartsdental.com.au"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-[9px] border border-line bg-canvas px-3 py-2 text-[12.8px] text-ink outline-none placeholder:text-ink-faint focus:border-teal"
        />
        <Button onClick={() => void start()} disabled={busy || !url.trim()}>
          {busy ? 'Starting…' : 'Run review'}
        </Button>
      </div>
      <p className="mt-1.5 text-[11.5px] text-ink-muted">
        {error
          ? <span className="font-semibold text-crit">{error}</span>
          : 'No enquiry needed — collection reads the site’s markup, DNS, mail records and certificate. Under a minute.'}
      </p>
    </section>
  )
}

export function ReviewPage() {
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/reviews')
      if (!res.ok) throw new Error()
      setRows(((await res.json()) as { reviews: ReviewRow[] }).reviews)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const waiting = rows.filter((r) => r.status === 'requested' || r.status === 'collecting').length
  const needsMe = rows.filter((r) => r.status === 'draft' || r.status === 'in_review').length
  const delivered = rows.filter((r) => r.status === 'delivered').length

  return (
    <>
      <div className="flex items-end gap-3">
        <h1 className="font-display text-xl font-bold tracking-[-0.4px]">Online Presence Review</h1>
        <span className="pb-0.5 text-[12.5px] text-ink-muted">
          Audit requests in, scored 8-category review out.
        </span>
      </div>

      <AuditUrlBar />

      <div className="grid grid-cols-4 gap-4 max-[900px]:grid-cols-2">
        <Tile label="Awaiting collection" value={waiting} tone={waiting ? 'text-warn' : ''} />
        <Tile label="Needs your review" value={needsMe} tone={needsMe ? 'text-teal' : ''} />
        <Tile label="Delivered" value={delivered} tone="text-ok" />
        <Tile label="Total requests" value={rows.length} />
      </div>

      <section className="rounded-[14px] border border-line bg-surface shadow-card">
        {state === 'loading' && (
          <p className="px-5 py-10 text-center text-[12.3px] text-ink-muted">Loading reviews…</p>
        )}
        {state === 'error' && (
          <p className="px-5 py-10 text-center text-[12.3px] text-ink-muted">
            Reviews unavailable. Start the API with <code className="font-mono">npm run api</code> in{' '}
            <code className="font-mono">server/</code>.
          </p>
        )}
        {state === 'ready' && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <div className="text-[34px] text-ink-faint" aria-hidden>
              ◎
            </div>
            <h2 className="font-display text-[13.5px] font-[650]">No audit requests yet</h2>
            <p className="max-w-[420px] text-[12.3px] text-ink-muted">
              Requests arrive from the free-SEO-audit form on 2080solutions.com. The Jotform webhook
              posts to <code className="font-mono">/hooks/jotform</code> and lands here.
            </p>
          </div>
        )}
        {state === 'ready' && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Domain', 'Requested by', 'Status', 'Score', 'Findings', 'Age', ''].map((h) => (
                    <th
                      key={h}
                      className="border-b border-line px-4 pt-3 pb-2 text-left text-[10px] font-bold tracking-[0.06em] text-ink-faint uppercase whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-grid last:border-b-0">
                    <td className="px-4 py-2.5">
                      <div className="text-[12.5px] font-semibold">{r.domain}</div>
                      {r.practice_name && <div className="text-[11px] text-ink-faint">{r.practice_name}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-[12px]">{r.contact_name ?? '—'}</div>
                      {r.contact_email && <div className="text-[11px] text-ink-faint">{r.contact_email}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-px text-[10.5px] font-semibold',
                          STATUS[r.status].chip,
                        )}
                      >
                        <span className={cn('size-1.5 rounded-full', STATUS[r.status].dot)} />
                        {STATUS[r.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Stars score={r.overall_score} />
                    </td>
                    <td className="num px-4 py-2.5 text-[12px] text-ink-muted">
                      {r.findings_accepted}/{r.findings_candidate}
                    </td>
                    <td className="num px-4 py-2.5 text-[12px] text-ink-muted">{since(r.requested_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={`/review/${r.id}`}
                        className="text-[12px] font-semibold text-teal hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
