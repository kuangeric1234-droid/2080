# SPEC-SEO.md — SEO Watchtower (W4), Practitioner-Grade Depth

How a senior local-SEO lead for health practices actually works, encoded. Companion to SPEC-ADS (they share competitor-watch, the measurement-first ethos, and the PRD's money keywords).

---

## 1 · What we track (per client)

- **Tracking set:** money keywords × suburbs × device (mobile primary) from the PRD — typically 8–15 keywords × 2–4 suburbs. Plus: 3-pack membership per money keyword, GBP field snapshot (categories, services, attributes, photos count, Q&A), review count/velocity/rating vs tracked competitors, GSC impressions/clicks/position by query & page, rich-result presence per page (FAQ/LocalBusiness), citations status (BrightLocal), page-level index status.
- **Benchmarks:** page-1 share, 3-pack share, review velocity vs the practice-type portfolio median (maintained per SPEC-REPORTS §4).

## 2 · Data pipeline & connector reality

| Source | Reality | Mitigation |
|---|---|---|
| BrightLocal | report scheduling is theirs (results land late), API tier gates access, grid ranks noisy | 05:30 pull of *completed* reports only; per-client freshness stamps; CSV-bridge fallback on lower plan (parser versioned — their CSV format drifts); noise handled by the 2-day rule |
| GSC API | 2–3 day data lag, sampled queries, 16-month window | never mix GSC "today" with rank "today" — panels are date-stamped; store daily to metrics_daily (our history outlives their window) |
| GBP (Business Profile APIs) | **access requires a Google application/approval process** — lead time! | apply at Stage 3 start; public-scrape fallback for competitor GBP fields (ToS-aware, low frequency) |
| Algo updates | no official feed | curated feed (Search Central + reputable trackers) into a `serp_events` table; diagnosis consults it |
| SERP features | packs/features shift what "position 4" means | track feature presence alongside rank; a "drop" that's actually a layout change is classified `serp_shift`, not a client problem |

## 3 · Change classification (the alert discipline — trust depends on this)

- **STABLE** → history only. **WOBBLE** (±1–2, single keyword, no pack change) → `watching` state, visible but silent; alert only if confirmed +2 days. **DROP** → immediate path when: money keyword ≥3 positions, OR 3-pack exit, OR ≥3 keywords move together (pattern = real), OR page deindexed. **OPPORTUNITY** → position 4–15 on a money keyword with striking-distance signals (impressions rising, page exists).
- Sitewide vs localised triage first: one keyword vs one cluster vs everything (everything → check indexation/site health before any SEO hypothesis).

## 4 · `seo-diagnose` — the decision tree (ordered, evidence-gated)

Hypotheses checked in order, each with its evidence source; output = ranked hypotheses + confidence + fix drafts:
1. **Did WE change it?** CMS deploy log for the ranking page/site (last 14d) → if yes: diff the change, propose revert/fix. Always first — self-inflicted is most common and most fixable.
2. **Indexation/technical:** page indexed? canonical sane? robots/noindex accident? schema validation errors (the FAQ-snippet class)? → `schema-validator` + GSC inspection.
3. **Rich-result loss:** GSC feature impressions collapsed while rank held → schema fix path.
4. **GBP changes:** ours (changelog) or competitor's (competitor-watch: new categories, review-velocity spike, photo dumps, new competitor entity in the pack).
5. **Algo/SERP event:** serp_events window ±5 days → if match: "wait + verify" posture, annotated, no panic fixes.
6. **Link/citation loss:** BrightLocal citation drops, known-lost links.
7. **Local shuffle (residual):** self-correcting; watch posture with re-check date.
Evidence contract: every hypothesis cites its data (`gsc.faq_impressions: -100% since Jul 3`); no hypothesis without evidence. Fix drafts attach to the winning 1–2 only.

## 5 · Opportunities & GBP methodology

- **opportunity-writer scoring:** money-keyword weight × striking distance (4–15) × demand (GSC impressions) × effort (existing page needs section vs new page) → card with the fix pre-drafted (internal links from ia-planner's graph, 150–300 word section brief, schema additions). Accept → content task; skip → archived 60d.
- **GBP cadence per practice:** 2 posts/mo minimum (gbp-post-writer, EN+中文 where relevant), photo freshness target, Q&A seeding from the FAQ pack (same registry as W1 — one source of truth), review responses within 48h (review-responder), category/service completeness vs the top pack competitor.
- **Content decay:** quarterly sweep — pages with −30% impressions YoY → refresh cards (this is the organic-side auditor).

## 6 · Recovery & reporting

Recovery tracker per flag: position chart annotated with fixes shipped → auto-close on target restoration → the "found same-day, fixed, recovered" story lands in the monthly report automatically. Migration mode (SPEC-CMS §6): thresholds loosened, wobble rule suspended, direction-watching for 6 weeks post-cutover.

## 7 · Evals & build

- **Golden set:** 25 historical diagnosed drops (Hamza session) — replay with only the data available at the time; top-2 hypothesis must contain his verdict ≥80%. Opportunity backtest: cards he actioned that reached page 1 = positives.
- [ ] Build (Stage 3.4 detail): pipeline per §2 with freshness stamps · classifier per §3 · seo-diagnose per §4 + evidence contract · opportunity-writer + GBP cadence engine · recovery tracker · GBP API application filed week 1 of Stage 3. **Tests:** "dentist blackburn 4→9" produces the deploy-log-first diagnosis; a synthetic serp_event within window yields "wait+verify", not a task; wobble alerts zero times in a 2-week noise replay; sitewide synthetic drop routes to site-health, not SEO.
