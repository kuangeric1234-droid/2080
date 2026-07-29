import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Site {
  id: string
  url: string
  status: 'up' | 'degraded' | 'down' | 'unknown'
  http_status: number | null
  latency_ms: number | null
  ssl_days_left: number | null
  form_canary: 'ok' | 'fail' | 'unknown'
  flags: string[]
  checked_at: string | null
  client_name: string | null
}

const STATUS: Record<Site['status'], { dot: string; chip: string; label: string }> = {
  up: { dot: 'bg-ok', chip: 'bg-ok-tint text-ok', label: 'Up' },
  degraded: { dot: 'bg-warn', chip: 'bg-warn-tint text-warn', label: 'Degraded' },
  down: { dot: 'bg-crit', chip: 'bg-crit-tint text-crit', label: 'Down' },
  unknown: { dot: 'bg-ink-faint', chip: 'bg-canvas text-ink-muted', label: 'Unknown' },
}
const FLAG_LABEL: Record<string, string> = {
  unreachable: 'unreachable', http_5xx: 'server error', http_4xx: 'client error', slow: 'slow',
  ssl_expired: 'SSL expired', ssl_expiring: 'SSL expiring', ssl_soon: 'SSL <30d', form_canary_fail: 'form broken',
}

function Tile({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-surface px-4 py-3.5 shadow-card">
      <div className="text-[11.5px] text-ink-muted">{label}</div>
      <div className={cn('num mt-1 font-display text-[26px] font-bold leading-none', tone)}>{value}</div>
    </div>
  )
}

export function SiteHealthPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [checking, setChecking] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/site-health')
      if (!res.ok) throw new Error()
      setSites(((await res.json()) as { sites: Site[] }).sites)
      setState('ready')
    } catch { setState('error') }
  }, [])
  useEffect(() => { void load() }, [load])

  const recheck = async (id: string) => {
    setChecking(id)
    try { await fetch(`/api/site-health/${id}/check`, { method: 'POST' }); await load() }
    finally { setChecking(null) }
  }

  const n = (s: Site['status']) => sites.filter((x) => x.status === s).length
  const sslSoon = sites.filter((s) => s.ssl_days_left != null && s.ssl_days_left < 30).length
  const canaryFails = sites.filter((s) => s.form_canary === 'fail').length

  return (
    <>
      <div className="flex items-end gap-3">
        <h1 className="font-display text-xl font-bold tracking-[-0.4px]">Site Health</h1>
        <span className="pb-0.5 text-[12.5px] text-ink-muted">Uptime, latency, SSL expiry and form canaries — a broken site is a lost patient.</span>
      </div>

      <div className="grid grid-cols-4 gap-4 max-[900px]:grid-cols-2">
        <Tile label="Sites up" value={`${n('up')}/${sites.length}`} tone="text-ok" />
        <Tile label="Down / degraded" value={n('down') + n('degraded')} tone={n('down') ? 'text-crit' : n('degraded') ? 'text-warn' : ''} />
        <Tile label="SSL expiring < 30d" value={sslSoon} tone={sslSoon ? 'text-warn' : ''} />
        <Tile label="Form-canary fails" value={canaryFails} tone={canaryFails ? 'text-crit' : ''} />
      </div>

      <section className="rounded-[14px] border border-line bg-surface shadow-card">
        {state === 'error' && (
          <p className="px-5 py-10 text-center text-[12.3px] text-ink-muted">
            Site Health unavailable. Start the API with <code className="font-mono">npm run api</code> in <code className="font-mono">server/</code>.
          </p>
        )}
        {state === 'ready' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Site', 'Status', 'Latency', 'SSL', 'Form canary', 'Flags', ''].map((h) => (
                    <th key={h} className="border-b border-line px-4 pb-2 pt-3 text-left text-[10px] font-bold tracking-[0.06em] text-ink-faint uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id} className="border-b border-grid last:border-b-0">
                    <td className="px-4 py-2.5">
                      <div className="text-[12.5px] font-semibold">{s.url.replace(/^https?:\/\//, '')}</div>
                      {s.client_name && <div className="text-[11px] text-ink-faint">{s.client_name}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-px text-[10.5px] font-semibold', STATUS[s.status].chip)}>
                        <span className={cn('size-1.5 rounded-full', STATUS[s.status].dot)} />{STATUS[s.status].label}
                      </span>
                    </td>
                    <td className="num px-4 py-2.5 text-[12px] text-ink-muted">{s.latency_ms != null ? `${s.latency_ms} ms` : '—'}</td>
                    <td className="num px-4 py-2.5 text-[12px]">
                      {s.ssl_days_left == null ? <span className="text-ink-faint">—</span>
                        : <span className={s.ssl_days_left < 14 ? 'font-semibold text-crit' : s.ssl_days_left < 30 ? 'font-semibold text-warn' : 'text-ink-muted'}>{s.ssl_days_left}d</span>}
                    </td>
                    <td className="px-4 py-2.5 text-[12px]">
                      <span className={s.form_canary === 'fail' ? 'font-semibold text-crit' : s.form_canary === 'ok' ? 'text-ok' : 'text-ink-faint'}>{s.form_canary}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {s.flags.length === 0 ? <span className="text-[11px] text-ink-faint">—</span>
                          : s.flags.map((f) => <span key={f} className="rounded-full bg-canvas px-1.5 text-[10px] text-ink-muted border border-line">{FLAG_LABEL[f] ?? f}</span>)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="ghost" onClick={() => void recheck(s.id)} disabled={checking === s.id}>
                        {checking === s.id ? 'Checking…' : 'Re-check'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-[11px] text-ink-faint">Uptime + SSL are live probes. Form-canary is a stored signal — it goes live when CMS forms exist to POST a test lead through (Stage 5).</p>
    </>
  )
}
