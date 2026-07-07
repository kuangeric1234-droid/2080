import { useCallback, useEffect, useState } from 'react'
import { GateCard, type GateItem } from '@/components/GateCard'
import { Sparkline } from '@/components/Sparkline'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Tile {
  label: string
  value: string
  unit: string
  delta: string
  deltaTone: 'up' | 'down' | 'down-good' | 'flat'
  spark: number[]
}

interface Flag {
  id: string
  client_name: string
  workflow: string
  severity: 'info' | 'amber' | 'red'
  title: string
  opened_at: string
  score: number
}

type Data = { tiles: Tile[]; flags: Flag[]; gates: GateItem[] }
type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: Data }

const DELTA_TONE: Record<Tile['deltaTone'], string> = {
  up: 'text-ok',
  'down-good': 'text-ok',
  down: 'text-crit',
  flat: 'text-ink-muted',
}

const SEV_STRIPE: Record<Flag['severity'], string> = {
  red: 'bg-crit', amber: 'bg-warn', info: 'bg-info',
}

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning.' : h < 18 ? 'Good afternoon.' : 'Good evening.'
}

function FlagCard({ flag, onActed }: { flag: Flag; onActed: () => void }) {
  const [asking, setAsking] = useState<'resolve' | 'snooze' | null>(null)
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act() {
    if (!asking) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/flags/${flag.id}/${asking}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actor: 'WC', why: why.trim() }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? `failed (${res.status})`)
      onActed()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const ageDays = Math.floor((Date.now() - new Date(flag.opened_at).getTime()) / 86_400_000)
  return (
    <article className="relative rounded-[11px] border border-line bg-surface-2 py-3 pr-[15px] pl-4">
      <span aria-hidden className={cn('absolute top-[11px] bottom-[11px] left-0 w-[3px] rounded-[3px]', SEV_STRIPE[flag.severity])} />
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-[5px] border border-line bg-canvas px-1.5 font-mono text-[10px] text-ink-muted">
          {flag.workflow}
        </code>
        <span className="text-[12.8px] font-semibold">{flag.title}</span>
        <span className="num ml-auto text-[11px] text-ink-muted">
          {flag.client_name} · {ageDays === 0 ? 'today' : `${ageDays}d old`}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {asking == null ? (
          <>
            <Button size="sm" variant="soft" onClick={() => setAsking('resolve')}>Resolve</Button>
            <Button size="sm" variant="ghost" onClick={() => setAsking('snooze')}>Snooze</Button>
          </>
        ) : (
          <>
            <input
              autoFocus
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder={asking === 'resolve' ? 'What fixed it? Lands in the audit log.' : 'Why snooze? Lands in the audit log.'}
              aria-label="Reason"
              className="w-[300px] rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-ink-faint"
            />
            <Button size="sm" disabled={busy || why.trim().length === 0} onClick={() => void act()}>
              Confirm {asking}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAsking(null)}>Back</Button>
          </>
        )}
        {error && <span className="text-[11.5px] font-semibold text-crit">{error}</span>}
      </div>
    </article>
  )
}

export function TodayPage() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  const load = useCallback(async () => {
    try {
      const [todayRes, gatesRes] = await Promise.all([
        fetch('/api/today'), fetch('/api/gate-items?state=pending'),
      ])
      if (!todayRes.ok || !gatesRes.ok) throw new Error(`API responded ${todayRes.status}/${gatesRes.status}`)
      const { tiles, flags } = (await todayRes.json()) as { tiles: Tile[]; flags: Flag[] }
      const { items } = (await gatesRes.json()) as { items: GateItem[] }
      setState({ kind: 'ready', data: { tiles, flags, gates: items } })
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
        <h1 className="font-display text-xl font-bold tracking-[-0.4px]">{greeting()}</h1>
        <span className="pb-0.5 text-[12.5px] text-ink-muted">
          What ran, what moved, and the things that need you.
        </span>
        {state.kind === 'ready' && (
          <span className="num mb-0.5 ml-auto rounded-full bg-warn-tint px-2.5 py-0.5 text-[11px] font-bold text-warn">
            {state.data.gates.length} waiting on you
          </span>
        )}
      </div>

      {state.kind === 'loading' && (
        <section className="rounded-[14px] border border-line bg-surface px-6 py-10 text-center text-[12.5px] text-ink-muted shadow-card">
          Loading today…
        </section>
      )}

      {state.kind === 'error' && (
        <section className="rounded-[14px] border border-line bg-surface px-6 py-10 text-center shadow-card">
          <h2 className="font-display text-[13.5px] font-[650] text-crit">Today unavailable</h2>
          <p className="mt-1 text-[12.3px] text-ink-muted">
            {state.message}. Start the API with <code className="font-mono">npm run api</code> in{' '}
            <code className="font-mono">server/</code>.
          </p>
        </section>
      )}

      {state.kind === 'ready' && (
        <>
          <section className="grid grid-cols-4 gap-4 max-lg:grid-cols-2">
            {state.data.tiles.map((tile) => (
              <div key={tile.label} className="rounded-[14px] border border-line bg-surface px-4 py-3.5 shadow-card">
                <div className="text-[11.5px] text-ink-muted">{tile.label}</div>
                <div className="mt-1.5 flex items-end justify-between gap-2">
                  <div className="num font-display text-[26px] leading-none font-bold tracking-[-0.6px]">
                    {tile.value}
                    {tile.unit && <span className="text-[12.5px] font-medium text-ink-muted">{tile.unit}</span>}
                  </div>
                  <Sparkline points={tile.spark} tone={tile.deltaTone === 'down-good' ? 'ok' : 'teal'} />
                </div>
                <div className={cn('num mt-1.5 text-[11.5px] font-semibold', DELTA_TONE[tile.deltaTone])}>
                  {tile.delta}
                </div>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-[1fr_1.42fr] items-start gap-4 max-lg:grid-cols-1">
            <div className="min-w-0 rounded-[14px] border border-line bg-surface shadow-card">
              <div className="border-b border-line px-5 py-3">
                <h2 className="font-display text-[13.5px] font-[650]">Flags, ranked</h2>
                <p className="text-[11.5px] text-ink-faint">Severity first, then age and client risk.</p>
              </div>
              <div className="flex flex-col gap-3 p-5">
                {state.data.flags.length === 0 && (
                  <p className="py-6 text-center text-[12.3px] text-ink-muted">
                    Nothing is flagged. Monitors add to this feed as they land (Stage 3).
                  </p>
                )}
                {state.data.flags.map((flag) => (
                  <FlagCard key={flag.id} flag={flag} onActed={load} />
                ))}
              </div>
            </div>

            <div className="min-w-0 rounded-[14px] border border-line bg-surface shadow-card">
              <div className="border-b border-line px-5 py-3">
                <h2 className="font-display text-[13.5px] font-[650]">Waiting for you</h2>
                <p className="text-[11.5px] text-ink-faint">Approve executes exactly what you see.</p>
              </div>
              <div className="flex flex-col gap-3 p-5">
                {state.data.gates.length === 0 && (
                  <p className="py-6 text-center text-[12.3px] text-ink-muted">Queue is clear.</p>
                )}
                {state.data.gates.map((item) => (
                  <GateCard key={item.id} item={item} onSettled={load} />
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </>
  )
}
