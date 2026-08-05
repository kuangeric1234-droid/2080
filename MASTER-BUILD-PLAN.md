# 20-80 Platform — Master Build Plan

**The single source of truth for what we're building, how we build it, and how we know each piece is done.**
Version 1.0 · 6 July 2026 · Consolidates all design work to date (6 artifacts + chat deep-dives).

Visual design docs (reference, not source of truth — this file wins on conflict):

| # | Doc | URL |
|---|-----|-----|
| 1 | Blueprint (strategy/architecture) | https://claude.ai/code/artifact/52e5db76-c9f1-4f25-a584-baf6692669a3 |
| 2 | UI Spec (every tab drawn) | https://claude.ai/code/artifact/4f1ae519-4330-4104-8114-7c93ea30c623 |
| 3 | Automation Deep-Dive (traces, rules, edge cases) | https://claude.ai/code/artifact/1f1932a6-fc80-4ce1-a041-8dc3d44d8c57 |
| 4 | Live Demo (interactive prototype) | https://claude.ai/code/artifact/9d41c30e-be76-42bd-8146-c252ba545341 |
| 5 | Master Plan (tabs, skills, CRM engine) | https://claude.ai/code/artifact/c471d572-de3a-4ceb-a642-55f6cc05cb0a |
| 6 | Factory Skill Spec (build pipeline W2–W30) | https://claude.ai/code/artifact/cbd7ef1d-e248-4807-946c-3161de5a55be |

---

## 0 · How to use this document

1. **Build the current module in §13.2, one module per week.** Each step has a checkbox, a definition of done (DoD), and a test plan. A step is done when its tests pass — not when the code exists. §13.5 keeps the original staged plan as reference detail; read the stage that matches the module, don't work through it top-to-bottom.
1a. **Depth-spec discipline (this file is deliberately breadth; depth lives in `specs/`).** No stage starts until its depth spec exists: the skill methodologies at practitioner grade, the connector realities (API versions, quotas, data lag, auth failure modes), field-level data contracts, failure modes, UI deltas, and eval design. **`specs/SPEC-ADS.md` is the exemplar.** **All specs now exist ✓** — SPEC-SPINE (schema/matcher/gates/audit/notifications) · SPEC-INBOX · SPEC-SECURITY (auth/roles/APPs/NDB) · SPEC-VOICE · SPEC-ADS · SPEC-SEO · SPEC-SALES · SPEC-REPORTS · SPEC-CMS · SPEC-FACTORY · **SPEC-INTAKE (onboarding questionnaire & intake wizard — the client-facing surface of Factory Stage 2, built from 20-80's three real Initial Engagement Questionnaires)**. Before building each stage, run its **validation session** with the craft owner (Hamza: ADS+SEO · Wally: SALES+REPORTS+VOICE scripts · Ish: INBOX taxonomy+CMS) — the session confirms the spec's assumptions AND collects the golden sets. Stage mapping: SPINE + INBOX + SECURITY (stages 0–1) · VOICE (2) · ADS + SEO (3) · SALES + REPORTS (4) · FACTORY (5 — **the overnight autonomous build: AI generates the site while everyone sleeps, deploys to a demo server, humans wake up to review; brand kits are client-facing dashboard deliverables**) · CMS (**5.0 core BEFORE the first AI-generated site** — the CMS content model is the factory's output format — then stage 6 editing surfaces).

**Scale framing (so nobody under-builds this):** the platform is a multi-system SaaS — an ops dashboard, a client portal, a voice product, an autonomous website-generation service with overnight job orchestration, a CMS/publishing platform, a CRM/sales engine, and a billing system, sharing one client record and one gate architecture. It is NOT "a dashboard with features." Size decisions accordingly. Writing each spec = mining the team's actual expertise (Hamza for Ads/SEO, Wally for sales/strategy, Ish for web) — the spec session doubles as the golden-set collection session.
2. **No random prompting.** Every build session starts by reading the relevant section here, builds exactly that step, tests it, checks it off, and commits.
3. **No feature ships without quality gates** (§12): skill golden-set evals, UI review checklist, both themes, real data.
4. When a design decision changes, **update this file in the same commit** as the change.

---

## 1 · What we're building

One AI operations platform for 20-80 Solutions with two surfaces and a skills layer:

- **Agency dashboard** — the team's command centre: CRM, sales pipeline, inbox, receptionist fleet, Ads, SEO, meetings, website factory, CMS, reports, billing, knowledge/skills admin.
- **Client portal** — what each practice logs into: overview, website editing, requests, phone AI, leads, reports, meetings, reviews, approvals, assets, billing.
- **Skills layer** — ~60 named, versioned AI skills that do the work. Humans only ever do three things: **decide, approve, or talk to a client.**

### Non-negotiable principles

1. **Gate levels on every skill:** G0 silent · G1 auto-but-visible · G2 human approves · G3 restricted (named senior human; AI may not even draft — complaints/cancellations/refunds).
2. **Trust is earned per skill per client:** G2 → G1 graduation requires a measured precision streak; a human flips the switch, informed by the number.
3. **Spend never changes without a named human** (Ads Tier C, total budgets, launches).
4. **AHPRA compliance is a hard blocking gate** on all client-facing content — agency- or client-initiated.
5. **Everything is audited:** who/what/why/rollback for every action, human or AI.
6. **Bilingual EN/中文 is first-class**, not a bolt-on (calls, pages, keywords, reports).
7. **Health scores and metrics are computed, never manually set.** Annotate, don't override.
8. **The knowledge base is versioned IP** (philosophy · SEO rules · AHPRA · design directions · block library). It's what makes output 20-80-flavoured, and later what gets licensed as SaaS.
9. **No AI slop** — quality is structural (§12), not a filter at the end.

---

## 2 · Business context

- **20-80 Solutions** (2080solutions.com.au, Preston VIC): digital marketing for independent Australian health practices (dental, chiro, physio, etc.). Founder Wally Chiang; Hamza (SEO/SEM), Ish (web). Qing Guo (dentist, co-founder perspective).
- Current stack: ActiveCollab (tasks), Fathom (meetings), Slack, support@ Gmail, BrightLocal, Google Ads/GA4/GSC/GBP, Agile CRM (sales — to be absorbed), Xero (accounting — stays, gets integrated), Calendly (to be absorbed), Emergent/WordPress sites (W8 CMS replaces over time).
- Strategy: web delivery is commoditising; automate delivery, keep strategic judgement human, serve more clients with the same team, then productise as SaaS + training (~$30k program).
- Claimed numbers that set benchmarks: 14:1 Ads ROI, 18:1 organic, 10:1 minimum line, $25M client revenue generated, 100+ sites.

---

## 3 · Architecture

### 3.1 Four layers

1. **Inputs:** practice phone lines, support@, portal forms, Fathom webhooks, Google Ads API, BrightLocal, GA4/GSC/GBP, Xero webhooks, marketing channels (web forms, FB Messenger, popups).
2. **Client record & knowledge:** one record per practice (see §10) + the versioned 20-80 knowledge base.
3. **Intelligence core:** the skills (§11) + benchmark engine + change detection + approval gates.
4. **Surfaces:** dashboard, portal, ActiveCollab, Slack, client email, CMS-published sites.

### 3.2 The skills system

A **skill** = versioned prompt + allowed client-record slice + knowledge-base versions + structured output schema + declared gate level. Every run is logged (skill version, knowledge versions, input hash, output, gate outcome). Human corrections become labelled examples via the **precision-ledger**; the **skill-evaluator** runs golden-set regressions nightly and before any version promotion (a new version ships only when it beats the incumbent).

**Model tiers:** high-volume classification/triage → fast tier (Haiku-class); drafting/judgement (diagnosis, PRD, proposals, design direction) → top tier (Sonnet/Opus/Fable-class). Skill config declares its model; cost telemetry per skill/client/run.

**Security:** skills never hold credentials. They call internal platform tools (`ads.query`, `ads.mutate`, `cms.publish`, `xero.status`…) and the platform enforces caps/gates in code. A confused model cannot exceed a budget cap because the tool refuses.

### 3.3 Tech stack

- **Frontend:** React 19 + Vite + Tailwind v4, components from the **Watermelon UI registry** (cloned at `./watermellon-registry`, 260+ shadcn-compatible components, 19 dashboard templates — `lead-dashboard`, `mail-dashboard`, `meetings-dashboard`, `task-management-dashboard`, `invoice-manager-dashboard`, `incident-management` map directly to our modules). Restyle registry components to the 20-80 token set — never ship default styling.
- **Backend:** Node/TypeScript API + Postgres (client record, events, skill runs) + background job runner (crons for the 05:30/06:00 syncs) + webhook receivers (Gmail push, Fathom, ActiveCollab, Stripe, Xero, Ads).
- **AI:** Anthropic API (latest Claude models per tier above). Prompts live in the repo under `/skills/<name>/<version>/` with schema + golden set beside each.
- **Design tokens:** the established suite palette — bg `#F4F6F5`, surface `#FFFFFF`, ink `#1C2A33`, muted `#5B6C75`, accent teal `#0E7C7B` (dark `#41B8AC`), blue `#2C5FA8`, warn `#A96F14`, crit `#B23A32`, ok `#2E7D4F`; Segoe UI Variable (display/text) + Cascadia Code mono; light + dark themes token-level.

### 3.4 Hosting, environments & runtime

- **Region: Sydney (AU).** Health-adjacent client data stays in Australia. Platform app + Postgres in one region; no multi-region until SaaS phase.
- **Platform app (dashboard + portal + API + workers):** one monorepo deployed to a managed container platform with an AU region (Fly.io `syd`, or AWS Sydney if compliance hardens). Three processes: `web` (React SPA + API), `worker` (skill runs, syncs), `cron` (05:30 SEO, 06:00 Ads, month-end).
- **Jobs/queue: pg-boss on the same Postgres** — crons, retries, webhook processing, dead-letter. One less service than Redis/BullMQ; revisit only if volume demands.
- **Client sites (W8 output): static export → CDN** (Cloudflare Pages), forms POST to the platform API; Cloudflare manages client DNS/SSL. A broken platform never takes client sites down.
- **Webhooks in:** Gmail push, Fathom, ActiveCollab, Stripe, Xero, Ads — one signed `/hooks/<source>` receiver each, enqueue-then-process (never do work in the request handler).
- **Secrets:** platform secret store; MCC OAuth + API keys encrypted at rest; skills never see raw credentials (tool layer only).
- **Environments:** `dev` (local, seeded demo portfolio) → `staging` (sandbox integrations: Ads test account, test inbox, voice sandbox — every E2E test in §13 runs here) → `prod`. Deploy on merge to main after CI (typecheck, unit, golden-set evals for touched skills).
- **Observability:** Sentry + structured logs; the audit log is the business-level trace; per-skill token/cost telemetry from day 1.
- **Backups:** Postgres daily snapshot + point-in-time recovery; CMS block storage versioned by design.

### 3.5 Integrations & connectors (the MCP model)

Every external service the platform talks to is a **connector** (authored as an MCP server / mediated tool group — one authoring model, same as skills). A connector is the *only* thing that holds a vendor credential: OAuth tokens and API keys live in the platform secret store, encrypted at rest, and the connector exposes a **capped tool surface** to skills. Skills call `ads.mutate`, `xero.status`, `cms.publish`… — they never see a raw key, and the caps/gates are enforced **in the connector's code, not by the model** (a confused model cannot exceed a budget cap because the tool refuses and audit-logs the refusal). This is the concrete implementation of §3.2's security rule and the `login-customer-id`/operation-budgeter machinery in SPEC-ADS.

Connector responsibilities: hold + refresh credentials · expose the minimal capped tool surface · enforce caps/gates/cooldowns in code · run reads on schedule (crons) and receive webhooks (enqueue-then-process) · report health, data lag, quota/rate usage, and OAuth expiry to the **Integrations tab** (§4) · fail honestly (stale data suppresses that client's alerts; over-budget calls are refused and logged, never silently dropped).

**Connector inventory (21 live across 6 groups; 5 planned).** Grouped as rendered in the Integrations tab:

| Group | Connectors | Auth |
|-------|-----------|------|
| Money & billing | Xero (accounting; invoice webhooks fire the factory) · Stripe (deposits + subscriptions) | OAuth2 · API key + webhook |
| Ads, SEO & analytics | Google Ads MCC (`ads.query`/`ads.mutate`, capped; offline-conv upload) · GA4 · Search Console · Google Business Profile (posts G2) · Google Tag Manager · BrightLocal (rank/citations) | OAuth2 · API key |
| Comms & social | Gmail support@ (Pub/Sub push) · Google Workspace Admin (mailbox provisioning) · Slack (routing/digests) · Meta Graph Pages (`social.post` G2 — *currently disconnected, token refresh*) · Twilio (voice + SMS) | OAuth2 · bot token · API key · SIP |
| Meetings, scheduling & tasks | Fathom (transcripts→W5) · ActiveCollab (tasks) · Calendly (read-only, being absorbed by meeting-scheduler) | webhook · API token · OAuth2 |
| Web & hosting | Cloudflare (client DNS/SSL + Pages CDN) · WordPress/Emergent (legacy import for W8 migration) | API token · app password |
| AI & platform | Anthropic API/Claude (model tiers + Batches for evals; token telemetry) · Sentry (observability) · Postgres backups (snapshot + PITR) | API key · DSN · internal |

**Planned / phase-2 connectors (decide at the mapped stage):** GoCardless (direct debit, Stage 4 · open q #14) · Meta Ads (FB/IG paid, Stage 4 · open q #9) · Praktika / Core Practice (PMS booking + patient reconcile, Voice phase 2 · open q #4) · HealthEngine (booking availability, Voice phase 2) · Microsoft/Bing Ads (secondary search, later). Adding a connector is packaging, not a rebuild — the tool-surface + secret-store pattern is uniform.

---

## 4 · Module map

### Agency dashboard (Operate / Monitor / Deliver / Grow / System)

| Tab | Purpose | Status |
|-----|---------|--------|
| ▦ Today | Flags feed + approval queue + briefing | designed (demo) |
| 👥 Clients | CRM backbone — see §10 | designed |
| ◈ Prospects | Sales pipeline — see §6 | **new** |
| ✉ Inbox | support@ triage (W2) | designed |
| ☎ Receptionists | Fleet view (W1) | designed |
| ◎ Google Ads | Monitor→approve→implement (W3) — see §8 | designed |
| ⌖ SEO Watchtower | Drops/opportunities (W4) | designed |
| ◉ Meetings | Fathom→tasks→summaries (W5) | designed |
| ⚒ Website Factory | Build pipeline — see §7 | designed |
| ▤ CMS & Sites | W8 — see §9 | designed |
| 文 Content Studio | Translation EN⇄中文, content | designed |
| ▥ Reports | Monthly ROI/SEO generation | thin — needs build |
| ▧ Billing | Invoices, MRR, dunning (Xero-integrated) | **new** |
| ♥ Site Health | Uptime, SSL, form-canary, CWV | **new** |
| ◷ Calendar | Publishes, posts, reports, meetings, seasonal | **new** |
| ✓ Guarantee Tracker | 6-month promise vs actuals | **new** |
| ≡ Audit Log | Filterable who/what/why/rollback viewer | **new** |
| ⛓ Workflows | Automation runtime — live per-workflow skill pipelines (running/gated/blocked) + in-place tuning of a workflow's steps/skills (prompt, gate, threshold, model, order) via the draft→shadow→eval→promote lifecycle; every edit versioned, audited, reversible | **new** |
| ⇄ Integrations | Connector catalog & health — every external service as an MCP connector (auth status, exposed capped tool surface, quota/rate, data lag, OAuth expiry, reconnect); see §3.5 | **new** |
| ✦ Knowledge & Skills | KB versions, evals, precision, cost telemetry | designed (thin) |
| ⚙ Settings | Integrations health, autonomy dials, notification routing, roles | designed (thin) |

### Client portal

| Tab | Purpose | Status |
|-----|---------|--------|
| ▦ Overview | Health, activity narrated in plain English | designed |
| ▤ My Website | Tiered editing — see §9 | designed |
| ✉ Requests | Form + threads → W2 pipeline | designed |
| ☎ Phone AI | Follow-up list (PWA + push), transcripts, stats | designed |
| ◎ Leads | Form enquiries + rescued calls, status tracked | **new** |
| ✓ Approvals | Design/content/GBP sign-offs with chasing | **new** |
| ▣ Assets | Brand library + empty upload slots | **new** |
| ▥ Reports | Interactive monthly ROI | designed |
| ◉ Meetings | Summaries, actions, agenda input | designed |
| ★ Reviews | Feed + AHPRA-safe drafted responses | designed |
| ➜ Getting Started | **Intake wizard** (8-step onboarding questionnaire — appears right after first login; see `specs/SPEC-INTAKE.md`) + assets/logins checklist + onboarding progress | **new (spec'd)** |
| ▧ Billing / ⚙ Settings | Invoices · profile/users/notifications | designed |

---

## 5 · Core workflows W1–W8 (canonical rules)

Full traces and edge cases live in artifact 3. The load-bearing rules:

- **W1 Receptionist:** answers as the practice EN/普通话; FAQs from practice profile only ("reception will confirm" otherwise); emergency keywords → practice-approved script, P1 SMS; **never clinical advice**; confidence <0.7 → "listen to recording"; outage → ordinary voicemail fallback, transcribed on recovery; spam excluded from stats.

  **W1 voice architecture (runs inside our platform):**
  - **Pipeline:** Twilio SIP/DID per practice (forward-on-no-answer + after-hours from the practice's existing number — no porting, install = a forwarding rule) → streaming multilingual STT with live language ID → Claude (the brain: practice profile + FAQ pack + rules R1–R7 in a **cached prompt prefix**; tools for booking capture, SMS, profile lookup, phase-2 PMS availability) → streaming multilingual TTS. Every hop streams.
  - **Humanness = latency + turn-taking + voice.** Targets: first audio < 800ms; **barge-in** (caller interrupts → agent stops instantly); semantic endpointing (no cutting callers off mid-thought, no dead air); short turns, one question at a time, verbal confirmations of captured details; natural fillers/backchannels ("mm-hm", "let me check that"). Per-practice voice picked from 3–5 curated samples at onboarding; one *multilingual* voice per practice so EN⇄中文 keeps the same "person". Phase 2: consented voice-clone of the practice's own receptionist. **Honesty rule:** greeting identifies it as the practice's assistant; never claims to be human when asked.
  - **Language switching:** per-utterance language ID from the STT stream → Claude responds natively → same multilingual TTS voice. Handles mid-call switches and code-switching (mixed EN/中文 sentences) without a hard "mode change". Preference stored on the follow-up item. Cantonese v1: detect → capture flow + tag for the practice's Cantonese speaker; full Cantonese voice v2.
  - **Safety outside the LLM:** the emergency-keyword detector runs as a parallel deterministic stream on the transcript (any language, any point in call) → practice-approved script + P1 SMS, not a model judgement. Clinical-question refusal and the never-say list enforced in the tool/guardrail layer.
  - **Buy-then-own:** phase 1 rides a managed voice-agent runtime (fastest to market) wrapped behind our own `voice` service interface — config, transcripts, follow-up lists, analytics all live in OUR platform from day 1; phase 2 migrates the audio loop to self-hosted (Pipecat/LiveKit-class) for margin and control, with no product change visible to practices.
  - **Client-side install = the portal.** Onboarding wizard in the practice's dashboard: pick voice (hear samples) → approve greeting + emergency script → confirm FAQ pack → set forwarding rules/hours → live. Day-to-day: Phone AI tab (follow-up list PWA, transcripts EN+中文 side-by-side, stats, holiday mode toggle). Continuous improvement: call-qa-sampler scores humanness/accuracy weekly; an "unanswerable questions" report per practice feeds profile additions → faq-pack-builder rebuilds.
- **W2 Inbox:** thread dedupe; multi-request emails split; ≥0.8 confidence → auto task + drafted ack; complaint/cancel keywords → **Wally directly, no AI ack ever**; SLA matrix per request type; every inbound maps to a request or timeline entry (zero-loss, audited weekly).
- **W3 Ads:** flag gates first — tracking health, seasonality, data completeness; CPL flag at target×1.3 for 5 days (amber) / ×1.6 (red); risk classes low/med/high; >25% budget move = high; change-watch 7 days vs prediction; rejected recs stored and excluded. See §8.
- **W4 SEO:** 05:30 sync; 2-day confirmation on single-keyword wobbles (money keyword + 3-pack exit skips the wait); diagnosis reads our own CMS deploy log first; stale data = suppressed alerts for that client only.
- **W5 Meetings:** extraction dedupes against existing tasks/flags; "theirs" actions get +5d chases; agendas pre-built from open flags.
- **W6 Onboarding → W7 Metadata:** see §7 (factory).
- **W8 CMS:** content/composition as structured data; locked layout blocks; propagation-mapper keeps facts consistent everywhere; every publish versioned with rollback.

### 5.1 Support process (P-B flowchart, nodes S1–S14) — coverage map

The ongoing support loop **is** the Operate phase; most nodes map to existing machinery. New pieces marked **NEW**.

| Node | Today | Automated by |
|------|-------|--------------|
| S1 Signup | manual | Factory stage 8 hands over automatically; **NEW: support-only onboarding path** for clients who join without a site build — portal provisioning + integration connection (Ads/GBP/BrightLocal on their existing site) + baseline audit via `audit-report-generator` |
| S2 Implement support process | manual checklist | Lifecycle flip to Operate activates the whole loop — no longer a step |
| S3 Join Facebook support group | manual invite | Invite baked into `portal-provisioner` welcome checklist (see §14 open q: FB group vs portal community long-term) |
| S4 Create monthly invoice | manual | `invoice-runner` (Xero-integrated) |
| S5 Setup reputation management pack | manual | **NEW `reputation-pack-builder`:** review links, QR cards, GBP optimisation pass, practice-approved response templates — generated from the practice profile at Operate entry |
| S6 Client builds online reputation | client's homework, unsupported | **NEW `review-requester`:** post-visit review-request flows (front-desk one-tap / SMS templates; PMS-triggered in phase 2) + `review-responder` drafting AHPRA-safe replies |
| S7 Setup regular meetings | manual | `meeting-scheduler` recurring cadence (monthly/quarterly per plan) |
| S8 Conduct meetings | human (stays human) | Prepared by `agenda-builder` + `brief-pack-writer`; mined by W5 |
| S9 Produce new-patients report | **client produces it** — the number lives in their PMS | **NEW `new-patient-reconciler`:** merges platform-tracked enquiries (forms + rescued calls + portal Leads statuses) with a one-tap monthly confirmation from the practice, pre-filled with our number; phase 2 = PMS pull. Turns claimed ROI into verified ROI |
| S10 Produce ROI & SEO report | manual | `report-writer` + `insight-writer` from W1–W4 data |
| S11 Research & suggest improvements | ad hoc | W3/W4 opportunity cards + `upsell-writer` feeding the next agenda |
| S12 Document notes & actions | manual | `meeting-summariser` (dedupes vs open work) |
| S13 Implement action items | manual tracking | Tasks with SLA tracking + `nudge-writer`; "theirs" items chased by `chase-scheduler` |
| S14 Inform & review → repeat | manual emails | `client-update-writer` + `completion-writer` + portal `activity-narrator` |

---

## 6 · Sales & marketing engine (from the funnel flowchart)

### 6.1 The funnel, as designed today

**Create Awareness** (SEO, eDM, utility videos → YouTube/FB/IG, word of mouth, joint ventures, Google Ads, magazines, conferences, past-client website footers, landing pages, FB funnels) → **Initial Contact / Cold Lead** (free tools: review links, practice setup blueprint, eBooklet, marketing calendar → popup captures contact via phone / web form / Messenger / face-to-face → Agile CRM "Deal: Cold Lead") → **Give Value / Warm Lead** (Online Presence Audit Report + Suburb & Competitors Report sent with portfolio → Calendly meeting → meet & greet → "Warm Lead") → **Sales / Prospect** (proposal + costings → proposal with warm-lead video → accept/reject; accept → invoice + questionnaire → Xero payment check → start project; reject → find out reason → debrief). Regular mailouts loop back to the eDM list.

### 6.2 What automation changes (the strategy)

1. **The "Give Effortful Value" stage becomes near-free.** The audit + suburb/competitor reports are generated from machinery the platform already runs (rank checks, GBP scraping, competitor watch, review analysis). Today: hours per prospect, so rationed. Automated: **every cold lead gets a personalised audit within minutes.** Effortful for the machine, impressive to the prospect, zero marginal team time. This is the funnel's economic unlock — and the audit doubles as a taste of the client portal (deliver it as a live microsite link, not a PDF, so the prospect experiences the product before buying).
2. **Speed-to-lead in minutes.** Lead captured → enriched → audit generating → personalised nurture email out, before a competitor agency has read the enquiry.
3. **Channel attribution closes.** Spend (Ads, conferences, publications) and leads live in one system → real CAC per channel, kill/scale decisions with data.
4. **Loss mining.** "Find out reason → debrief" becomes a survey + pattern analysis across all losses (pricing? timing? feature gap?) feeding proposal and pricing improvements.
5. **Dogfooding:** 20-80's own phone line runs the clinic-call-agent (sales edition). Prospects calling after hours get captured, not lost — and it demos the product.

### 6.3 Deal stages (absorb Agile CRM into the Prospects tab)

`Cold Lead → Warm Lead → Meeting Held → Proposal Sent → Won / Lost`
Mirror of the flowchart's stage updates; each transition is automated by its trigger (audit sent + engagement → warm; Calendly booking → meeting; proposal-writer output approved → proposal; deposit webhook → won → **fires §7 stage 1**; explicit reject or 30d silence after final chase → lost → loss-miner).

### 6.4 Sales skills

| Skill | Trigger | Does | Gate |
|-------|---------|------|------|
| `lead-capture` | web form / popup / Messenger webhook / missed call / manual quick-add (conferences) | One intake pipeline: dedupe, create Deal (Cold Lead), source+channel tagged | G1 |
| `prospect-researcher` *(reused)* | lead created | Scrape their site, GBP, reviews, competitor set, rank baseline → research pack | G0 |
| `audit-report-generator` | research pack ready | **The flagship:** Online Presence Audit + Suburb & Competitor Report as a personalised live microsite; portfolio proof and relevant case study auto-selected; CTA = book a meeting | G2 first 90 days → G1 |
| `lead-scorer` | any prospect event | Cold→warm scoring from engagement (audit opened, sections viewed, email replies); stale-lead re-nurture triggers | G0 |
| `nurture-writer` | stage timers | Follow-up sequences + the "regular mailouts" eDM loop; per-vertical content; unsubscribe-safe | G2 templates, G1 sends |
| `meeting-scheduler` *(reused)* | warm lead | Booking link (absorbs Calendly), reminders, no-show rebook | G1 |
| `proposal-writer` *(reused)* | post-meeting | Proposal + costings from rate card + meeting transcript (via kickoff-miner machinery); warm-lead video script personalised for Wally to record (his face = trust; his time = 3 minutes) | G2 always |
| `deal-tracker` | all of the above | Pipeline board, stage automation, follow-up cadences, "deposit 10% discount" offer logic as configurable playbook | G1 |
| `loss-miner` | deal lost | Reason survey + interview notes → quarterly pattern report → pricing/proposal improvements | G0→report |
| `marketing-content-writer` | content calendar | Utility-video scripts, eDM campaigns, social posts, landing-page copy for the awareness layer — same anti-slop rules as client content | G2 |
| `landing-page-composer` *(site-composer reused)* | campaign brief | Specific landing pages from the block library with lead-capture wired | G2 |

**Integrations:** Agile CRM → **migrated into Prospects module** (export deals once, map stages). Xero → **stays** as accounting; invoice-status webhooks make "check Xero for payment" an event that fires the factory. Calendly → replaced by meeting-scheduler.

---

## 7 · Website factory (flowchart nodes W2–W30 → 8 automated stages)

Full spec: artifact 6. Summary — **29 nodes → 24 skills → 5 human decisions → ~15 working days.**

| Stage | Nodes | What happens | Skills |
|-------|-------|--------------|--------|
| 1 Deposit→workspace | W2, W6 | Payment webhook → portal login + checklist in 1 minute | `deposit-runner`, `portal-provisioner` |
| 2 Questionnaire→first mock | W3, W7 | Research runs before they type; **portal intake wizard** (8 steps, save-anywhere, mobile — the client-facing surface, see `specs/SPEC-INTAKE.md`); adaptive intake pushes back on thin answers; PRD v1 + IA draft; **48h style-tile/hero mock in portal** | `practice-researcher`, `intake-interviewer`, `prd-generator`, `ia-planner`, `concept-sketcher` |
| 3 Kickoff | W4, W9 | Auto-scheduled; agenda from PRD gaps; transcript mined → **PRD v2 diff, quotes preserved** → strategist approves (**H1**) | `meeting-scheduler`, `kickoff-agenda-builder`, `kickoff-miner` |
| 4 Assets | W5, W14, W15 | Upload slots from PRD manifest; validation (vector check, resolution); +3d/+6d chases; shot list from IA | `asset-requester`, `asset-validator`, `chase-scheduler`, `shot-list-writer` |
| 5 Three concepts | W8, W10–W13 | Designer approves 3 design briefs (**H2**); three full sites composed from block library; slop-critic loops; designer kill-authority review (**H3**); client **chooses** in concept gallery; feedback interpreted into revision sets | `design-director`, `site-composer`, `content-writer`, `slop-critic`, `build-qa-checker`, `feedback-interpreter` |
| 6 Build-out | W16–W18 | Long-tail pages; client edits copy in CMS pre-launch (doubles as training); metadata batch; approval #2 as portal checklist | `site-composer`, `metadata-writer`, `launch-readiness-scorer` |
| 7 Launch chain | W19–W22, W29, W30 | Launch button (**H4**) → DNS/SSL/redirects/analytics/uptime; Workspace email; GBP built; **Ads account built paused → specialist enables (H5)**; watchtower enrolment in "new site" mode | `launch-runner`, `gsuite-provisioner`, `gbp-builder`, `campaign-builder`, `watchtower-enroller` |
| 8 Handover→Operate | W23–W28 | Role-personalised training packs; final invoice; +7d survey (low score → Wally same day); auto-written retro feeds skill improvements; lifecycle flips to Operate | `handover-builder`, `invoice-runner`, `survey-runner`, `retro-writer` |

---

## 8 · Google Ads automation (connect · manage · optimise)

- **Connection:** one 20-80 MCC, client accounts linked under it (client keeps ownership); one developer token (Basic tier suffices); one OAuth credential; all accounts via `login-customer-id`. Platform holds credentials; skills call mediated tools that enforce caps in code.
- **Read loop:** 06:00 GAQL daily — campaign/ad-group/keyword stats (1/7/30d), search terms, quality scores, impression share, pacing, conversion lag buckets, **change history** (detects out-of-band edits → reconcile, don't fight).
- **The moat:** **offline conversion upload from the receptionist fleet** — rescued calls that became bookings teach Google's bidding what a real patient looks like. GCLID capture + per-campaign tracking numbers. No competitor can copy this without the receptionist product.
- **Change classes:** negatives (Claude classifies search-term intent vs practice profile) · keyword adds · budget shifts (marginal CPL + impression-share-lost) · bid-target nudges (±10–15%, never mid-learning-period) · RSA copy (AHPRA-checked) · assets/sitelinks · geo/schedule · structure (always gated).
- **Autonomy ladder:** **Tier A** auto from early (negatives under spend threshold, zero-conv pauses, assets, pacing ±10%) · **Tier B** auto after per-account trust streak (budget shifts within cap, bid nudges, keywords, copy swaps) · **Tier C** human forever (total monthly budget = client's money = contractual; new structures; >25% moves; campaign off).
- **Safety rails:** `validateOnly` dry-run → execute batched → rollback snapshot → audit → 7-day change-watch with auto-rollback proposals; cooldown one budget/bid change per campaign per 5–7 days; kill switch per account + portfolio.
- **Also:** read Google's own recommendations feed and **dismiss most of it via API** — our layer optimises for the client, not for Google.

---

## 9 · Client website editing (the "full access" answer)

Clients don't want to edit HTML — they want changes done **now**. Four tiers:

1. **Structured edits:** hours/fees/team/photos as form fields → instant publish after compliance scan.
2. **"Change anything by asking":** prompt box → `cms-edit-assistant` builds a structured change set (any scope: new pages, sections, rewrites) → before/after preview (desktop+mobile) → publish. Composed inside the design system, so output is always on-brand and unbreakable.
3. **Visual editor:** block-level direct manipulation from the approved component library; layout primitives not exposed — broken layouts unreachable, not forbidden.
4. **Raw control as contract change:** export & self-host (no-lock-in promise kept) **or** "unmanaged zones" explicitly outside the SEO guarantee and compliance liability, scanned + warned but not blocked.

**Guardrail stack on every client change:** `ahpra-checker` (hard block + rewrites) → `seo-guard` (**new skill**: detects ranking damage — gutting a ranking page, money-page H1/title changes, snippet-holding block removal, orphaned links — offers the safe alternative; money pages route to agency review) → `propagation-mapper` (facts fan out consistently) → `tone-checker` (advisory) → versioned, previewed, reversible, on the timeline. Risk lanes: safe = instant · sensitive = agency same-day review · blocked = rewrite loop. Clients graduate like skills do (clean-edit streak → more instant lanes).

---

## 10 · Client management engine

- **One record, ten surfaces:** Practice Profile/PRD (source of truth; edits are G2 + impact-analysed — suburbs→metadata re-run, hours→CMS+GBP+FAQ-pack fan-out) · Timeline (append-only event log; FLAG/EMAIL/CALL/MEETING/PUBLISHED/REPORT/INVOICE/NOTE) · KPIs vs practice-type benchmarks · Tasks (source-attributed) · Contacts & roles · Sites & CMS · Receptionist deployment · Billing (+ guarantee clock) · Assets · Skill-run history.
- **Entity matcher:** email domain→contacts→thread history; phone line = deterministic; Fathom participants; Ads/BrightLocal account-ID maps; portal auth. <0.8 → human queue; unknown domain → **prospect flow** (never lost mail).
- **Lifecycle (one phase per client, phases activate skills):** Prospect → Onboarding → Build → Launch → **Operate** (steady state) → Grow (headroom → upsell briefs on the QBR agenda, never cold pitches) → At-risk (health <40 / sentiment / unpaid 30d / guarantee off-track → Wally save-plan brief, meeting cadence doubled, G1 privileges suspended for that client) → Offboard (G3 Wally-only; one-click export; win-back check +6mo).
- **Health score (computed, never set):** 35% KPI-vs-benchmark + 20% open flags (severity×age) + 15% engagement (portal logins, report opens, attendance) + 10% SLA record + 10% sentiment + 10% billing. ≥80 healthy · 60–79 watch · 40–59 attention · <40 at-risk. Humans annotate; never override.

### 10.1 Offboarding & handover — the no-lock-in promise, engineered

Handover is not a feature bolted on at the end; it is **five ownership rules enforced at setup time** plus one orchestration skill at exit time.

**Day-1 ownership rules (enforced by the factory — clients always own their assets):**
1. **Domain** registered in the practice's name (registrant = practice; we are technical contact only)
2. **Google Business Profile**: `gbp-builder` sets the practice as *primary owner*, us as manager
3. **Google Ads** account owned by the practice, linked under our MCC (never MCC-owned)
4. **GA4 / Search Console / Tag Manager**: practice has owner-level access from setup
5. **Website is exportable by architecture** — W8 stores content as structured data and renders static output, so a complete handover bundle exists at all times

**The handover process (trigger: cancellation confirmed — G3, Wally only):**
| Step | What happens | Skill/mechanism |
|------|--------------|-----------------|
| 1 Exit interview | Reason captured, dignified-exit email, save-offer if appropriate | `loss-miner` pattern + Wally |
| 2 Website | Choice: (a) stay on hosting-only plan, or (b) full handover — static site bundle (HTML/CSS/assets) + structured content export (JSON/CSV) + DNS cutover instructions; platform form endpoints replaced with their new handler or mailto | `handover-runner` |
| 3 Domain & DNS | Registrar unlock + EPP/auth code, or registrar account transfer — theirs already by rule 1 | `handover-runner` checklist |
| 4 Google properties | Remove ourselves as GBP manager; MCC unlink (they keep full Ads history); confirm their owner access on GA4/GSC | `handover-runner` |
| 5 Receptionist | Forwarding rule removed (their number was never touched); Twilio DID grace-held 30d; recordings handled per retention then purged | `handover-runner` |
| 6 Data export | One-click ZIP: timeline, reports, invoices, call transcripts, leads, asset library, rank-history CSVs | export API (built Stage 4) |
| 7 Money | Pro-rata final invoice; dunning stops; Xero closed | `invoice-runner` |
| 8 Access | Portal → read-only export mode for 30 days → archived; any held credentials returned/rotated | `handover-runner` |
| 9 Win-back | Check-in scheduled +6 months; timeline preserved for a warm restart | lifecycle machine |

**Partial handovers** (downgrade, not exit): drop the receptionist only, or drop Ads management only, or move to hosting-only — each is a plan change in Billing that deactivates the relevant skills for that client, not an offboard. The lifecycle stays at Operate.

**Why this is also a sales weapon:** "Here is exactly what you get if you ever leave" printed in the proposal converts skeptics — it is the anti-lock-in pitch no competitor agency can make.

---

## 11 · Skill registry (~90 named skills across 13 groups)

| Group | Skills |
|-------|--------|
| **Communication (10)** | email-triage · reply-drafter · completion-writer · chase-scheduler · meeting-summariser · agenda-builder · brief-pack-writer · client-summary-writer · client-update-writer · review-responder |
| **Voice / fleet (5)** | clinic-call-agent · call-summary · faq-pack-builder · call-qa-sampler · outage-sentinel |
| **Marketing intelligence (11)** | **ads-auditor** (full-account audit methodology — SPEC-ADS §2) · **keyword-recommender** (sourcing→scoring→complete recs — SPEC-ADS §3) · ads-optimiser · change-watch · ad-copy-writer · budget-pacer · seo-diagnose · opportunity-writer · gbp-post-writer · competitor-watch · schema-validator |
| **Delivery / content (9)** | prd-generator · asset-chaser · ia-planner · build-qa-checker · launch-runner · cms-edit-assistant · translator-zh · content-writer · alt-text-writer |
| **Guardrails (4)** | ahpra-checker (hard gate) · tone-checker · propagation-mapper · seo-guard |
| **Factory (15)** | deposit-runner · portal-provisioner · intake-interviewer · concept-sketcher · meeting-scheduler · kickoff-miner · asset-requester · asset-validator · shot-list-writer · design-director · **brand-kit-generator** (client-facing design contract — SPEC-FACTORY §1) · site-composer · slop-critic · feedback-interpreter · launch-readiness-scorer |
| **Launch & handover (7)** | gsuite-provisioner · gbp-builder · campaign-builder · watchtower-enroller · handover-builder · survey-runner · retro-writer |
| **Sales & marketing (8)** | lead-capture · audit-report-generator · lead-scorer · nurture-writer · deal-tracker · loss-miner · marketing-content-writer · (+ prospect-researcher, proposal-writer, landing-page-composer reused) |
| **Business ops (7)** | invoice-runner · dunning-writer · prospect-researcher · proposal-writer · upsell-writer · guarantee-scorer · handover-runner |
| **Reporting (3)** | report-writer · insight-writer · engagement-tracker |
| **System / meta (8)** | flag-ranker · daily-briefing-writer · eod-summariser · nudge-writer · sentiment-sentinel · skill-evaluator · precision-ledger · knowledge-diff-writer |
| **Module sentinels (4)** | uptime-sentinel · form-canary · season-planner · activity-narrator |
| **Reputation & retention (3)** | reputation-pack-builder · review-requester · new-patient-reconciler |

---

## 12 · Quality system — "perfected, proper UI/UX, no AI slop"

### 12.1 The two human-taste assets (build these deliberately; they cannot be generated)

- **Block library:** the curated component set every site/page/report is composed from. Human-designed typographic scales, spacing, section patterns. AI composes within tokens; never invents CSS. Quality floor = library floor.
- **Design-directions library:** named, versioned design recipes (type pairing, palette logic, imagery treatment, density, motion). The design-director *casts* three per client against the local competitive scan. Part of the sellable IP.

### 12.2 Skill quality loop

- Every skill has a **golden set** in the repo (e.g. 100 labelled triage emails, 50 scored call transcripts, known-good metadata batches) before it ships.
- `skill-evaluator` runs regressions nightly + pre-promotion; a version ships only when it beats the incumbent.
- `precision-ledger` turns every human edit/rejection into a labelled example and moves the score that gates autonomy.
- Every bounded output states what it dropped ("7/15 accounts refreshed") — no silent truncation, ever.

### 12.3 UI review checklist (every screen, before it's "done")

**Live product references** (study trials, don't copy): **AgencyAnalytics** — primary UX reference for multi-client dashboards, monitor tabs, white-label reports/portal, AI anomaly alerts (~$20/client/mo — also our pricing benchmark). **GoHighLevel** — functional-scope reference for the agency-OS concept (sub-accounts, SaaS mode, snapshots = our stage-7 playbook) but a *cautionary* design reference (cluttered). **Vendasta** — their "Snapshot Report" validates our audit-report-generator; white-label client portal patterns. Component-level reference stays the Watermelon registry's 19 dashboard templates + our own Live Demo (doc 4) as north star.

- [ ] Real data (the demo scenarios — Hearts Dental, Mrs Lin, Yarra Hills), never lorem
- [ ] Both themes, token-level; contrast checked in each
- [ ] Severity encoded in form (stripes/pills/dots), not just text; semantic colours ≠ accent
- [ ] `tabular-nums` on all number columns; wide tables scroll in their own container
- [ ] Every card ends in an action; no dead-end statistics
- [ ] Keyboard: `/` search, j/k navigation, visible focus states
- [ ] Empty, loading, error, and stale-data states designed ("14/15 synced" honesty)
- [ ] Mobile pass (portal is front-desk-on-their-feet)
- [ ] Copy: user's words, active voice, controls say what happens; no emoji section markers, no filler

### 12.4 Skill authoring — where skills come from and how each one is built

**Format:** author every skill in Anthropic's Agent Skills format — a folder with `SKILL.md` (instructions) + resources, stored in the repo at `/skills/<name>/`. This format runs in Claude Code during development (drop into `.claude/skills/` and test interactively), and in production via the API (Skills API `/v1/skills` gives hosted create/version/list — matching our versioning model exactly) or attached to Managed Agents. One authoring format, three runtimes.

**Pre-existing skills — use for the mechanical layer only:** Anthropic's pre-built skills (`xlsx`, `docx`, `pptx`, `pdf`) are production-quality and cover document generation — use them inside `report-writer`, `proposal-writer`, and audit exports rather than building document handling ourselves. Anthropic's open skills repo + community skills cover generic coding/document/data tasks. **Nobody has pre-built `ahpra-checker` or `seo-diagnose` for Australian health practices — the judgement skills are the moat and must be built from 20-80's own material.**

**The raw material already exists — mine it before writing any prompt:**
- The intranet SOPs + ~40 YouTube training videos (26 web-dev + ~15 support) — each SOP video transcribes into a skill draft
- The support@ sent folder — years of real triage decisions and client emails in the team's actual voice
- Past reports, diagnoses, proposals, meeting notes, live sites — labelled input→output pairs for free

**The recipe, per skill (eval-first):**
1. Collect 30–50 real historical examples (input → the output a human actually produced)
2. Split: golden set (eval, never in prompt) vs 3–5 gold few-shot examples (in prompt — the single biggest anti-slop lever: the model imitates Wally's actual voice, not generic-assistant voice)
3. Write `SKILL.md`: role + house rules (from the SOP), knowledge-base slices with versions, the gold examples, **negative examples** ("never write like this", with real bad outputs), grounding requirement (every claim must trace to a client-record field — validator rejects unsourced claims), structured output schema, gate level
4. Eval loop until target: classification skills → exact-match precision (email-triage ≥95%); generative skills → rubric-based LLM-judge + pairwise vs the human original + the blind test (can the team tell which is AI?). Run evals via the Batches API (50% cost)
5. Ship at G2 — production edits/rejections feed the precision-ledger as new labelled examples; `skill-evaluator` regression-tests before any version promotes
6. Model tier per skill: fast tier (Haiku-class) for high-volume classification; top tier (Opus-class) for judgement skills (diagnosis, PRD, design direction, proposals). Knowledge-base slices sit in the cached prompt prefix (stable content first) so per-run cost stays low

**Pattern-setter:** build `email-triage` first — the support@ archive is the richest labelled dataset we have, and its recipe (mine → split → author → eval → ship gated → learn) becomes the template for the other ~60.

**The full skill lifecycle (each skill moves through 7 states):**
1. **Drafted** — SKILL.md v1 from SOP + archive examples
2. **Backtested** — scored against the golden set; iterate until target
3. **Shadow mode** — runs on live production inputs but takes NO actions; its would-be output is compared against what the human actually did for 1–2 weeks. Catches distribution drift the golden set missed, at zero client risk
4. **Live @ G2** — human approves every output; precision-ledger logs every edit/rejection
5. **Tuned** — weekly review of worst outputs + edit clusters → prompt/example tweaks → new version → skill-evaluator regression (ships only if it beats the incumbent) 
6. **Graduated** — per-category, per-client G2→G1 when the streak threshold is crossed (a human flips it)
7. **Cost-tuned** — token telemetry → stable context moved into cached prefix; model tier stepped down where precision holds

Note: "fine-tuning" here means prompt/context/example tuning against evals — **no model fine-tuning**. Cheaper, inspectable, reversible, and the precision ledger gives it real data.

### 12.5 Anti-slop rules for generated content

Composition over generation · specificity by construction (every claim traces to a source in the client record; generic copy is impossible because the inputs are real quotes/suburbs/reviews) · adversarial `slop-critic` pass (fails: "we pride ourselves on…", stock-photo feel, uniform rhythm, fake testimonials, claim-without-source) · human with kill authority before any client sees generated design.

---

## 13 · Build order — one module per week

**Changed 2026-08-03.** The staged waterfall below (§13.5) stays as the reference
detail, but it is no longer how work is picked. The dashboard was collapsed to a
single live tab and the build now runs **one module per week**: pick the module,
build it end-to-end against real work, ship it, then un-park the next one from
`backlog/PARKED-MODULES.md`. A module is only "done" when Wally has used it to do
a real piece of client work — not when its screen renders.

Why the change: 21 rail tabs were live, 15 of them placeholders, and 22 of 23
skills were `draft` with no golden set. Surface was outrunning substance. A
one-module rail forces each week's work to be finished rather than started.

### 13.1 Shipped

Spine (auth, authz, audit log, notification routing, skill runner + G0–G3 gates,
entity matcher, Inbox W2, Today, Clients CRM, SEO audit evidence layer, Site
Health). Detail preserved in §13.5 Stages 1 and 3. Six of these screens are now
off-rail — reachable by URL, absent from the navigation, tests still running.

### 13.2 Current module — 1 · Online Presence Review

The free SEO audit 20-80 offers today, industrialised. Request arrives from the
Jotform on 2080solutions.com; the platform collects evidence, proposes findings
from the house snippet bank, Wally accepts/edits/scores, and it exports as the
same `.docx` the practice already receives.

The report is **not** LLM prose. `new/1. Online Presence Review/` holds ~70
canonical paragraphs across 8 categories, most in matched positive/negative
pairs. Those paragraphs are the IP. Deterministic checks produce signals →
signals trigger snippets → a model only fills variables, makes the genuinely
subjective calls from screenshots, and writes the closing summary. Every finding
must name the signal that triggered it, or it does not appear.

Data sources are free/self-hosted only (decided 2026-08-03): own crawler,
Playwright, TLS/DNS. That fully automates Website (Technical) and Website
(Usability), semi-automates Website (Business) and Social Media, and leaves
Visibility (SEO), Visibility (SEM), Reputation and Competition as guided manual
entry with the snippet bank still doing the writing. Paid SERP/Places APIs are
the upgrade path, behind a provider interface so adding one is an adapter.

- [x] 1.0 Collapse the shell to one rail item; park 20 tabs + 18 unreferenced draft skills into `backlog/`. **DoD:** app typechecks, all tests green, no placeholder pages, no fabricated stats in the chrome.
- [x] 1.1 Snippet bank v1 — all ~70 template paragraphs as versioned, addressable records: category, variant, trigger over signals, variables, exemplar links. **DoD:** every paragraph in the source template is represented; a bank-coverage test fails if one is dropped. *(71 snippets; the coverage test cuts both ways — no dropping template copy, no inventing new copy.)*
- [x] 1.2 Schema: `intake_requests`, `reviews`, `review_signals`, `review_findings`, `review_exhibits`, `review_competitors`. Workspace-scoped, append-only provenance. **DoD:** migration applies and passes the workspace_id rule.
- [x] 1.3a **Fetch-layer collectors** (no browser, no key): sitemap discovery, multi-page crawl, TLS, DNS/MX vs A comparison, CMS + analytics fingerprint, on-page SEO, link/CTA/CAPTCHA markup, social profiles. **DoD:** ≥25 typed signals with provenance on a real practice site — 30 on heartsdental.com.au, 0 errors, 0 false findings. `npm run review:probe -- <domain>`.
- [x] 1.3b **Render-layer collectors** (Playwright): computed body font size, sticky nav, axe-core contrast, interior banner height, real load timing, and the homepage/SERP/performance screenshots the report embeds as exhibits. **DoD:** the six `layer: 'render'` signals in `SIGNAL_CATALOG` populate, and an exhibit PNG lands in the store. *(6/6 on heartsdental.com.au — `site.load_seconds` reclassified fetch→render as the sixth, now measuring the real load event rather than document download; 1440×5107 homepage PNG in the store. Each collector is isolated, so one failure costs one signal, not the review. SERP/performance exhibits still wait on a SERP provider.)*
- [x] 1.4 Rules engine: signals → candidate findings + suggested per-category star scores. **DoD:** no finding can render without a signal reference. *(Also enforced: an absent signal never fires a trigger, both halves of a pair can never ship together, and an uncollected category scores `null` rather than five stars.)*
- [x] 1.5 Review workspace: evidence + candidate snippets, accept/reject/edit, star scores, add-from-bank. **DoD:** §12.3 UI checklist with real data. *(Every finding shows the collector's own provenance next to the accept button; an accepted finding with an unfilled `{{var}}` is flagged in the row and counted on the Overall line; unscored categories read "not scored". Exhibit picker and preview shipped in 1.5b.)*
- [x] 1.5b **Exhibit picker** — the half 1.5 deferred. The exporter has placed a capture beside its finding since 1.7, but nothing ever set `finding_id`, so every screenshot fell into the Evidence block at the back while the template puts it under the paragraph it proves. Adds attach/detach, a session-guarded image route for the preview, and a picker on each capture listing only the findings that are actually shipping. **DoD:** an attached exhibit prints beside its finding and an unattached one at the back; §12.3 in both themes with real data. *(An exhibit may only point at a finding in the same review — otherwise one practice's screenshot could be filed against another's paragraph — and the file path is resolved and checked against the store root before anything is read.)*
- [x] 1.6 Jotform webhook → intake → dashboard notification + email to Wally, plus the review lifecycle (collect, decide, score). **DoD:** a test submission appears in the queue and in the inbox. *(Idempotent on submission id; never 500s — Jotform retries; a submission with no usable domain still opens a review and says so; a re-collect never destroys a reviewer's decision.)*
- [x] 1.6b **Audit a URL by hand** — type a domain on the queue page and the review opens and collects in one action. No enquiry needed; this is how an existing client, a prospect or a competitor gets audited, and it is expected to be the common path. Same intake record, audit trail and export as a Jotform request; only the notification is skipped. An *open* review of the same site is handed back rather than duplicated; a *delivered* one does not block a fresh audit.
- [x] 1.7 `.docx` export matching the existing template. **DoD:** exported file opens in Word with the same layout and star ratings as `_Online Presence Review Template.docx`. *(Cambria body / Calibri headings in the template's own blues, the eight-row summary table, a section per category with issues before strengths. Ships only accepted findings, prefers the reviewer's edit over house copy, and **refuses** to export a paragraph still holding a `{{variable}}`. Embedded exhibits wait on 1.3b.)*
- [x] 1.8 **Snippet risk classification** — `auto_safe` on every bank snippet: permission to ship that paragraph into a client's report with nobody having read it. True only for pure measurements of the practice's own site plumbing (https, analytics, CMS, load time, contrast, mobile, font size, sticky nav, email hosting, tel/mailto, CAPTCHA). False for anything manual, judgement-driven, AHPRA-adjacent, or about a third party — competitors, reviews, social — because those are the sentences a practice is harmed by getting wrong. **DoD:** every snippet answers the field; no `ahpra_blocking` snippet is `auto_safe`; the set is pinned by id in `bank.test.ts` so widening it takes a deliberate edit. *(18 of 71. Deliberately narrower than "deterministic": `tech.wpadmin.default`, `seo.onpage.*`, `biz.email.public_domain`, nav counts and `use.banner.tall` are all machine-measured but left for a human — the first three carry a judgement the allowlist did not name, and banner height runs on an uncalibrated heuristic (1.3b).)*
- [x] 1.9 **Auto-accept pass on collect** — a finding whose snippet is `auto_safe` lands `accepted` with `decided_by='auto'`; everything else stays `candidate` for a human. Three conditions, deliberately redundant: `auto_safe`, not `ahpra_blocking`, and no unfilled `{{variable}}` (the export would refuse it anyway, and a finding parked in `accepted` that can never ship is worse than one awaiting review). **DoD:** a collected review exports with findings and zero human input, while every AHPRA and judgement finding stays `candidate` and is absent from that document. *(A human's ruling is final: only an untouched candidate is promoted, and a rejection is never resurrected by a later crawl. The DoD test runs first in the file, before any other test accepts anything, so it sees only what the collector decided on its own.)*
- [x] 1.10 **review-summariser skill** — `skills/review-summariser/v1`, G1, judgement tier. Writes the Recommendations opening and the Overall comment from the **accepted** findings only. The bank ships house copy verbatim; these two paragraphs are the one place a model writes prose about a real business, so a grounding validator rejects any number, percentage or domain that is not in the evidence and nothing is written. **DoD:** the export opens on a written summary; a test proves an invented measurement is caught; the skill stays SHADOW on a synthetic exam. *(Refuses rather than repairs — a summary trimmed of its invented number still came from a run that invented one. Prose-level claims need a judge with real material: BLOCKERS.md `review-summariser golden set`.)*
- [x] 1.11 **Social metrics behind a provider** — `SocialProvider` with `MetaGraphProvider` (real) and `MockSocialProvider` (PROVISIONAL); six `layer: 'provider'` signals and a new `provider` signal source, because a credentialed third-party API is a fourth kind of provenance and the evidence trail should say so. Fills the bank's long-unfilled `{{fans}}`/`{{followers}}`/`{{posts}}`. **DoD:** signals populate with provenance; swapping a real provider in is an adapter, not a rewrite. *(**Tested live 2026-08-04**: a Graph token reads pages the user administers but returns `(#100) missing permission or reviewable feature` for every practice page — prospect metrics need Meta's Page Public Content Access, i.e. App Review + Business Verification. So the real provider returns null rather than a guess, no signal is emitted, and the reviewer fills Social Media by hand as the template's own margin comments describe. Every social snippet stays `when: manual`, so nothing sourced this way can auto-accept.)*
- [x] 1.12a **Competitors — the manual path** (server). `review_competitors` had never been written to and had no route, so the Competition section could never render: an absent feature, not a formatting bug. Adds add/update/remove with the technical facts collected automatically once a domain is named (comp.row's own note describes that split), the `manual.competitors.count` signal that `comp.intro`/`comp.row` trigger on, and row assembly from the bank's `row_template` instead of an ad-hoc join in the exporter. `SerpProvider` sits behind it with `NoSerpProvider`, which returns nothing on purpose. **DoD:** a competitor added by hand renders in the .docx Competition section via comp.row; the automatic half is PROVISIONAL. *(Caught a real bug: with no facts at all the either/or token printed "not secure" about a competitor nobody had checked. Not-measured now differs from measured-false.)*
- [x] 1.12b **Competitors — the workspace UI**. Add/remove from the review workspace, with each fact chipped by where it came from — green for measured from their site, grey for typed by a reviewer — because comp.row's own note draws exactly that line and Wally needs to know which half he still owes. **DoD:** add/edit/remove from the workspace and it reaches the export; §12.3 in both themes with real data. *(The visual pass earned its keep: the chips read "HTTPS: false" and "Online booking: true" — raw booleans the tests happily asserted. They now read "Not secure" and "Online booking", which is how the report speaks.)*
- [x] 1.13 **End-to-end unattended report** — queued the way intake queues it, collected, auto-accepted and summarised with nobody touching it, then exported. **Verified on heartsdental.com.au 2026-08-04:** 35 signals, 12 findings of which **7 accepted with no human**, a grounded model-written opening, one exhibit, and a 48-paragraph .docx carrying the letterhead, the page footer, the eight-row star table, a section per category with issues before strengths, and the screenshot under Evidence. *(Four of the eight categories come up empty and the reasons are known, not mysterious: Website (Business) and Visibility (SEO) wait on Wally's judgement by design; Visibility (SEM), Reputation and Social Media wait on providers nobody has bought; Competition waits on somebody typing a competitor. Roughly 58% of what fired shipped unread.)*
- [x] 1.14 **Google research — reputation and competitor discovery**. `PlacesProvider` with `GooglePlacesProvider` (real) and `NoPlacesProvider`. Text Search finds the practice the way a person would, Place Details returns its rating and review count, Nearby Search returns the same-trade practices within 5km — which is what a competitor set is. Fills `rep.reviews.*`'s `{{count}}x {{rating}}*` and seeds `review_competitors` so the Competition section populates itself. **DoD:** signals carry Places provenance; a missing key produces nothing rather than a plausible rating; a bad key is loud. *(Measured against the 17 real reports: the Google review line appears in 15/17 and a competitor set in 15/17 — one key covers both. The trade searched is inferred from the practice name, because a chiropractor's competitors are not dentists.)*
- [x] 1.15 **One bank, every trade** — six of the 71 paragraphs were mined from a dental template and say "dental", "dentists" or "teeth"; the real reports carry the same paragraphs for chiropractic and dermatology with the trade swapped. They now take `{{profession_adj}}`, `{{practitioners}}`, `{{condition_examples}}` and `{{treatment_example}}`, filled from the trade inferred for the practice — the same inference that decides what Google is asked for nearby, so the trade searched and the trade written about cannot disagree. **DoD:** every profession variable fills for any trade including an unknown one, and the bank still traces to the source template. *(One paragraph with a variable, not one per trade: forking the copy per vertical would triple what has to stay in step and is how a house style stops being one.)*
- [x] 1.16 **Performance exhibit via Lighthouse** — `PageSpeedProvider` over Google's PageSpeed Insights, which is **free with a key** unlike Places. Produces `perf.score`, LCP/FCP/Speed Index in seconds and Lighthouse's own highest-impact fix, plus its rendered screenshot written as a `performance_report` exhibit — the `review_exhibits.kind` that has existed since 1.2 with nothing ever producing one. **DoD:** timings parse to seconds, the exhibit lands as a real PNG, a quota failure is loud. *(The template's own margin comment says to test speed with GTmetrix from Australia; this is the official equivalent. 10 of 17 real reports carry the resulting paragraph.)*
- [x] 1.17 **Severity legend** — ~~every real report colours each finding and prints a legend~~ **corrected 2026-08-05 by the 1.19 harness: exactly one of the 17 does — Oh Dental. The other sixteen carry no severity colour anywhere and no legend.** The claim below was wrong when written; the feature stays because it was asked for by name, but it is a deliberate divergence from house style, not a match to it. Colours: Positive `00FF00`, Negative (Moderate) `FF9900`, Negative (Critical) `FF0000`. Adds `severity` to the bank, seeded from Oh Dental's own colouring of 36 findings (**not** a 17-report majority vote), and prints the legend between Recommendations and the first section as Oh Dental does. **DoD:** the legend appears, each finding carries its own ink, the template's exact hex values. *(`severity` is not `weight`: `biz.website.dated` is weight 3 but moderate, `biz.conditions_content.missing` is weight 2 but critical. Weight is scoring impact, severity is how alarmed the reader should be. Anything never observed in colour defaults to moderate when negative — critical is earned, not assumed: 5 critical, 49 moderate, 17 positive.)*
- [x] 1.18 **Summary-table Comments column** — the Comments cell beside each star score is a written verdict in all 17 real reports ("Great performance and diversified email/server", "Need more service, conditions and reasons for new patients visit content", "Abandoned social media"), telegraphic and three to twelve words; mine printed the category's static dimension list, which is only what the *blank* template carries. The summariser now returns `category_comments` alongside the two paragraphs, each one grounded against the accepted findings by the same validator, persisted to `reviews.category_comments`, and rendered in place of the dimension list. **DoD:** the summariser's verdict reaches the table and the dimension list for that category is gone; a category with no findings prints `N/A`. *(Written by the skill rather than templated per category, because the verdict has to reflect what was actually found — a canned line per category would be house copy that says nothing, and the reader treats this column as the executive summary.)*

- [x] 1.19 **Fidelity harness** — until now every check compared the code to my own intention, which cannot answer whether the document reads like one of Wally's. This parses the 17 completed reports back out of OOXML (`docx-read.ts`), reduces them to what can be compared (`fidelity.ts`), audits a real practice unattended, and diffs the two — chrome, section order, table shape, star rendering, severity ink, exhibits, findings per section, and paragraph coverage against the bank. Writes `docs/FIDELITY-LEDGER.md` with a weighted score, and **that ledger is the work queue from here**. **DoD:** every gap states its reference count so it can be argued with, the score moves when a gap closes, and the reader is pinned by tests that build their own documents rather than reading the reference folder (it lives on one machine). *(Threshold: a pattern in fewer than 3 of 17 is one reviewer's choice on one report, not house style. That rule is what demoted 1.17 from "what every report does" to "what Oh Dental does".)*

- [x] 1.20 **Five star glyphs, the unearned ones tinted** — first gap closed off the 1.19 ledger. A score printed as many asterisks as it scored, so a 1 was one character wide and a 5 was five; **16 of 17 reference reports print five glyphs in every cell**, the earned ones black and the remainder in `B8CCE4` (122 of the 141 pale runs; the other 19 are `C6D9F1`, one template generation copied forward). The seventeenth has a single four-glyph cell — a slip, not a convention. **DoD:** every scored cell holds exactly five glyphs, an unscored one still prints an em dash, and the tint is asserted by ink rather than by glyph count. *(This is about reading down the column: equal-width cells let a partner compare rows at a glance, and three asterisks hide the denominator — three out of what?)*

- [x] 1.21 **N/A, never the writer's prompt** — the Comments cell fell back to the category's dimension list ("UVP, Content, Personal, Frequency, AHPRA…") whenever the summariser had written nothing for that category, which put the blank template's *question* where a client expects the *answer*. **13 of 17 reference reports print `N/A` there instead, and not one of their 153 Comments cells is left empty.** The fallback is now `N/A`, and `mockReviewSummary` returns a comment for every category rather than only the ones with findings, so the tests exercise what SKILL.md already tells the real skill to do. **DoD:** no cell is empty, no cell is a dimension list, and a category with nothing measured prints N/A. *(Also fixed the harness check that made this look unfixed: `N/A` is literally Visibility (SEM)'s whole dimension list in the blank template, so matching on text alone counted every deliberate N/A as a placeholder — it was flagging the reference reports themselves.)*

- [x] 1.22 **Severity ink on the bullet, not the text** — the colour sat on the finding's own runs, so thirty paragraphs of a client's report came out orange and red. Oh Dental — the only reference that colours findings at all — puts it on the paragraph mark, which is what Word paints the **list bullet** with, and leaves the sentence black. The legend is now bulleted the same way, so it samples the thing it explains rather than describing it in a different style. **DoD:** every coloured finding carries `bulletColor` and no finding's text is coloured; the three legend items carry `00FF00` / `FF9900` / `FF0000` on their bullets. *(The `<3 of 17` rule would normally retire a one-report pattern, but the colour itself is here by explicit request — given it exists, Oh Dental is the only reference for where it goes, and the alternative is worse typography on its own merits: the dot carries the signal, the sentence carries the meaning.)*

- [x] 1.23 **No section announces its own emptiness** — an empty section printed "Not assessed in this review."; **0 of 17 reference reports contain any such sentence**, and it was the clearest machine-written thing in the document — the report admitting mid-page that it was assembled rather than written. Incompleteness is a fact about the document's *status*, so it is now stated once at the top ("DRAFT — not ready to send", with the sections named) and disappears when a reviewer fills them. All eight headings still print. `empty_note` removed from `categories.json` and `CategoryDef` — my change orphaned it. **DoD:** the body contains no such sentence, the notice names exactly the empty sections and no filled one, and a complete report carries no notice. **Note: the ledger score went 5 → 14 on this change and that is correct** — the placeholder was being counted as content by the thin-section check, so the report was never as close as 5 suggested. *(A client who receives a draft by accident now sees a loud warning at the top instead of a quiet hole in the middle.)*

- [x] 1.24 **The harness measures the reviewer ceiling, not just the unattended run** — 1.19 read only the document that falls out with no human input, and §13.4 *guarantees* that document is thin: a judgement finding stays a candidate until a person rules on it. So the ledger was reporting "thin section" gaps that no amount of building could close, and mixing them in with gaps that are real. It now exports twice — unattended, and again with every candidate accepted — and reports both. **The ceiling is the number that matters:** what survives there is what the platform cannot produce, and that is the queue; what exists only unattended is a reviewer doing the job §13.4 deliberately left them. **DoD:** two scores in the ledger, the queue table drawn from the ceiling, and a separate table for what a reviewer closes. *(Diagnosis that forced this: Website (Business) renders nothing unattended, but the bank fired two correct findings there and four of its six other paragraphs are `judgement` triggers. Nothing was broken. The measurement was asking the wrong question.)*

- [x] 1.25 **dd/mm/yyyy, and gaps that say when they are blocked** — two small honesty fixes. The date printed "5 August 2026"; **all 17 references write dd/mm** (11 with a four-digit year, 6 with two), zero-padded, so it is `04/08/2026`. Separately, the ledger labelled every gap `buildable`, including four that no amount of code will close — it was telling a reader to go and build something that needs a purchase or an application instead. Thin sections now carry `blocked` plus the specific credential, pointing at the `BLOCKERS.md` entry that would release them. **DoD:** the long date form appears nowhere, and Social Media / SEO / SEM / Competition / Reputation report the credential blocking them rather than claiming to be buildable. *(Ceiling 8 → 7. What is left in the queue is one buildable thin section and three blocked ones.)*

- [x] 1.26 **Archive signals — built, and it did not close the gap it was aimed at** — `biz.website.stale` ("hasn't been updated since {{year}}, according to {{web_archive}}") is in **7 of 17** reports with a trigger nothing has ever satisfied. `WaybackProvider` over the Internet Archive's CDX API — free, official, no credential — now produces `archive.last_change_months`, `archive.snapshot_url` and, only past 24 months, `archive.last_major_update_year`; `varsFromSignals` fills both variables so the paragraph ships with the year and a capture a reader can open. **The ceiling did not move (7 → 7), and the step is recorded as not closing Website (Business).** The reason is worth keeping: the human means the *design* hasn't changed, the archive measures *bytes*, and bytes move whenever a plugin updates — Camberwell's report says 2018 while its HTML changed 8 months ago. Firing on the byte measure would tell practices their site is frozen when it is not. **DoD:** the paragraph fires filled-in on a genuinely frozen site, publishes nothing on a fresh one, and a failed lookup is loud rather than silent. *(Also checked and dropped: `biz.blog.abandoned` is 2 of 17 and `biz.blog.active` 0 of 17 — below the threshold, so WONTFIX rather than built.)*

- [x] 1.27 **Exhibits live inside sections, and two observations struck** — the homepage capture landed after Competition, under no heading. **Every image in all 17 references sits inside a section**; a homepage capture is under Website (Business) in 12 of 17, and Website (Technical) carries one in 17 of 17 (the speed test — exactly what `performance_report` is). Loose exhibits are now placed by kind; a kind with no precedent still goes to the back rather than being guessed. **Struck after quantifying:** O5 (quote the mail host in `tech.email.same_server`) is **1 of 17** — one reviewer's thoroughness, not house style; O3 (the optimistic closing paragraph) is not a defect at all — it is already in the bank as `summary.closer.optimistic` and already ships **at the ceiling**, absent only from the unattended document. **Ceiling 7 → 10, because the count was flattered again:** the exhibit caption had been sitting under Competition and counting as its one "finding", so `countPerSection` now counts list items only — findings are bulleted, captions and intros are not. **DoD:** the capture renders inside Website (Business), an unprecedented kind still falls to the back, and no caption counts as a finding.

- [x] 1.28 **The sample summary stops contradicting itself** — observation O4. `mockReviewSummary` built its "weak" and "strong" lists independently, so a category with both a problem and a strength was named in both sentences: *"particularly around website usability … your website usability already works in your favour"*. A category with a problem is now simply weak. It also printed raw category keys as prose — "website technical" is a database column — and comma-spliced its lists. **DoD:** no category appears in both halves, no underscore key reaches the page, lists join with "and". *(This is the mock, not the product. The real point of O4 stands unfixed and unfixable here: the grounding validator passed that paragraph, because every claim in it traced to a finding. **A summary can be fully grounded and still be nonsense**, and only Wally's past reports can score that — BLOCKERS.md, `review-summariser golden set`.)*

- [x] 1.29 **The Comments cell is a walk through the category's dimensions** — asked for directly. The cell was one free-standing verdict; **7 of 17 reference reports instead walk the category's own dimension list**, naming each and giving it a two-to-five word judgement: *"UVP needs to be added, Need more content, Good photos, Online booking is missing"*, *"Performance needs improvement, Analytics is active, Hosted in Australia and emails are hosted on Outlook"*. Above the threshold, so it is house style. The skill now receives `categories: [{key, label, dimensions}]` and SKILL.md carries the register with eight verbatim examples. **DoD:** the cell names dimensions from that category's own list, a category with no findings still prints N/A, Overall Score stays a forward-looking sentence rather than a dimension walk. *(The hard rule, and it is instruction-enforced rather than validator-enforced: **only name a dimension the findings actually speak to.** The list is what a category could be assessed on, not what was. "AHPRA fine" when nothing checked AHPRA is inventing a measurement, and it is worse here than anywhere because the cell reads as a completed checklist. The grounding validator catches invented numbers and domains; it cannot catch this. One more reason the skill stays in shadow until the golden set exists.)*

- [x] 1.31 **Reputation writes itself; competitors are the top three** — with the Places key live, the three count-based reputation paragraphs now fire from Google's own number instead of waiting for a reviewer to raise them. **The threshold is read off the reports, not invented:** across the references "small amount" is used at 8, 17 and 18 reviews and "good amount" at 21, 24, 44, 73, 79, 142 and 227 — a clean break, so the line is 20. Competitors are capped at **three, strongest first by review count**: of the 13 references that name competitors the median is 3 and **not one lists more**, so which three is the whole decision, and nearest-first would rank a quiet single-chair clinic above the busiest practice in the suburb. Ratings print to one decimal — "228x 5.0*", the template's own format — in both the Reputation line and the competitor rows. **DoD:** the reputation paragraph fires filled from the live count, the competitor list is three long and ordered by strength, and the manual worklist for Reputation drops from five items to the two that are genuinely judgement. *(Still `auto_safe: false`, so these arrive as candidates for the reviewer rather than shipping unread — §13.4 untouched. The three competition **verdict** paragraphs stay manual on purpose: they say "judging by their website, social media and online reputation", and we have no social data at all, so firing them would assert something never looked at.)*

- [x] 1.32 **Positive halves of measured pairs — WONTFIX on five of six, and the counting instrument was wrong** — the premise was that a site which passes a check gets silence while one that fails gets a paragraph, and that the missing halves should be built. Counting them killed it. The first count said the nav-sticky positive was 3/17, which clears the threshold; reading the three showed one of them was Camberwell saying the **negative** — "The navigation bar *should* float down" against "floats down", one word different in forty, scoring 0.89 against each other. A plain overlap count credits a positive with every report carrying its twin, and that is a systematic error in every paired count anyone runs, not a one-off. `count-probe.ts` now scores a paragraph against **all** variants in a group and awards it to the nearest, so a report votes once for the half it actually says. Honest counts: nav sticky **2/17**, third-party links in a new tab **1/17**, legible navigation **1/17**, sufficient font size **1/17**, non-default admin URL **1/17** — every one of them Oh Dental, alone. Only the fast-load positive clears at **6/17**, and 1.34 owns it. **DoD:** met by measurement rather than by code — the halves under threshold are recorded here with their counts and are not built. *(Oh Dental is the only reference that praises a check the site passed, which is the same report that is the only one to colour its findings — 1.17, 1.22. It is one unusually thorough reviewer, not house style, and the threshold exists precisely to stop one such report from setting it. Worth naming what this does **not** excuse: the export was not silent about these checks, it asserted the negatives — which is a facts problem, and 1.33's, not a copy problem.)*

- [x] 1.33 **The three findings the reference contradicts — we were right once and wrong twice** — three claims, three different answers, which is the argument for checking rather than assuming either side. **`/wp-admin` — the probe was right.** The reference says the site "doesn't use the default admin login URL https://ohdental.com.au/wp-admin/ which is great", quoting the default URL in the sentence denying it. `/wp-admin/` 302s to `/wp-login.php`, which serves WordPress's stock login form: that redirect *is* the default behaviour of every unhardened install, not a defence. No change; a test now pins both the stock case and a genuinely moved login (404 → no signal). **Third-party links — the probe was measuring the wrong thing.** It counted anchors across the crawl, so one destination in a global header scored once per page, and the practice's own booking system counted as a distraction from the inquiry it *is*. 60 on four destinations. Now a set of destination hosts with the booking system excluded, and the provenance names them. **The sticky nav — the probe was wrong.** It asked whether the nav held its offset within 8px; ohdental's condenses from 83px to 41px inside a `position:fixed` wrapper — plainly still on screen — and failed. `navIsSticky` is now a pure predicate asking the question the paragraph asks: still in the top band, and it stayed behind while the page moved. **DoD:** met — nine tests off the real markup and the real numbers, `render.nav_sticky` flips to true on the live site, and the same-tab count reads 3 named hosts instead of 60. *(**Ceiling unchanged at 6; unattended 12 → 13, and the rise is the point** — Usability lost a finding because the finding was false, and a harness that scored the report better for carrying a wrong sentence would be measuring the wrong thing too. Also seen and not fixed: `render.contrast_violations` returned 0, 1, 0 across three runs of the same page, so axe is reading something that varies between loads. Out of scope here, but the flake is real and `use.contrast.fail` rides on it.)*

- [x] 1.34 **Hosting and performance never reached the document — two faults, and the first hid the second** — the signal was not absent. `site.load_seconds` fires on every run and always has; `site.host.country` has sat in the catalogue since 1.3a **with nothing anywhere emitting it**, so `{{host_country}}` never filled, the export refused the paragraph for holding a variable (1.7), and 1.9 declined to accept it for the same reason. A refused paragraph and a paragraph that never fired look identical from outside, which is how the line 14 of 17 references carry went a whole module without once reaching a document. Underneath it, the second fault: only the negative half existed, so the moment the country filled, a site loading in 1.6s would have been told it "took 1.6 seconds to load which isn't ideal". The country now comes from **reverse DNS on the origin IP** — free, no key, DNS being a source §13.2 already allows, and precisely what the reference reviewer did by hand: Oh Dental's report quotes `syn03ge.syd5.hostyourservices.net` and reads "syd5" exactly as `australianHostMarker` does. A host that cannot be placed publishes nothing. The paragraph splits on the two-second line its own text names, with the fast half quoted at **6/17** from Advanced Chiropractic. **DoD:** met but for the exhibit — fast and slow halves each fire and render filled, and the export now carries "hosted in Australia … took 1.6 seconds to load which is great". **The performance exhibit could not be verified live: the PageSpeed daily quota is exhausted on the configured project.** The collector does the right thing with that — one loud error, no signals, no guess — and a docx test now pins the placement under Website (Technical) that 1.27 built and nothing had ever asserted end to end. *(**Ceiling unchanged at 6.** Two guards fired and both were right to. The traceability test traces to the blank template, which ships only the negative half; rather than loosen it, quoted report copy now lives in `source-reports.txt` with its report names and count, and is held to naming them. The `auto_safe` list is pinned by id so widening is deliberate — this widened it to 19, on the grounds that the same measurement read the other way round cannot be less safe than its twin.)*

- [x] 1.35 **One of the two sections, and the DoD's other half refused** — the counts split them cleanly. `sem.access.request` is **2/17** (Oh Dental and Windsor Dental Care): below the threshold, so it stays `manual` and Visibility (SEM) stays a reviewer's section. `social.video.opportunity` is **13/17** — house copy by any reading — and had been sitting behind `when: "manual"`, meaning a reviewer had to go and find it in the bank drawer on every single review. Now `when: "always"`, so it is proposed on every review. It was already trade-neutral from 1.15, so a chiropractor is offered "chiropractic IQ" rather than "dental IQ". **DoD: half met, and the other half is refused rather than worked around.** "Neither section is empty on an unattended run" cannot be done without making a social snippet `auto_safe`, which §13.4 and 1.8 forbid — and the bank test forbids it twice over, since `always` and `auto_safe` are mutually exclusive by design. So the line reaches the reviewer's desk on every review, not the client's inbox, and Social Media is still named in the draft notice until a person accepts it. *(**Ceiling 6 → 3**, the largest single move so far and none of it from new prose: "Social Media is thin" fell from major to minor because the section went from 0 findings to 1. Worth saying plainly — the DoD asked for something that contradicts a standing rule, and the rule won. A section that fills itself unread is exactly what §13.4 exists to prevent.)*

- [x] 1.36 **The summary is written once and goes stale** — it ran at collect time over whatever 1.9 had auto-accepted by then, and never again, so every finding a reviewer accepted afterwards was invisible to it. That is the whole explanation for the `N/A` beside a Website (Business) row whose section carries two bullets, and for an opening paragraph describing a thinner report than the one it opens. The export now brings it up to date on the way out — the last moment the accepted set can change. **Not unconditionally:** `reviews.summary_basis` records the fingerprint of the accepted set the stored summary was written from, and the re-run is skipped when it matches. A model asked the same question twice does not write the same paragraph, so exporting an untouched review twice would otherwise hand the reviewer two different documents and no way to tell which was the real one. A refusal from the grounding validator now **fails the export with the reason** rather than silently leaving the stale summary in place: 1.10's refuse-rather-than-repair, extended to the case where the thing not repaired is already on the page. **DoD:** met — accepting a finding moves both the Comments cell and the opening paragraph, the `N/A` goes, a re-export with nothing changed is byte-for-byte the same summary, and an ungrounded run 422s into the workspace's existing "Not exported —" banner. *(**Ceiling unchanged at 3**, which is right: this changes what a reviewer's report says, and the harness only ever reads the unattended run and the ceiling — both of which accept everything in one pass and so never had a stale summary to catch. A gap the harness structurally cannot see is exactly the kind `FIDELITY-OBSERVATIONS.md` exists for.)*

- [x] 1.37 **Competitors arrive as names and review counts only — because Nearby Search does not return a website** — the manual path has collected a competitor's technical facts since 1.12a, and nothing ever ran it on the ones Google seeded. The reason turned out to be one field: **Nearby Search carries neither `website` nor `opening_hours`**, only Details does, so every seeded competitor was stored with a null domain and `collectCompetitorFacts` had nothing to crawl. The top three are now hydrated with a Details call each — the same call `findPractice` already makes — and then crawled like any other site. `days_open` counts *distinct* days from `periods`, because a practice open twice on a Saturday appears twice. A failed lookup or an unreachable site costs that competitor its extra facts, never its row. SERP, map and every `fb_` fragment stay dropped: `NoSerpProvider` returns nothing on purpose and there is no social data, and printing "#1 in Google search" about a named third party on 20-80 letterhead with nothing behind it is the worst thing this file could do. **DoD:** met — `Flagstaff Hill Dental Care, secure, 84 pages, online booking, open 5 days, Google: 678x 5.0* reviews`, three of them, in `comp.row`'s own order. *(**Ceiling unchanged at 3** — the harness counts findings per section and the Competition rows were already being counted; what changed is what each one says, which it cannot see. **And it found a real race**: seeding was a check-then-insert, so two overlapping collections of one review both read zero and both wrote — the section capped at three printed six, each competitor twice, once thin and once with facts. Not hypothetical: `receiveIntake` queues a collect and the harness also calls `collectReview` directly, so the harness was racing the API's own worker. 0014 puts the identity in the table, and the harness now passes `autoCollect: false` — measuring the platform should not involve competing with it.)*

- [x] 1.38 **The Competition verdict — WONTFIX, and 1.31 was right for the reason it gave** — both routes were tried against the sixteen Competition sections and both close. **Route one, fire only when every named fact is present:** every verdict that clears the threshold names social media without exception — open_field "according to their online presence, social media followers and online reputation", leading "improving on areas that you're weaker in such as social media", behind "judging by their website, social media and online reputation". We have no social data for the practice and none at all for a competitor, and Meta Page Public Content Access is blocked behind App Review (1.11, BLOCKERS.md). **Route two, a variant that claims only what we measure:** exactly one exists — Expert Smiles' "You have strong competitors in your area but no one practice is dominating the area" — and it is **1/17**. So the verdict stays a reviewer's line, and the house copy stays unedited. **DoD:** met as the second branch — documented, with counts. *(**The counting caught something worth keeping.** Oh Dental's Competition section carries **all three** verdicts at once, which contradict each other — an untouched template block, and the reason that section was excluded from the report comparison that produced these seven steps. Counting it credits every verdict with a report that chose none: `comp.verdict.leading` is 3/17 with Oh Dental and **2/17 without**, which is the difference between clearing the threshold and not. `count-probe.ts` carries the caveat so the next person to count these does not have to rediscover it. **Ceiling unchanged at 3** — no code was written.)*

### 13.3 Module queue

Next modules are pulled from `backlog/PARKED-MODULES.md`. Order is set weekly by
what the business actually needs, not by this list. Detail for each lives in
§13.5 and in `specs/`.

### 13.4 Rules that survive the change

Unchanged and non-negotiable: G0–G3 gates on every skill · AHPRA checks are hard
blocking gates · spend never changes without a named human · `workspace_id` on
every table · skills call platform tools, never raw credentials · a golden set
before any skill ships (§12.4) · the UI checklist on every screen (§12.3).

### 13.5 Reference — the original staged plan

Kept for the detail. Read the stage that matches the module being built; do not
work top-to-bottom through it.

### Stage 1 — Spine *(everything else writes into this)*
- [x] 1.1 Repo scaffold: Vite + React 19 + Tailwind 4, token set, Watermelon components vendored & restyled. **DoD:** app shell with rail/topbar in both themes.
- [x] 1.2 Postgres schema: clients, contacts, timeline_events, tasks, requests, skill_runs, audit_log, deals. **DoD:** migrations + seed with demo portfolio (Hearts, Yarra Hills, Smile Council, Trowse, Aspire One, Smile To Go).
- [x] 1.3 Skill runner: versioned prompts from `/skills/`, structured outputs, run logging, gate framework (G0–G3). **DoD:** a hello-world skill runs, logs, and renders its gate card.
- [x] 1.4 Entity matcher + timeline. **Test:** golden set of 30 emails/events routes ≥95% correctly, <0.8 goes to queue.
- [x] 1.5 **Inbox (W2):** Gmail push webhook → email-triage → task creation (ActiveCollab API) → ack drafts → completion-writer on webhook. **Test:** the Hearts double-request email E2E (split into 2 tasks, ack drafted, bio chase scheduled); zero-loss audit query returns empty. *(Gmail/AC/model behind PROVISIONAL mocks; email-triage shadow-blocked — see BLOCKERS.md)*
- [x] 1.6 **Today tab:** flag-ranker + approval queue + tiles. **Test:** approve/reject flows mutate state + audit log.
- [x] 1.7 Audit Log viewer. **DoD:** filter by client/actor/workflow; every 1.5–1.6 action appears.

### Stage 2 — Receptionist product (W1) — build to `specs/SPEC-VOICE.md` (honest sizing: 6–8 wks + pilots in parallel with Stage 3; the pilot calendar is the critical path)
- [ ] 2.0 Vendor spike (1 wk): runtimes × STT × TTS on REAL phone calls — latency p50/p95, barge-in, code-switch script, AU media region (SPEC-VOICE §7).
- [ ] 2.1 Core loop (2 wks): voice service interface, per-practice config, state skeleton, cached-prefix prompting, filler bank, normalisation + pronunciation lexicon, capture-confirm loops, SMS both ways (SPEC-VOICE §2–3).
- [ ] 2.2 Guardrails: parallel emergency stream (outside the LLM), clinical refusal, disclosure+recording-consent greeting, silence policy, privacy redaction, retention clocks (SPEC-VOICE §6).
- [ ] 2.3 **call-simulator eval harness** (persona × scenario matrix, rubric scoring, CI gate) — built BEFORE the first pilot (SPEC-VOICE §4).
- [ ] 2.4 Portal: wizard (voice samples, script approvals, pronunciation audio check, forwarding test button) + Phone AI tab (follow-up PWA, dual-language transcripts, stats) + fleet view + outage-sentinel.
- [ ] 2.5 P1 dogfood on Qing's practice line (2 wks) — weekly training ritual on real calls (§4 layers 1–4).
- [ ] 2.6 P2 after-hours pilots (2–3 friendly practices) → P3 overflow → P4 fleet, per the §1 risk ladder and §8 go/no-go gates.
- **Stage DoD:** Mrs Lin E2E on a real phone · simulator suite green on 2 practice configs · emergency drill passes in both languages · blind listen test ≤60% detection · fleet health bar (§8) holds 4 consecutive weeks before selling.

### Stage 3 — Monitors (ship WITH notification routing, not before)
- [x] 3.1 Notification center + per-user routing/digests. **Done 2026-07-08** — router (SPEC-SPINE §5 matrix, quiet hours w/ red-bypass, 10-min coalescing, 30-min escalation), notification center + routing/digests UI (topbar bell), per-user prefs; server 7 tests (incl. the §5 DoD), app 2 tests.
- [ ] 3.2 **Ads (W3) — build to `specs/SPEC-ADS.md`:** MCC connection, GAQL daily pull, benchmark engine + gates, ads-optimiser queue, mutation pipeline (validateOnly → execute → snapshot → audit), change-watch. Plus SPEC-ADS §7: 3.2a ads-auditor + audit card · 3.2b keyword-recommender + search-term triage + coverage map · 3.2c measurement-first gate + health strip · 3.2d connector hardening (version pinning, operation budgeter, lag windows, change-history reconciler, offline-upload pipeline). **Test:** Yarra Hills E2E; cap-exceed refused by code; seeded broken account → auditor finds ≥10/12 known issues; recs missing any of the 6 components fail CI.
- [ ] 3.3 Offline conversion upload from fleet outcomes. **Test:** rescued-call booking appears in Ads as conversion.
- [ ] 3.4 **SEO (W4):** BrightLocal sync, diff engine, 2-day rule, seo-diagnose, opportunity cards. **Test:** "dentist blackburn 4→9" scenario produces diagnosis citing CMS deploy log.
- [ ] 3.5 **Meetings (W5):** Fathom webhook → extraction → dedupe vs open tasks → agenda-builder. **Test:** extraction auto-links to existing flag (no duplicate task).
- [ ] 3.6 Site Health: uptime, SSL/domain expiry, form-canary. **Test:** canary catches a deliberately broken form within 24h.

### Stage 4 — Money & sales
- [ ] 4.1 Billing: Xero integration (webhooks), invoice-runner, dunning-writer, MRR view.
- [ ] 4.2 **Prospects module (§6):** deal board, lead-capture (all channels), prospect-researcher, **audit-report-generator** (the flagship — build early, it sells), lead-scorer, nurture-writer, meeting-scheduler, proposal-writer, loss-miner. **Test:** fake lead → audit microsite live <15 min → stage transitions fire on events. Migrate Agile CRM deals.
- [ ] 4.3 Reports: report-writer + insight-writer + engagement-tracker; portal interactive reports. **Test:** June-style report generates from 30 days of seeded monitor data without hand-editing.
- [ ] 4.4 Guarantee tracker.
- [ ] 4.5 Support-loop completion (P-B §5.1): reputation-pack-builder + review-requester + review-responder in portal Reviews tab; new-patient-reconciler with one-tap monthly confirmation; support-only onboarding path (portal + integrations + baseline audit, no factory). **Test:** seeded month closes with a report whose new-patient number is confirmed, not claimed; review request → response drafted → practice one-tap approves E2E.

### Stage 5 — Factory (§7)
- [ ] 5.0 **CMS core first (SPEC-CMS §8, ~3–4 wks)** — block library schema + editability/guardrail manifests · facts registry with effective dating · renderer + static publisher + incremental builds + previews + redirects manager · change-set engine (atomic apply, guardrail pipeline, scheduling, versions/rollback, provenance) · forms-as-blocks → Leads + GCLID. The factory generates INTO this. **Test:** composer-emitted block tree → published staging site <2 min → fact edit propagates everywhere → instant rollback.
- [ ] 5.1 Stages 1–4: deposit webhook → provisioning → **portal intake wizard (SPEC-INTAKE: author `intake-schema v1` = base + 3 vertical overlays from the real questionnaires + the answer→PRD map; 8-step save-anywhere wizard; research pre-fill; adaptive pushback; compliance moments)** → intake-interviewer → PRD pipeline → kickoff-miner → asset slots. **Test:** deposit-to-first-mock ≤48h on a dry run; thin-answer pushback + contradiction surfacing + assets-non-blocking per SPEC-INTAKE §9.
- [ ] 5.1b Brand kit (SPEC-FACTORY §1): brand-kit-generator + kit page rendered from the block library + client approval flow (email notify → portal review → comments → lock-as-design-contract → chasing). **Test:** kit renders with the practice's own content in the samples; approval locks v1.
- [ ] 5.2 **Block library + directions library** (the human-taste sprint — designer-led, this is craft not code).
- [ ] 5.3 design-director + site-composer + slop-critic + concept gallery. **Test:** 3 concepts for a fictional practice pass the critic and a blind "which is AI-made?" review vs a past hand-built site.
- [ ] 5.3a–d **Overnight run system (SPEC-FACTORY §2–3):** run orchestrator (job graph, page-level checkpoints, critic/regenerate loops, budgets + kill switch, run records) · demo infrastructure (wildcard *.demo subdomains, password + noindex + expiry + PREVIEW watermark; promote-to-production repoint) · review workbenches (agency screenshot grid + regenerate-with-note + release; client demo view + per-section comments → next-night queue → approve) · morning digests into Today + client notify on release. **Test:** conditions met by 6pm → wake to 3 candidates on 3 demo URLs + digest → client comment at 9pm is rebuilt in the next 6:30 digest — two consecutive nights, zero manual generation steps.
- [ ] 5.3e **Anti-slop enforcement (SPEC-FACTORY §5, eight layers):** fleet similarity budget (no two same-specialty practices in overlapping catchment share a direction variant — enforced against a used-combinations registry) · swap-test + banned-phrase lexicon + specificity quotas · imagery policy (real photography as product policy; placeholders = tracked content debt) · one-bold-move rule · three calibrated critics incl. competitor-comparative judging tuned to a team-rated corpus · quarterly library curation · post-launch conversion feedback into the directions library. **Test:** a deliberately generic candidate is auto-rejected at ≥3 layers before human review; critic-vs-team blind-rating correlation ≥0.8 on a 20-site holdout.
- [ ] 5.4 Stages 6–8: build-out, metadata batch, launch-runner, gbp-builder, campaign-builder, handover, retro. **Test:** full pipeline dry-run on a staging domain, 5 human decisions and zero other manual steps.

### Stage 6 — Client editing surfaces & Studio (§9) — build to `specs/SPEC-CMS.md` (~4–6 wks; CMS core already exists from 5.0)
- [ ] 6.1 Agency editor: block-tree manipulation, page templates, bulk find-and-replace with change-set preview, cross-site fact queries.
- [ ] 6.2 cms-edit-assistant + seo-guard + lanes + conflicts/soft-locks + post-publish rank watch (+7/+28d via W4). **Test:** the CLIENT-typed "Saturday hours from 1 Aug" E2E → page+footer×N+schema+GBP, scheduled, previewed, rolled back.
- [ ] 6.3 Client tiers 1–3 (server-side editability manifests; mobile-first T1). **Test:** a Tier-3 client demonstrably cannot produce a broken layout or an AHPRA violation.
- [ ] 6.4 Studio: translator-zh + glossary manager + translation memory.
- [ ] 6.4b **Emergent/WordPress exit (rolling, SPEC-CMS §6):** importer + parity gate (URLs/301s, meta, schema, visual diff, CWV) + pilot site + 4-wk W4 "migration mode" hold → batches, fragile high-rank sites last. **Test:** pilot cutover with zero rank loss beyond noise at +6 wks; forms + GCLID verified post-cutover.
- [ ] 6.5 Offboarding & handover (§10.1): handover-runner orchestration + static-export bundle + one-click data-export ZIP + portal read-only mode + MCC-unlink/GBP-demote checklists. Verify the day-1 ownership rules are enforced in the factory (gbp-builder primary-owner, domain registrant, Ads ownership). **Test:** dry-run a full offboard on a staging client — bundle opens standalone in a browser, export ZIP complete, portal flips read-only, win-back scheduled; then dry-run a partial handover (drop receptionist only) — lifecycle stays Operate, W1 skills deactivate for that client only.

### Stage 7 — SaaS layer
- [ ] Multi-tenant workspaces · white-label theming · KB licensing/version pinning per tenant · usage metering. *(Data model already supports this — packaging, not rebuild.)*

---

## 14 · Decisions log & open questions

**Decided:** Agile CRM absorbed; Calendly absorbed; Xero stays (integrated); ActiveCollab stays for now (task surface; revisit after Stage 3); Emergent/WordPress exit via W8 over time; Watermelon registry as component base; audits delivered as live microsites, not PDFs.

**Open (decide before the relevant stage):**
1. ~~Voice platform vendor~~ **DECIDED (Jul 2026): built into our platform** — Twilio telephony + managed voice-agent runtime phase 1 (wrapped behind our own `voice` interface), self-hosted pipeline phase 2. See §5 W1 voice architecture. Remaining sub-decision: which managed runtime + which STT/TTS vendors — settle via the Stage 2.0 latency spike (test: <800ms first audio, clean EN⇄中文 mid-call switch on one call).
2. ActiveCollab: keep long-term or absorb tasks into the platform once Stage 1 proves itself.
3. BrightLocal plan tier (API access vs CSV-bridge parsing) — decide start of Stage 3.
4. PMS booking integrations (Praktika / Core Practice / HealthEngine) for receptionist phase 2 — needs partner conversations; not blocking.
5. Warm-lead video: Wally-recorded per prospect (3 min/deal) vs. AI-assembled personalised blocks — A/B in Stage 4.
6. Hosting/infra for client sites under W8 (static export + CDN is the default assumption).
7. Facebook support group: keep as the community channel (auto-invite only) or migrate into a portal community section long-term — decide when portal engagement data exists (Stage 4+).
8. Review-request triggers: front-desk one-tap vs SMS templates vs PMS-event-driven (phase 2) — start with front-desk one-tap in Stage 4.5.
9. **Social media management (GAP from site review, Jul 2026):** it's a listed 20-80 service (FB/IG for clients) with NO module in the plan — gbp-post-writer covers Google only. Needs: per-client social calendar + `social-post-writer` + approval flow + Meta Graph API connector (app review process, page-token refresh — its own connector pain). Decide scope by Stage 4; candidate home: Content Studio + Calendar tabs.
10. **eForms (GAP from site review):** the site sells eForms incl. new-patient medical history and eConsult — that is CLINICAL data, a different compliance class from anything in this plan (Privacy Act/APPs, encryption, retention, breach-notification duty). Decide: keep eForms OUT of the platform (separate/existing tool, link only) vs build with a dedicated SPEC-EFORMS + legal review. Default: OUT until legal review says otherwise. Lead-capture forms (non-clinical) remain in scope.
11. **Referral program + Education hub** (portal tabs proposed in doc 5, silently dropped from the module map): decide keep/cut at Stage 4 — both are cheap retention features; neither blocks anything.
12. **SPEC-SECURITY needed before Stage 1 ships to real users:** auth (portal magic links vs passwords, 2FA for agency), role/permission matrix (agency admin/specialist/coordinator; practice owner/manager/front-desk), session management, rate limiting, Privacy Act 1988 / APP compliance statement, NDB (notifiable data breach) runbook, data-retention schedule per record type. **Progress (see BUILD-LOG): SEC.1 (agency email+password auth, server-side sessions, httpOnly cookie, `/api/*` gate + dashboard login gate) ✓ · SEC.3 (permission matrix + actor-from-session; G3 owner-only; body-actor trust removed) ✓ — both 2026-07-08. Remaining: SEC.2 2FA · SEC.4 tenant isolation + CI cross-client leak suite · SEC.5 portal magic-link · SEC.6 hardening · SEC.7 privacy/APPs. The security track is the critical path (BUILD-EXECUTION-PLAN.md).**
13. **AHPRA rules corpus governance:** the ahpra-checker is only as good as its rules corpus — needs sourcing (AHPRA advertising guidelines + National Law s133), a lawyer review pass, update monitoring when guidelines change (knowledge-diff-writer handles rollout), and a violation test-case suite. Mini-spec inside SPEC-SPINE or standalone; before Stage 5 at the latest (first client-facing generated content).
14. **Payment rails split:** deposits/receptionist subscriptions via Stripe vs invoicing via Xero — who is merchant of record, direct-debit option (GoCardless-class) for monthly plans — settle in SPEC-SALES (Stage 4).
