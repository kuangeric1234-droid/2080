import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Severity = 'critical' | 'warning' | 'good'
interface Finding { id: string; severity: Severity; title: string; detail: string }
interface Category { key: string; label: string; score: number; max: number; findings: Finding[] }
interface Report { score: number; grade: string; categories: Category[]; stats: Record<string, string | number | boolean | null> }
interface Audit { id: string; url: string; finalUrl?: string; final_url?: string; score: number; grade: string; report: Report; createdAt?: string; created_at?: string; client_name?: string | null }
interface ListItem { id: string; url: string; score: number; grade: string; created_at: string; client_name: string | null; requested_by: string | null }

const SEV: Record<Severity, { dot: string; chip: string }> = {
  critical: { dot: 'bg-crit', chip: 'bg-crit-tint text-crit' },
  warning: { dot: 'bg-warn', chip: 'bg-warn-tint text-warn' },
  good: { dot: 'bg-ok', chip: 'bg-ok-tint text-ok' },
}
const tone = (s: number) => (s >= 80 ? 'text-ok' : s >= 55 ? 'text-warn' : 'text-crit')
const barTone = (s: number, max: number) => (s / max >= 0.8 ? 'bg-ok' : s / max >= 0.55 ? 'bg-warn' : 'bg-crit')

export function SeoPage() {
  const [url, setUrl] = useState('')
  const [list, setList] = useState<ListItem[]>([])
  const [current, setCurrent] = useState<Audit | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadList = useCallback(async () => {
    try {
      const res = await fetch('/api/seo/audits')
      if (res.ok) setList(((await res.json()) as { audits: ListItem[] }).audits)
    } catch { /* API down — the run button surfaces it */ }
  }, [])
  useEffect(() => { void loadList() }, [loadList])

  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/seo/audit', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }),
      })
      if (!res.ok) { setError(((await res.json()) as { error?: string }).error ?? `Analysis failed (${res.status}).`); return }
      setCurrent((await res.json()) as Audit)
      await loadList()
    } catch { setError('Can’t reach the API — start it with npm run api in server/.') }
    finally { setBusy(false) }
  }

  const open = async (id: string) => {
    setError('')
    const res = await fetch(`/api/seo/audit/${id}`)
    if (res.ok) setCurrent((await res.json()) as Audit)
  }

  const report = current?.report
  const counts = report ? tally(report) : null

  return (
    <>
      <div className="flex items-end gap-3">
        <h1 className="font-display text-xl font-bold tracking-[-0.4px]">SEO Watchtower</h1>
        <span className="pb-0.5 text-[12.5px] text-ink-muted">Analyse any website’s on-page &amp; technical SEO — real crawl, scored report.</span>
      </div>

      <form onSubmit={run} className="flex flex-wrap items-center gap-2 rounded-[14px] border border-line bg-surface p-3 shadow-card">
        <span className="pl-2 text-[12px] font-semibold text-ink-muted">Analyse a website</span>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="heartsdental.com.au"
          aria-label="Website URL"
          className="min-w-[240px] flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none focus:border-teal"
        />
        <Button type="submit" disabled={busy}>{busy ? 'Analysing…' : 'Analyse'}</Button>
      </form>
      {error && <p className="text-[12.5px] text-crit">{error}</p>}

      <div className="grid grid-cols-[1.6fr_1fr] items-start gap-4 max-[1100px]:grid-cols-1">
        {/* Report */}
        <section className="rounded-[14px] border border-line bg-surface shadow-card">
          {!report && (
            <p className="px-5 py-14 text-center text-[12.5px] text-ink-muted">
              Enter a website above and hit <b>Analyse</b> — or pick a past audit on the right.
            </p>
          )}
          {report && current && (
            <div className="p-5">
              <div className="flex items-center gap-5 border-b border-line pb-4">
                <div className="text-center">
                  <div className={cn('font-display text-[44px] leading-none font-bold', tone(report.score))}>{report.score}</div>
                  <div className="text-[11px] text-ink-faint">/ 100 · grade {report.grade}</div>
                </div>
                <div className="min-w-0">
                  <div className="truncate font-display text-[15px] font-[650]">{current.finalUrl ?? current.final_url ?? current.url}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {counts!.critical > 0 && <span className={cn('rounded-full px-2 py-px text-[10.5px] font-semibold', SEV.critical.chip)}>{counts!.critical} critical</span>}
                    {counts!.warning > 0 && <span className={cn('rounded-full px-2 py-px text-[10.5px] font-semibold', SEV.warning.chip)}>{counts!.warning} to improve</span>}
                    <span className={cn('rounded-full px-2 py-px text-[10.5px] font-semibold', SEV.good.chip)}>{counts!.good} passing</span>
                    {current.client_name && <span className="rounded-full border border-line bg-canvas px-2 py-px text-[10.5px] text-ink-muted">{current.client_name}</span>}
                  </div>
                </div>
              </div>

              {report.categories.map((cat) => (
                <div key={cat.key} className="border-b border-grid py-3.5 last:border-b-0">
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className="text-[12.5px] font-[650]">{cat.label}</div>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-canvas">
                      <div className={cn('h-full rounded-full', barTone(cat.score, cat.max))} style={{ width: `${(cat.score / cat.max) * 100}%` }} />
                    </div>
                    <span className="num text-[11px] text-ink-faint">{cat.score}/{cat.max}</span>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {cat.findings.map((f) => (
                      <li key={f.id} className="flex gap-2.5">
                        <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', SEV[f.severity].dot)} />
                        <div className="min-w-0">
                          <span className="text-[12.5px] font-semibold">{f.title}</span>
                          <span className="ml-1.5 text-[12px] text-ink-muted">{f.detail}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent audits */}
        <section className="rounded-[14px] border border-line bg-surface p-[17px] shadow-card">
          <h2 className="mb-3 font-display text-[13.5px] font-[650]">Recent audits</h2>
          {list.length === 0 && <p className="text-[12px] text-ink-muted">No audits yet.</p>}
          <ul className="flex flex-col">
            {list.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => void open(a.id)}
                  className={cn('flex w-full items-center gap-3 border-b border-grid py-2.5 text-left last:border-b-0 hover:bg-canvas',
                    current?.id === a.id && 'bg-teal-tint')}
                >
                  <span className={cn('num w-9 shrink-0 text-center font-display text-[17px] font-bold', tone(a.score))}>{a.score}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold">{a.url.replace(/^https?:\/\//, '')}</span>
                    <span className="block text-[11px] text-ink-faint">
                      {a.client_name ? `${a.client_name} · ` : ''}{new Date(a.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      {a.requested_by ? ` · ${a.requested_by}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full border border-line px-1.5 text-[10.5px] font-bold text-ink-muted">{a.grade}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

function tally(r: Report): Record<Severity, number> {
  const t = { critical: 0, warning: 0, good: 0 }
  for (const c of r.categories) for (const f of c.findings) t[f.severity]++
  return t
}
