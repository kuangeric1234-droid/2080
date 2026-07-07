import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/* Queue card + gate chip per design-comps/platform.html (.qi / .gate). */

export interface GateItem {
  id: string
  gate: 'G0' | 'G1' | 'G2' | 'G3'
  state: string
  payload: { kind: string; client_id: string | null; data: Record<string, unknown> }
  expires_at: string | null
  created_at: string
  skill: string
  version: string
  trigger: string | null
  client_slug: string | null
  client_name: string | null
}

const GATE_STYLES: Record<GateItem['gate'], string> = {
  G0: 'text-ok border-ok/40 bg-ok-tint',
  G1: 'text-teal border-teal/40 bg-teal-tint',
  G2: 'text-warn border-warn/40 bg-warn-tint',
  G3: 'text-crit border-crit/40 bg-crit-tint',
}

const STRIPE: Record<GateItem['gate'], string> = {
  G0: 'bg-ok',
  G1: 'bg-teal',
  G2: 'bg-warn',
  G3: 'bg-crit',
}

function GateChip({ gate }: { gate: GateItem['gate'] }) {
  return (
    <span
      className={cn(
        'rounded-[5px] border px-1.5 py-px font-mono text-[10px] font-bold tracking-[0.02em] whitespace-nowrap',
        GATE_STYLES[gate],
      )}
    >
      {gate}
    </span>
  )
}

function PayloadBody({ payload }: { payload: GateItem['payload'] }) {
  if (payload.kind === 'timeline.note') {
    return (
      <p className="text-[12.3px] leading-normal text-ink-muted">
        <b className="font-semibold text-ink">{String(payload.data.note_title ?? '')}</b>
        <br />
        {String(payload.data.note_body ?? '')}
      </p>
    )
  }
  return (
    <pre className="overflow-x-auto rounded-lg bg-canvas p-2 font-mono text-[11px] text-ink-muted">
      {JSON.stringify(payload.data, null, 2)}
    </pre>
  )
}

export function GateCard({ item, onSettled }: { item: GateItem; onSettled: () => void }) {
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function act(path: 'approve' | 'reject', body: Record<string, string>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/gate-items/${item.id}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const { error } = (await res.json()) as { error?: string }
        throw new Error(error ?? `${path} failed (${res.status})`)
      }
      onSettled()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <article className="relative rounded-[11px] border border-line bg-surface-2 py-3 pr-[15px] pl-4">
      <span
        aria-hidden
        className={cn('absolute top-[11px] bottom-[11px] left-0 w-[3px] rounded-[3px]', STRIPE[item.gate])}
      />
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <GateChip gate={item.gate} />
        <span className="text-[12.8px] font-semibold">
          {item.skill} proposes {item.payload.kind}
          {item.client_name ? ` · ${item.client_name}` : ''}
        </span>
        <span className="ml-auto num text-[11px] text-ink-muted">
          {item.skill}@{item.version}
          {item.expires_at
            ? ` · expires ${new Date(item.expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
            : ''}
        </span>
      </div>
      <PayloadBody payload={item.payload} />
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {!rejecting ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => act('approve', { actor: 'WC' })}>
              {item.payload.kind === 'timeline.note'
                ? 'Approve — post to timeline'
                : `Approve — execute ${item.payload.kind}`}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
              Reject
            </Button>
          </>
        ) : (
          <>
            <input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this wrong? Feeds the precision ledger."
              aria-label="Rejection reason"
              className="w-[320px] rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-ink-faint"
            />
            <Button
              size="sm"
              variant="destructive"
              disabled={busy || reason.trim().length === 0}
              onClick={() => act('reject', { actor: 'WC', reason: reason.trim() })}
            >
              Confirm reject
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRejecting(false)}>
              Keep
            </Button>
          </>
        )}
        {error && <span className="text-[11.5px] font-semibold text-crit">{error}</span>}
      </div>
    </article>
  )
}
