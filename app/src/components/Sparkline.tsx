/* Sparkline per design-comps/platform.html `spk` — 84×30 polyline, token
   stroke, no axes (trend glance only; real charts come with Reports). */
export function Sparkline({ points, tone = 'teal' }: { points: number[]; tone?: 'teal' | 'ok' }) {
  if (points.length < 2) return null
  const w = 84
  const h = 30
  const pad = 2
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const step = (w - pad * 2) / (points.length - 1)
  const path = points
    .map((v, i) => `${(pad + i * step).toFixed(1)},${(h - pad - ((v - min) / span) * (h - pad * 2)).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={w} height={h} aria-hidden className="shrink-0">
      <polyline
        points={path}
        fill="none"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={tone === 'ok' ? 'stroke-ok' : 'stroke-teal'}
      />
    </svg>
  )
}
