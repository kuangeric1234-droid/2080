import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NAV, navItemById } from './nav'
import { useTheme } from './useTheme'

/* Demo values until skill_runs exist (§13 step 1.3). */
const AUTOMATED_PCT = 94
const AUTOMATED_TOTAL = '8,140'

function railBadge(count: number, tone: 'crit' | 'warn') {
  return (
    <span
      className={cn(
        'ml-auto min-w-[17px] rounded-full px-1.5 py-px text-center text-[10px] font-bold',
        tone === 'crit' ? 'bg-crit text-white' : 'bg-warn-tint text-warn',
      )}
    >
      {count}
    </span>
  )
}

function nowInMelbourne(): string {
  const now = new Date()
  const date = new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Australia/Melbourne',
  }).format(now)
  const time = new Intl.DateTimeFormat('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Australia/Melbourne',
  }).format(now)
  return `${date.replace(/,/g, '')} · ${time}`
}

export function AppShell() {
  const location = useLocation()
  const { theme, toggle } = useTheme()
  const searchRef = useRef<HTMLInputElement>(null)
  const [clock, setClock] = useState(nowInMelbourne)

  const path = location.pathname.replace(/^\//, '')
  const OFF_RAIL_TITLES: Record<string, string> = { gates: 'Gate items' }
  const title = navItemById(path)?.label ?? OFF_RAIL_TITLES[path] ?? 'Today'

  useEffect(() => {
    const tick = setInterval(() => setClock(nowInMelbourne()), 30_000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape' && el === searchRef.current) {
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="grid min-h-screen grid-cols-[238px_1fr]">
      <aside className="sticky top-0 flex h-screen flex-col gap-0.5 overflow-y-auto border-r border-line bg-surface px-3 py-4">
        <div className="flex items-center gap-2.5 px-2 pt-1 pb-3">
          <div className="flex size-[34px] items-center justify-center rounded-[9px] bg-gradient-to-br from-teal to-teal-deep font-display text-[11px] font-bold tracking-[-0.3px] text-white shadow-card">
            20·80
          </div>
          <div className="font-display text-[14.5px] font-[650] tracking-[-0.2px]">
            20-80 <span className="font-normal text-ink-muted">Platform</span>
          </div>
        </div>
        <nav aria-label="Primary">
          {NAV.map(({ group, items }) => (
            <div key={group}>
              <div className="px-2.5 pt-3 pb-1 text-[10px] font-bold tracking-[0.09em] text-ink-faint uppercase">
                {group}
              </div>
              {items.map((item) => (
                <NavLink
                  key={item.id}
                  to={`/${item.id}`}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.8px] text-ink hover:bg-canvas',
                      isActive && 'bg-teal-tint font-semibold text-teal hover:bg-teal-tint',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={cn('w-[18px] text-center text-[13px] text-ink-muted', isActive && 'text-teal')}>
                        {item.glyph}
                      </span>
                      {item.label}
                      {item.badge && railBadge(item.badge.count, item.badge.tone)}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-auto border-t border-line px-2.5 pt-3 pb-0.5">
          <div className="text-[10px] font-bold tracking-[0.08em] text-ink-faint uppercase">
            Automated this week
          </div>
          <div className="num mt-0.5 font-display text-[19px] font-bold">
            {AUTOMATED_PCT}
            <small className="text-[11.5px] font-medium text-ink-muted">% of {AUTOMATED_TOTAL}</small>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex h-[58px] items-center gap-3.5 border-b border-line bg-surface/80 px-6 backdrop-blur-md">
          <div className="font-display text-base font-[650] tracking-[-0.2px]">{title}</div>
          <div className="ml-1.5 flex w-[290px] items-center gap-2 rounded-[9px] border border-line bg-canvas px-2.5 py-[7px]">
            <input
              ref={searchRef}
              type="search"
              placeholder="Search clients, flags, runs…"
              aria-label="Search clients, flags, runs"
              className="w-full bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-faint"
            />
            <kbd className="rounded-[5px] border border-line bg-surface px-1.5 font-mono text-[10px] text-ink-faint">
              /
            </kbd>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="num text-[12.5px] text-ink-muted">{clock}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={toggle}
              title="Toggle theme"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="text-[15px] text-ink-muted"
            >
              ◐
            </Button>
            <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-info to-[#274e86] text-[11.5px] font-[650] text-white">
              WC
            </div>
          </div>
        </header>
        <main className="flex w-full max-w-[1380px] flex-col gap-4 px-6 pt-5 pb-11">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
