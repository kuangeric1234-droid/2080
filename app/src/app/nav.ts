/* Rail taxonomy per MASTER-BUILD-PLAN §4 module map; glyphs and grouping
   per design-comps/platform.html. Badge counts are demo values until the
   tabs they belong to are built (queues land in §13 steps 1.5–1.6+). */

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
    group: 'Operate',
    items: [
      { id: 'today', glyph: '◧', label: 'Today', badge: { count: 6, tone: 'crit' }, purpose: 'Flags feed, approval queue and daily briefing.', buildRef: 'step 1.6' },
      { id: 'clients', glyph: '◔', label: 'Clients', purpose: 'The CRM backbone — one record per practice.', buildRef: 'step 1.2' },
      { id: 'inbox', glyph: '✉', label: 'Inbox', badge: { count: 4, tone: 'crit' }, purpose: 'support@ triage to tasks, ack drafts and completion notes (W2).', buildRef: 'step 1.5' },
      { id: 'receptionists', glyph: '☎', label: 'Receptionists', purpose: 'AI receptionist fleet view (W1).', buildRef: 'step 2.4' },
      { id: 'meetings', glyph: '◉', label: 'Meetings', purpose: 'Fathom transcripts to actions and agendas (W5).', buildRef: 'step 3.5' },
    ],
  },
  {
    group: 'Monitor',
    items: [
      { id: 'ads', glyph: '◎', label: 'Google Ads', badge: { count: 3, tone: 'crit' }, purpose: 'Monitor, approve and implement ads changes (W3).', buildRef: 'step 3.2' },
      { id: 'seo', glyph: '⌖', label: 'SEO Watchtower', badge: { count: 2, tone: 'crit' }, purpose: 'Rank drops and opportunities (W4).', buildRef: 'step 3.4' },
      { id: 'sitehealth', glyph: '♥', label: 'Site Health', badge: { count: 1, tone: 'crit' }, purpose: 'Uptime, SSL and domain expiry, form canaries.', buildRef: 'step 3.6' },
      { id: 'calendar', glyph: '◷', label: 'Calendar', purpose: 'Publishes, posts, reports, meetings and seasonal moments.', buildRef: 'Stage 3' },
    ],
  },
  {
    group: 'Deliver',
    items: [
      { id: 'factory', glyph: '⚒', label: 'Website Factory', purpose: 'The 8-stage website build pipeline.', buildRef: 'Stage 5' },
      { id: 'intake', glyph: '➜', label: 'Intake Wizard', purpose: 'The 8-step client onboarding questionnaire.', buildRef: 'step 5.1' },
      { id: 'cms', glyph: '▤', label: 'CMS & Sites', purpose: 'Block-tree editing, change-sets and publishes (W8).', buildRef: 'step 5.0' },
      { id: 'studio', glyph: '文', label: 'Content Studio', purpose: 'Translation EN⇄中文 and content work.', buildRef: 'step 6.4' },
    ],
  },
  {
    group: 'Grow',
    items: [
      { id: 'prospects', glyph: '◈', label: 'Prospects', purpose: 'Deal board and the audit-report generator.', buildRef: 'step 4.2' },
      { id: 'reports', glyph: '▥', label: 'Reports', purpose: 'Monthly ROI and SEO report generation.', buildRef: 'step 4.3' },
      { id: 'billing', glyph: '▧', label: 'Billing', purpose: 'Invoices, MRR and dunning, Xero-integrated.', buildRef: 'step 4.1' },
      { id: 'guarantee', glyph: '✓', label: 'Guarantee', purpose: 'The 6-month promise tracked against actuals.', buildRef: 'step 4.4' },
    ],
  },
  {
    group: 'System',
    items: [
      { id: 'workflows', glyph: '⛓', label: 'Workflows', badge: { count: 5, tone: 'warn' }, purpose: 'Live per-workflow skill pipelines with in-place tuning.', buildRef: 'Stage 3' },
      { id: 'integrations', glyph: '⇄', label: 'Integrations', badge: { count: 3, tone: 'warn' }, purpose: 'Connector catalog and health.', buildRef: 'Stage 3' },
      { id: 'audit', glyph: '≡', label: 'Audit Log', purpose: 'Filterable who, what, why and rollback viewer.', buildRef: 'step 1.7' },
      { id: 'skills', glyph: '✦', label: 'Knowledge & Skills', purpose: 'KB versions, evals, precision and cost telemetry.', buildRef: 'step 1.3' },
      { id: 'settings', glyph: '⚙', label: 'Settings', purpose: 'Autonomy dials, notification routing and roles.', buildRef: 'Stage 1' },
    ],
  },
]

export const NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items)

export function navItemById(id: string | undefined): NavItem | undefined {
  return NAV_ITEMS.find((i) => i.id === id)
}
