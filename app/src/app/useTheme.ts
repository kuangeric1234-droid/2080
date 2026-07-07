import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const listeners = new Set<() => void>()

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolvedTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'dark' || stored === 'light' ? stored : systemTheme()
}

function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  document.documentElement.dataset.theme = theme
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Explicit choice wins over OS preference; index.html applies the stored
    choice before first paint so there is no flash. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, resolvedTheme)
  const toggle = useCallback(() => setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark'), [])
  return { theme, toggle }
}
