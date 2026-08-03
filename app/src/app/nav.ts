/* The rail carries exactly the modules that are live. Everything else sits in
   backlog/PARKED-MODULES.md as the weekly build queue — parked, not cancelled.
   Six built tabs (today, clients, inbox, audit, seo, sitehealth) stayed
   routable off-rail; see routes.tsx. */

export type BadgeTone = 'crit' | 'warn'

export interface NavItem {
  id: string
  glyph: string
  label: string
  badge?: { count: number; tone: BadgeTone }
  purpose: string
  buildRef: string
}

export interface NavGroup {
  group: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    group: 'Deliver',
    items: [
      {
        id: 'review',
        glyph: '◎',
        label: 'Online Presence Review',
        purpose: 'Audit requests in, scored review out — the 8-category report.',
        buildRef: 'module 1',
      },
    ],
  },
]

export const NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items)

export function navItemById(id: string | undefined): NavItem | undefined {
  return NAV_ITEMS.find((i) => i.id === id)
}

/* Built but off-rail — reachable by URL, absent from the navigation.
   Keys match the route paths in routes.tsx. */
export const OFF_RAIL_TITLES: Record<string, string> = {
  today: 'Today',
  clients: 'Clients',
  inbox: 'Inbox',
  audit: 'Audit Log',
  seo: 'SEO Watchtower',
  sitehealth: 'Site Health',
  gates: 'Gate items',
  notifications: 'Notifications',
}
