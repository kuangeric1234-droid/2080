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

1. **Build in the order of §13.** Each step has a checkbox, a definition of done (DoD), and a test plan. A step is done when its tests pass — not when the code exists.
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

## 13 · Build order (the guideline — work top to bottom)

### Stage 1 — Spine *(everything else writes into this)*
- [x] 1.1 Repo scaffold: Vite + React 19 + Tailwind 4, token set, Watermelon components vendored & restyled. **DoD:** app shell with rail/topbar in both themes.
- [x] 1.2 Postgres schema: clients, contacts, timeline_events, tasks, requests, skill_runs, audit_log, deals. **DoD:** migrations + seed with demo portfolio (Hearts, Yarra Hills, Smile Council, Trowse, Aspire One, Smile To Go).
- [x] 1.3 Skill runner: versioned prompts from `/skills/`, structured outputs, run logging, gate framework (G0–G3). **DoD:** a hello-world skill runs, logs, and renders its gate card.
- [ ] 1.4 Entity matcher + timeline. **Test:** golden set of 30 emails/events routes ≥95% correctly, <0.8 goes to queue.
- [ ] 1.5 **Inbox (W2):** Gmail push webhook → email-triage → task creation (ActiveCollab API) → ack drafts → completion-writer on webhook. **Test:** the Hearts double-request email E2E (split into 2 tasks, ack drafted, bio chase scheduled); zero-loss audit query returns empty.
- [ ] 1.6 **Today tab:** flag-ranker + approval queue + tiles. **Test:** approve/reject flows mutate state + audit log.
- [ ] 1.7 Audit Log viewer. **DoD:** filter by client/actor/workflow; every 1.5–1.6 action appears.

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
- [ ] 3.1 Notification center + per-user routing/digests.
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
12. **SPEC-SECURITY needed before Stage 1 ships to real users:** auth (portal magic links vs passwords, 2FA for agency), role/permission matrix (agency admin/specialist/coordinator; practice owner/manager/front-desk), session management, rate limiting, Privacy Act 1988 / APP compliance statement, NDB (notifiable data breach) runbook, data-retention schedule per record type.
13. **AHPRA rules corpus governance:** the ahpra-checker is only as good as its rules corpus — needs sourcing (AHPRA advertising guidelines + National Law s133), a lawyer review pass, update monitoring when guidelines change (knowledge-diff-writer handles rollout), and a violation test-case suite. Mini-spec inside SPEC-SPINE or standalone; before Stage 5 at the latest (first client-facing generated content).
14. **Payment rails split:** deposits/receptionist subscriptions via Stripe vs invoicing via Xero — who is merchant of record, direct-debit option (GoCardless-class) for monthly plans — settle in SPEC-SALES (Stage 4).
