# SPEC-REPORTS.md — Reports, Insights, Benchmarks & the Guarantee, Practitioner-Grade Depth

The monthly proof. Reports render exclusively from `metrics_daily` + timeline (never live API calls) — if the data wasn't structured all month, the report can't lie its way around it.

---

## 1 · The monthly report — section contracts

| Section | Content | Source | Rule |
|---|---|---|---|
| Headline | enquiries (by source), **verified** new patients, cost per new patient, ROI estimate | forms + rescued calls + `new-patient-reconciler` confirmation | the verified badge renders ONLY when the practice confirmed — otherwise labelled "tracked, unconfirmed" |
| What we did | shipped work: publishes, Ads changes + measured outcomes (change-watch), SEO fixes + recoveries, calls rescued | timeline + audit log | every line links to evidence; nothing vague ("optimised your campaigns" banned) |
| Rankings | money-keyword movement, pack status, the recovery stories | metrics_daily (W4) | down months shown honestly (see §3) |
| Ads | spend, CPL vs target, what changed and what it did | W3 + change-watch | predictions vs actuals shown — accountability is the differentiator |
| Phone AI | calls answered, after-hours rescued, bookings won, 中文 share | W1 outcomes | only for receptionist clients; it sells itself here |
| Reviews | count/velocity/rating vs competitors, responses handled | reputation machinery | |
| Next month | the 2–3 accepted opportunity cards + anything client owes | opportunity cards + chases | becomes the next QBR agenda seed |

Delivery: **interactive portal report** (drill "41 enquiries" → the actual list) + PDF export (Anthropic doc skills) + scheduled send with `engagement-tracker` (opens/dwell; 2 months unopened = churn signal). 中文 duals where the practice prefers.

## 2 · `insight-writer` — narrative methodology

Lead with the outcome in patient terms ("June brought 41 enquiries; 38 became patients — your best month this year"). Plain English, zero jargon (no "CTR", say "of the people who saw your ad…"). **Benchmark context** from the anonymised portfolio ("practices like yours averaged X — you're ahead on calls, behind on reviews"). Trend over snapshot (3-month arcs). Exactly one recommended focus per report — not twelve. Voice = the practice's account owner, few-shot from past reports Wally/Hamza actually wrote.

## 3 · The down-month playbook (honesty is the retention strategy)

Never hide, never bury: name the dip in the headline, explain with evidence (seasonality? tracking gap? competitor? our miss?), show the action already taken (link the tasks), and the recovery marker to watch. A report that explains a bad month builds more trust than five good-month reports. `insight-writer` has a dedicated down-month mode with its own golden examples.

## 4 · Benchmarks — where targets come from

- **benchmark registry** (versioned in the KB): per practice-type × metric: target + portfolio median + source (historical portfolio stats / industry ref / Wally judgement — labelled which).
- Seeded from a one-time historical analysis of the existing portfolio; reviewed quarterly (season-planner schedules it); every threshold that gates a flag (Ads ×1.3, health weights, review velocity) reads from here — **no magic numbers in code**.
- Per-client overrides allowed with a reason (a new practice ≠ a 25-year practice), rendered wherever the benchmark is used.

## 5 · ROI & the guarantee

- **Enquiry** = form submit + rescued-call booking intent + tracked calls (defined once, used everywhere — sales claims, reports, guarantee).
- **Verified new patients** = reconciler confirmations (the number that makes 14:1 defensible).
- **Revenue estimate** = verified patients × practice-type value model (avg first-year patient value; registry-maintained, conservative, always labelled "estimate").
- **`guarantee-scorer`:** monthly checkpoint months 1–6 vs the proposal's promised outcome — traffic-light on the Guarantee tracker; amber at month 2 → intervention plan task (not month 5 panic); every checkpoint narrative stored for the (rare) refund conversation.

## 6 · Evals & build

- **Eval:** regenerate the real June report for Hearts from seeded data → team judges vs the hand-made original (coverage, accuracy, tone; blind). Down-month mode evaluated on a real historical bad month.
- [ ] Build (Stage 4.3 detail): section renderers off metrics_daily · insight-writer + down-month mode · benchmark registry + quarterly review ritual · interactive portal report + PDF + scheduler + engagement events · guarantee-scorer + tracker tab. **Tests:** report generates with zero live API calls; unverified months render "tracked, unconfirmed"; a seeded down-month produces the honesty structure (named dip, evidence, action, marker); benchmark change propagates to flags without code deploy.
