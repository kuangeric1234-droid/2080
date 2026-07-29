import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ListClient {
  id: string; slug: string; name: string; lifecycle: string; practice_type: string
  health_score: number | null; languages: string[]; enquiries_30d: number
  ads_cost_cents: number | null; open_flags: number; site_status: string | null
}
interface Detail {
  client: { name: string; slug: string; practice_type: string; lifecycle: string; health_score: number | null; languages: string[]; timezone: string }
  contacts: Array<{ name: string; email: string[]; phone: string[]; role: string | null; is_vip: boolean }>
  timeline: Array<{ type: string; occurred_at: string; title: string; body: string | null; source: string }>
  flags: Array<{ id: string; severity: string; title: string; workflow: string; opened_at: string }>
  tasks: Array<{ id: string; title: string; assignee: string | null; status: string; due_at: string | null; sla_state: string }>
  seo: { id: string; url: string; score: number; grade: string; created_at: string } | null
  site: { url: string; status: string; latency_ms: number | null; ssl_days_left: number | null; form_canary: string; flags: string[] } | null
  kpis: { enquiries: number; ads_cost_cents: number; conversions: number }
  series: number[]
}

const LC: Record<string, string> = {
  operate: 'bg-ok-tint text-ok', build: 'bg-blue-tint text-info', launch: 'bg-blue-tint text-info',
  at_risk: 'bg-crit-tint text-crit', grow: 'bg-teal-tint text-teal', prospect: 'bg-canvas text-ink-muted border border-line',
  onboarding: 'bg-blue-tint text-info', offboard: 'bg-canvas text-ink-muted border border-line',
}
const SEV: Record<string, string> = { red: 'bg-crit', amber: 'bg-warn', info: 'bg-info' }
const SITE: Record<string, string> = { up: 'text-ok', degraded: 'text-warn', down: 'text-crit' }
const healthTone = (h: number | null) => (h == null ? 'text-ink-faint' : h >= 80 ? 'text-ok' : h >= 40 ? 'text-warn' : 'text-crit')
const costPer = (cents: number | null, enq: number) => (cents && enq ? `$${(cents / 100 / enq).toFixed(0)}` : '—')

export function ClientsPage() {
  const [list, setList] = useState<ListClient[]>([])
  const [detail, setDetail] = useState<Detail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/clients')
      if (!res.ok) throw new Error()
      setList(((await res.json()) as { clients: ListClient[] }).clients)
      setState('ready')
    } catch { setState('error') }
  }, [])
  useEffect(() => { void load() }, [load])

  const open = async (slug: string) => {
    const res = await fetch(`/api/clients/${slug}`)
    if (res.ok) setDetail((await res.json()) as Detail)
  }

  if (detail) return <ClientDetail d={detail} onBack={() => setDetail(null)} />

  return (
    <>
      <div className="flex items-end gap-3">
        <h1 className="font-display text-xl font-bold tracking-[-0.4px]">Clients</h1>
        <span className="pb-0.5 text-[12.5px] text-ink-muted">The portfolio — one record per practice, worst health first.</span>
      </div>
      <section className="rounded-[14px] border border-line bg-surface shadow-card">
        {state === 'error' && <p className="px-5 py-10 text-center text-[12.3px] text-ink-muted">Clients unavailable. Start the API (<code className="font-mono">npm run api</code>).</p>}
        {state === 'ready' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>
                {['Practice', 'Lifecycle', 'Health', 'Enquiries 30d', 'Cost / enq', 'Site', 'Flags'].map((h) => (
                  <th key={h} className="border-b border-line px-4 pb-2 pt-3 text-left text-[10px] font-bold tracking-[0.06em] text-ink-faint uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="cursor-pointer border-b border-grid last:border-b-0 hover:bg-canvas" onClick={() => void open(c.slug)}>
                    <td className="px-4 py-2.5"><div className="text-[12.5px] font-semibold">{c.name}</div><div className="text-[11px] text-ink-faint capitalize">{c.practice_type}{c.languages.includes('zh') ? ' · EN/中文' : ''}</div></td>
                    <td className="px-4 py-2.5"><span className={cn('rounded-full px-2 py-px text-[10.5px] font-semibold capitalize', LC[c.lifecycle] ?? 'bg-canvas text-ink-muted')}>{c.lifecycle.replace('_', '-')}</span></td>
                    <td className={cn('num px-4 py-2.5 font-display text-[15px] font-bold', healthTone(c.health_score))}>{c.health_score ?? '—'}</td>
                    <td className="num px-4 py-2.5 text-[12.5px]">{c.enquiries_30d}</td>
                    <td className="num px-4 py-2.5 text-[12.5px] text-ink-muted">{costPer(c.ads_cost_cents, c.enquiries_30d)}</td>
                    <td className="px-4 py-2.5 text-[12px]">{c.site_status ? <span className={cn('font-semibold capitalize', SITE[c.site_status] ?? 'text-ink-muted')}>{c.site_status}</span> : <span className="text-ink-faint">—</span>}</td>
                    <td className="px-4 py-2.5">{c.open_flags > 0 ? <span className="rounded-full bg-warn-tint px-2 py-px text-[10.5px] font-semibold text-warn">{c.open_flags}</span> : <span className="text-[11px] text-ink-faint">—</span>}</td>
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

function ClientDetail({ d, onBack }: { d: Detail; onBack: () => void }) {
  const c = d.client
  const roi = d.kpis.ads_cost_cents ? (d.kpis.enquiries * 25000 / d.kpis.ads_cost_cents).toFixed(1) : '—' // demo: $250 avg patient value
  return (
    <>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>← Portfolio</Button>
        <h1 className="font-display text-xl font-bold tracking-[-0.4px]">{c.name}</h1>
        <span className={cn('rounded-full px-2 py-px text-[10.5px] font-semibold capitalize', LC[c.lifecycle] ?? 'bg-canvas text-ink-muted')}>{c.lifecycle.replace('_', '-')}</span>
        <span className="text-[12px] text-ink-muted capitalize">{c.practice_type}{c.languages.includes('zh') ? ' · EN / 中文' : ''}</span>
        <span className="ml-auto text-right"><span className={cn('font-display text-[26px] font-bold', healthTone(c.health_score))}>{c.health_score ?? '—'}</span><span className="text-[11px] text-ink-faint"> health</span></span>
      </div>

      <div className="grid grid-cols-4 gap-4 max-[900px]:grid-cols-2">
        <Tile label="Enquiries · 30d" value={d.kpis.enquiries} />
        <Tile label="Cost / enquiry" value={costPer(d.kpis.ads_cost_cents, d.kpis.enquiries)} />
        <Tile label="Ad spend · 30d" value={`$${Math.round((d.kpis.ads_cost_cents ?? 0) / 100).toLocaleString()}`} />
        <Tile label="Return per $1" value={roi === '—' ? '—' : `$${roi}`} />
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] items-start gap-4 max-[1100px]:grid-cols-1">
        <div className="flex flex-col gap-4">
          <Panel title="Recent activity">
            {d.timeline.length === 0 ? <Empty /> : (
              <ul className="flex flex-col">
                {d.timeline.map((t, i) => (
                  <li key={i} className="flex gap-2.5 border-b border-grid py-2 last:border-b-0">
                    <span className="mt-px rounded-[5px] border border-line bg-canvas px-1.5 font-mono text-[9.5px] text-ink-muted">{t.type}</span>
                    <div className="min-w-0 flex-1"><div className="text-[12.5px]">{t.title}</div>{t.body && <div className="truncate text-[11px] text-ink-faint">{t.body}</div>}</div>
                    <span className="num shrink-0 text-[10.5px] text-ink-faint">{new Date(t.occurred_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={`Open flags (${d.flags.length})`}>
            {d.flags.length === 0 ? <Empty label="No open flags." /> : d.flags.map((f) => (
              <div key={f.id} className="flex items-center gap-2.5 border-b border-grid py-2 last:border-b-0">
                <span className={cn('size-2 rounded-full', SEV[f.severity] ?? 'bg-ink-faint')} />
                <span className="flex-1 text-[12.5px]">{f.title}</span>
                <span className="rounded-full bg-canvas px-1.5 text-[10px] text-ink-muted border border-line">{f.workflow}</span>
              </div>
            ))}
          </Panel>
        </div>
        <div className="flex flex-col gap-4">
          <Panel title="Contacts">
            {d.contacts.map((ct, i) => (
              <div key={i} className="border-b border-grid py-2 last:border-b-0">
                <div className="flex items-center gap-2 text-[12.5px] font-semibold">{ct.name}{ct.is_vip && <span className="rounded-full bg-warn-tint px-1.5 text-[9.5px] font-bold text-warn">VIP</span>}</div>
                <div className="text-[11px] text-ink-faint">{ct.role ?? 'contact'}{ct.email[0] ? ` · ${ct.email[0]}` : ''}</div>
              </div>
            ))}
          </Panel>
          <Panel title="Site & SEO">
            {d.site ? (
              <div className="flex items-center justify-between border-b border-grid py-2 text-[12px]">
                <span>Site status</span>
                <span className={cn('font-semibold capitalize', SITE[d.site.status] ?? 'text-ink-muted')}>{d.site.status}{d.site.ssl_days_left != null ? ` · SSL ${d.site.ssl_days_left}d` : ''}</span>
              </div>
            ) : <div className="py-2 text-[11px] text-ink-faint">No site monitored.</div>}
            {d.seo ? (
              <div className="flex items-center justify-between py-2 text-[12px]">
                <span className="truncate">SEO audit</span>
                <span className="font-semibold"><span className={d.seo.score >= 80 ? 'text-ok' : d.seo.score >= 55 ? 'text-warn' : 'text-crit'}>{d.seo.score}</span> <span className="text-ink-faint">/100 ({d.seo.grade})</span></span>
              </div>
            ) : <div className="py-2 text-[11px] text-ink-faint">No SEO audit yet.</div>}
          </Panel>
        </div>
      </div>
    </>
  )
}

const Tile = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-[14px] border border-line bg-surface px-4 py-3.5 shadow-card">
    <div className="text-[11.5px] text-ink-muted">{label}</div>
    <div className="num mt-1 font-display text-[24px] font-bold leading-none">{value}</div>
  </div>
)
const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-[14px] border border-line bg-surface p-[17px] shadow-card">
    <h2 className="mb-2 font-display text-[13.5px] font-[650]">{title}</h2>
    {children}
  </section>
)
const Empty = ({ label = 'Nothing yet.' }: { label?: string }) => <p className="py-2 text-[11px] text-ink-faint">{label}</p>
