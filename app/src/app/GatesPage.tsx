import { useCallback, useEffect, useState } from 'react'
import { GateCard, type GateItem } from '@/components/GateCard'

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: GateItem[] }

/* Dev preview of the approval queue — the production surface is the Today
   tab (§13 step 1.6), which reuses GateCard. */
export function GatesPage() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/gate-items?state=pending')
      if (!res.ok) throw new Error(`API responded ${res.status}`)
      const { items } = (await res.json()) as { items: GateItem[] }
      setState({ kind: 'ready', items })
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <div className="flex items-end gap-3">
        <h1 className="font-display text-xl font-bold tracking-[-0.4px]">Gate items</h1>
        <span className="pb-0.5 text-[12.5px] text-ink-muted">
          Pending skill proposals — approve executes exactly what you see.
        </span>
      </div>

      {state.kind === 'loading' && (
        <section className="rounded-[14px] border border-line bg-surface px-6 py-10 text-center text-[12.5px] text-ink-muted shadow-card">
          Loading the queue…
        </section>
      )}

      {state.kind === 'error' && (
        <section className="rounded-[14px] border border-line bg-surface px-6 py-10 text-center shadow-card">
          <h2 className="font-display text-[13.5px] font-[650] text-crit">Queue unavailable</h2>
          <p className="mt-1 text-[12.3px] text-ink-muted">
            {state.message}. Start the API with <code className="font-mono">npm run api</code> in{' '}
            <code className="font-mono">server/</code> (and <code className="font-mono">npm run db:dev</code> for the database).
          </p>
        </section>
      )}

      {state.kind === 'ready' && state.items.length === 0 && (
        <section className="rounded-[14px] border border-line bg-surface px-6 py-10 text-center shadow-card">
          <h2 className="font-display text-[13.5px] font-[650]">Queue is clear</h2>
          <p className="mt-1 text-[12.3px] text-ink-muted">
            Nothing is waiting on a human. Trigger a demo run:{' '}
            <code className="font-mono text-[11px]">
              POST /api/skills/hello-world/run {'{'}"clientSlug":"hearts"{'}'}
            </code>
          </p>
        </section>
      )}

      {state.kind === 'ready' && state.items.length > 0 && (
        <section className="flex flex-col gap-3">
          {state.items.map((item) => (
            <GateCard key={item.id} item={item} onSettled={load} />
          ))}
        </section>
      )}
    </>
  )
}
