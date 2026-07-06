# SPEC-SALES.md — The Sales Engine, Practitioner-Grade Depth

The funnel automated end-to-end, with the audit microsite as the flagship. Builds on SPEC-SPINE (deals, matcher) and reuses SEO/Ads machinery read-only.

---

## 1 · The audit microsite (`audit-report-generator`) — section by section

**Constraint:** at cold-lead time we have NO account access — every section works from public data only. Renders from the block library (the prospect literally experiences the product).

| Section | Content | Public data source |
|---|---|---|
| Headline scorecard | 0–100 across 5 pillars + "what this means in patients" | computed below |
| Google presence | GBP completeness vs the local leader (categories, services, photos, posts recency, Q&A) | GBP public scrape (low-frequency, cached) |
| Reviews | count/rating/velocity vs top-3 competitors; response rate; last responded | GBP public |
| Rankings snapshot | 5 assumed money keywords × their suburb — where they sit, who owns the pack | one-off tracker checks (paid per audit — pennies) |
| Website check | mobile, speed (CWV), click-to-call, booking path, SSL, last-updated smell | PageSpeed API + crawl |
| Competitor table | 3 named locals: who's winning what and the one thing each does well | all of the above per competitor |
| "What we'd do first" | exactly 3 plays, specific to findings ("your FAQ page is 2 clicks from ranking for X") | derived |
| Proof + CTA | 1 case study auto-picked by same practice-type + suburb-class; book-a-meeting embed | portfolio registry |

Rules: every claim sourced (same grounding discipline); competitor names REAL (that's what makes it land); tone = helpful specialist, zero fear-mongering; 中文 variant when the practice signals it. Cost target <$2/audit compute — affordable for EVERY cold lead. G2 first 90 days → G1.

## 2 · Capture, enrichment, scoring

- **lead-capture endpoints:** website forms, popup, FB Messenger webhook, missed-call (dogfooded receptionist on 20-80's line), conference quick-add (mobile form). Dedupe on email/phone/practice-name fuzzy; UTM + channel tagged (CAC per channel finally real).
- **prospect-researcher:** fires on capture; the §1 data collection IS the research pack; also grabs practice size signals (practitioner count from site/GBP) → deal value estimate.
- **lead-scorer:** engagement events (audit opened ×N, sections dwelled, replies, booking-link click) + fit (practice type, suburb competitiveness, size) → cold→warm at threshold; stale (14d silence) → re-nurture; dead (45d) → lost/nurture-only pool.

## 3 · Nurture cadences (per vertical, editable playbooks)

D0 audit delivery → D2 "did you see the competitor section?" (references THEIR audit specifics — never generic) → D7 case study (same vertical) → D14 the warm-lead video (§14.5 A/B) → D30 breakup ("we'll leave you with the audit — it's yours"). Warm leads exit sequences immediately; replies route through the inbox matcher to the deal. Unsubscribe honored globally (spam-act compliant: sender ID, opt-out, no purchased lists — eDM list is opt-in only).

## 4 · Proposal (`proposal-writer`) & acceptance

Sections: their situation (from audit + meeting transcript, their words quoted) · the plan (modules: site build / Ads / SEO / receptionist — priced from the **rate card**, a versioned config) · timeline (factory's real ~15 days) · the guarantee terms · **"what you get if you ever leave"** (§10.1 as a sales weapon) · investment with 2 options (good/better — never 3+) · validity 30 days.
**Acceptance = deposit paid** (no e-signature product in v1: accept button → agreement PDF attached to the deposit invoice; terms acknowledged at payment). Deposit webhook → Won → factory fires.

## 5 · Payment rails (recommendation — confirm with Wally at Stage 4)

- **Stripe:** deposits + receptionist subscriptions + any card payments (merchant of record = 20-80; instant webhooks fire the factory).
- **Xero:** stays the ledger — invoices for monthly retainers + final invoices; Stripe payouts reconciled into Xero.
- **Direct debit** for retainers (AU practices prefer it): add GoCardless-class via Xero payment services in Stage 4.5+, not v1.
- One rule: **the platform reads money state from webhooks, never from humans remembering** — "check Xero" becomes an event.

## 6 · Loss mining & evals

Loss taxonomy: price / timing / chose-competitor (who?) / DIY / no-budget / ghosted / bad-fit. Quarterly pattern report → rate card + proposal + audit tweaks. **Evals:** audit-generator judged by the team against 10 hand-made past audits (coverage + accuracy + "would you send this?"); nurture/scorer measured in production (open→meeting conversion vs the historical funnel).

## 7 · Build items (Stage 4.2 detail)

- [ ] Capture endpoints + dedupe + channel attribution. **Test:** same prospect via form then Messenger = one deal, two touchpoints.
- [ ] audit-report-generator per §1 + cost telemetry. **Test:** fake lead → live microsite <15 min, every claim carries a source, competitor names real, renders in the block library.
- [ ] Scoring + cadences + deal board with event-fired stages. **Test:** audit engagement promotes to warm with zero human data entry; unsubscribe kills all sequences instantly.
- [ ] proposal-writer + rate card + Stripe deposit flow. **Test:** accept → deposit → Won → factory stage 1 fires — one webhook chain, no clicks.
- [ ] Agile CRM migration (one-time script; counts verified) + loss-miner survey/report.
