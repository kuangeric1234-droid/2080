import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AuditEntry {
  id: string
  at: string
  actor_type: 'human' | 'skill' | 'system'
  actor_id: string
  action: string
  target_type: string | null
  target_id: string | null
  why: string
  rollback_of: string | null
  client_slug: string | null
  client_name: string | null
}

interface ClientRow {
  slug: string
  name: string
}

interface Filters {
  client: string
  actor: string
  action: string
}

type Data = { entries: AuditEntry[]; actors: string[]; actions: string[]; clients: ClientRow[] }
type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: Data }

const ACTOR_TONE: Record<AuditEntry['actor_type'], string> = {
  human: 'bg-info-tint text-info',
  skill: 'bg-teal-tint text-teal',
  system: 'bg-canvas text-ink-muted border border-line',
}

const EMPTY: Filters = { client: '', actor: '', action: '' }

function Select({
  value, onChange, options, allLabel, label,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  allLabel: string
  label: string
}) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink outline-none"
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function AuditPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [state, setState] = useState<State>({ kind: 'loading' })

  const load = useCallback(async (f: Filters) => {
    try {
      const params = new URLSearchParams()
      if (f.client) params.set('client', f.client)
      if (f.actor) params.set('actor', f.actor)
      if (f.action) params.set('action', f.action)
      const [auditRes, clientsRes] = await Promise.all([
        fetch(`/api/audit?${params}`), fetch('/api/clients'),
      ])
      if (!auditRes.ok || !clientsRes.ok) throw new Error(`API responded ${auditRes.status}/${clientsRes.status}`)
      const { entries, actors, actions } = (await auditRes.json()) as Omit<Data, 'clients'>
      const { clients } = (await clientsRes.json()) as { clients: ClientRow[] }
      setState({ kind: 'ready', data: { entries, actors, actions, clients } })
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message })
    }
  }, [])

  useEffect(() => {
    void load(filters)
  }, [filters, load])

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))
  const filtering = filters.client || filters.actor || filters.action

  return (
    <>
      <div className="flex items-end gap-3">
        <h1 className="font-display text-xl font-bold tracking-[-0.4px]">Audit Log</h1>
        <span className="pb-0.5 text-[12.5px] text-ink-muted">
          Who did what, why — append-only, enforced by the database.
        </span>
      </div>

      {state.kind === 'error' && (
        <section className="rounded-[14px] border border-line bg-surface px-6 py-10 text-center shadow-card">
          <h2 className="font-display text-[13.5px] font-[650] text-crit">Audit log unavailable</h2>
          <p className="mt-1 text-[12.3px] text-ink-muted">
            {state.message}. Start the API with <code className="font-mono">npm run api</code> in{' '}
            <code className="font-mono">server/</code>.
          </p>
        </section>
      )}

      {state.kind !== 'error' && (
        <section className="rounded-[14px] border border-line bg-surface shadow-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
            {state.kind === 'ready' ? (
              <>
                <Select
                  label="Filter by client" allLabel="All clients" value={filters.client}
                  onChange={(v) => set({ client: v })}
                  options={state.data.clients.map((c) => ({ value: c.slug, label: c.name }))}
                />
                <Select
                  label="Filter by actor" allLabel="All actors" value={filters.actor}
                  onChange={(v) => set({ actor: v })}
                  options={state.data.actors.map((a) => ({ value: a, label: a }))}
                />
                <Select
                  label="Filter by action" allLabel="All actions" value={filters.action}
                  onChange={(v) => set({ action: v })}
                  options={state.data.actions.map((a) => ({ value: a, label: a }))}
                />
                {filtering && (
                  <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY)}>Clear filters</Button>
                )}
                <span className="num ml-auto text-[11px] text-ink-faint">
                  {state.data.entries.length} entr{state.data.entries.length === 1 ? 'y' : 'ies'}
                  {state.data.entries.length === 200 ? ' (showing latest 200)' : ''}
                </span>
              </>
            ) : (
              <span className="text-[12px] text-ink-muted">Loading…</span>
            )}
          </div>

          {state.kind === 'ready' && state.data.entries.length === 0 && (
            <p className="px-5 py-10 text-center text-[12.3px] text-ink-muted">
              Nothing matches these filters.
            </p>
          )}

          {state.kind === 'ready' && state.data.entries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['When', 'Actor', 'Action', 'Client', 'Why'].map((h) => (
                      <th
                        key={h}
                        className="border-b border-line px-4 pb-2 pt-3 text-left text-[10px] font-bold tracking-[0.06em] text-ink-faint uppercase whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.data.entries.map((e) => (
                    <tr key={e.id} className="border-b border-grid last:border-b-0">
                      <td className="num px-4 py-2.5 text-[11.5px] whitespace-nowrap text-ink-muted">
                        {new Date(e.at).toLocaleString('en-AU', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
                        })}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={cn('rounded-full px-2 py-px text-[10.5px] font-bold', ACTOR_TONE[e.actor_type])}>
                          {e.actor_id}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <code className="rounded-[5px] border border-line bg-canvas px-1.5 font-mono text-[10.5px] text-ink">
                          {e.action}
                        </code>
                        {e.rollback_of && (
                          <span className="ml-1.5 rounded-full bg-warn-tint px-1.5 text-[10px] font-bold text-warn">
                            rollback
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] whitespace-nowrap">{e.client_name ?? '—'}</td>
                      <td className="max-w-[420px] px-4 py-2.5 text-[12px] text-ink-muted">{e.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  )
}
