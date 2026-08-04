import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/* The review workspace. Its whole job is to make a finding's evidence
   inescapable: every paragraph shows the measurement that earned it, in the
   collector's own words, right next to the accept button. A reviewer who can
   see why the report says something can trust the ones they didn't check. */

type FindingState = 'candidate' | 'accepted' | 'rejected' | 'edited'

interface Finding {
  id: string
  snippet_id: string
  category: string
  dimension: string
  variant: 'positive' | 'negative' | 'neutral'
  weight: number
  state: FindingState
  rendered_text: string
  edited_text: string | null
  vars: Record<string, string | number>
  triggered_by: string[]
  ahpra_blocking: boolean
  decided_by: string | null
}

interface Signal {
  target: string
  key: string
  value: unknown
  source: string
  provenance: string
  collected_at: string
}

interface Category {
  key: string
  label: string
  dimensions: string[]
  automation: 'full' | 'semi' | 'manual'
  automation_note: string
}

interface BankItem {
  snippet_id: string
  dimension: string
  variant: 'positive' | 'negative' | 'neutral'
  text: string
  prompt: string | null
  kind: 'manual' | 'judgement'
  vars: string[]
  hint: { key: string; value: unknown; provenance: string } | null
  state: FindingState | null
}

interface BankGroup {
  category: string
  label: string
  automation: Category['automation']
  automation_note: string
  items: BankItem[]
}

interface ReviewDetail {
  review: {
    id: string
    domain: string
    practice_name: string | null
    contact_name: string | null
    contact_email: string | null
    status: string
    category_scores: Record<string, number | null>
    overall_score: number | null
    collect_error: string | null
    collected_at: string | null
    requested_at: string
  }
  signals: Signal[]
  findings: Finding[]
  categories: Category[]
}

const VARIANT: Record<Finding['variant'], { chip: string; label: string }> = {
  positive: { chip: 'bg-ok-tint text-ok', label: 'Strength' },
  negative: { chip: 'bg-crit-tint text-crit', label: 'Issue' },
  neutral: { chip: 'bg-canvas text-ink-muted', label: 'Note' },
}

function StarPicker({
  value, suggested, onChange,
}: { value: number | null; suggested: number | null; onChange: (n: number | null) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(value === n ? null : n)}
          aria-label={`${n} of 5`}
          aria-pressed={value === n}
          className={cn(
            'text-[15px] leading-none transition-colors',
            value !== null && n <= value ? 'text-teal' : 'text-ink-faint hover:text-ink-muted',
          )}
        >
          ★
        </button>
      ))}
      {value === null ? (
        <span className="ml-1.5 text-[11px] text-ink-faint">not scored</span>
      ) : suggested !== null && suggested !== value ? (
        <span className="ml-1.5 text-[11px] text-warn">suggested {suggested}</span>
      ) : null}
    </span>
  )
}

function EvidenceLine({ signals, keys }: { signals: Map<string, Signal>; keys: string[] }) {
  if (keys.length === 0) {
    return <span className="text-[11.5px] text-ink-faint">Unconditional — always included</span>
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {keys.map((k) => {
        const s = signals.get(k)
        if (!s) {
          return (
            <li key={k} className="text-[11.5px] text-warn">
              {k.startsWith('reviewer:') ? `Entered by hand (${k.split(':')[1]})` : `${k} — signal no longer present`}
            </li>
          )
        }
        return (
          <li key={k} className="flex gap-2 text-[11.5px] text-ink-muted">
            <code className="shrink-0 font-mono text-[10.5px] text-ink-faint">{s.key}</code>
            <span>{s.provenance}</span>
          </li>
        )
      })}
    </ul>
  )
}

function FindingCard({
  f, signals, onDecide,
}: { f: Finding; signals: Map<string, Signal>; onDecide: (state: FindingState, editedText?: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(f.edited_text ?? f.rendered_text)
  const text = f.edited_text ?? f.rendered_text
  const unfilled = [...text.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1])

  return (
    <article
      className={cn(
        'border-l-2 px-4 py-3',
        f.state === 'accepted' || f.state === 'edited' ? 'border-l-ok bg-ok-tint/25'
          : f.state === 'rejected' ? 'border-l-line opacity-45'
          : 'border-l-transparent',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full px-2 py-px text-[10.5px] font-semibold', VARIANT[f.variant].chip)}>
          {VARIANT[f.variant].label}
        </span>
        <span className="text-[11px] text-ink-faint">{f.dimension}</span>
        {f.ahpra_blocking && (
          <span
            title="AHPRA advertising guidelines — this cannot be dropped without a reason"
            className="rounded-full bg-crit px-2 py-px text-[10.5px] font-semibold text-white"
          >
            AHPRA breach
          </span>
        )}
        {f.state === 'edited' && (
          <span className="rounded-full bg-blue-tint px-2 py-px text-[10.5px] font-semibold text-info">Edited</span>
        )}
        <code className="ml-auto font-mono text-[10px] text-ink-faint">{f.snippet_id}</code>
      </div>

      {editing ? (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            aria-label="Edit the finding text"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[12.5px] leading-[1.55] text-ink outline-none focus:border-teal"
          />
          <div className="mt-1.5 flex gap-2">
            <Button size="sm" onClick={() => { onDecide('accepted', draft); setEditing(false) }}>
              Save and accept
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(text); setEditing(false) }}>
              Cancel
            </Button>
            <span className="self-center text-[11px] text-ink-faint">
              House copy is the default — edit only when this practice needs different words.
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-[12.7px] leading-[1.6] text-ink">{text}</p>
      )}

      {unfilled.length > 0 && !editing && (
        <p className="mt-1.5 text-[11.5px] font-semibold text-warn">
          Needs {unfilled.join(', ')} before this can ship
        </p>
      )}

      <details className="mt-2 group">
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-ink-faint hover:text-teal">
          Evidence ({f.triggered_by.length}) <span className="group-open:hidden">▸</span>
          <span className="hidden group-open:inline">▾</span>
        </summary>
        <div className="mt-1.5 rounded-lg border border-line bg-canvas px-3 py-2">
          <EvidenceLine signals={signals} keys={f.triggered_by} />
        </div>
      </details>

      {!editing && (
        <div className="mt-2 flex items-center gap-1.5">
          <Button
            size="sm"
            variant={f.state === 'accepted' || f.state === 'edited' ? 'default' : 'outline'}
            onClick={() => onDecide('accepted')}
          >
            {f.state === 'accepted' || f.state === 'edited' ? 'In the report' : 'Include'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDecide(f.state === 'rejected' ? 'candidate' : 'rejected')}
          >
            {f.state === 'rejected' ? 'Undo' : 'Drop'}
          </Button>
          {f.decided_by && (
            <span className="ml-1 text-[11px] text-ink-faint">by {f.decided_by}</span>
          )}
        </div>
      )}
    </article>
  )
}

export function ReviewDetailPage() {
  const { id = '' } = useParams()
  const [data, setData] = useState<ReviewDetail | null>(null)
  const [bank, setBank] = useState<BankGroup[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading')
  const [busy, setBusy] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, number | null>>({})
  const [overall, setOverall] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [dRes, bRes] = await Promise.all([
        fetch(`/api/reviews/${id}`),
        fetch(`/api/reviews/${id}/bank`),
      ])
      if (dRes.status === 404) return setState('missing')
      if (!dRes.ok) throw new Error()
      const d = (await dRes.json()) as ReviewDetail
      setData(d)
      setScores(d.review.category_scores ?? {})
      setOverall(d.review.overall_score)
      setDirty(false)
      if (bRes.ok) setBank(((await bRes.json()) as { groups: BankGroup[] }).groups)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [id])
  useEffect(() => { void load() }, [load])

  const signals = useMemo(
    () => new Map((data?.signals ?? []).map((s) => [s.key, s])),
    [data],
  )
  const accepted = useMemo(
    () => (data?.findings ?? []).filter((f) => f.state === 'accepted' || f.state === 'edited'),
    [data],
  )

  const collect = async () => {
    setBusy('collect')
    try {
      const res = await fetch(`/api/reviews/${id}/collect`, { method: 'POST' })
      if (!res.ok) {
        const e = (await res.json()) as { error: string }
        window.alert(e.error)
      }
      await load()
    } finally { setBusy(null) }
  }

  const decide = async (f: Finding, next: FindingState, editedText?: string) => {
    setBusy(f.id)
    try {
      await fetch(`/api/reviews/findings/${f.id}/decide`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: next, editedText }),
      })
      await load()
    } finally { setBusy(null) }
  }

  const addManual = async (snippetId: string) => {
    setBusy(snippetId)
    try {
      await fetch(`/api/reviews/${id}/findings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ snippetId }),
      })
      await load()
    } finally { setBusy(null) }
  }

  /* The export refuses a paragraph with an unfilled variable in it, so a 422
     here is the server protecting the practice from receiving
     "such as {{public_email}}". Show it rather than swallowing it. */
  const exportDocx = async () => {
    setBusy('export')
    try {
      const res = await fetch(`/api/reviews/${id}/export.docx`)
      if (!res.ok) {
        const { error } = (await res.json()) as { error: string }
        setExportError(error)
        return
      }
      setExportError(null)
      const blob = await res.blob()
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1]
        ?? 'Online Presence Review.docx'
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = name
      a.click()
      URL.revokeObjectURL(href)
      await load()
    } finally { setBusy(null) }
  }

  const saveScores = async () => {
    setBusy('scores')
    try {
      await fetch(`/api/reviews/${id}/scores`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scores, overall }),
      })
      await load()
    } finally { setBusy(null) }
  }

  if (state === 'loading') return <p className="py-14 text-center text-[12.3px] text-ink-muted">Loading review…</p>
  if (state === 'missing') {
    return (
      <div className="py-14 text-center">
        <p className="text-[12.3px] text-ink-muted">That review doesn’t exist.</p>
        <Button asChild variant="outline" className="mt-3"><Link to="/review">Back to the queue</Link></Button>
      </div>
    )
  }
  if (state === 'error' || !data) {
    return (
      <p className="py-14 text-center text-[12.3px] text-ink-muted">
        Reviews unavailable. Start the API with <code className="font-mono">npm run api</code> in{' '}
        <code className="font-mono">server/</code>.
      </p>
    )
  }

  const r = data.review
  const unfilledCount = accepted.filter((f) => /\{\{/.test(f.edited_text ?? f.rendered_text)).length

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <Link to="/review" className="text-[12px] text-ink-faint hover:text-teal">← Queue</Link>
        <h1 className="font-display text-xl font-bold tracking-[-0.4px]">
          {r.practice_name ?? r.domain}
        </h1>
        <span className="pb-0.5 text-[12.5px] text-ink-muted">{r.domain}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => void collect()} disabled={busy === 'collect'}>
            {busy === 'collect' ? 'Collecting…' : r.collected_at ? 'Re-collect' : 'Collect evidence'}
          </Button>
          {r.collected_at && (
            <Button onClick={() => void exportDocx()} disabled={busy === 'export' || accepted.length === 0}>
              {busy === 'export' ? 'Building…' : 'Export .docx'}
            </Button>
          )}
        </div>
      </div>

      {exportError && (
        <div className="rounded-[14px] border border-warn bg-warn-tint px-4 py-3 text-[12.3px] text-warn">
          Not exported — {exportError}
        </div>
      )}

      {r.collect_error && (
        <div className="rounded-[14px] border border-crit bg-crit-tint px-4 py-3 text-[12.3px] text-crit">
          Collection failed: {r.collect_error}
        </div>
      )}

      {!r.collected_at && !r.collect_error && (
        <div className="rounded-[14px] border border-line bg-surface px-5 py-10 text-center shadow-card">
          <h2 className="font-display text-[13.5px] font-[650]">No evidence collected yet</h2>
          <p className="mx-auto mt-1 max-w-[440px] text-[12.3px] text-ink-muted">
            Collecting crawls {r.domain} and reads its markup, DNS, mail records and certificate.
            It takes under a minute and finds nothing the practice would object to us seeing.
          </p>
        </div>
      )}

      {r.collected_at && (
        <>
          {/* ── the summary table, exactly the eight rows of the report ── */}
          <section className="rounded-[14px] border border-line bg-surface shadow-card">
            <header className="flex items-center gap-3 border-b border-line px-5 py-3">
              <h2 className="font-display text-[13.5px] font-[650]">Summary</h2>
              <span className="text-[11.5px] text-ink-muted">
                {data.signals.length} signals · {accepted.length} of {data.findings.length} findings in the report
              </span>
              {dirty && (
                <Button size="sm" className="ml-auto" onClick={() => void saveScores()} disabled={busy === 'scores'}>
                  {busy === 'scores' ? 'Saving…' : 'Save scores'}
                </Button>
              )}
            </header>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" aria-label="Score summary">
                <thead>
                  <tr>
                    {['Category', 'Score', 'Comments'].map((h) => (
                      <th key={h} className="border-b border-line px-5 pt-3 pb-2 text-left text-[10px] font-bold tracking-[0.06em] text-ink-faint uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((cat) => {
                    const mine = accepted.filter((f) => f.category === cat.key)
                    const neg = mine.filter((f) => f.variant === 'negative').length
                    const pos = mine.filter((f) => f.variant === 'positive').length
                    return (
                      <tr key={cat.key} className="border-b border-grid last:border-b-0">
                        <td className="px-5 py-2.5">
                          <div className="text-[12.5px] font-semibold">{cat.label}</div>
                          <div className="text-[11px] text-ink-faint">{cat.dimensions.join(', ')}</div>
                        </td>
                        <td className="px-5 py-2.5 whitespace-nowrap">
                          <StarPicker
                            value={scores[cat.key] ?? null}
                            suggested={r.category_scores?.[cat.key] ?? null}
                            onChange={(n) => { setScores((s) => ({ ...s, [cat.key]: n })); setDirty(true) }}
                          />
                        </td>
                        <td className="px-5 py-2.5 text-[11.5px] text-ink-muted">
                          {mine.length === 0
                            ? cat.automation === 'manual'
                              ? 'Needs your input — nothing here is collectable without a paid provider'
                              : 'Nothing fired'
                            : `${neg} issue${neg === 1 ? '' : 's'}, ${pos} strength${pos === 1 ? '' : 's'}`}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="border-t border-line bg-canvas">
                    <td className="px-5 py-2.5 font-display text-[12.5px] font-bold">Overall Score</td>
                    <td className="px-5 py-2.5">
                      <StarPicker
                        value={overall}
                        suggested={r.overall_score}
                        onChange={(n) => { setOverall(n); setDirty(true) }}
                      />
                    </td>
                    <td className="px-5 py-2.5 text-[11.5px] text-ink-muted">
                      {unfilledCount > 0
                        ? `${unfilledCount} accepted finding${unfilledCount === 1 ? '' : 's'} still ha${unfilledCount === 1 ? 's' : 've'} a blank to fill`
                        : 'Your score, not the engine’s — the suggestion is only a starting point'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── findings, grouped as the report groups them ── */}
          {data.categories.map((cat) => {
            const mine = data.findings.filter((f) => f.category === cat.key)
            const manual = bank.find((g) => g.category === cat.key)
            if (mine.length === 0 && !manual) return null
            return (
              <section
                key={cat.key}
                aria-label={`${cat.label} findings`}
                className="rounded-[14px] border border-line bg-surface shadow-card"
              >
                <header className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
                  <h2 className="font-display text-[13.5px] font-[650]">{cat.label}</h2>
                  <span className={cn(
                    'rounded-full px-2 py-px text-[10.5px] font-semibold',
                    cat.automation === 'full' ? 'bg-ok-tint text-ok'
                      : cat.automation === 'semi' ? 'bg-warn-tint text-warn'
                      : 'bg-canvas text-ink-muted',
                  )}>
                    {cat.automation === 'full' ? 'automatic' : cat.automation === 'semi' ? 'part manual' : 'manual'}
                  </span>
                  <span className="text-[11.5px] text-ink-muted">{cat.automation_note}</span>
                </header>

                <div className="divide-y divide-grid">
                  {mine.map((f) => (
                    <FindingCard
                      key={f.id}
                      f={f}
                      signals={signals}
                      onDecide={(next, editedText) => void decide(f, next, editedText)}
                    />
                  ))}
                  {mine.length === 0 && (
                    <p className="px-5 py-4 text-[12px] text-ink-muted">
                      Nothing fired here. Add what you can see below.
                    </p>
                  )}
                </div>

                {manual && manual.items.some((i) => !i.state) && (
                  <details className="border-t border-line">
                    <summary className="cursor-pointer list-none px-5 py-2.5 text-[11.5px] font-semibold text-teal hover:bg-canvas">
                      Add from the bank — {manual.items.filter((i) => !i.state).length} available
                    </summary>
                    <ul className="divide-y divide-grid border-t border-grid">
                      {manual.items.filter((i) => !i.state).map((item) => (
                        <li key={item.snippet_id} className="flex gap-3 px-5 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn('rounded-full px-2 py-px text-[10.5px] font-semibold', VARIANT[item.variant].chip)}>
                                {VARIANT[item.variant].label}
                              </span>
                              <span className="text-[11px] text-ink-faint">{item.kind}</span>
                            </div>
                            {item.prompt && (
                              <p className="mt-1 text-[11.5px] font-semibold text-ink-muted">{item.prompt}</p>
                            )}
                            <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-muted">{item.text}</p>
                            {item.hint && (
                              <p className="mt-1 text-[11.5px] text-info">We measured: {item.hint.provenance}</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="self-start"
                            onClick={() => void addManual(item.snippet_id)}
                            disabled={busy === item.snippet_id}
                          >
                            Add
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            )
          })}

          {/* ── the raw evidence, for when a finding is disputed ── */}
          <details className="rounded-[14px] border border-line bg-surface shadow-card">
            <summary className="cursor-pointer list-none px-5 py-3 font-display text-[13.5px] font-[650] hover:bg-canvas">
              All evidence ({data.signals.length} signals)
            </summary>
            <div className="overflow-x-auto border-t border-line">
              <table className="w-full border-collapse">
                <tbody>
                  {data.signals.map((s) => (
                    <tr key={s.key} className="border-b border-grid last:border-b-0">
                      <td className="px-5 py-1.5 font-mono text-[10.5px] whitespace-nowrap text-ink-faint">{s.key}</td>
                      <td className="num px-3 py-1.5 text-[11.5px] whitespace-nowrap">
                        {s.value === null ? <span className="text-ink-faint">unknown</span> : String(s.value)}
                      </td>
                      <td className="px-3 py-1.5 text-[11.5px] text-ink-muted">{s.provenance}</td>
                      <td className="px-5 py-1.5 text-[10.5px] text-ink-faint">{s.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </>
  )
}
