# Parked modules — the weekly build queue

Nothing here is cancelled. On 2026-08-03 the dashboard was collapsed to a single
tab (**Online Presence Review**) so each week's module ships against real work
instead of sitting behind a placeholder page. This file is the queue: when a
module comes up, restore its rail entry in `app/src/app/nav.ts`, build it, and
delete its row here.

## How a module gets un-parked

1. Move its row out of the table below.
2. Add the `NavItem` back to `NAV` in `app/src/app/nav.ts` (definition preserved below).
3. Build to its spec in `specs/`, with a golden set if it ships a skill (§12.4).
4. Pass the UI checklist (§12.3) in both themes with real seeded data.
5. Commit, then tick it off in `MASTER-BUILD-PLAN.md` §13.

## Queue

| Module | Rail group | Purpose | Spec |
|---|---|---|---|
| Clients | Operate | The CRM backbone — one record per practice. **Built, off-rail** at `/clients`. | SPEC-SPINE |
| Today | Operate | Flags feed, approval queue, daily briefing. **Built, off-rail** at `/today`. | SPEC-SPINE |
| Inbox | Operate | support@ triage → tasks, ack drafts, completion notes (W2). **Built, off-rail** at `/inbox`. | SPEC-INBOX |
| Audit Log | System | Filterable who/what/why + rollback. **Built, off-rail** at `/audit`. | SPEC-SPINE |
| SEO Watchtower | Monitor | Rank drops and opportunities (W4). **Built, off-rail** at `/seo`. | SPEC-SEO |
| Site Health | Monitor | Uptime, SSL, domain expiry, form canaries. **Built, off-rail** at `/sitehealth`. | SPEC-SEO |
| Receptionists | Operate | AI receptionist fleet view (W1). | SPEC-VOICE |
| Meetings | Operate | Fathom transcripts → actions and agendas (W5). | — |
| Google Ads | Monitor | Monitor, approve, implement ads changes (W3). | SPEC-ADS |
| Calendar | Monitor | Publishes, posts, reports, meetings, seasonal moments. | — |
| Website Factory | Deliver | The 8-stage website build pipeline. | SPEC-FACTORY |
| Intake Wizard | Deliver | The 8-step client onboarding questionnaire. | SPEC-INTAKE |
| CMS & Sites | Deliver | Block-tree editing, change-sets, publishes (W8). | SPEC-CMS |
| Content Studio | Deliver | Translation EN⇄中文 and content work. | — |
| Prospects | Grow | Deal board and the audit-report generator. | SPEC-SALES |
| Reports | Grow | Monthly ROI and SEO report generation. | SPEC-REPORTS |
| Billing | Grow | Invoices, MRR, dunning — Xero-integrated. | — |
| Guarantee | Grow | The 6-month promise tracked against actuals. | SPEC-REPORTS |
| Workflows | System | Live per-workflow skill pipelines with in-place tuning. | — |
| Integrations | System | Connector catalog and health. | — |
| Knowledge & Skills | System | KB versions, evals, precision and cost telemetry. | — |
| Settings | System | Autonomy dials, notification routing, roles. | SPEC-SPINE |

Six of these are already built and still routable off-rail — they were removed
from the navigation, not from the codebase, and their tests still run.

## Preserved rail definitions

Restore verbatim into `NAV` when un-parking.

```ts
{ id: 'today',        glyph: '◧', label: 'Today',              purpose: 'Flags feed, approval queue and daily briefing.',                    buildRef: 'step 1.6' },
{ id: 'clients',      glyph: '◔', label: 'Clients',            purpose: 'The CRM backbone — one record per practice.',                       buildRef: 'step 1.2' },
{ id: 'inbox',        glyph: '✉', label: 'Inbox',              purpose: 'support@ triage to tasks, ack drafts and completion notes (W2).',   buildRef: 'step 1.5' },
{ id: 'receptionists',glyph: '☎', label: 'Receptionists',      purpose: 'AI receptionist fleet view (W1).',                                  buildRef: 'step 2.4' },
{ id: 'meetings',     glyph: '◉', label: 'Meetings',           purpose: 'Fathom transcripts to actions and agendas (W5).',                   buildRef: 'step 3.5' },
{ id: 'ads',          glyph: '◎', label: 'Google Ads',         purpose: 'Monitor, approve and implement ads changes (W3).',                  buildRef: 'step 3.2' },
{ id: 'seo',          glyph: '⌖', label: 'SEO Watchtower',     purpose: 'Rank drops and opportunities (W4).',                                buildRef: 'step 3.4' },
{ id: 'sitehealth',   glyph: '♥', label: 'Site Health',        purpose: 'Uptime, SSL and domain expiry, form canaries.',                     buildRef: 'step 3.6' },
{ id: 'calendar',     glyph: '◷', label: 'Calendar',           purpose: 'Publishes, posts, reports, meetings and seasonal moments.',         buildRef: 'Stage 3' },
{ id: 'factory',      glyph: '⚒', label: 'Website Factory',    purpose: 'The 8-stage website build pipeline.',                               buildRef: 'Stage 5' },
{ id: 'intake',       glyph: '➜', label: 'Intake Wizard',      purpose: 'The 8-step client onboarding questionnaire.',                       buildRef: 'step 5.1' },
{ id: 'cms',          glyph: '▤', label: 'CMS & Sites',        purpose: 'Block-tree editing, change-sets and publishes (W8).',               buildRef: 'step 5.0' },
{ id: 'studio',       glyph: '文', label: 'Content Studio',     purpose: 'Translation EN⇄中文 and content work.',                              buildRef: 'step 6.4' },
{ id: 'prospects',    glyph: '◈', label: 'Prospects',          purpose: 'Deal board and the audit-report generator.',                        buildRef: 'step 4.2' },
{ id: 'reports',      glyph: '▥', label: 'Reports',            purpose: 'Monthly ROI and SEO report generation.',                            buildRef: 'step 4.3' },
{ id: 'billing',      glyph: '▧', label: 'Billing',            purpose: 'Invoices, MRR and dunning, Xero-integrated.',                       buildRef: 'step 4.1' },
{ id: 'guarantee',    glyph: '✓', label: 'Guarantee',          purpose: 'The 6-month promise tracked against actuals.',                      buildRef: 'step 4.4' },
{ id: 'workflows',    glyph: '⛓', label: 'Workflows',          purpose: 'Live per-workflow skill pipelines with in-place tuning.',           buildRef: 'Stage 3' },
{ id: 'integrations', glyph: '⇄', label: 'Integrations',       purpose: 'Connector catalog and health.',                                     buildRef: 'Stage 3' },
{ id: 'audit',        glyph: '≡', label: 'Audit Log',          purpose: 'Filterable who, what, why and rollback viewer.',                    buildRef: 'step 1.7' },
{ id: 'skills',       glyph: '✦', label: 'Knowledge & Skills', purpose: 'KB versions, evals, precision and cost telemetry.',                 buildRef: 'step 1.3' },
{ id: 'settings',     glyph: '⚙', label: 'Settings',           purpose: 'Autonomy dials, notification routing and roles.',                   buildRef: 'Stage 1' },
```

## Parked skills

18 skills adapted from `coreyhaines31/marketingskills` moved to
`backlog/skills/`. Every one was `lifecycle_state: draft` with no golden set,
and none was referenced by server or app code. They cannot ship under §12.4
until each has a scored golden set, so they wait here rather than inflating the
active skill count.

`booking-cro-auditor` · `cold-outreach-writer` · `content-calendar-planner` ·
`launch-planner` · `marketing-council` · `marketing-idea-generator` ·
`marketing-plan-builder` · `patient-persona-researcher` · `positioning-writer` ·
`pr-outreach-writer` · `practice-offer-writer` · `practice-sms-writer` ·
`pricing-packager` · `prospect-list-builder` · `referral-program-builder` ·
`sales-collateral-writer` · `social-post-writer` · `suburb-page-planner`

Still active in `skills/`: `email-triage`, `ack-writer`, `completion-writer`
(the built Inbox pipeline), `hello-world` (runner smoke test), and
`site-seo-auditor` (folded into the Online Presence Review).
