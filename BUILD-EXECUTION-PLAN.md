# BUILD-EXECUTION-PLAN.md

_Whole-platform build plan, synthesized 2026-07-08 by an 8-agent planning workflow (7 stages deep-read in parallel + synthesis). Advisory: a blueprint, not a commitment — the loop still builds one step at a time. Source of progress truth remains MASTER-BUILD-PLAN.md §13._

## Critical path

1. Stage 1 spine (DONE)
2. SEC.1 auth foundation (login/sessions/gate)
3. SEC.3 authorization matrix (actor = session principal)
4. SEC.4 tenant isolation + CI cross-client leak suite
5. Job runner (pg-boss) bootstrap [shared infra, from 3.2.1]
6. 5.0a CMS block library schema + editability/guardrail manifests
7. 5.0b facts registry + effective dating + references
8. 5.0c-i renderer + static publisher + versions/releases + rollback
9. 5.0d change-set engine + guardrail pipeline + lanes + scheduling
10. 5.0-gate CMS core integration (render→publish→propagate→rollback)
11. 5.2 designer block + design-directions libraries (human-taste sprint)
12. 5.3 design-director + site-composer + slop-critic + gallery
13. 5.3a overnight run orchestrator (checkpoints/budgets/kill-switch)
14. 5.3e anti-slop eight layers + critic calibration corpus
15. 5.4 factory launch chain (build-out → launch → handover)
16. 5-DoD two-night autonomous dry run
17. Stage 6 client editing surfaces (S1→S6b)
18. 7.1 multi-tenant spine (reuses SEC.4 isolation gate)

## Next 5 unblocked steps (no new credentials)

1. SEC.1 — Auth foundation: password login, sessions, httpOnly cookies, dashboard login gate (buildable_now, L) — gates real users and unblocks the whole security chain + Stage-7 tenancy
2. SEC.2 — Mandatory TOTP 2FA + step-up re-auth for G3/Settings (buildable_now, L; Node crypto RFC-6238)
3. SEC.3 — Authorization matrix: capability gate, audited actor from session principal not request body (buildable_now, L)
4. SEC.4 — Tenant isolation: row-scope every route + CI cross-client leak suite; the isolation gate Stage 7 reuses (buildable_now, XL)
5. 5.0a — CMS block library schema + editability/guardrail manifests + core block types; start the long pole the factory and all Stage-6 editing build on (buildable_now, L)

## Hard blockers (most-blocking first)

- Anthropic API key — gates live model calls and graduation for EVERY skill across all seven stages (dozens); building proceeds on MockModelClient, going-live does not
- Team golden sets / 'Wally-Ish-Hamza sauce' — Ish's 150 triage labels, Hamza's ads audits + keyword hindsight + 25 SEO drops, Wally's 10 audits/proposals/June report + down-month, voice graded transcripts, and the team-rated critic calibration corpus (~50 sites + 20-site holdout); no skill leaves shadow without its real set
- Voice vendor trial accounts + one AU test DID — un-mockable real-call latency spike (2.0) that gates the entire receptionist product and all pilots (2.5/2.6)
- Hosting / staging (Fly.io Sydney) — DB encryption at rest, real backup/restore drill, and production deploy of anything; nothing reaches real clients without it
- Cloudflare account + API token — real publish/CDN (5.0c-i), demo wildcard subdomains (5.3b), launch DNS/SSL (5.4), migration cutover (S9), white-label vanity domains (7.2)
- Designer-led library sprint + Wally's recorded walkthrough — the human-taste block + design-directions libraries (5.2) that cap every factory site's quality; schema builds now, curated craft cannot be mocked
- AHPRA rules corpus + lawyer review — makes ahpra-checker authoritative; required before the first AI-generated client-facing content ships (CMS guardrail, review-responder, intake compliance)
- Stripe + Xero sandbox keys — real billing/deposits/factory-trigger (4.1a/b, 4.2f, 5.1-s1) and SaaS invoicing (7.4)
- Google Ads MCC + developer token + OAuth + one linked client account — real ads warehouse, mutations, and offline conversion upload (3.2.x, 3.3)
- BrightLocal plan tier + Google Business Profile API approval (GBP has real approval lead time — file in week 1) — real SEO monitor data (3.4.x)
- Fathom API token + webhook secret — meetings extraction and factory kickoff mining (3.5, 5.1-s3)
- Twilio (AU DID + SMS sender-ID registration) — voice SMS, forwarding verify, outage-sentinel, review requests (2.1c/2.4a/2.4b, 4.5a)
- Gmail OAuth (support@) + ActiveCollab token — real inbox in/out + magic-link email (1.5, SEC.5) and real task creation
- FCM server key / APNs cert — real PWA push delivery (SEC.5, 2.4b)
- SPEC-SAAS commercial decisions from Wally (pricing/rate-card, white-label boundaries, KB license terms, reseller/sub-tenant model) — gates Stage 7 go-to-market; plumbing builds behind defaults
- Pilot practices + consent (Qing's line + 2–3 friendly practices) — voice graduation to a sellable product; calendar-bound, un-mockable
- One-time human deliverables — Agile CRM export CSV (sales migration 4.2f); a real Emergent/WordPress site + DNS cutover window + 6-week rank observation (migration DoD S9)

---

# 20-80 Platform — Master Build Plan (whole-platform synthesis)

## 0. Reality check (what is actually built)

Per `BUILD-LOG.md` and git, **only the Stage 1 spine + Stage 3.1 notifications exist**:

- 1.1 app shell (tokens, both themes, rail/topbar) · 1.2 Postgres schema (17 tables, `workspace_id NOT NULL` everywhere, append-only timeline/audit at DB-role level, 30-day seed) · 1.3 skill runner + G0–G3 gates + `MockModelClient`/`AnthropicModelClient` (never made a live call) · 1.4 entity matcher (30/30 golden) + timeline ingest · 1.5 Inbox W2 (triage in **shadow**, connectors mocked) · 1.6 Today (flag-ranker, approval queue, GateCard) · 1.7 Audit Log viewer · 3.1 notification router.

**Everything else in the seven stage-plans is unbuilt.** Two premises in the source plans are explicitly corrected here: (a) *CMS core (5.0) does NOT exist* — Stage 5 factory and all of Stage 6 build on it; (b) *there is no real auth* — `actor` is client-supplied and no query is workspace-scoped, so SPEC-SECURITY is a hard prerequisite for real users.

This is a **multi-system SaaS**: a voice product + an ads/SEO/meetings monitoring layer + a billing/CRM/reporting revenue system + a website-generation factory on a CMS platform + client editing surfaces + a security layer + a multi-tenant SaaS wrapper. Realistically a multi-quarter, multi-engineer program (~80 remaining build-loop steps), not a sprint. The good news: ~70% is *buildable now* behind the established mock-connector + `MockModelClient` pattern; the constraint is that **skills cannot graduate out of shadow/G2 without the Anthropic key + the human golden sets**, and **nothing ships to real clients until SPEC-SECURITY + hosting land**.

---

## 1. Load-bearing internal dependencies (build-order gates, not credentials)

These are sequencing decisions the orchestrator must respect regardless of credentials:

| Gate | Blocks | Why |
|---|---|---|
| **SPEC-SECURITY auth (SEC.1→SEC.4)** | Any real client/user data in prod | No auth today; tenant isolation + role gates must exist before real users. Fully buildable now. |
| **Job runner (pg-boss)** | Every cron/monitor/factory-overnight/voice-retention/outage-sentinel | First bootstrapped inside Ads 3.2.1; pull it forward as shared infra. |
| **CMS core 5.0 (block model + facts + renderer/publisher + change-set engine + forms)** | Factory 5.1–5.4, all Stage 6 editing, audit microsite (4.2d), SaaS KB (7.3) | "The CMS content model IS the factory's output format." The longest pole. |
| **Designer library sprint 5.2 (block + directions libraries)** | Factory output *quality* (5.1b brand kit, 5.3 composer, 5.3e anti-slop) | Human craft; schema builds now, curated taste cannot be mocked. |
| **Golden sets (per skill)** | Every skill leaving shadow/G2 | The trust architecture — synthetic exams never graduate a skill. |

---

## 2. Dependency-ordered sequence (with parallel worktrees)

Steps share the `schema / api.ts / seed.ts` contracts, so within a track they are sequential. **Five tracks can run in parallel worktrees** once the shared infra (auth + job runner + CMS-core-start) is moving. Rough sizes: S/M/L/XL as in the source plans.

### Track A — Security & tenancy (build FIRST; zero creds; gates real users)
1. **SEC.1** Auth foundation: password login, sessions, httpOnly cookies, dashboard login gate — *buildable_now, L*. DoD: seeded login sets cookie, `/api/*` returns 401 unauthenticated, logout revokes.
2. **SEC.2** Mandatory TOTP 2FA + step-up for G3/Settings — *buildable_now, L* (Node crypto RFC-6238). DoD: no-TOTP user forced through enrollment; G3 challenged.
3. **SEC.3** Authorization matrix (capability gate; actor = session principal, not body) — *buildable_now, L*. DoD: specialist refused a G3 server-side; audit records session principal.
4. **SEC.4** Tenant isolation: row-scope every route + CI cross-client leak suite — *buildable_now, XL*. DoD: portal A → 404 on every practice-B resource; agency sees all. **This CI suite is the isolation gate Stage 7 depends on.**
5. **SEC.6** Hardening: rate-limit, login lockout+notify, webhook HMAC, CSP — *buildable_now, L*.
6. **SEC.7** Privacy/APPs: export ZIP, retention purge, secret redaction, envelope cipher — *buildable_now, L* (real KMS later).
7. **SEC.5** Portal magic-link auth + push-token bind/revoke — *mockable (FCM/APNs + Gmail OAuth), L*.
8. **SEC.8** CI pipeline + NDB runbook + logical backup/restore round-trip — *mockable (real pg_dump drill needs hosting), M*.

### Track B — Voice / Receptionist (largest single build; mostly mockable now)
9. **2.1a** Voice data model + `voice` interfaces + MockVoiceRuntime + per-practice config — *buildable_now, L*.
10. **2.2** Guardrails: parallel emergency stream, clinical refusal, disclosure, silence, redaction, retention cron — *buildable_now, L*.
11. **2.1b** Conversation engine: state machine + `clinic-call-agent` + capture-confirm + fillers — *mockable (Anthropic; +voice golden set to graduate), XL*.
12. **2.1c** Speech-text pipeline: normalise + lexicon + bilingual/code-switch + SMS both ways + call-summary — *mockable (Anthropic; Twilio SMS later), L*.
13. **2.3** call-simulator eval harness + CI gate — *mockable (Anthropic), L*.
14. **2.0** Vendor-spike harness + decision matrix + carrier setup sheets (the non-call part) — *mockable (real p50/p95 needs vendor + AU DID), M*.
15. **2.4a** Portal onboarding wizard + go/no-go checklist + faq-pack-builder — *mockable (Twilio; Wally content), L*.
16. **2.4b** Phone AI tab + fleet view + outage-sentinel + call-qa-sampler — *mockable (Twilio; voice golden set), L*.
17. **2.5 / 2.6** Pilots (Qing's line → after-hours → overflow → fleet) — **blocked** (vendor spike + consent + weeks of real calls). The true calendar critical path for the sellable receptionist.

### Track C — Monitors (mockable now; bootstraps shared job runner)
18. **3.2.1** Ads connector + GAQL warehouse + **pg-boss job runner bootstrap** — *mockable (Google Ads MCC), L*. **Pull the job-runner half forward — Tracks B/C/E all need it.**
19. **3.2.2** Measurement-first gate + health strip — *buildable_now, M*.
20. **3.2.3** ads-auditor + score model + audit card — *mockable (Anthropic; Hamza audits to exit shadow), L*.
21. **3.2.4** keyword-recommender + search-term triage + coverage map — *mockable (Anthropic; Hamza hindsight labels), L*.
22. **3.2.5** ads-optimiser queue + mutation pipeline (validateOnly→execute→snapshot→audit) + change-watch + reconciler — *mockable (Google Ads; Hamza set), XL*.
23. **3.4.1** SEO connector + BrightLocal/GSC/GBP warehouse + change classifier — *mockable (BrightLocal tier + GBP approval), L*.
24. **3.4.2** seo-diagnose tree + opportunity-writer + GBP cadence + recovery tracker — *mockable (Anthropic; Hamza 25 drops), L*.
25. **3.5** Meetings: Fathom webhook → extraction → dedupe → agenda-builder — *mockable (Fathom token), M*.
26. **3.6** Site Health: uptime/SSL/domain/form-canary probes — *mockable (form-canary needs Stage 5 CMS forms; uptime/SSL real now), M*.
27. **3.3** Offline conversion upload (fleet outcomes → Ads) + enhanced-conversions + reconciliation — *mockable (Stage 2 fleet + Google Ads), M*.

### Track D — Money & Sales (mockable now; mostly independent)
28. **4.1a** Billing schema + Xero/Stripe connectors + signed webhooks + `deal.won` — *mockable (Stripe/Xero sandbox), M*.
29. **4.1b** invoice-runner + dunning-writer + MRR + Billing tab — *mockable (Anthropic; Wally voice), M*.
30. **4.2a** Prospects schema + deal-tracker stage machine + deal board — *buildable_now, L*.
31. **4.2b** lead-capture + multi-channel endpoints + dedupe/attribution — *mockable (Meta/Messenger; Anthropic), M*.
32. **4.2c** prospect-researcher + PublicDataConnector research pack — *mockable (public data + PageSpeed later), M*.
33. **4.2d** audit-report-generator — flagship live audit microsite + cost telemetry — *mockable (Anthropic; Wally's 10 audits; **interim renderer until 5.2 block library**), L*.
34. **4.2e** lead-scorer + nurture cadences + meeting-scheduler + engagement tracking — *mockable (Anthropic; Calendly), L*.
35. **4.2f** proposal-writer + rate card + deposit→Won→factory + loss-miner + Agile migration — *mockable (Stripe; Agile export; Wally proposals), L*.
36. **4.3a** Benchmark registry + monthly report section renderers off `metrics_daily` — *buildable_now, M*.
37. **4.3b** insight-writer + down-month mode + interactive report + PDF + scheduler — *mockable (Anthropic; Wally June report), L*.
38. **4.4** guarantee-scorer + Guarantee Tracker tab — *buildable_now, M*.
39. **4.5a** reputation-pack-builder + review-requester + review-responder (AHPRA hard gate) + Reviews tab — *mockable (Anthropic; GBP/Twilio; AHPRA corpus), L*.
40. **4.5b** new-patient-reconciler (verified ROI) + support-only onboarding — *mockable (Anthropic; depends on 4.2d + 4.3a), M*.

### Track E — CMS core → Factory → Client editing → SaaS (the long pole; strictly sequential)
**E1 — CMS core (5.0) — must precede Track-E factory and all Stage-6 editing**
41. **5.0a** Block library schema + editability/guardrail manifests + core block types — *buildable_now, L*.
42. **5.0b** Facts registry + effective dating + reference tracking — *buildable_now, M*.
43. **5.0c-i** Renderer + static publisher (LocalPublisher) + versions/releases + atomic publish/rollback — *mockable (Cloudflare Pages), L*.
44. **5.0c-ii** Preview builds + screenshots + redirects manager + SEO plumbing — *buildable_now, M*.
45. **5.0d** Change-set engine core + guardrail pipeline (ahpra→seo-guard→tone→mechanical) + lanes + scheduling — *mockable (Anthropic; AHPRA corpus for authority), L*.
46. **5.0e** Forms as blocks → Leads + GCLID + form-canary hooks — *buildable_now, M*.
47. **5.0-gate** CMS core integration gate (stub composer → render → publish → propagate → rollback) — *mockable, S*.

**E2 — Factory (5.1–5.4)**
48. **5.1-s1** deposit-runner + portal-provisioner + **client-portal shell bootstrap** — *mockable (Stripe/Xero), M*.
49. **5.1-s2a** intake-schema v1 + 8-step save-anywhere wizard — *buildable_now, L*.
50. **5.1-s2b** adaptive interviewer + PRD pipeline → first mock — *mockable (Anthropic; team golden sets), L*.
51. **5.1-s3** Kickoff: agenda from PRD gaps + transcript mining (H1) — *mockable (Fathom; Anthropic), M*.
52. **5.1-s4** Asset slots + validation + chases + shot list — *buildable_now (vision check mocked), M*.
53. **5.1-gate** deposit-to-first-mock ≤48h dry run — *mockable, S*.
54. **5.1b** Brand kit — client-facing design contract (H2) — *mockable (Anthropic; needs 5.2 directions), L*.
55. **5.2** Block library + design-directions library — **the designer human-taste sprint** — *blocked (designer sessions + Wally walkthrough)*; schema/registry build now, curated set blocked, *L*.
56. **5.3** design-director + site-composer + slop-critic + concept gallery — *mockable (Anthropic; quality capped by 5.2), XL*.
57. **5.3a** Overnight run orchestrator (pg-boss batch mode, checkpoints, budgets, kill switch) — *buildable_now (machinery), L*.
58. **5.3b** Demo infra: wildcard subdomains + promote-to-production — *mockable (Cloudflare), M*.
59. **5.3c-d** Review workbenches (agency + client) + 06:30 morning digests — *mockable (Anthropic), L*.
60. **5.3e** Anti-slop enforcement — eight layers — *blocked (team-rated critic calibration corpus + 20-site holdout)*; mechanics build now, *XL*.
61. **5.4** Factory stages 6–8: build-out + launch chain (H4/H5) + handover + retro — *mockable (Cloudflare/Google/Xero), XL*.
62. **5-DoD** Two-night autonomous dry run — *mockable, M*.

**E3 — Client editing surfaces (Stage 6; builds on 5.0/5.1/5.2)**
63. **P0** Client portal shell scaffold — *mockable (SPEC-SECURITY auth), M* (shared with 5.1-s1).
64. **I1** intake-schema v1 as versioned data — *buildable_now, M*.
65. **I2** Portal intake wizard UI (8 steps, save-per-field, mobile) — *buildable_now, XL*.
66. **I3a** practice-researcher pre-fill (confirm-or-fix chips) — *mockable (Anthropic), M*.
67. **I3b** intake-interviewer (pushback/contradiction/COI) + compliance moment — *mockable (Anthropic; AHPRA), L*.
68. **I4** Submit → PRD v1 + Getting-Started checklist + non-blocking assets — *mockable (Anthropic; secret store), XL*.
69. **S1** Agency editor — block-tree manipulation + templates — *mockable (CMS core; Cloudflare), L*.
70. **S2** Bulk find-and-replace + cross-site fact queries — *mockable, M*.
71. **S3** cms-edit-assistant (words → change-set) — *mockable (Anthropic), L*.
72. **S4** seo-guard + guardrail lanes + soft-locks — *mockable (Anthropic; AHPRA; W4), L*.
73. **S5** "Saturday hours from 1 Aug" E2E — scheduling + propagation + post-publish rank watch — *mockable, L*.
74. **S6a** Client My Website Tier-1 fields + server-side editability enforcement — *mockable, L*.
75. **S6b** Client Tier-2 prompt + Tier-3 visual editor + lane graduation — *mockable (Anthropic; 5.2), XL*.
76. **S7** Studio — translator-zh + glossary + translation memory — *mockable (Anthropic; 中文 gold), L*.
77. **S8a** Offboarding — handover-runner + static export + data ZIP — *mockable, L*.
78. **S8b** Portal read-only + partial handover + day-1 ownership verification — *mockable, M*.
79. **S9** Emergent/WordPress exit — importer + parity gate — *blocked (real site + DNS window + 6-week rank observation)*; importer/parity build vs fixture, *XL*.

**E4 — SaaS layer (Stage 7; needs SEC.4 isolation + a SPEC-SAAS)**
80. **7.1** Multi-tenant spine: tenant model + per-request workspace context + scope every query + isolation CI gate — *buildable_now, XL*.
81. **7.2** White-label theming per tenant — *buildable_now (asset hosting later), M*.
82. **7.3** KB licensing + per-tenant version pinning — *mockable (KB content from Stage 5), L*.
83. **7.4** Usage metering + rating — *buildable_now (invoicing needs Stripe/Xero), L*.
84. **7.5** Tenant provisioning + super-admin surface — *buildable_now (real super-admin role needs SEC.1), L*.

---

## 3. What can be built right now with ZERO new credentials

Pure platform code that ships real (not behind a mock), dependency-valid today:

- **All of Track A security SEC.1–SEC.4, SEC.6, SEC.7** (Node crypto; no external dep). This is the highest-leverage buildable work — it gates real users and the Stage-7 isolation contract.
- **Job runner (pg-boss)** — pull out of 3.2.1; shared infra for every later cron.
- **CMS core start: 5.0a (blocks), 5.0b (facts), 5.0c-ii (previews/redirects/SEO), 5.0e (forms)** — the long pole; start immediately.
- **Voice 2.1a (data model) + 2.2 (guardrails)** — deterministic safety floor, no model needed.
- **Ads 3.2.2 (measurement gate)** — after 3.2.1's mock warehouse.
- **Sales/reports pure-code: 4.2a (deal-tracker), 4.3a (benchmark registry + report renderers), 4.4 (guarantee-scorer)**.
- **Intake I1 (schema) + I2 (wizard UI)** and **5.1-s2a (intake wizard)**, **5.1-s4 asset mechanics**, **5.3a orchestrator machinery**.
- **SaaS 7.1 (tenant spine), 7.2 (white-label), 7.4 (metering capture), 7.5 (provisioning UI)** — all plumbing buildable behind defaults.

Everything else on Tracks B–E is *mockable now behind the existing connector/`MockModelClient` pattern* — build the full logic, contract-test it, wire creds later. Skills ship **shadow/G2 on provisional ≤10-case golden sets** and cannot graduate.

---

## 4. Blocked until a human provides X

| Human input | Unblocks | Nature |
|---|---|---|
| **Anthropic API key** | Live model calls for *every* skill (voice, ads, seo, meetings, sales, reports, factory, CMS guardrails, translation). Building proceeds on mock; **graduation does not.** | Credential (already OPEN) |
| **Golden sets / team "sauce"** — Ish's 150 triage labels; Hamza's ads audits + keyword hindsight + 25 SEO drops; Wally's 10 audits, proposals, June report + a down-month; voice graded transcripts; **critic calibration corpus (~50 sites + 20-site holdout)** | Every skill leaving shadow (email-triage, ads-auditor, keyword-recommender, ads-optimiser, seo-diagnose, insight-writer, audit-report-generator, proposal-writer, clinic-call-agent, slop-critic…) | Human labour |
| **Voice vendor trials + one AU test DID** | Stage 2.0 real latency measurement + **all pilots 2.5/2.6** (the sellable receptionist) | Un-mockable / calendar |
| **Pilot practices + consent** (Qing's line, 2–3 friendly practices) + weeks of QA | Voice graduation to product | Un-mockable / calendar |
| **Hosting / staging (Fly.io Sydney)** | DB encryption at rest, real backup/restore drill (SEC.8), production deploy of anything | Infra credential (pre-known) |
| **Cloudflare account + API token** | Real publish/CDN (5.0c-i), demo wildcard `*.demo.20-80.dev` (5.3b), launch DNS/SSL (5.4), migration cutover (S9), white-label vanity domains (7.2) | Infra credential |
| **Designer library sprint + Wally walkthrough** | Factory output *quality* (5.2 → 5.1b/5.3/5.3e) | Human craft, un-mockable |
| **Stripe + Xero sandbox keys** | Real billing/deposits (4.1a/b, 4.2f), factory trigger (5.1-s1), SaaS invoicing (7.4) | Credential |
| **Google Ads MCC + dev token + OAuth + linked account** | Real ads warehouse/mutations/offline upload (3.2.x, 3.3) | Credential |
| **BrightLocal tier + GBP API approval** (GBP has real lead time — file week 1) | SEO monitor real data (3.4.x) | Credential + approval lead time |
| **Fathom API token** | Meetings + kickoff mining (3.5, 5.1-s3) | Credential |
| **AHPRA rules corpus + lawyer review** | ahpra-checker *authority* (CMS guardrail 5.0d, review-responder 4.5a, intake compliance) — **required before the first AI-generated client-facing content ships** | Legal/human |
| **Twilio (AU DID + SMS sender-ID)** | Voice SMS (2.1c), forwarding verify (2.4a), outage-sentinel (2.4b), review requests (4.5a) | Credential |
| **Gmail OAuth / ActiveCollab token** | Real inbox in/out + magic-link email (SEC.5); real task creation | Credential (OPEN) |
| **FCM/APNs push creds** | Real PWA push delivery (SEC.5, 2.4b) | Credential |
| **SPEC-SAAS commercial decisions** (pricing, white-label boundaries, KB terms, reseller model) | Stage 7 go-to-market (plumbing builds behind defaults) | Product decision |
| **Agile CRM export; real Emergent site + DNS window** | One-time sales migration (4.2f); migration rank-safety DoD (S9) | One-time human deliverable |

---

## 5. Realistic critical path

The chain that everything ultimately waits on (each step gates the next; parallel tracks feed in but do not shorten it):

**Stage 1 spine (DONE) → SEC.1→SEC.4 auth+isolation → CMS core 5.0a→5.0-gate → designer library sprint 5.2 → factory composer 5.3 → overnight orchestrator 5.3a + anti-slop 5.3e (critic calibration corpus) → factory launch chain 5.4 → two-night autonomous dry-run 5-DoD → Stage 6 client editing (S1–S6) → Stage 7 SaaS (7.1→7.5).**

Two independent calendar-bound paths run alongside and set the *product* (not code) timeline:
- **Voice:** vendor spike 2.0 → Qing dogfood 2.5 → friendly-practice pilots 2.6 (weeks of real calls) — the receptionist cannot be *sold* until this completes, regardless of code.
- **Skill graduation:** Anthropic key + each golden set — no skill goes live on real client work until its real set scores to target.

**Load-bearing, in order:** SEC.1 → SEC.4 (isolation gate) → 5.0a → 5.0d (change-set engine) → 5.0-gate → 5.2 (designer libraries) → 5.3 → 5.3a → 5.3e → 5.4 → 5-DoD.

**Where SPEC-SECURITY must land:** before ANY real client data enters production — i.e. before the Inbox leaves shadow on live mail, before the portal (5.1-s1/P0) serves a real practice, and as a hard prerequisite for Stage 7 multi-tenancy (7.1 reuses SEC.4's isolation suite). It is entirely buildable now with zero credentials, so it should be built next, not deferred.

---

## 6. Honest scaling note

This is seven substantial subsystems sharing one client record and one gate architecture. Even with ~70% buildable/mockable today, the *shippable* platform is gated by: one legal review (AHPRA), one designer craft sprint (libraries), one hosting decision (Fly.io), and a stack of golden sets that only the team can produce. Build the code now on mocks; the calendar is set by humans, not by the compiler.


---

# Appendix — per-stage step inventory

## Stage 2 — Receptionist product (voice, W1) — build to specs/SPEC-VOICE.md

Stage 2 is the platform's single biggest build — a voice PRODUCT, not a prompt-skill. The critical path is the pilot calendar (real phone calls), which is human-gated, so the plan splits into two tracks. Track A (buildable/mockable NOW, ~6 loop iterations): everything behind the `voice` service interface — the §5 "buy-then-own" seam that keeps config, transcripts, follow-ups and analytics in OUR Postgres from day 1 while the audio runtime is mocked. This covers the data model, the state-skeleton conversation engine (clinic-call-agent), the speech-text pipeline (normalisation/lexicon/bilingual/SMS), the deterministic guardrail layer (emergency stream, clinical refusal, disclosure, retention), the call-simulator eval harness, and the portal surfaces (wizard, Phone AI tab, fleet view, outage-sentinel). Every conversation-logic piece is testable at the TEXT level (turn sequences) with zero audio hardware, exactly like the Mrs Lin seed scenario. Track B (BLOCKED, operational not code): the 2.0 vendor-selection MEASUREMENT (real-call latency p50/p95, needs vendor trials + AU DID) and the 2.5/2.6 pilots (Qing's line + friendly practices + weeks of weekly training rituals). The blocked items cannot be mocked because they are measurement/consent decisions on live carrier audio. Build order: data model + interfaces first (unblocks all), then engine, then guardrails, then simulator (gates every later config change), then portal. clinic-call-agent + call-simulator run on MockModelClient until the Anthropic key lands, and the turn model stays in sandbox/shadow until real graded call transcripts (a voice golden set, analogous to Ish's 150 triage labels) arrive.

**Blockers:** Voice-vendor trial accounts + one AU test DID (already OPEN in BLOCKERS.md) — blocks the 2.0 REAL-call latency measurement (p50/p95 first-audio, barge-in, code-switch, AU media region) and all pilots (2.5/2.6); the harness/scripts/setup-sheets build now behind the VoiceRuntime interface.; Anthropic API key (already OPEN) — clinic-call-agent, call-summary, call-simulator, faq-pack-builder, outage-sentinel, call-qa-sampler run on MockModelClient until it lands.; Twilio credentials — AU DID provisioning + forwarding control + SMS sender-ID registration + AU media region (NEW blocker; mockable now via TelephonyConnector/SmsConnector). Needed for real forwarding-verify (2.4a), SMS both-ways (2.1c), outage-sentinel forwarding-disable (2.4b).; Voice golden set — real graded call transcripts (turn-model evals) + QA rubric calibration, the voice analogue of Ish's 150 triage labels (NEW blocker). clinic-call-agent stays sandbox/shadow and cannot graduate on synthetic exams; provisional ≤10 synthetic transcripts only.; Wally-approved per-practice content — emergency scripts word-for-word + FAQ-pack answers + curated 3–5 multilingual voice samples + pronunciation ground-truth (suburbs/practitioner names). Seed placeholders build the wizard now; real content is a hard go/no-go gate before any live line.; Qing's practice-line consent + forwarding setup (P1 dogfood) and 2–3 recruited friendly pilot practices (P2/P3) — operational/consent, the calendar critical path; plus weeks of human weekly-training-ritual and QA time. Cannot be mocked.

| Step | Builds | Status | Size |
|---|---|---|---|
| 2.0 Vendor-spike harness + decision matrix + §7 carrier setup sheets (the non-call part) | The measurement rig and artefacts for the vendor-selection spike — WITHOUT placing real ca | mockable (Real-call latency measurement needs voice-vendor trial accounts + one AU test DID (BLOCKERS.md, already OPEN). Harness/scripts/sheets build now against the interface; wire real runtimes when trials land.) | M |
| 2.1a Voice data model + `voice` service interfaces + MockVoiceRuntime + per-practice config | The foundation every later voice step writes into — the §5 'buy-then-own' seam. Migration  | buildable_now | L |
| 2.1b Conversation engine: state skeleton + clinic-call-agent turn skill + capture-confirm + filler bank | The dialogue brain, driven at the text-turn level (audio mocked). A state-machine (GREET→I | mockable (Model runs on MockModelClient until the Anthropic API key lands (BLOCKERS.md OPEN). Turn model stays in sandbox and CANNOT graduate past shadow until a real graded call-transcript golden set arrives (voice analogue of Ish's 150 triage labels) — add a precise BLOCKERS.md entry; provisional ≤10 synthetic transcripts only.) | XL |
| 2.1c Speech-text pipeline: normalisation + pronunciation lexicon + bilingual/code-switch + SMS both ways + call-summary | The layer between text and speech, all unit-testable without audio. Text normalisation for | mockable (call-summary model on MockModelClient until the Anthropic key. Real STT/TTS vendor + Twilio SMS sender-ID registration wire later (mock now).) | L |
| 2.2 Guardrails: parallel emergency stream + clinical refusal + disclosure greeting + silence policy + privacy redaction + retention clocks | The safety floor that lives OUTSIDE the LLM (SPEC-VOICE §6). A deterministic emergency det | buildable_now | L |
| 2.3 call-simulator eval harness + CI gate | The measurement instrument that gates every future config/prompt/vendor change (SPEC-VOICE | mockable (Synthetic caller + LLM-judge run on MockModelClient until the Anthropic key. The real-audio second-line version (TTS caller on a real DID) is a P4-era upgrade needing vendor + DID; text-level suite is the buildable-now form.) | L |
| 2.4a Portal: onboarding wizard + go/no-go checklist + faq-pack-builder | The client-side install surface (SPEC-VOICE §8, §5 'install = the portal'). A wizard: pick | mockable (Real forwarding verification + voice samples need Twilio (new blocker) and the curated 3–5 multilingual voice set. Wally-approved emergency scripts + real per-practice FAQ answers are content inputs — seed placeholders now, real content required before any go-live.) | L |
| 2.4b Portal: Phone AI tab + fleet view + outage-sentinel + call-qa-sampler | Day-to-day surfaces (SPEC-VOICE §5, §7, §8). Client Phone AI tab: follow-up list (PWA-shap | mockable (outage-sentinel forwarding-disable + synthetic calls need Twilio (mock now). call-qa-sampler needs real graded calls to produce meaningful precision numbers (same voice-golden-set blocker as 2.1b).) | L |
| 2.5 P1 dogfood on Qing's practice line (2 weeks running) | Not code — the first real-call rung (SPEC-VOICE §1 risk-ladder P1; §9 step 2.5). Qing's pr | blocked (Voice-vendor selection (2.0 real-call spike) + Qing's practice-line consent + forwarding setup + 2 weeks of human weekly-training time. Purely operational/consent — cannot be mocked.) | L |
| 2.6 P2 after-hours pilots → P3 overflow → P4 fleet (parallel with Stage 3) | Not code — the graduation rungs to a sellable product (SPEC-VOICE §1 P2–P4; §8 fleet healt | blocked (2–3 friendly pilot practices (recruitment + consent + per-practice provisioning) + weeks of real after-hours/overflow calls + weekly QA. Human/operational and calendar-bound — the true critical path; cannot be mocked.) | XL |

## Stage 3 — Monitors (Ads W3, SEO W4, Site Health, Meetings W5)

Stage 3 turns the spine into a live monitoring layer: it wires the first read-crons and connectors, warehouses external data, and runs the judgement skills (auditor, keyword-recommender, seo-diagnose, extraction) that raise flags onto Today and route monitor-class notifications through the 3.1 router. Step 3.1 (notification center) is already DONE and not re-planned — every monitor step below wires its notify.route() emit into that existing router, satisfying the "ship WITH notification routing, not before" rule. The dominant reality is that all external services (Google Ads MCC, BrightLocal, GBP, Fathom) are credential-blocked, so every step follows BUILD-LOOP rule 7: build the full platform logic behind a connector interface with a labelled PROVISIONAL mock, contract-test it, and leave credential wiring + skill shadow-exit as precise BLOCKERS. The mocks let every DoD test in §13/SPEC-ADS/SPEC-SEO run now against seeded data. Ads (SPEC-ADS, the exemplar depth) is the heaviest sub-stage and decomposes into five steps (connector+warehouse, measurement gate, auditor, keyword-recommender, optimiser+mutation pipeline). SEO splits into two (pipeline+classifier, then diagnose+opportunities). Meetings and Site Health are one step each. Ordering is dependency-driven: the Ads connector/warehouse (which also bootstraps the pg-boss job runner + the connector pattern reused by SEO/Site-Health) comes first; the measurement-first gate precedes auditor/optimiser because it gates every rec; the mutation pipeline (safety-critical, the largest step) comes after auditor+recommender produce the recs it executes. New action-executor kinds (ads.mutate, ads.uploadConversions) are added to the existing gates.ts executor registry so skills still never hold credentials — caps are enforced in connector code, per §3.2/§3.5.

**Blockers:** Google Ads MCC + developer token (Basic tier, 15k ops/day) + one OAuth credential + at least one linked client account (§8, SPEC-ADS §5) — needed to wire 3.2.1–3.2.5 real; MockAdsConnector stands in until then.; Hamza Ads validation session + golden sets: past audits (account snapshot → the changes he made) for ads-auditor recall ≥80%/noise ≤20%; keyword hindsight labels (adds that later converted vs his negatives) for keyword-recommender ≥70% rediscovery/≤25% noise (SPEC-ADS §2/§3 evals). ads-auditor + keyword-recommender + ads-optimiser stay SHADOW until these score.; ANTHROPIC_API_KEY (already OPEN in BLOCKERS.md) — all Stage-3 skills run on MockModelClient (PROVISIONAL) until set; runner auto-switches.; BrightLocal plan-tier decision (open q #3): API access vs CSV-bridge parsing, plus the credential/key (SPEC-SEO §2) — needed to wire 3.4.1 real.; Google Business Profile (Business Profile APIs) application/approval — has real lead time; file in week 1 of Stage 3 (SPEC-SEO §2). GBP-field snapshots + competitor GBP watch are mocked until granted.; Hamza SEO golden set: 25 historical diagnosed rank drops replayed with only the data available at the time; seo-diagnose top-2 hypotheses must contain his verdict ≥80% (SPEC-SEO §7). seo-diagnose stays SHADOW until.; Fathom API token + webhook signing secret — needed to wire 3.5 real; a seeded/mock Fathom transcript payload stands in until then.; Stage 2 (W1 receptionist fleet) is blocked on the voice-vendor spike — so 3.3's real rescued-call booking outcomes are unavailable; 3.3 is built against a mock fleet outcome and a mock ads.uploadConversions until Stage 2 lands.

| Step | Builds | Status | Size |
|---|---|---|---|
| 3.2.1 Ads connector + GAQL warehouse ingest + job runner bootstrap | The AdsConnector tool-surface (the ONLY holder of Google Ads credentials, per §3.5): ads.q | mockable (Google Ads MCC + developer token + OAuth credential + one linked client account (mock until provided)) | L |
| 3.2.2 Measurement-first gate + measurement-health strip UI | SPEC-ADS §1 as a code gate every Ads skill runs behind before any rec: conversion-actions  | buildable_now | M |
| 3.2.3 ads-auditor skill + audit score model + audit card UI | SPEC-ADS §2 ads-auditor: scored A–F audit (Measurement 25 / Structure 20 / Query&Keyword 2 | mockable (Hamza's past-audit golden set (skill stays SHADOW until recall ≥80%/noise ≤20%); ANTHROPIC_API_KEY (MockModelClient until then)) | L |
| 3.2.4 keyword-recommender + weekly search-term triage + coverage-map UI | SPEC-ADS §3 keyword-recommender: sourcing (converting-terms-not-yet-keywords, GSC 5–20 org | mockable (Hamza's keyword hindsight labels (SHADOW until ≥70% rediscovery/≤25% noise); ANTHROPIC_API_KEY) | L |
| 3.2.5 ads-optimiser queue + mutation pipeline (validateOnly→execute→snapshot→audit) + change-watch + change-history reconciler | The safety-critical core (§8, SPEC-ADS §4/§5). ads-optimiser ranks the union of auditor fi | mockable (Google Ads MCC/token (mutations run against MockAdsConnector; caps tested in code); Hamza golden set for optimiser SHADOW-exit; ANTHROPIC_API_KEY) | XL |
| 3.3 Offline conversion upload pipeline (fleet outcomes → Ads) + enhanced-conversions fallback + reconciliation | SPEC-ADS §5 + §13 3.3: the offline-conversion upload tool on AdsConnector (ads.uploadConve | mockable (Stage 2 (W1 fleet) blocked — real rescued-call outcomes mocked; Google Ads token for real upload) | M |
| 3.4.1 SEO connector + BrightLocal/GSC/GBP warehouse + change classifier (2-day rule) | SPEC-SEO §1–§3: the SeoConnector tool-surface (BrightLocal ranks/citations, GSC queries/pa | mockable (BrightLocal plan tier + credential (open q #3); GBP API application/approval (lead time — file week 1); GBP fields mocked until granted) | L |
| 3.4.2 seo-diagnose decision tree + opportunity-writer + GBP cadence + recovery tracker | SPEC-SEO §4–§6: seo-diagnose as an ordered, evidence-gated hypothesis tree — (1) Did WE ch | mockable (Hamza's 25 diagnosed-drop golden set (SHADOW until top-2 ≥80%); CMS deploy-log stubbed until Stage 5; ANTHROPIC_API_KEY) | L |
| 3.5 Meetings (W5): Fathom webhook → extraction → dedupe vs open work → agenda-builder | §13 3.5 + §5 W5: a signed /hooks/fathom receiver (enqueue-then-process via pg-boss, never  | mockable (Fathom API token + webhook secret (mock transcript fixture until provided); ANTHROPIC_API_KEY) | M |
| 3.6 Site Health: uptime-sentinel, SSL/domain expiry, form-canary | §13 3.6 + module map ♥ Site Health: scheduled probes (pg-boss cron) — uptime-sentinel (HTT | mockable (form-canary target endpoint depends on CMS forms (Stage 5) — mocked until then; real client URLs usable now for uptime/SSL) | M |

## Stage 4 — Money & Sales (Billing, Prospects, Reports, Guarantee, Support loop)

Stage 4 turns the spine into a revenue system: a Xero/Stripe-fed billing surface, the full sales funnel (deal board → capture → research → the flagship audit microsite → scoring/nurture → proposal → deposit→Won→factory event), monthly proof reports off metrics_daily, the guarantee tracker, and the ongoing support loop (reputation/reviews + verified new-patient reconciliation + support-only onboarding). It is a multi-system build, sized as §1 warns (a billing system + a CRM/sales engine + a reporting platform sharing one client record and the G0–G3 gate architecture), so I break it into 13 right-sized loop iterations across §13 4.1–4.5.

Everything builds on Stage 1 contracts (Postgres schema incl. deals/metrics_daily/timeline/audit, skill runner + G0–G3 gates, entity matcher, timeline, W2 pipeline) and the 3.1 notify router. Following BUILD-LOOP rule 7 and the "mock behind the real interface" rule: all vendor touchpoints are built behind capped connector interfaces with recording mocks (like the existing MailSender/TaskConnector) — Stripe/Xero (money), a PublicDataConnector (GBP/CWV/rank/reviews for the audit), a SchedulingConnector (absorbs Calendly), and a PdfExporter (Anthropic doc skills). All 8 new judgement/generative skills are authored in /skills/<name>/v1/ and run against the existing MockModelClient (Anthropic key still OPEN) and provisional ≤10-case golden sets — they ship G2/shadow and CANNOT graduate until Wally's real sauce lands. The report/guarantee renderers are pure platform code over seeded metrics_daily and are buildable_now.

Two cross-stage notes ground the sequencing: (1) the audit microsite is spec'd to render "from the block library" (Stage 5.2), which does not exist yet — 4.2d ships an interim standalone renderer behind a stable interface, to be repointed at the block library later; (2) production reports depend on Stage 3 monitors filling metrics_daily, but the 4.3 DoD runs against the 30-day seed from step 1.2, so reports are buildable and testable now.

**Blockers:** Stripe + Xero SANDBOX keys (BUILD-LOOP Stage-4 pre-list) — money connectors built behind XeroMock/StripeMock; needed to wire real webhooks/invoices/deposits (4.1a, 4.1b, 4.2f); Payment-rails decision confirmation from Wally (open q #14 / SPEC-SALES §5): Stripe = merchant of record, Xero = ledger, direct-debit/GoCardless deferred to 4.5+ — recommendation exists so build proceeds, but confirm before real wiring; Anthropic API key (already OPEN in BLOCKERS.md) — all 8+ new sales/report/support skills run on MockModelClient (PROVISIONAL, output labelled mock) until provided; Wally's SALES golden sauce: 10 hand-made past audits (audit-report-generator eval, SPEC-SALES §6) + historical proposals (proposal-writer) + nurture voice examples — skills ship G2/shadow on provisional ≤10-case sets and CANNOT graduate until the real sets score to target; Wally/Hamza's REPORTS golden sauce: the real June report + a real historical down-month + past report prose (insight-writer eval, SPEC-REPORTS §6) — insight-writer stays G2 until it beats the hand-made original on the blind judge; One-time benchmark-registry seed values from Wally/Hamza's historical portfolio analysis (SPEC-REPORTS §4) — provisional values seeded now; real targets feed the quarterly-review ritual; Agile CRM export file (the real deals CSV) for the one-time migration run — script built + tested on a sample; real run blocked on the export; Meta Graph / Messenger app credentials (page-token refresh) for real Messenger lead capture (also open q #9 social) — behind MessengerConnector mock; Twilio/SMS sandbox + GBP write access for real review-request sends and review posting (4.5a) — behind mocks; PMS-triggered review requests are phase 2 (open q #4/#8, out of scope); AHPRA rules corpus + lawyer review (open q #13) — review-responder's hard-gate quality depends on it; the gate wires now, the corpus lands before client-facing sends

| Step | Builds | Status | Size |
|---|---|---|---|
| 4.1a Billing schema + money connectors (Xero/Stripe) + signed webhook receivers | The money substrate. New billing schema; a capped MoneyLedgerConnector (Xero: invoice stat | mockable (Stripe + Xero SANDBOX keys (BUILD-LOOP Stage-4 pre-list) — built behind XeroMock/StripeMock until provided; also confirm payment-rails split with Wally (open q #14 / SPEC-SALES §5: Stripe = merchant of record, Xero = ledger, GoCardless deferred to 4.5+).) | M |
| 4.1b invoice-runner + dunning-writer skills + MRR view + Billing tab | invoice-runner (business-ops skill: monthly retainer + final/pro-rata invoices from the ra | mockable (Anthropic API key (skills run on MockModelClient, PROVISIONAL); Wally's invoice/dunning voice examples for the real golden set — skills stay G2/shadow until then. Same Stripe/Xero sandbox keys as 4.1a.) | M |
| 4.2a Prospects schema + deal-tracker stage machine + Prospects deal board | The sales backbone. Extends the existing deals table with a prospects-domain migration (to | buildable_now | L |
| 4.2b lead-capture skill + multi-channel capture endpoints + dedupe/attribution | One intake pipeline (SPEC-SALES §2). lead-capture skill (G1): create Deal(Cold Lead), sour | mockable (Meta Graph / Messenger app credentials (page-token refresh) for real Messenger capture — behind MessengerConnector mock until provided (also relates to open q #9 social). Anthropic key for lead-capture live model calls.) | M |
| 4.2c prospect-researcher + PublicDataConnector (public-data research pack) | prospect-researcher (reused skill, G0): fires on capture, assembles the research pack from | mockable (None hard (public data), but real GBP scrape + rank-tracker (paid pennies/audit) + PageSpeed API keys land later — behind PublicDataMock until then. Anthropic key for the skill.) | M |
| 4.2d audit-report-generator — the flagship live audit microsite + cost telemetry | The funnel's economic unlock (SPEC-SALES §1). audit-report-generator (G2 first 90 days → G | mockable (Block library (Stage 5.2) does not exist yet — ships an INTERIM renderer behind AuditRenderer, repointed later (cross-stage sequencing, not a human blocker). Anthropic key + Wally's 10 hand-made past audits for the real golden set (SPEC-SALES §6) — stays G2 until scored.) | L |
| 4.2e lead-scorer + nurture cadences + meeting-scheduler + engagement tracking | lead-scorer (G0): engagement events (audit opened ×N, sections dwelled, replies, booking-l | mockable (Anthropic key (nurture-writer/lead-scorer on MockModelClient). Real nurture voice examples + open→meeting conversion baseline (SPEC-SALES §6, measured in production) — nurture-writer sends stay G2 until.) | L |
| 4.2f proposal-writer + rate card + deposit→Won→factory chain + loss-miner + Agile CRM migration | proposal-writer (reused, G2 always): proposal + costings from the versioned rate-card conf | mockable (Agile CRM export file (the real deals CSV — human deliverable) for the actual migration run; Stripe sandbox keys; Anthropic key + Wally's historical proposals for the golden set (proposal-writer stays G2 — it is G2-always by design).) | L |
| 4.3a Benchmark registry + monthly report section renderers off metrics_daily | The report data layer, pure platform code, zero live API calls (SPEC-REPORTS invariant). A | buildable_now (Provisional benchmark values seeded; the real per-type targets need Wally/Hamza's one-time historical portfolio analysis (SPEC-REPORTS §4) — flagged for the quarterly-review ritual, not blocking the build.) | M |
| 4.3b insight-writer + down-month mode + interactive portal report + PDF + scheduler + engagement-tracker | insight-writer (top-tier judgement skill, G2): the §2 narrative — outcome in patient terms | mockable (Anthropic key (insight-writer is top-tier judgement on MockModelClient — output labelled mock). Wally/Hamza's real June report + a real historical down-month for the golden set (SPEC-REPORTS §6) — insight-writer stays G2 until it beats the hand-made original on the blind judge.) | L |
| 4.4 guarantee-scorer + Guarantee Tracker tab | guarantee-scorer (computed, never set — platform code like flag-ranker, reading benchmarks | buildable_now (Depends on 4.2f writing the proposal's promised_outcome onto the deal (until real proposals exist, uses the seeded promise); benchmark registry from 4.3a.) | M |
| 4.5a reputation-pack-builder + review-requester + review-responder + portal Reviews tab | The reputation loop (P-B §5.1 S5/S6). reputation-pack-builder (G2): review links, QR cards | mockable (Anthropic key; GBP write access + a Twilio/SMS sandbox for real review-request sends (behind mocks until then); Wally/Ish review-response examples + the AHPRA rules corpus (open q #13) for the real golden set — review-responder stays G2 until.) | L |
| 4.5b new-patient-reconciler (one-tap monthly confirmation) + support-only onboarding path | Closes the ROI loop (P-B §5.1 S9). new-patient-reconciler (G2): merges platform-tracked en | mockable (Depends on 4.2d (baseline audit) + 4.3a (report verified badge). Anthropic key; real reconciler flow assumes production monitor data (Stage 3) — tested on seed. PMS pull is phase 2 (open q #4), out of scope here.) | M |

## Stage 5 — Website Factory + CMS core (W6–W8)

Stage 5 is the platform's largest build after the receptionist: a vertical website-generation SaaS (SPEC-FACTORY) sitting on top of a five-subsystem CMS content platform (SPEC-CMS). The load-bearing sequencing correction from SPEC-CMS §3 governs the whole plan: the CMS content model IS the factory's output format, so CMS core (5.0: block/facts model + renderer/publisher + change-set engine + forms) must build BEFORE any AI-generated site, or every factory site needs migrating later. Then the factory builds on it: deposit→intake→PRD→kickoff→assets (5.1), the client-facing brand kit as a design contract (5.1b), the human-taste block+directions libraries (5.2), the composer/critic/gallery (5.3), the overnight autonomous run system (5.3a–d), the eight-layer anti-slop system (5.3e), and the launch/handover chain (5.4). Everything builds on the Stage-1 spine (Postgres schema, skill runner + G0–G3 gates, entity matcher, audit log) and the 3.1 notification router. Nearly every generative skill runs behind the existing MockModelClient until the Anthropic key lands (established pattern); Cloudflare/Xero/Google connectors mock behind their tool interfaces per §3.5; the two irreducible human blockers are the designer-led library sprint (5.2) and the team-rated critic calibration corpus (5.3e). This stage also introduces two pieces of infrastructure the plan assumes but hasn't built yet: pg-boss (the job runner, §3.4) and a minimal client-portal shell (the intake wizard is the portal's first surface). Sequenced strictly per §13 / SPEC-CMS §8 / SPEC-FACTORY §6, giving ~19 single-iteration steps. The final stage DoD (SPEC-FACTORY §6): conditions met by 6pm → wake to 3 candidates on 3 demo URLs + digest → agency releases → client comments → next morning the revision is live on the demo → approve → launch, two consecutive nights, zero manual generation steps.

**Blockers:** Anthropic API key (already OPEN in BLOCKERS.md) — EVERY Stage-5 generative skill (intake-interviewer, prd-generator, concept-sketcher, kickoff-miner, brand-kit-generator, design-director, site-composer, content-writer, slop-critic, feedback-interpreter, ahpra/seo/tone guardrails, metadata-writer, retro-writer, etc.) runs behind MockModelClient until it lands; skills ship shadow/G2 and cannot go live on synthetic exams.; Designer sessions for the block library + design-directions library (5.2) + Wally's recorded walkthrough — the human-taste craft that caps every overnight run's quality; the schema/registry build now with a provisional starter set, but curated taste cannot be generated or mocked.; Team-rated critic calibration corpus (~50 sites: portfolio + competitors + raw AI output) + a 20-site blind-rating holdout (5.3e L6) — Wally/the team's ratings; the ≥0.8 critic-vs-team correlation DoD cannot be verified without them (same shape as the triage golden-set blocker).; Real golden sets for the factory generative skills (site-composer / content-writer / brand-kit-generator / intake-interviewer / prd-generator) from Wally/Ish's historical work — needed before these skills leave shadow mode (BUILD-LOOP rule); provisional 10-case sets until then.; Cloudflare account + API token (Pages CDN, wildcard *.demo.20-80.dev, DNS/SSL) — for real publish (5.0c-i), demo infra (5.3b), and launch chain (5.4); mocked behind SitePublisher/DemoHost/DNS interfaces until provided.; Stripe + Xero sandbox keys — deposit-runner webhook that fires the factory (5.1-s1); mocked behind the connector tool interface.; Google Workspace admin + Google Business Profile API + Google Ads MCC credentials — launch chain (5.4: gsuite-provisioner, gbp-builder primary-owner, campaign-builder paused); mocked (Ads already mocked in Stage 3).; Fathom API/webhook credentials — kickoff-miner transcript (5.1-s3; also Stage 3.5); mocked behind the connector interface.; AHPRA rules corpus + lawyer review pass + violation test-suite (open q #13) — ahpra-checker is BLOCKING in the change-set guardrail pipeline (5.0d) and the overnight AHPRA sweep (5.3a); mockable but not authoritative on real client-facing content until sourced and legally reviewed — required before the first AI-generated site ships.

| Step | Builds | Status | Size |
|---|---|---|---|
| 5.0a Block library schema + editability/guardrail manifests + core block types | The one definition four consumers share (SPEC-CMS §1/§2.1): per block type a JSON schema ( | buildable_now (The 15–20 block types here are provisional/engineering-quality; the human-taste curated library is the 5.2 designer sprint (blocked on designer sessions) — same schema, expanded set.) | L |
| 5.0b Facts registry + effective dating + reference tracking | The propagation trick (SPEC-CMS §2.2): practice facts (hours, phone, address, team, fee ra | buildable_now | M |
| 5.0c-i Renderer + static publisher + page versions/releases + atomic publish & rollback | Block tree → SSG static build (Astro-class; the sub-decision is a Stage-5.0 spike, SPEC-CM | mockable (Cloudflare account + API token for real Pages CDN deploy — LocalPublisher stands behind the SitePublisher interface until then.) | L |
| 5.0c-ii Preview builds + screenshots + redirects manager + SEO plumbing | The mechanism behind every G2 CMS approval (SPEC-CMS §3): every change-set gets a draft bu | buildable_now | M |
| 5.0d Change-set engine core + guardrail pipeline + lanes + scheduling | The heart (SPEC-CMS §4): a change-set is the ONLY way anything changes on any site (AI, ag | mockable (ahpra-checker is only as good as its rules corpus — open q #13 needs the AHPRA advertising-guidelines corpus + a lawyer review pass + violation test-suite before it is authoritative on real client-facing content; mocked/provisional-ruleset behind the interface until then. All three guardrail skills run behind MockModelClient until the Anthropic key lands.) | L |
| 5.0e Forms as blocks → Leads + GCLID capture + form-canary hooks | Forms are platform endpoints, defined as blocks like everything else (SPEC-CMS §3). A form | buildable_now | M |
| 5.0-gate CMS core integration gate (SPEC-CMS §8 DoD) | The Stage-5.0 acceptance test wiring, exercised by a stub composer before the real site-co | mockable (Real 'staging domain' is the Cloudflare-backed publisher (mocked as LocalPublisher until the CF token lands, per 5.0c-i).) | S |
| 5.1-s1 Factory Stage 1: deposit-runner + portal-provisioner + client-portal shell bootstrap | Payment webhook → portal login + onboarding checklist in ~1 minute (masterplan §7 stage 1) | mockable (Stripe + Xero sandbox keys — webhooks mocked behind the connector tool interface until provided.) | M |
| 5.1-s2a Factory Stage 2a: intake-schema v1 + 8-step save-anywhere wizard | SPEC-INTAKE §1–2: author intake-schema v1 = base questionnaire + 3 vertical overlays (dent | buildable_now | L |
| 5.1-s2b Factory Stage 2b: adaptive interviewer + PRD pipeline → first mock | The adaptive layer that beats a Google Form (SPEC-INTAKE §4–5) + PRD generation (masterpla | mockable (Anthropic API key (skills run behind MockModelClient until it lands). Real team golden sets (Wally/Ish examples) needed before these generative skills leave shadow mode — provisional 10-case sets until then.) | L |
| 5.1-s3 Factory Stage 3: kickoff — agenda from PRD gaps + transcript mining (H1) | Masterplan §7 stage 3: auto-scheduled kickoff; kickoff-agenda-builder builds the agenda fr | mockable (Fathom API/webhook credentials (also Stage 3.5) — mocked behind the connector interface. Anthropic key for the miner skill.) | M |
| 5.1-s4 Factory Stage 4: asset slots + validation + chases + shot list | Masterplan §7 stage 4: asset-requester generates upload slots from the PRD manifest; asset | buildable_now (chase-scheduler already exists from Stage 1.5; asset-validator's vision check uses the model (mocked until the Anthropic key lands) but resolution/vector/EXIF checks are mechanical and testable now. Reuse chase-scheduler.) | M |
| 5.1-gate Factory 5.1 stage DoD: deposit-to-first-mock ≤48h dry run | Integration test threading stages 1→4: deposit webhook → provisioning → intake wizard → ad | mockable (Connector mocks (Xero/Stripe/Fathom) + MockModelClient stand in until credentials/key land.) | S |
| 5.1b Brand kit — the client-facing design contract (SPEC-FACTORY §1) | brand-kit-generator produces 1–3 kits from PRD v2 (differentiators/voice/red lines) + the  | mockable (Depends on the design-directions library — needs at least the directions SCHEMA + a provisional starter set (see 5.2); the curated set is designer-blocked. brand-kit-generator runs behind MockModelClient until the Anthropic key lands.) | L |
| 5.2 Block library + design-directions library — the human-taste sprint | The two human-taste assets that cannot be generated (masterplan §12.1, SPEC-FACTORY §3/L1) | blocked (Designer sessions (block + directions libraries) + Wally's recorded walkthrough — the craft investment; engineering schema/registry builds now with a clearly-provisional starter set, but the curated human-taste content cannot be generated or mocked into quality.) | L |
| 5.3 design-director + site-composer + slop-critic + concept gallery | Masterplan §7 stage 5 / SPEC-FACTORY: design-director casts 3 directions per client vs the | mockable (Anthropic key (all skills mocked until then). The blind 'which is AI?' review needs a human panel. Composition quality is capped by the 5.2 libraries (designer-blocked). Real golden sets needed before these skills leave shadow.) | XL |
| 5.3a Overnight run orchestrator — the skill-runner in batch mode | SPEC-FACTORY §2–3: the autonomous generation engine. Introduces pg-boss (the §3.4 job runn | buildable_now (Orchestration + pg-boss + budgets are buildable and testable now with mocked skills; the generated content quality depends on the Anthropic key + libraries, but the run machinery does not.) | L |
| 5.3b Demo infrastructure — wildcard subdomains + promote-to-production | SPEC-FACTORY §3: the run deploys to a demo server at https://{client-slug}.demo.20-80.dev  | mockable (Cloudflare account + API token (wildcard *.demo.20-80.dev + Pages CDN) — LocalDemoHost behind the interface until then.) | M |
| 5.3c-d Review workbenches (agency + client) + morning digests | SPEC-FACTORY §2 wake-up + §6 items 5.3c/5.3d. Agency review workbench (Factory tab): scree | mockable (Reuses the 3.1 notification router (built). Skills mocked until the Anthropic key lands.) | L |
| 5.3e Anti-slop enforcement — eight layers (SPEC-FACTORY §5) | The eight structural counters to slop: L2 fleet similarity budget (no two same-specialty p | blocked (The three-critic calibration corpus (team scores ~50 sites: portfolio + competitors + raw AI output) and the 20-site blind-rating holdout require Wally/the team's ratings — the ≥0.8-correlation DoD cannot be verified without them (same shape as the triage golden-set blocker). Layer MECHANICS (similarity registry, swap-test, banned phrases, specificity quota, imagery/content-debt, one-bold-move) build and test now with a provisional corpus; the calibration DoD is human-blocked.) | XL |
| 5.4 Factory Stages 6–8: build-out + metadata + launch chain + handover + retro | Masterplan §7 stages 6–8. Stage 6: site-composer long-tail pages, metadata-writer batch, l | mockable (Cloudflare (DNS/SSL) + Google Workspace admin + GBP API + Google Ads MCC credentials — all mocked behind connector tool interfaces (Ads already mocked in Stage 3). Anthropic key for the generative skills.) | XL |
| 5-DoD Stage 5 acceptance — the two-night autonomous dry run | The upgraded Stage-5 DoD (SPEC-FACTORY §6) as an end-to-end test across the whole factory  | mockable (Full acceptance requires the Anthropic key, the designer-curated libraries (5.2), the critic calibration corpus (5.3e), and Cloudflare/Google/Xero credentials; runs on mocks + provisional data until they land, so the machinery is provable now but the quality bar is human-gated.) | M |

## Stage 6 — Client editing surfaces, Studio, offboarding + the intake wizard (SPEC-CMS §5–6, SPEC-INTAKE)

CRITICAL SEQUENCING CORRECTION: the task premise ("CMS core already exists from 5.0") is FALSE against BUILD-LOG.md — only Stage 1 spine + 3.1 notifications are built. Stage 5.0 (CMS content model, facts registry, renderer/publisher, change-set engine, forms-as-blocks), 5.1 (factory deposit→provisioning), and 5.2 (block + directions libraries) DO NOT EXIST. Every Stage 6 editing step and the whole intake wizard build ON TOP OF those 5.0/5.1 contracts, so this stage is genuinely gated behind them and cannot land as real product until they do. This plan therefore names the exact 5.0 contracts each step consumes and treats them as depends_on/blockers rather than re-planning 5.0 (per the "build on existing contracts, don't re-plan" instruction).

Scope covers two of the plan's biggest builds bundled together: (A) the CMS editing surfaces + guardrails + Studio + offboarding of §13 Stage 6 (SPEC-CMS §5–6), and (B) the portal intake wizard the task title adds (SPEC-INTAKE / §13 5.1's intake portion). I broke it into 18 right-sized loop iterations, ordered so the client-portal shell and intake wizard (which precede Stage 6 editing in real build order) come first, then the agency editor, the change-set guardrail/lane machinery and its "Saturday hours from 1 Aug" E2E, the client tiers, Studio, offboarding, and finally the rank-safe Emergent exit.

Almost everything is "mockable" behind the established MockModelClient + mock-connector pattern (Anthropic key, Cloudflare, GBP, W4, Xero all mocked; skills ship G2/shadow on provisional golden sets exactly as email-triage did). Two things are genuinely un-mockable and marked accordingly: the internal 5.0/5.1 prerequisite (a build-order gate, not a credential) and the Emergent migration PILOT (needs a real client site + DNS cutover + 6-week rank observation, like the voice 2.0 spike). The intake-schema authoring (I1) is the one purely buildable-now data step.

Existing contracts reused: skill runner + G0–G3 gates (1.3), MockModelClient auto-switch (1.3), entity matcher (1.4), append-only timeline_events + audit_log (1.2), gate_items/precision_ledger (1.3), notify router for chases/handover/intake notifications (3.1), chase-scheduler pattern from inbox (1.5), GateCard UI + Sparkline (1.6). New app surface: the client PORTAL shell does not exist yet (only the agency dashboard rail) — P0 scaffolds it, and both the intake wizard and My Website mount there.

**Blockers:** BUILD-ORDER GATE (dominant): Stage 5.0 CMS core + 5.1 factory + 5.2 libraries must be built before this stage is real product. BUILD-LOG shows only Stage 1 + 3.1 exist. Not a credential — a sequencing decision the human/orchestrator must make: build 5.0/5.1/5.2 first, or accept that Stage 6 is coded against mocked 5.0 interfaces and re-wired later.; Anthropic API key (already OPEN in BLOCKERS.md) — every LLM skill here (cms-edit-assistant, seo-guard, translator-zh, intake-interviewer, practice-researcher, prd-generator, asset-validator, handover-builder) runs on MockModelClient until it lands.; Cloudflare API token — real publish to Pages CDN, DNS/SSL automation, and migration DNS cutover; renderer/publisher runs behind a mock until provided.; AHPRA rules corpus + lawyer review (§14 open q #13) — the guardrail-pipeline ahpra-checker and the intake compliance moment (SPEC-INTAKE §6) need the real corpus; provisional rules until then; required before any real client-facing generated/edited content.; Translation glossary + 中文 gold examples (Ish / bilingual owner) — translator-zh golden set; the Studio skill stays shadow/G2 on synthetic data until the real set arrives (BUILD-LOOP golden-set rule).; Skill golden sets from team history (Wally/Ish sauce) for cms-edit-assistant, seo-guard, intake-interviewer, prd-generator, practice-researcher — each ships G2 on a ≤10-case provisional set and CANNOT graduate or leave shadow until the real ≥30–50 examples arrive.; Wally's confirmation of the intake differentiation-question wording + the specificity/pushback bar (SPEC-INTAKE §10) — schema can be authored provisionally from the three real questionnaires in specs/intake-source/ now, but needs sign-off.; A real Emergent/WordPress client site + a DNS cutover window + 6-week post-cutover rank observation — required for the 6.4b migration DoD (zero rank loss at +6wk). Cannot be mocked (like the Stage 2.0 voice spike); the importer + parity gate are buildable against a captured static fixture, the pilot cutover is blocked.; SPEC-SECURITY portal auth (magic-link/session) + secret store — the client portal login the wizard follows and the credential-capture lane (domain EPP / hosting / analytics logins go to the secret store, never a prompt); stubbed until SPEC-SECURITY is built.

| Step | Builds | Status | Size |
|---|---|---|---|
| P0 Client portal shell scaffold (the portal does not exist yet) | A distinct client-portal SPA surface (rail/topbar/routing separate from the agency dashboa | mockable (SPEC-SECURITY portal auth not built — magic-link/session stubbed.) | M |
| I1 intake-schema v1 as versioned branching data (base + 3 overlays + answer→PRD map) | The questionnaire modelled as data per SPEC-INTAKE §1: one base (~20 Qs) + bodywork/dental | buildable_now (Wally sign-off on differentiation wording + specificity bar (SPEC-INTAKE §10) — authored provisionally now, refined on sign-off.) | M |
| I2 Portal intake wizard UI — 8 steps, save-after-every-field, resumable, mobile | The wizard rendered from intake-schema per SPEC-INTAKE §2: 8 grouped steps + progress rail | buildable_now | XL |
| I3a practice-researcher pre-fill into Steps 2 & 5 (confirm-or-fix chips) | skills/practice-researcher/v1 that (behind connector mocks for site/GBP/reviews/competitor | mockable (Anthropic key + real scrape targets (GBP/site) — research runs on mocked packs until provided.) | M |
| I3b intake-interviewer (thin-answer pushback + contradiction + COI) + compliance moment | skills/intake-interviewer/v1 (top-tier, G2) wrapping the schema per SPEC-INTAKE §4: specif | mockable (Anthropic key + AHPRA rules corpus (open q#13, provisional until lawyer-reviewed) + intake-interviewer golden set (Wally sauce) — stays G2 on synthetic until real.) | L |
| I4 Submit → PRD v1 assembly + Getting-Started checklist + non-blocking assets lane | skills/prd-generator/v1 assembling PRD v1 from answers (facts→facts registry [5.0], differ | mockable (5.0 facts registry (fact writes) + SPEC-SECURITY secret store (credential capture) + Anthropic key + prd-generator golden set — all mocked/stubbed until provided.) | XL |
| S1 Agency editor — block-tree manipulation + page templates | The agency-side CMS editor (CMS & Sites tab): read a site's block tree, edit block fields  | mockable (5.0 CMS core (change-set engine + renderer/publisher) + Cloudflare token — publish behind a mock until built.) | L |
| S2 Bulk find-and-replace with change-set preview + cross-site fact queries | The agency 'we renamed a service' operation: bulk find-and-replace across a site rendered  | mockable (5.0 change-set engine + facts registry reference tracking.) | M |
| S3 cms-edit-assistant skill — words → structured change-set | skills/cms-edit-assistant/v1 (SPEC-CMS §5 Tier-2 brain): a prompt-box instruction → a stru | mockable (Anthropic key + cms-edit-assistant golden set (Ish sauce) + 5.0 change-set engine — G2 on synthetic until real.) | L |
| S4 seo-guard skill + guardrail lanes + soft-locks/conflicts | skills/seo-guard/v1 (SPEC-CMS §4): detects ranking damage (money-page H1/title change, sni | mockable (Anthropic key + seo-guard golden set + ahpra-checker (unbuilt, stubbed w/ provisional AHPRA rules) + W4 rank data (3.4, mocked).) | L |
| S5 The 'Saturday hours from 1 Aug' E2E — scheduling + propagation + post-publish rank watch | The 6.2 headline test wiring: effective-dated change-sets executed by the cron process, pr | mockable (5.0 change-set scheduling + facts registry; GBP connector (Stage 3) + W4 (3.4) mocked.) | L |
| S6a Client My Website — Tier 1 structured fields + server-side editability enforcement | Portal My Website Tier 1 (SPEC-CMS §5): facts registry + team members + photos as plain mo | mockable (5.0 editability manifests + facts registry + portal auth (P0 stub).) | L |
| S6b Client Tier 2 (prompt box) + Tier 3 (visual editor) + client lane graduation | Tier 2 prompt box (reuses cms-edit-assistant → change-set → preview → publish per lane — t | mockable (5.0 change-set engine + 5.2 block library + ahpra-checker (stub) + Anthropic key.) | XL |
| S7 Studio — translator-zh + glossary manager + translation memory | Content Studio agency tab (§13 6.4): skills/translator-zh/v1 translating translatable bloc | mockable (Anthropic key + team translation glossary + 中文 gold examples (Ish/bilingual) — stays shadow/G2 on synthetic until real.) | L |
| S8a Offboarding — handover-runner orchestration + static-export bundle + one-click data ZIP | skills/handover-runner/v1 + handover-builder orchestrating §10.1 steps 2/4/6: the static-s | mockable (5.0 renderer static output + Stage 4 invoice-runner (final invoice, mocked).) | L |
| S8b Portal read-only mode + partial handover + day-1 ownership-rule verification | §10.1 finish: portal flips to read-only export mode for 30d then archives; win-back check  | mockable (portal auth (P0 stub) + Stage 4 billing plan model (mocked).) | M |
| S9 Emergent/WordPress exit — importer + parity gate (pilot cutover blocked) | SPEC-CMS §6 rolling workstream: importer (crawl existing site → Claude proposes block-ific | blocked (A real Emergent/WordPress client site + DNS cutover window + 6-week rank observation (like the Stage 2.0 voice spike) — importer/parity-gate are mockable against a fixture, the pilot cutover + rank-safety DoD cannot be mocked.) | XL |

## Cross-cutting — Security / auth / roles / APPs (SPEC-SECURITY) — gates real users before Stage 1 ships

SPEC-SECURITY.md is a "must exist before real client data enters prod (end of Stage 1)" cross-cutting stage, not a numbered §13 line. Today the platform has NO auth: api.ts is wide open, `actor` is client-supplied in request bodies/query, and queries are single-workspace with no row-level tenant scoping. Migration 0004 already added a minimal `users` table (id/workspace/name/role + notification prefs) explicitly deferring real auth to this spec. The spec's own Stage DoD (§5) enumerates exactly four proof points, which decompose cleanly: (1) CI isolation suite passes on every route → SEC.4+SEC.8; (2) a G3 action by a specialist is refused server-side → SEC.3; (3) a revoked portal user's push tokens stop working → SEC.5; (4) restore drill from last night's snapshot on staging → SEC.8 (real drill blocked on hosting; local logical round-trip built now). I sequence 8 steps: auth foundation (password login + sessions + dashboard login gate) → mandatory TOTP 2FA + step-up → authorization matrix (capability gate) → tenant isolation (row scoping + CI leak sweep) → portal magic-link auth + push-token bind/revoke → hardening (rate limit/throttle/webhook-sig/CSP) → privacy/APPs (export ZIP + retention purge + secret redaction) → CI pipeline + NDB runbook + backup/restore round-trip. All crypto uses Node's built-in `crypto` (scrypt for passwords, HMAC-SHA1 for TOTP) so SEC.1–4 and SEC.6–7 need no external creds. SEC.5 mocks magic-link email behind the existing MailSender and mocks push *delivery* (binding/revocation are real). SEC.8's real staging drill + external pen-test are the only truly blocked items. Everything builds on the Stage-1 spine contracts (schema 0001–0004, api.ts Hono app, append-only audit_log, notify.ts router).

**Blockers:** PWA push delivery credentials (FCM server key / APNs cert) — NEW, needed for SEC.5 real push send; binding/revocation built behind PushSender interface now (add a precise BLOCKERS.md entry); Gmail OAuth for support@ (EXISTING blocker) — needed for real magic-link email in SEC.5 and the real Gmail-push webhook signing token in SEC.6; mocked behind MailSender / dev webhook secret now; ActiveCollab API token (EXISTING blocker) — carries the real /hooks/activecollab signing secret for SEC.6; dev secret used until then; Hosting / staging (Fly.io Sydney, PRE-KNOWN in BUILD-LOOP) — needed for SEC.8's real pg_dump restore drill and §3 DB-encryption-at-rest / KMS; local logical round-trip + envelope-cipher-with-dev-key built now; KMS / infra secret store — needed to hold the real credential-encryption key (SEC.7 CredentialCipher) and platform webhook secrets; local dev key used until provided; External pen-test (SPEC-SECURITY §5) — human/vendor engagement required before the P4 receptionist fleet / SaaS phase; not gating this stage's DoD but tracked; Dev-only seed passwords / TOTP secrets for the 4 agency users must be labelled non-production and rotated before real deploy — no real secrets committed (BUILD-LOOP rule)

| Step | Builds | Status | Size |
|---|---|---|---|
| SEC.1 Auth foundation: password login, sessions, httpOnly cookies, dashboard login gate | Real agency authentication behind the currently-open API. Extends the users table with aut | buildable_now | L |
| SEC.2 Mandatory TOTP 2FA + step-up re-auth for G3 / Settings | Enforces SPEC-SECURITY §1 'mandatory TOTP 2FA' for agency users and step-up re-auth for G3 | buildable_now | L |
| SEC.3 Authorization: the SPEC-SECURITY §2 permission matrix (capability gate, session-derived actor) | Server-side per-route authorization. Encodes the §2 matrix (capability × role) as a PERMIS | buildable_now | L |
| SEC.4 Tenant isolation: row-level client scoping on every route + CI cross-client leak suite | The §2 requirement 'every query workspace- and client-scoped at the data layer' + 'cross-c | buildable_now | XL |
| SEC.5 Portal auth: magic-link (behind MailSender) + portal sessions + PWA push-token bind/revoke | SPEC-SECURITY §1 portal auth. Migration adds magic_links (token hash, contact_id, expires_ | mockable (PWA push delivery creds (FCM server key / APNs) for real push, and Gmail OAuth for real magic-link email — both mocked behind PushSender/MailSender now (existing gmail-oauth blocker; NEW push-creds blocker)) | L |
| SEC.6 Platform hardening: rate limiting, login throttle/lockout-with-notify, webhook signatures, CSP | SPEC-SECURITY §5 hardening checklist items that are code, not infra. Per-IP + per-user rat | buildable_now | L |
| SEC.7 Privacy / APPs: data-export ZIP, retention purge clocks, secret & clinical redaction | SPEC-SECURITY §3 privacy machinery. exportClientData(clientId) assembles the APP-12/13 acc | buildable_now (KMS / secret store for credential encryption at rest — envelope cipher built behind CredentialCipher with a local dev key; real KMS key is human/infra-provided (rides the hosting blocker). Export/retention/redaction themselves are fully buildable now.) | L |
| SEC.8 CI pipeline + NDB runbook + backup/restore round-trip | Closes the remaining §5 DoD + checklist. CI workflow (.github/workflows/ci.yml, none exist | mockable (Hosting/staging (Fly.io Sydney, pre-known) for the real pg_dump restore drill + DB-encryption-at-rest, and an external pen-test (human) before P4/SaaS — local logical round-trip, CI config and revoke-all tooling built now.) | M |

## Stage 7 — SaaS layer (multi-tenant, white-label, KB licensing, metering)

Stage 7 turns the single-tenant 20-80 platform into a multi-tenant SaaS. The data model is already tenant-ready — every table carries `workspace_id NOT NULL REFERENCES workspaces(id)` (0001_spine.sql) — but tenancy is NOT actually enforced: `WORKSPACE_ID = 'ws_2080'` is a hardcoded constant in gates.ts/runner.ts/seed.ts, and NO read query in api.ts filters by workspace. So the plan's "packaging, not rebuild" is accurate for the schema but the wiring (context resolution, query scoping, isolation tests, per-tenant branding/KB/metering surfaces) is real work. I break it into 5 steps: (7.1) the multi-tenant spine — tenant model + per-request workspace context + scope every query + the SPEC-SECURITY §2 cross-tenant isolation CI gate; (7.2) white-label theming per tenant over the existing CSS-token/no-flash-boot mechanism; (7.3) KB licensing + per-tenant version pinning, wiring the currently-empty `skill_runs.kb_versions` and adding a tool-layer license refusal; (7.4) usage metering + rating built on the already-recorded `skill_runs` token/cost telemetry; (7.5) tenant provisioning + a super-admin/white-label admin surface (the GoHighLevel "SaaS mode / snapshots" playbook, §12.3). CRITICAL GAP: there is NO SPEC-SAAS — the plan's own spec-before-build rule (§0.1a) is unmet for this stage. All plumbing is buildable behind sensible defaults, but the commercial shape (pricing/rate-card, what's metered, white-label boundaries, KB license terms, reseller/sub-tenant model) are Wally/product decisions that must be settled (a SPEC-SAAS + validation session) before this ships to real paying agencies. Isolation-to-real-sessions also depends on SPEC-SECURITY §1 auth, which is still unbuilt (open q#12).

**Blockers:** NO SPEC-SAAS EXISTS — the plan's own spec-before-build rule (§0.1a) is unmet for Stage 7. Need a SPEC-SAAS + validation session (Wally) settling the COMMERCIAL shape before shipping to real agencies: (1) pricing tiers + metered rate-card — what's metered and at what price (§12.3 $20/client/mo is only a benchmark); (2) white-label boundaries — vanity domains? BYO Anthropic key? which tokens are overridable; (3) KB license terms — which packs are licensable, version-support/deprecation policy, pricing; (4) reseller/sub-tenant model — does a tenant resell to sub-tenants (GHL SaaS mode, parent_workspace_id) and how is that billed. All plumbing is buildable behind defaults now, but these decisions gate go-to-market.; SPEC-SECURITY §1 auth is not built (open q#12): multi-tenant isolation is enforced now via a header/role stand-in; binding the tenant + super-admin to a real authenticated session must wait for the auth layer. A cross-tenant CI leak test can and must ship in 7.1 regardless.; Stripe + Xero sandbox keys (Stage 4 blocker): required to turn 7.4's rated usage into real tenant subscription invoices. Metering capture/rollup/rating is buildable and testable now without them.; Cloudflare Pages/CDN connector (Stage 5 infra) + Fly.io deploy tokens (pre-known blocker): required for real white-label asset hosting and per-tenant vanity subdomains/DNS. 7.2 uses URL strings + a subdomain header until then.; KB pack content — real AHPRA corpus (open q#13, needs legal review), block/directions library (Stage 5 designer sprint): 7.3 builds licensing/pinning machinery on placeholder versions; real content lands later without contract change.

| Step | Builds | Status | Size |
|---|---|---|---|
| 7.1 Multi-tenant spine: tenant model + per-request workspace context + query scoping + isolation CI gate | The foundation everything else needs. (a) Migration extends `workspaces` into a real tenan | buildable_now | XL |
| 7.2 White-label theming per tenant | Per-tenant branding over the existing token mechanism (CSS variables in app/src/index.css  | buildable_now (Logo/favicon stubbed to URL strings; real upload+hosting → Cloudflare Pages/CDN connector (Stage 5 infra). Custom vanity domains for white-label need DNS + Fly.io deploy tokens (pre-known blocker). Both mockable now via URL + subdomain header.) | M |
| 7.3 KB licensing + per-tenant version pinning | Realises principle #8 (the KB is versioned IP that 'later gets licensed as SaaS') and wire | mockable (The KB pack CONTENT (real AHPRA corpus, block/directions library, SEO rules) is authored in Stage 5 (designer sprint) + open-q#13 AHPRA governance/legal review. This step builds the registry + licensing + pinning MACHINERY against placeholder pack versions; content lands later without changing the contract.) | L |
| 7.4 Usage metering + per-tenant rating | Turns the already-recorded `skill_runs.{tokens_in,tokens_out,cost_cents}` telemetry (§3.2/ | buildable_now (Rated usage → a REAL tenant subscription invoice needs Stripe/Xero sandbox keys (Stage 4 blocker) + a Wally-approved rate card (what's metered and priced — the §12.3 $20/client/mo is only a benchmark). Capture + rollup + rating are fully buildable now; invoicing is the mockable seam.) | L |
| 7.5 Tenant provisioning + super-admin & white-label admin surface | Composes 7.1–7.4 into the GoHighLevel 'SaaS mode / snapshots' playbook (§12.3). Server `pr | buildable_now (Super-admin role enforcement + binding tenant↔authenticated-user depends on SPEC-SECURITY §1 auth (open q#12); stubbed to a role header until the auth layer lands. UI/provisioning logic is fully buildable now.) | L |
