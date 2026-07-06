# SPEC-ADS.md — Google Ads Engine, Marketer-Grade Depth

**The exemplar depth spec.** Every module gets one of these before its stage builds (see MASTER-BUILD-PLAN.md §0). This document specifies the Ads engine the way a senior PPC lead for local health practices actually works — the audit methodology, the keyword recommendation methodology, the connector realities, and the failure modes. The masterplan says *what*; this says *exactly how*.

Skills specified here: `ads-auditor` (NEW), `keyword-recommender` (NEW), plus depth for `ads-optimiser`, `change-watch`, `campaign-builder`.

---

## 1 · The measurement-first rule

**No optimisation decision is valid on broken measurement.** Every Ads skill runs behind this gate, checked before any recommendation is generated:

| Check | Method | Fail behavior |
|---|---|---|
| Conversion actions sane | Primary vs secondary correctly set; lead actions count one-per-click (not every); no double-counting (Ads tag + GA4 import both primary = 2× lies) | Block recs; task to fix; account marked "measurement broken" on the tile |
| Tracking firing | Clicks ≥ N with conversions ≈ 0 while GA4 shows enquiries | "Likely tracking broken" alert → web team task, NOT an Ads rec |
| Discrepancy bounds | Ads conversions vs GA4/platform-tracked enquiries, 30d; flag > 15% divergence | Investigate task; recs annotated "measurement uncertainty" |
| Offline loop live | GCLID capture on site forms + rescued-call bookings uploading; last upload < 7d | Warn — bidding is optimising blind to phone bookings |
| Auto-tagging + template | `gclid` present, tracking template not stripping params | Fix task |
| Conversion lag profile | Per-account lag bucket distribution (dental bookings convert days later) | All windows lag-adjusted; never judge the last 3 days |

---

## 2 · `ads-auditor` — the full account audit as a skill

**Triggers:** onboarding (before `campaign-builder` touches anything) · new-client audit inside `audit-report-generator` (read-only, on access grant) · quarterly per account · on-demand from the account tile. Weekly mini-audit = sections C+D only.

**Output:** scored audit (0–100 per section, weighted overall) + prioritised findings, each with evidence, predicted impact, effort class, and a ready-to-queue fix (feeds the same G2 queue as `ads-optimiser`). The audit card renders on the account detail page and in prospect audits.

### A · Measurement (weight 25) — §1 checklist, scored

### B · Structure (weight 20)
- **Brand isolation:** brand terms in their own campaign — mixed brand/generic makes every CPL number a lie. Finding if mixed.
- **Segmentation logic:** campaigns split by service line (emergency / implants / general / ortho) or intent tier — not "Campaign #1". Budget control requires service-level campaigns; a practice's emergency clicks are worth 3× a checkup click.
- **Ad group tightness:** single intent per ad group; ≤ ~15 keywords; flag groups mixing "emergency dentist" with "teeth whitening".
- **Match-type strategy:** exact/phrase core; broad **only** paired with smart bidding + strong negative discipline; flag naked broad on manual CPC.
- **Shared negative lists:** the portfolio-wide health-vertical list applied (jobs, courses, DIY, "free", "how to", supplier/wholesale terms). This list is a 20-80 asset — every client benefits from every other client's waste discoveries (patterns only, never client data).
- **Geo settings:** the classic local trap — location option must be **presence**, not "presence or interest"; radius vs suburb-polygon choice matches the PRD's suburbs; flag nationwide leakage.
- **Networks:** search partners + display expansion off unless deliberately justified; flag silent enablement.
- **Ad schedule vs reality:** compare schedule to opening hours AND receptionist coverage — **20-80-specific play: with the AI receptionist live, after-hours ads become viable because calls get answered.** Auditor recommends schedule expansion only when W1 is deployed. This is a cross-sell trigger, too.
- **Shared budgets:** detected → flagged (they break per-campaign marginal analysis); recommend unsharing.

### C · Query & keyword health (weight 25)
- **N-gram analysis:** 1/2/3-grams across 90d search terms; spend and conversions per gram; surfaces waste themes single terms hide ("near me" converting 4×; "cost of" burning spend).
- **Waste %:** spend share on terms with 0 conversions over 90d (lag-adjusted) — the headline number.
- **Three-way coverage gap:** PRD money keywords ⟷ keywords actually bid ⟷ queries actually matched. Gaps in either direction are findings: money keyword unbid = missed demand; matched queries far from any money keyword = waste or PRD gap (feeds back to strategy).
- **Cannibalisation:** same query matching multiple ad groups → serving conflicts, QS damage.
- **Quality Score decomposition:** per keyword, the three components route to different owners — expected CTR ↓ → ad copy task (`ad-copy-writer`); ad relevance ↓ → structure fix; LP experience ↓ → landing-page task (W4/W6). Never "improve QS" as a finding — always the component and its owner.

### D · Ads & assets (weight 15)
- RSA strength + pinning review; **differentiator presence** — do the ads say what the PRD says makes this practice different, or generic "quality care" filler? (Claude checks copy against the PRD — a check no generic tool can do.)
- Ad ↔ landing page message match per ad group.
- Extension coverage: sitelinks, callouts, call extension (tracking number), location extension linked to the right GBP.
- **Policy status sweep:** healthcare is a restricted vertical — disapprovals and "limited" statuses surface here, plus LP claim risks (Google policy + AHPRA double-gate).

### E · Landing pages (weight 10)
Per ad group: dedicated LP or homepage-dumping? Mobile speed, click-to-call above the fold, form-canary green, AHPRA clean. Findings become W6/W8 tasks with the ad group linked.

### F · Competitive & budget (weight 5)
- Auction insights trends: overlap rate, outranking share per competitor, 90d movement (feeds `competitor-watch`).
- Impression-share-lost split: **budget vs rank** — lost-to-budget on the best-CPL campaign is the single most actionable finding in local PPC.
- Bid-strategy fit: tCPA needs ~30+ conv/mo to function; below that, recommend Max Conversions or manual + careful; respect learning states (14d / significant-change resets).
- Marginal CPL curve per campaign (spend deciles vs conversions) → where the next dollar should go. This powers budget-shift recs with evidence, not vibes.

**Evals:** golden set = Hamza's past audits (account snapshots + what he changed). Recall: does the auditor find what he found? Precision: shadow-mode weekly runs where he rates each finding useful/noise → precision-ledger. Ship gate: ≥80% recall on his historical findings, ≤20% noise rate.

---

## 3 · `keyword-recommender` — recommended keywords as a methodology

**Triggers:** weekly search-term triage (every account) · after audit section C · new service page live · seasonal calendar events.

### Sources (in priority order)
1. **Converting search terms not yet keywords** — the highest-certainty adds that exist; promotion loop runs weekly.
2. **GSC organic queries ranking 5–20** — proven local demand where the site almost ranks; cheap to test in paid. (The SEO⟷SEM data share is a 20-80 structural advantage — single-channel tools can't do this.)
3. **Seed matrix:** service × modifier × geo from the PRD — services ("emergency dentist", "invisalign") × intent modifiers ("near me", "open now", "cost", suburb names) × the PRD's suburbs.
4. **Keyword Planner API** volumes/forecasts for the seed matrix (note quota + access-level constraints, §5).
5. **Auction-insights competitors' visible terms** and the portfolio's cross-client winners (pattern-level only).

### Scoring — every candidate gets:
`score = local_volume × intent_score × economic_fit × coverage_gap`
- **intent_score:** Claude classifies patient-intent vs job-seeker/DIY/research/supplier — with the practice context (an ortho practice scores "braces cost" differently than a GP dentist). This classification IS the moat; Planner can't do it.
- **economic_fit:** est. CPC vs the service's value tier (implant lead ≫ checkup lead — value tiers live in the PRD).
- **coverage_gap:** already bid? already matched by broad? cannibalises an existing group?

### Every recommendation ships complete, or not at all:
| Component | Rule |
|---|---|
| Match type | exact/phrase core; broad only into smart-bidding campaigns |
| Placement | existing tight ad group, or a proposed new group (with theme) — never dumped into a mixed group |
| Starting bid / tCPA | from campaign averages + Planner estimate |
| **Negative twins** | every add carries its waste-shadow ("dentures" → neg "repair kit", "diy"; "implants" → neg "jobs", "course") |
| Landing page | mapped to an existing page, or the rec is BLOCKED into a content task first — never send paid traffic to a wrong page |
| Evidence | source (search term / GSC / seed), volume, est. CPC, intent rationale |

Recs enter the same G2 queue; rejections stored with reasons as future context. **Weekly triage loop:** every search term ≥ N clicks gets classified → promote / negate / watch — the account converges on clean coverage instead of drifting.

**Evals:** hindsight labels — keywords Hamza added historically that later converted = positives; his negatives = negatives. Recommender must rediscover ≥70% of his winners from the data that existed at the time, with noise ≤25% in shadow mode.

---

## 4 · Depth upgrades to existing skills

- **`ads-optimiser`** consumes auditor + recommender outputs — it stops being "generic recs" and becomes the ranked union of: §2 findings, §3 keyword adds, waste cuts, budget shifts (from marginal curves), bid nudges. Every rec carries: evidence, predicted impact **with the prediction method named**, risk class, rollback, and the §1 measurement stamp.
- **`change-watch`** upgrades: predictions are lag-adjusted (evaluate day 7–14, not 1–7, for booking-lag accounts); overlapping change sets merged; verdicts write back to the precision-ledger (prediction accuracy per rec type is public on the Skills tab).
- **`campaign-builder`** (factory) builds to this spec by construction: brand isolated, service-segmented, presence-only geo, shared negatives applied, extensions complete, LP-mapped, conversion actions configured per §1 — so new accounts *start* at audit score ≥90 and the auditor's job on them is drift detection.

---

## 5 · Connector reality — the small components that break

| Reality | Consequence | Mitigation (build item) |
|---|---|---|
| Ads API versions sunset ~every 6 months | Frozen client lib = dead integration | Pin lib version; upgrade task auto-created on deprecation announcements; API-version check in CI |
| Dev token levels | Basic = 15k operations/day — fine for ~20 accounts, audit bursts can spike | Operation budgeter in the tool layer; batch + stagger pulls; apply for Standard before SaaS phase |
| Conversions restate for days | Yesterday's CPL is fiction | Lag-adjusted windows everywhere; every tile shows data-through date; flags use ≥5-day confirmation |
| GA4-imported conversions delay 24–48h | Same-day dashboards mislead | Prefer Ads-native + offline upload as primaries; GA4 as secondary |
| Offline conversion rules | GCLID 90-day window; timezone must match account; dedupe on re-upload; no GCLID → enhanced conversions for leads (hashed email/phone) | Upload pipeline handles all four; reconciliation report weekly |
| PMax opacity | Limited search-term visibility; negatives constrained | Recs on PMax carry an opacity caveat; prefer Search for money services; account-level negative lists where API allows |
| Change history ≠ our audit log | Client/other-party edits happen out-of-band | Nightly change-history poll → reconcile → annotate change-watch (external change during watch window = verdict "contaminated", no rollback proposal) |
| OAuth refresh tokens die | Password change/revocation kills the pipe silently | Nightly connection audit → red banner + "data stale" (no recs from stale data) + reconnect task |
| Healthcare policy | Disapprovals, restricted terms, LP claim rules | Policy sweep in audit §D; `ad-copy-writer` output passes Google-policy check AND ahpra-checker before the queue |
| Shared budgets, currency, timezone | Break per-campaign math and comparisons | Detected in audit §B; normalised in the warehouse layer |
| Keyword Planner quotas | Volume data rate-limited at Basic access | Cache volumes 30d; batch seed-matrix lookups; degrade gracefully to historical metrics |
| MCC link states | Pending/cancelled links look like empty accounts | Link-state check in the nightly connection audit |

---

## 6 · UI deltas for `mockups/html/google-ads.html`

Current mockup = monitoring view ✓ (tiles, account table, rec queue, change-watch, Google-recs dismissals). **Missing for a true marketer's workbench — add:**
1. **Audit score card** per account (A–F section scores, trend, "12 findings → queue") — the auditor's surface
2. **Search-terms workbench** — n-gram view, waste %, weekly triage queue (promote/negate/watch buttons)
3. **Keyword coverage map** — PRD money keywords × (bid? / matched? / ranking organically?) — the three-way gap made visual, doubles as the client-meeting artifact
4. **Auction insights panel** — competitor overlap/outranking trends (shared with competitor-watch)
5. **Measurement health strip** on every account detail — the §1 gate, visible (discrepancy %, lag profile, offline-upload freshness)
6. Account detail drill-in: campaign → ad group → keyword tree with QS decomposition columns

---

## 7 · Build additions (feeds MASTER-BUILD-PLAN §13 Stage 3)

- [ ] 3.2a `ads-auditor` skill + audit score data model + audit card UI. **Test:** run against a deliberately broken staging account seeded with 12 known issues (mixed brand, interest-geo, naked broad, missing negatives, QS spread, budget-starved winner…) — auditor finds ≥10, each finding names its section, evidence, and owner-routed fix.
- [ ] 3.2b `keyword-recommender` + weekly search-term triage loop + coverage map UI. **Test:** hindsight backtest per §3 evals; every emitted rec carries all 6 components (match type, placement, bid, negative twins, LP, evidence) — a rec missing any component fails CI.
- [ ] 3.2c Measurement-first gate in the tool layer + health strip UI. **Test:** account with conversions ≈ 0 & clicks normal produces a tracking task and ZERO optimisation recs.
- [ ] 3.2d Connector hardening per §5 (version pinning, operation budgeter, lag windows, change-history reconciler, offline-upload pipeline w/ enhanced-conversions fallback).
