# Marketing-skills conversion map

Source library: **coreyhaines31/marketingskills** (49 skills), vendored at `reference/marketing-skills-src/`. Those are long, conversational *framework* skills for **B2B-SaaS growth**. This map records how each is being brought into the 20-80 platform's skill contract (tight `SKILL.md` + `skill.json` + `output.schema.json`, grounded, gated, **AHPRA-firewalled**, structured output).

**Golden rule:** nothing converted here ships past `draft` until it has a golden set and (for anything client-facing) passes an AHPRA violation suite — per MASTER-BUILD-PLAN §12.4. The originals are agency/SaaS-flavoured; the value is the *framework*, not the copy.

Three dispositions:
- **NEW** — becomes a new 20-80 skill (fills a gap). Lives in `skills/<name>/v1/`.
- **MERGE** — a reference framework to fold into an existing 20-80 skill; no new skill.
- **AGENCY** — useful for 20-80's *own* marketing / sales / the $30k training product, **not** for client health sites (these keep the SaaS tactics that are fine for a business but AHPRA-prohibited for a practice).
- **SKIP** — no fit for local health practices or this agency.

## Batch 1 — converted ✓ (in `skills/`, lifecycle `draft`)

| Source | → 20-80 skill | Gate | Why / reframe |
|--------|---------------|------|---------------|
| `social` | **social-post-writer** | G2 | Fills the social gap (open q #9). AHPRA firewall; grounded in profile; FB/IG/GBP. |
| `customer-research` | **patient-persona-researcher** | G0 | Patient anxieties & access, not JTBD; grounded, no-PII; feeds PRD/content. |
| `offers` | **practice-offer-writer** | G2 | Grand-slam-offer playbook gutted of scarcity/guarantee/testimonial; s133 inducement flags. |
| `cro` | **booking-cro-auditor** | G1 | Conversion via clarity + permitted trust only; block-library-bound; money-page routing. |
| `referrals` | **referral-program-builder** | G2 | Viral-loop reframed for clinical/privacy; specialist↔GP supported; inducement flags. |

## Batch 2 — converted ✓ (workflow: 14 skills, author→adversarial-verify; all `pass`, 0 AHPRA issues, schemas valid)

**Client-facing (AHPRA-firewalled):**

| Source | → 20-80 skill | Gate | Verify |
|--------|---------------|------|--------|
| `content-strategy` | content-calendar-planner | G2 | pass |
| `sms` | practice-sms-writer | G2 | pass (+ consent/opt-out firewall) |
| `seo-audit` | site-seo-auditor | G1 | pass |
| `programmatic-seo` | suburb-page-planner | G2 | pass (content floor enforced) |

**Agency-internal (20-80's own GTM, no client AHPRA gate):**

| Source | → 20-80 skill | Gate | Verify |
|--------|---------------|------|--------|
| `product-marketing` | positioning-writer | G1 | pass |
| `pricing` | pricing-packager | G2 | pass |
| `cold-email` | cold-outreach-writer | G2 | pass |
| `prospecting` | prospect-list-builder | G1 | pass |
| `sales-enablement` | sales-collateral-writer | G2 | pass |
| `marketing-plan` | marketing-plan-builder | G1 | pass |
| `launch` | launch-planner | G1 | pass |
| `marketing-council` | marketing-council | G0 | pass |
| `marketing-ideas` | marketing-idea-generator | G0 | pass |
| `public-relations` | pr-outreach-writer | G2 | pass |

## Remaining — feed / reference only (no standalone skill)

| Source | Disposition |
|--------|-------------|
| `lead-magnets` / `free-tools` | feed `audit-report-generator` (the audit microsite is already the flagship free tool) |
| `ai-seo` | feed the seo skills (LLM-citation overlay) |
| `co-marketing` · `marketing-loops` · `image` · `video` · `community-marketing` | reference / merge — weak fit as standalone runtime skills |

## Queued — MERGE into existing 20-80 skills (reference only, no new skill)

| Source | Folds into |
|--------|-----------|
| `copywriting`, `copy-editing` | `content-writer` |
| `ads`, `ad-creative` | `ads-optimiser`, `ad-copy-writer` |
| `emails` | `nurture-writer`, `reply-drafter` |
| `schema` | `schema-validator` |
| `competitor-profiling`, `competitors` | `competitor-watch` |
| `site-architecture` | `ia-planner` |
| `analytics`, `attribution` | Reports + Integrations (GA4/GSC) |
| `onboarding` | SPEC-INTAKE / `portal-provisioner` |
| `marketing-psychology` | content guidelines — **reference only**, hard-capped by AHPRA (no urgency/social-proof tactics on client sites) |

## Agency-internal note

The AGENCY skills (now converted in Batch 2) are for 20-80's *own* marketing/sales and the ~$30k training program — SaaS-flavoured on purpose, never routed to client health sites. Useful for the Prospects engine (§6) and the awareness layer.

## SKIP (no fit)

`aso` (app store) · `paywalls` · `signup` (trials) · `churn-prevention` (SaaS churn ≠ practice retention) · `revops` (B2B lifecycle) · `directory-submissions` (startup directories) · `influencer-marketing` · `popups` · `ab-testing` (platform-level, not a practice skill)

---

**Status:** 19 of 49 converted (5 batch-1 + 14 batch-2). All remaining are MERGE / SKIP / feed-reference — no more standalone conversions planned. Every converted skill is `lifecycle_state: "draft"` and needs its golden set + (client-facing) AHPRA suite before leaving `draft`. See `reference/marketing-skills-src/` for the originals.
