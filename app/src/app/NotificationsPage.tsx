import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Severity = 'red' | 'amber' | 'info'

interface Notification {
  id: string
  event_class: string
  severity: Severity
  title: string
  body: string | null
  count: number
  channels_sent: string[]
  read_at: string | null
  escalated_at: string | null
  created_at: string
  client_name: string | null
}

interface UserPref {
  id: string
  name: string
  role: string
  quiet_start: number
  quiet_end: number
  muted_classes: string[]
}

interface Routing {
  matrix: Record<string, Record<Severity, string[]>>
  users: UserPref[]
  digests: string[]
}

type Data = { feed: Notification[]; unread: number; routing: Routing }
type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: Data }

const SEV_TONE: Record<Severity, string> = {
  red: 'bg-crit-tint text-crit',
  amber: 'bg-warn-tint text-warn',
  info: 'bg-info-tint text-info',
}
const SEV_STRIPE: Record<Severity, string> = { red: 'bg-crit', amber: 'bg-warn', info: 'bg-info' }
const CLASS_LABEL: Record<string, string> = {
  receptionist: 'Receptionist', gate: 'Gate', monitor: 'Monitor', sales: 'Sales', client_activity: 'Client',
}
/* No auth yet (SPEC-SECURITY): the demo acts as a chosen agency user. */
const ACTOR: Record<string, string> = { usr_wally: 'WC', usr_hamza: 'HK', usr_ish: 'IS', usr_qing: 'QG' }

function Chip({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span className={cn('rounded-full px-2 py-px text-[10.5px] font-semibold', tone ?? 'bg-canvas text-ink-muted border border-line')}>
      {children}
    </span>
  )
}

export function NotificationsPage() {
  const [user, setUser] = useState('usr_wally')
  const [state, setState] = useState<State>({ kind: 'loading' })

  const load = useCallback(async (u: string) => {
    try {
      const [feedRes, routingRes] = await Promise.all([
        fetch(`/api/notifications?user=${u}`), fetch('/api/notifications/routing'),
      ])
      if (!feedRes.ok || !routingRes.ok) throw new Error(`API responded ${feedRes.status}/${routingRes.status}`)
      const { notifications, unread } = (await feedRes.json()) as { notifications: Notification[]; unread: number }
      const routing = (await routingRes.json()) as Routing
      setState({ kind: 'ready', data: { feed: notifications, unread, routing } })
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message })
    }
  }, [])

  useEffect(() => { void load(user) }, [user, load])

  const acknowledge = async (id: string) => {
    await fetch(`/api/notifications/${id}/ack`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: ACTOR[user] ?? 'WC' }),
    })
    await load(user)
  }

  return (
    <>
      <div className="flex items-end gap-3">
        <h1 className="font-display text-xl font-bold tracking-[-0.4px]">Notifications</h1>
        <span className="pb-0.5 text-[12.5px] text-ink-muted">
          Routed to you by severity and your quiet hours — red always breaks through.
        </span>
      </div>

      {state.kind === 'error' && (
        <section className="rounded-[14px] border border-line bg-surface px-6 py-10 text-center shadow-card">
          <h2 className="font-display text-[13.5px] font-[650] text-crit">Notifications unavailable</h2>
          <p className="mt-1 text-[12.3px] text-ink-muted">
            {state.message}. Start the API with <code className="font-mono">npm run api</code> in{' '}
            <code className="font-mono">server/</code>.
          </p>
        </section>
      )}

      {state.kind !== 'error' && (
        <div className="grid grid-cols-[1.4fr_1fr] items-start gap-4 max-[1100px]:grid-cols-1">
          {/* Feed */}
          <section className="rounded-[14px] border border-line bg-surface shadow-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
              {state.kind === 'ready' ? (
                <>
                  {state.data.routing.users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setUser(u.id)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold',
                        u.id === user ? 'border-teal bg-teal-tint text-teal' : 'border-line bg-surface text-ink-muted',
                      )}
                    >
                      {u.name}
                    </button>
                  ))}
                  <span className="num ml-auto text-[11px] text-ink-faint">{state.data.unread} unread</span>
                </>
              ) : (
                <span className="text-[12px] text-ink-muted">Loading…</span>
              )}
            </div>

            {state.kind === 'ready' && state.data.feed.length === 0 && (
              <p className="px-5 py-10 text-center text-[12.3px] text-ink-muted">Nothing for this person right now.</p>
            )}

            {state.kind === 'ready' && (
              <ul className="flex flex-col">
                {state.data.feed.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      'relative flex gap-3 border-b border-grid px-5 py-3 pl-6 last:border-b-0',
                      n.read_at && 'opacity-55',
                    )}
                  >
                    <span className={cn('absolute top-3 bottom-3 left-0 w-[3px] rounded-r', SEV_STRIPE[n.severity])} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip tone={SEV_TONE[n.severity]}>{CLASS_LABEL[n.event_class] ?? n.event_class}</Chip>
                        <span className="text-[12.8px] font-[650]">{n.title}</span>
                        {n.count > 1 && <Chip>×{n.count}</Chip>}
                        {n.escalated_at && <Chip tone="bg-crit-tint text-crit">escalated</Chip>}
                        <span className="num ml-auto text-[10.5px] whitespace-nowrap text-ink-faint">
                          {new Date(n.created_at).toLocaleString('en-AU', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
                          })}
                        </span>
                      </div>
                      {n.body && <p className="mt-1 text-[12px] text-ink-muted">{n.body}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {n.client_name && <span className="text-[11px] text-ink-faint">{n.client_name}</span>}
                        {n.channels_sent.map((c) => (
                          <code key={c} className="rounded-[5px] border border-line bg-canvas px-1.5 font-mono text-[10px] text-ink-muted">
                            {c}
                          </code>
                        ))}
                        {!n.read_at && (
                          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void acknowledge(n.id)}>
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Routing / digests */}
          {state.kind === 'ready' && (
            <div className="flex flex-col gap-4">
              <section className="rounded-[14px] border border-line bg-surface p-[17px] shadow-card">
                <h2 className="mb-3 font-display text-[13.5px] font-[650]">Routing matrix</h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {['Event class', 'Red', 'Amber', 'Info'].map((h) => (
                          <th key={h} className="border-b border-line px-2.5 pb-2 text-left text-[10px] font-bold tracking-[0.06em] text-ink-faint uppercase">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(state.data.routing.matrix).map(([cls, sev]) => (
                        <tr key={cls} className="border-b border-grid last:border-b-0">
                          <td className="px-2.5 py-2 text-[12px] font-semibold">{CLASS_LABEL[cls] ?? cls}</td>
                          {(['red', 'amber', 'info'] as Severity[]).map((s) => (
                            <td key={s} className="px-2.5 py-2">
                              <div className="flex flex-wrap gap-1">
                                {sev[s].length === 0
                                  ? <span className="text-[11px] text-ink-faint">—</span>
                                  : sev[s].map((ch) => (
                                    <code key={ch} className="rounded-[5px] border border-line bg-canvas px-1 font-mono text-[9.5px] text-ink-muted">
                                      {ch}
                                    </code>
                                  ))}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2.5 text-[11px] text-ink-faint">
                  Digests: {state.data.routing.digests.join(' · ')}. Client-facing messages are skill outputs through gates, not this system.
                </p>
              </section>

              <section className="rounded-[14px] border border-line bg-surface p-[17px] shadow-card">
                <h2 className="mb-3 font-display text-[13.5px] font-[650]">Per-user routing</h2>
                <table className="w-full border-collapse">
                  <tbody>
                    {state.data.routing.users.map((u) => (
                      <tr key={u.id} className="border-b border-grid last:border-b-0">
                        <td className="py-2 text-[12px] font-semibold">{u.name}</td>
                        <td className="num py-2 text-[11.5px] text-ink-muted">
                          quiet {String(u.quiet_start).padStart(2, '0')}:00–{String(u.quiet_end).padStart(2, '0')}:00
                        </td>
                        <td className="py-2 text-right text-[11px] text-ink-faint">
                          {u.muted_classes.length ? `muted: ${u.muted_classes.join(', ')}` : 'all classes on'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}
        </div>
      )}
    </>
  )
}
