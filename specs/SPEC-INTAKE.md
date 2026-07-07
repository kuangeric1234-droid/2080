# SPEC-INTAKE.md — The Onboarding Questionnaire & Intake Wizard, Practitioner-Grade Depth

**Framing this spec encodes:** the intake is **not a form** — it is the moment the project is won or lost, so it is designed to *extract differentiators*, not collect fields. It is the client-facing surface of the **`intake-interviewer`** skill and the input side of **Factory Stage 2** (SPEC-FACTORY): the client gets their login (Stage 1), lands in the portal, and is walked through a **clickable, save-anywhere, mobile-first wizard** whose answers assemble **PRD v1**. The single human-only step in the whole factory front-half — the strategist sharpening the differentiators — happens *because of* what this wizard collects.

Source material: 20-80's three real "Initial Engagement Questionnaire" documents (Bodyworker · General Practice · Specialists), stored in `specs/intake-source/`. This spec turns those into one versioned, branching schema.

Depends on: SPEC-FACTORY §1–2 (the PRD + brand kit consume these answers) · SPEC-SPINE (client record / facts registry the answers write into) · SPEC-SECURITY (portal auth, the login this follows) · the design-directions and SEO knowledge bases (what the answers are matched against). Skills: **`intake-interviewer`** (the adaptive brain), `practice-researcher` (pre-fill), `asset-validator` + `asset-requester` + `chase-scheduler` (the assets lane), `ahpra-checker` (the compliance moment), `prd-generator` (assembles v1).

North star (from the philosophy doc): *a visitor should be able to say what makes this business different within 10 seconds of landing.* The wizard's job is to find that sentence.

---

## 1 · The questionnaire as versioned, branching data

Do **not** hard-code three forms. Model it as **one base question set + per-vertical overlays**, versioned like any knowledge asset (`intake-schema vX.Y`, pinned on every submission so a PRD is always reproducible from the exact questions asked).

```
intake-schema
├── base            (~20 shared questions — every practice type)
├── overlay: bodywork/dental   (+ HiCaps provider #, preferred funds, PMS=Nookal/Cliniko/D4W)
├── overlay: general-practice  (+ funds, D4W/Cliniko, dental treatment examples)
└── overlay: specialists       (+ referring-GP testimonials, published papers, LTV per referring GP; − HiCaps)
```

Each question carries structured metadata (not just a label):

| Field | Meaning |
|-------|---------|
| `id`, `label`, `help` | stable id, the ask, and the plain-language why |
| `type` | short-text · long-text · single-select · multi-select · number · money · file-upload · confirm (pre-filled) · credential |
| `required` | blocks submit? (assets/logins never do — see §3) |
| `prefillable` | can `practice-researcher` propose an answer the client confirms? |
| `pushback` | is this a thin-answer target the interviewer probes? (§4) |
| `conflictsWith` | pairs the contradiction detector watches (§4) |
| `prd` | which PRD section + which design/SEO decision this answer drives (§5) |
| `pii` / `credential` | routed to the secret store, never into a prompt (SPEC-SECURITY) |
| `condition` | show only if (e.g. HiCaps only if `type ∈ {bodywork, dental}`) |
| `visibility` | practice-facing vs internal-only (COI, AHPRA-ID) |

Adding a vertical later (optometry, vet, allied health) = a new overlay + knowledge-base tone/SEO/compliance slices. No new code. This mirrors the platform's "swap the knowledge layer per vertical" reuse model.

---

## 2 · The wizard — UX contract

24 raw questions is a slog and reads as bureaucracy. Group into **8 steps with a progress rail**. Every step is resumable; the whole thing completes in ~20–25 minutes and **saves after every field** (the login persists a draft; "Saved just now" is always visible).

| # | Step | Questions (base) |
|---|------|------------------|
| 1 | **Welcome** | how it works, ~20 min, save anytime, why the differentiator questions matter |
| 2 | **Your practice** | business name, ABN, AHPRA ID, address, phone, opening hours, main contact — **mostly pre-filled**, client confirms |
| 3 | **What makes you different** | differentiation · golden-triangle (2 of 3: quality/speed/affordable) · treatments to be known for · current issues · capacity now + at-capacity plan |
| 4 | **Who you serve** | target market · average patient lifetime value · how patients would find you (keywords + landmarks) · preferred funds *(overlay: HiCaps #)* |
| 5 | **Your web presence today** | purpose of the new site · websites you like + **why** · 3 things to improve · social accounts · analytics · PMS/booking software · email hosting · who maintains the current site |
| 6 | **Authority & community** | groups/affiliates/charities *(overlay: published papers · referring-GP testimonials)* |
| 7 | **Assets & logins** | logo (vector) · photos · domain EPP/registrar · hosting login · analytics/Ads logins — upload slots, **never block progress** |
| 8 | **Review & submit** | summary + edit-any-answer · "here's what happens next: three concepts in 48 hours" |

**Non-negotiable UX rules:**
1. **Research runs before they type.** On entry, `practice-researcher` has already scraped their site, GBP, reviews and competitor set. Step 2 and much of Step 5 arrive **pre-filled with a "confirm or fix" chip** — the client corrects rather than faces a blank page. Faster, and it signals competence before they've paid attention.
2. **Progress honesty.** The rail shows done / current / remaining; "Waiting on you" is never hidden. A half-done intake is a visible state, not a silence.
3. **Mobile-first.** Practice owners fill this on a phone between patients. One question group per screen on mobile; thumb-reachable Next.
4. **Save-and-exit anywhere**, resumable from the portal; +2d / +5d / +7d chase if abandoned (`chase-scheduler`).
5. **One primary action per step.** Big **Next**; quiet **Back**; **Save & exit** always available. Never two competing CTAs.
6. **The differentiator step gets weight** — more room, examples, and the adaptive follow-ups of §4. It is the point of the exercise.

---

## 3 · The assets & logins lane (Step 7) — decoupled and non-blocking

From the philosophy doc's hard rule: *missing assets never block progress.* Step 7 is upload slots derived from the PRD manifest (logo, hero/team photos, domain control, hosting, analytics/Ads access).

- Each slot: **empty → uploaded → validated**. `asset-validator` checks vector format for logos (.ai/.eps/.svg), resolution for photos, and rejects with a plain reason ("this logo is a JPEG — we need a vector so it stays crisp at every size; here's how to export one").
- **Submitting the questionnaire does not require assets.** Anything missing enters the fixed chase sequence (+2d email, +5d email, +7d phone) via `chase-scheduler` and appears as an open item on the client's Getting-Started checklist.
- **Credentials (domain EPP, hosting, analytics logins) go straight to the secret store** — captured through the connector/secret layer, never rendered back, never placed in a skill prompt (SPEC-SECURITY). The wizard shows "provided ✓", not the value.
- Day-1 ownership rules from the plan (§10.1) are surfaced here as reassurance: "your domain stays registered in your name; you can leave with everything, always."

---

## 4 · The adaptive interviewer (why this beats a Google Form)

`intake-interviewer` (top-tier model, G2 while learning) wraps the schema with three behaviours a static form can't do:

1. **Thin-answer pushback.** Questions flagged `pushback` (differentiation, treatments-to-be-known-for, "websites you like — *why*") are scored for specificity. "We care about our patients" → an inline, friendly follow-up: *"Most practices say that — what do patients actually say when they recommend you to a friend?"* Loops up to twice, then accepts and flags the weak answer for the strategist. This single behaviour is the biggest anti-slop lever: the copy later imitates a real, specific voice because the input was forced to be specific.
2. **Contradiction surfacing, not silent resolution.** `conflictsWith` pairs (e.g. "premium positioning" + "compete on price"; "want walk-ins" + "specialist referral-only") are **not** reconciled by the machine — they're captured as a **kickoff question**, per §2.2 of the philosophy. The machine never coin-flips a strategic decision.
3. **Conflict-of-interest check** on submit: same suburb + same specialty as an existing client → flagged to the agency **before** kickoff, not discovered later.

Everything the interviewer infers is a **draft the human can see and override** — it annotates, it does not decide.

---

## 5 · Answer → PRD → design decision (the "helps with design principles" contract)

Every answer has a destination. This table is the spec's core deliverable — it's what makes the questionnaire *drive design* rather than sit in a drawer.

| Question cluster | → PRD section | → Design / SEO decision it drives | Consumed by |
|------------------|---------------|-----------------------------------|-------------|
| Differentiation · golden-triangle · treatments-to-be-known-for | 1 · Identity & differentiators | hero headline, copy spine, **which of 3 design directions is cast**, ad angles | `design-director`, `content-writer`, `brand-kit-generator` |
| Websites you like + **why** · 3 improvements | 6 · Design direction | typography pairing, palette logic, density, imagery treatment | `design-director` |
| How patients find you · landmarks · keywords | 4 · Local SEO plan | money keywords, which suburb pages exist, GBP focus | `seo` rules, `ia-planner`, `keyword-recommender` |
| Target market · lifetime value | 3 · Tone & ROI | voice, targeting, proposal & report framing | `prd-generator`, `report-writer` |
| Funds/HiCaps · groups/affiliates · papers · referring-GP testimonials | 1 · Trust signals | schema, authority blocks, footer badges, credibility section | `content-writer`, `schema-validator` |
| Purpose of the new site | 2 · Services & page map | information architecture priority | `ia-planner` |
| PMS / booking software | 7 · Integrations | booking-CTA wiring, "book online" prominence | launch chain |
| Business name · ABN · AHPRA ID · hours · address · phone | 1 · Facts registry | **entered once, propagates** to footer, schema, GBP, phone-AI FAQ | `propagation-mapper` |
| Assets & logins (Step 7) | manifest | asset validation, migration, launch readiness | `asset-validator`, `handover-runner` |

`prd-generator` assembles **PRD v1** from these; the kickoff (H1) produces **PRD v2** with client quotes preserved; design briefs unlock only after the strategist approves.

---

## 6 · The compliance moment (AHPRA, at the point of asking)

From the philosophy: *codify the rules and enforce them at the point of writing, not in a late review.* When a question touches regulated ground, the wizard explains the rule **there**, inline, and offers the compliant alternative — it does not silently collect something that will be blocked later.

| Trigger in the wizard | Bodywork / GP / Dental | Specialists |
|-----------------------|------------------------|-------------|
| Testimonials / reviews | **Patient testimonials are AHPRA-prohibited.** Inline note + offer the compliant alternative (Google reviews handled via `review-responder`, outcomes shown as data not claims). | **Referring-GP / peer testimonials are B2B and generally permitted** — actively collected (Step 6). Patient testimonials still prohibited. The wizard branches this message by `type`. |
| "Treatments you're known for" | no outcome guarantees, no "pain-free/painless" clinical claims — `ahpra-checker` rules surfaced as you type | same |
| Before/after imagery (if raised in assets) | flagged: strict AHPRA conditions; routed to agency review | same |

The compliance copy is versioned with the AHPRA rules corpus (plan §14 open q #13), so when the rules change, `knowledge-diff-writer` updates the wizard's inline guidance too.

---

## 7 · Gates & automation — what runs itself, what needs the human

- **Automatic (G0/G1):** research pre-fill · adaptive follow-up prompts · specificity scoring · contradiction & COI detection · asset validation · the +2d/+5d/+7d chase · assembling PRD v1. All logged, all reversible.
- **Human (G2 → H1):** the **strategist's differentiation review** — the explicit "human 20%." The wizard collects and sharpens; a person always sets the strategic spine before build. This is decision **H1** in the factory. `intake-interviewer` ships at **G2** (its drafts reviewed) until precision earns G1 pre-fill trust per vertical; the strategist review is **never** automated away.
- **Restricted (G3):** none in intake itself, but credential capture is bound by the secret-store rules (SPEC-SECURITY) — the wizard can request a login, never display or reuse one in a prompt.

---

## 8 · Data contract & privacy

- Answers write to the **one client record** (Practice Profile / PRD in SPEC-SPINE) — facts (hours, address, funds) land in the **facts registry** so they propagate; free-text differentiators land as versioned PRD fields with the original client phrasing preserved (never paraphrased away — quotes are the anti-slop fuel).
- `intake-schema` version + `knowledge` versions pinned on the submission → any PRD is reproducible from the exact questions and rules in force.
- PII/credentials segregated: AHPRA ID and business identifiers are internal-visibility; domain/hosting/analytics logins go to the secret store; Privacy Act / APP handling per SPEC-SECURITY. Clinical data is explicitly **out of scope** here (eForms remain a separate compliance class — plan §14 open q #10).

---

## 9 · Definition of Done & test plan

**DoD:**
- `intake-schema v1` authored as data: base + 3 overlays, every question carrying the §1 metadata and a `prd` mapping.
- Portal wizard: 8 steps, progress rail, save-after-every-field, resumable, mobile pass, both themes, one primary CTA per step, empty/error/validated states on asset slots.
- `practice-researcher` pre-fill wired into Steps 2 & 5 (confirm-or-fix chips).
- `intake-interviewer` live at G2 with thin-answer pushback + contradiction surfacing + COI check.
- Compliance moment renders the correct AHPRA guidance per practice type.
- Submit assembles a PRD v1 draft and creates the Getting-Started checklist (assets + logins as non-blocking open items).

**Tests (staging, seeded practices):**
1. **Happy path (dental):** complete the wizard on a phone viewport → PRD v1 generated → differentiator answers appear verbatim in PRD §1 → facts (hours) written to the registry.
2. **Thin-answer:** submit "we care about patients" to differentiation → interviewer pushes back → improved answer captured; the weak original is flagged for the strategist, not silently kept.
3. **Contradiction:** "premium" + "cheapest in the suburb" → surfaced as a kickoff question, not resolved by the machine.
4. **Assets non-blocking:** submit with no logo → questionnaire completes → logo enters the +2d/+5d/+7d chase → appears on the checklist; a JPEG logo is rejected by `asset-validator` with a plain reason.
5. **Compliance branch:** the testimonials question shows "prohibited + alternative" for a dentist and "peer testimonials welcome" for a specialist.
6. **Reproducibility:** re-render a submitted PRD from its pinned schema/knowledge versions → identical.
7. **COI:** a second Blackburn dentist triggers the conflict flag to the agency before kickoff.

---

## 10 · Where it sits in the build

Portal surface of **Factory Stage 2**; build alongside **§13 Stage 5.1** (deposit → provisioning → intake → PRD pipeline). The schema authoring (mining the three real questionnaires into structured data + the answer→PRD map) is the same "mine the team's expertise" exercise every skill spec is — do it as the Stage-5.1 kickoff, with the strategist (Wally) confirming the differentiation-question wording and the specificity bar.
