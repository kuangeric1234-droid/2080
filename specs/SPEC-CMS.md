# SPEC-CMS.md — The CMS & Client Editing Platform, Practitioner-Grade Depth

**Honest framing:** W8 is the second-biggest build after the receptionist — a content platform with five subsystems, not an editor bolted onto the dashboard. And it carries the plan's most important sequencing correction: **the CMS content model is the factory's output format.** `site-composer` (Stage 5) must generate *into* this model from day one, or every factory site needs migrating later. Therefore: **CMS core (model + renderer + publisher) builds as Stage 5.0 — before the first AI-generated site — and the client editing surfaces build as Stage 6.** The Emergent exit is a third, rolling workstream.

Skills covered: `cms-edit-assistant`, `propagation-mapper`, `seo-guard`, `alt-text-writer`, plus the rendering substrate for `site-composer` and the guardrail wiring for `ahpra-checker`.

---

## 1 · The five subsystems

| # | Subsystem | What it is | Stage |
|---|---|---|---|
| 1 | **Content model** | block-tree + facts registry + versioning + provenance | 5.0 |
| 2 | **Renderer/publisher** | block tree → static site → CDN, atomic deploys, previews | 5.0 |
| 3 | **Change-set engine** | atomic edits, propagation, scheduling, guardrails, rollback | 5.0 core / 6 full |
| 4 | **Editor surfaces** | agency editor + client tiers 1–3 | 6 |
| 5 | **Migration tooling** | Emergent/WordPress → CMS, rank-safe | rolling after 6 |

One schema powers everything: **the block library defines what the AI composes, what humans edit, what clients may touch, and what the guardrails scan** — four consumers, one definition. That's the design decision that keeps this buildable.

---

## 2 · Content model (the foundation everything else stands on)

### 2.1 Blocks
Each block type in the library ships as a bundle:
- **JSON schema** — fields, types, constraints (`hero`: heading ≤ 80 chars, image ref, CTA ref…)
- **Render component** — the React/Astro component that emits its HTML/CSS from tokens
- **Editability manifest** — per field: `agency | client_t1 | client_t3 | locked` — enforced **server-side** on every write, not hidden in the UI
- **Guardrail flags** — per field: AHPRA-sensitive? SEO-load-bearing (H1/title/schema)? → drives which checks run on edit
- **Bilingual mode** — per field: translatable (paired zh value + translation-memory link) vs invariant (phone numbers)

### 2.2 The facts registry — single-source truth, the propagation trick
Practice facts (hours, phone, address, team members, fee ranges, funds accepted, booking URL) live **once** in a registry; blocks *reference* facts, never copy them. Consequences:
- "Saturday hours change 1 Aug" = **one fact edit** → every referencing block (footer ×N pages, contact page, schema.org, GBP sync job) re-renders automatically. `propagation-mapper` stops being magic and becomes a query: *who references fact X?*
- The FAQ pack (`faq-pack-builder`, W1) reads the same registry — website and receptionist can never disagree about opening hours.
- Facts carry effective-dating natively (current value + scheduled value + date).

### 2.3 Versions & provenance
- **Immutable page versions**; site-level releases (a release = the set of page versions live together); publish = atomic pointer move; rollback = repoint (seconds, not rebuilds).
- **Per-block provenance:** written by `site-composer@2.1` / edited by client (Sarah, Hearts) / approved by Hamza — feeds the audit log, the completion emails ("here's what changed"), and the client timeline.
- Design tokens versioned separately from content — a brand refresh re-renders every page without touching content history.

---

## 3 · Renderer & publisher

- **Static-first:** block tree → SSG build (Astro-class; sub-decision at Stage 5.0 spike) → HTML/CSS/assets → Cloudflare Pages. Client sites survive any platform outage (masterplan §3.4).
- **Incremental builds at fleet scale:** only affected pages rebuild on a change-set; build queue per site; **publish SLA < 2 min** from approval; 100+ sites must not mean 100+ full rebuilds nightly.
- **Previews:** every change-set gets a draft build at a tokenized preview URL (noindex, robots-blocked, auto-expiring) + desktop/mobile screenshots rendered into the approval card. Nothing publishes sight-unseen — this is the mechanism behind every G2 approval in the CMS.
- **Performance is the library's job:** image pipeline (upload → optimize → responsive srcset → `alt-text-writer`), font subsetting, zero third-party JS by default. CWV budget enforced by block-library CI, not per-site effort — a site composed of passing blocks passes.
- **SEO plumbing built-in:** per-page meta (from `metadata-writer`), schema.org emitted by blocks (FAQ/LocalBusiness/Dentist), sitemap.xml, **redirects manager** (load-bearing for migrations, §6), canonicals, robots.
- **Forms are platform endpoints:** submissions → Leads tab + notification routing + **GCLID capture** (feeds Ads offline conversions — SPEC-ADS §1) + spam protection (honeypot + rate + optional Turnstile). Form definitions are blocks like everything else. `form-canary` tests these weekly.
- **Domains:** client-owned (handover rule §10.1), DNS/SSL automated via Cloudflare, apex+www, per-practice email-sending domains for form notifications (SPF/DKIM) so notifications don't land in spam.

---

## 4 · The change-set engine (the heart)

A **change-set** is the only way anything changes on any site — AI, agency, or client:

`draft → guardrails → preview → approval lane → scheduled/published → watched → rollbackable`

- **Contents:** block edits + fact edits + page add/remove/reorder + metadata edits + an optional effective date. Atomic: applies fully or not at all.
- **Guardrail pipeline, fixed order:** ① `ahpra-checker` — blocking (testimonials, before/after claims, guarantees of outcome) with rewrite suggestions · ② `seo-guard` — lane routing: gutting a ranking page, money-page H1/title changes, removing a snippet-holding block, orphaning internal links → *offers the safe alternative*, routes to agency review · ③ `tone-checker` — advisory · ④ mechanical validation (links resolve, images exist, required fields).
- **Lanes:** safe (content edits, posts, photos) → instant publish · sensitive (money pages, homepage hero, pricing, new pages) → agency same-day review · blocked → rewrite loop. Clients graduate lanes on a clean-edit streak, same trust architecture as everything else.
- **Scheduling:** effective-dated change-sets (the "1 Aug" pattern) run via the cron process; GBP sync jobs ride the same schedule.
- **Conflicts:** per-page soft locks while a change-set is open; second editor gets "Sarah has an open draft on this page"; agency edits win collisions with notification, never silent overwrite. (Full CRDT merging is explicitly out of scope — soft locks are enough at this scale.)
- **Post-publish watch:** `seo-guard` re-checks rankings on touched money pages at +7/+28 days (via W4) — a client edit that tanked a ranking gets caught and rolled back with evidence, not discovered at the QBR.

---

## 5 · Editor surfaces (Stage 6)

- **Agency editor:** full block-tree manipulation, page templates from the library, **bulk find-and-replace with change-set preview** (the "we renamed a service" job = one operation across a site), cross-site queries (which sites still show fact X?).
- **Client Tier 1 — structured fields:** facts registry + team members + photos as plain forms. Covers ~70% of real requests. Mobile-first (practice managers edit from phones).
- **Client Tier 2 — the prompt box:** words → `cms-edit-assistant` → change-set → preview → publish per lane. Any scope, always composed in-system. The headline feature.
- **Client Tier 3 — visual editor:** click-to-edit text/images inline on a *rendered preview*; add/remove/reorder sections from the approved library. Layout primitives (CSS, columns, spacing) never exposed — broken layouts unreachable, not forbidden. Server-side editability manifest is the enforcement, the UI is just convenience.
- **Tier 4** — contract mode per masterplan §9 (export or unmanaged zones).
- Every surface produces the same change-set object — one engine, one guardrail path, one audit trail.

---

## 6 · The Emergent/WordPress exit (rolling workstream — rank-safe or not at all)

**The #1 migration risk is rank loss, and it is avoidable with discipline:**
1. **Importer:** crawl the existing site → map pages to nearest library blocks (semi-automated; Claude proposes the block-ification, human confirms) → facts extracted into the registry → images through the pipeline.
2. **Parity gate before cutover:** URL structure preserved (or exact 301 map, no chains) · meta/title parity · schema parity · internal links resolved · visual diff review · CWV equal-or-better · forms tested end-to-end.
3. **Cutover:** DNS switch with instant-rollback plan (old host stays warm 30 days) · GSC change monitored daily · W4 enters **migration mode** for that client — tightened rank alerts for 6 weeks, wobble rule suspended (we *expect* movement; we watch direction).
4. **Order:** pilot one low-risk site → hold 4 weeks → batch the healthy clients → leave the fragile/high-rank sites for last, migrated individually.
5. New builds never touch this path — the factory generates straight into the CMS from Stage 5.

---

## 7 · Small components that will bite (build items, not footnotes)

| Reality | Mitigation |
|---|---|
| Preview URLs leak into Google | noindex + robots + tokenized, auto-expiring URLs; canonical to prod |
| CDN cache staleness after publish | purge-by-URL on release; version-hashed assets |
| Image rights & licensing | asset library tracks source/licence per image; stock placeholders watermarked until replaced |
| AU privacy notice + cookies | privacy-policy block auto-maintained per practice; first-party analytics default; GA4 optional per client |
| Form notification deliverability | per-practice sender domain, SPF/DKIM at setup; fallback in-portal notification always fires |
| Font licensing per practice | library ships licensed/open fonts only; brand fonts uploaded with licence confirmation |
| Fact edits mid-change-set | facts registry locks a fact while a scheduled change is pending on it |
| 404s from removed pages | page delete REQUIRES a redirect decision — the change-set won't validate without one |
| Client uploads 40MB phone photos | pipeline resizes/strips EXIF (location data!) automatically |
| OG/social images | auto-generated per page from tokens; overridable |

---

## 8 · Build breakdown (corrects the masterplan)

**Stage 5.0 — CMS core (~3–4 wks, BEFORE the first factory site):**
- [ ] 5.0a Block library schema format + editability/guardrail manifests + 15–20 core block types (built in the design-libraries sprint 5.2 — same work item, one definition)
- [ ] 5.0b Facts registry + effective dating + reference tracking
- [ ] 5.0c Renderer + static publisher + incremental builds + preview builds + redirects manager
- [ ] 5.0d Change-set engine core: atomic apply, guardrail pipeline, scheduling, versions/releases/rollback, provenance
- [ ] 5.0e Forms as blocks → Leads + GCLID capture + canary hooks
- **Test:** `site-composer` emits a complete site as a block tree → renders → publishes to a staging domain < 2 min → a fact edit propagates to every referencing surface → rollback restores the prior release in seconds.

**Stage 6 — editing surfaces (~4–6 wks):** agency editor + bulk ops · client tiers 1–3 · `cms-edit-assistant` + `seo-guard` + lanes · Studio (translator + glossary + memory) · conflicts/locks · post-publish rank watch. **Test:** the client-typed "Saturday hours 9–1 from 1 Aug" E2E (unchanged from §13) + a Tier-3 client demonstrably cannot produce a broken layout or an AHPRA violation.

**Rolling — Emergent exit:** importer + parity gate + pilot site + 4-wk hold + batches, per §6. **Test:** pilot site cutover with zero rank loss beyond noise at +6 weeks, forms and GCLID verified post-cutover.
