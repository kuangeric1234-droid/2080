import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RequestChip {
  id: string
  type: string
  summary: string
  status: string
  sla_due_at: string | null
  client_name: string | null
}

interface InboxMessage {
  id: string
  from_email: string
  subject: string
  state: 'received' | 'triaged' | 'filed' | 'held' | 'error'
  disposition: string | null
  received_at: string
  match_queue_id: string | null
  requests: RequestChip[]
}

interface QueueItem {
  id: string
  refs: { emailFrom?: string }
  candidates: Array<{ clientId: string; via: string }>
  confidence: number | null
}

interface ClientRow {
  id: string
  name: string
}

type Data = {
  messages: InboxMessage[]
  unaccounted: number
  queue: QueueItem[]
  clients: Record<string, string>
}

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: Data }

const STATE_PILL: Record<InboxMessage['state'], string> = {
  received: 'bg-info-tint text-info',
  triaged: 'bg-ok-tint text-ok',
  filed: 'bg-canvas text-ink-muted border border-line',
  held: 'bg-warn-tint text-warn',
  error: 'bg-crit-tint text-crit',
}

function slaLabel(due: string | null): string {
  if (!due) return ''
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86_400_000)
  return days < 0 ? `${-days}d overdue` : `due in ${days}d`
}

export function InboxPage() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const [inboxRes, queueRes, clientsRes] = await Promise.all([
        fetch('/api/inbox'), fetch('/api/match-queue'), fetch('/api/clients'),
      ])
      if (!inboxRes.ok || !queueRes.ok || !clientsRes.ok) {
        throw new Error(`API responded ${inboxRes.status}/${queueRes.status}/${clientsRes.status}`)
      }
      const { messages, unaccounted } = (await inboxRes.json()) as { messages: InboxMessage[]; unaccounted: number }
      const { items } = (await queueRes.json()) as { items: QueueItem[] }
      const { clients } = (await clientsRes.json()) as { clients: ClientRow[] }
      setState({
        kind: 'ready',
        data: {
          messages, unaccounted, queue: items,
          clients: Object.fromEntries(clients.map((c) => [c.id, c.name])),
        },
      })
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // j/k moves the selection through the message list (§12.3)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (state.kind !== 'ready') return
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return
      if (e.key === 'j') setSelected((s) => Math.min(s + 1, state.data.messages.length - 1))
      if (e.key === 'k') setSelected((s) => Math.max(s - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  async function resolve(queueId: string, clientId: string) {
    await fetch(`/api/match-queue/${queueId}/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId, actor: 'WC' }),
    })
    await load()
  }

  return (
    <>
      <div className="flex items-end gap-3">
        <h1 className="font-display text-xl font-bold tracking-[-0.4px]">Inbox</h1>
        <span className="pb-0.5 text-[12.5px] text-ink-muted">
          support@ triage — one email in, every request accounted for.
        </span>
        {state.kind === 'ready' && (
          <span
            className={cn(
              'num mb-0.5 ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold',
              state.data.unaccounted === 0 ? 'bg-ok-tint text-ok' : 'bg-crit-tint text-crit',
            )}
          >
            {state.data.messages.length} ingested · {state.data.unaccounted} unaccounted
          </span>
        )}
      </div>

      {state.kind === 'loading' && (
        <section className="rounded-[14px] border border-line bg-surface px-6 py-10 text-center text-[12.5px] text-ink-muted shadow-card">
          Loading the inbox…
        </section>
      )}

      {state.kind === 'error' && (
        <section className="rounded-[14px] border border-line bg-surface px-6 py-10 text-center shadow-card">
          <h2 className="font-display text-[13.5px] font-[650] text-crit">Inbox unavailable</h2>
          <p className="mt-1 text-[12.3px] text-ink-muted">
            {state.message}. Start the API with <code className="font-mono">npm run api</code> in{' '}
            <code className="font-mono">server/</code>.
          </p>
        </section>
      )}

      {state.kind === 'ready' && state.data.queue.length > 0 && (
        <section className="rounded-[14px] border border-line bg-surface shadow-card">
          <div className="border-b border-line px-5 py-3">
            <h2 className="font-display text-[13.5px] font-[650]">
              Needs a human — who is this from?
            </h2>
            <p className="text-[11.5px] text-ink-faint">
              Identity matches between 0.5 and 0.8 wait here. Your choice teaches the matcher.
            </p>
          </div>
          <div className="flex flex-col gap-3 p-5">
            {state.data.queue.map((item) => (
              <div key={item.id} className="relative rounded-[11px] border border-line bg-surface-2 py-3 pr-4 pl-4">
                <span aria-hidden className="absolute top-[11px] bottom-[11px] left-0 w-[3px] rounded-[3px] bg-warn" />
                <div className="text-[12.8px] font-semibold">{item.refs.emailFrom ?? 'unknown sender'}</div>
                <div className="num text-[11px] text-ink-muted">
                  confidence {item.confidence ?? '—'} · candidates below
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.candidates.map((cand) => (
                    <Button
                      key={cand.clientId}
                      size="sm"
                      variant="soft"
                      onClick={() => void resolve(item.id, cand.clientId)}
                    >
                      {state.data.clients[cand.clientId] ?? cand.clientId} ({cand.via})
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {state.kind === 'ready' && state.data.messages.length === 0 && (
        <section className="rounded-[14px] border border-line bg-surface px-6 py-10 text-center shadow-card">
          <h2 className="font-display text-[13.5px] font-[650]">Inbox is empty</h2>
          <p className="mt-1 text-[12.3px] text-ink-muted">No mail ingested yet.</p>
        </section>
      )}

      {state.kind === 'ready' && state.data.messages.length > 0 && (
        <section ref={listRef} className="flex flex-col rounded-[14px] border border-line bg-surface shadow-card">
          {state.data.messages.map((msg, i) => (
            <article
              key={msg.id}
              aria-selected={i === selected}
              className={cn(
                'border-b border-grid px-5 py-3 last:border-b-0',
                i === selected && 'bg-teal-tint/40',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.8px] font-semibold">{msg.from_email}</span>
                <span className="text-[12.5px] text-ink-muted">{msg.subject}</span>
                <span className={cn('ml-auto rounded-full px-2 py-px text-[10.5px] font-bold', STATE_PILL[msg.state])}>
                  {msg.disposition ?? msg.state}
                </span>
                <span className="num text-[10.5px] text-ink-faint">
                  {new Date(msg.received_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              {msg.requests.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {msg.requests.map((req) => (
                    <span
                      key={req.id}
                      className="inline-flex items-center gap-1.5 rounded-[7px] border border-line bg-canvas px-2 py-0.5 text-[11px]"
                    >
                      <code className="font-mono text-[10px] text-teal">{req.type}</code>
                      <span className="text-ink-muted">{req.summary}</span>
                      {req.sla_due_at && (
                        <span className="num text-[10px] text-ink-faint">{slaLabel(req.sla_due_at)}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </>
  )
}
