import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { NavItem } from './nav'

export function PagePlaceholder({ item }: { item: NavItem }) {
  return (
    <>
      <div className="flex items-end gap-3">
        <h1 className="font-display text-xl font-bold tracking-[-0.4px] text-balance">{item.label}</h1>
        <span className="pb-0.5 text-[12.5px] text-ink-muted">{item.purpose}</span>
      </div>
      <section className="flex flex-col items-center gap-2 rounded-[14px] border border-line bg-surface px-6 py-14 text-center shadow-card">
        <div className="text-[34px] text-ink-faint" aria-hidden>
          {item.glyph}
        </div>
        <h2 className="font-display text-[13.5px] font-[650]">Not built yet</h2>
        <p className="max-w-[420px] text-[12.3px] text-ink-muted">
          This tab arrives with {item.buildRef} of the build plan. Until then it holds its place in
          the rail so the shell matches the module map.
        </p>
        {item.id !== 'today' && (
          <Button asChild variant="outline" className="mt-3">
            <Link to="/today">Back to Today</Link>
          </Button>
        )}
      </section>
    </>
  )
}
