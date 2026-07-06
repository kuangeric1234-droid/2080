# SPEC-FACTORY.md — The Autonomous Website Factory, Practitioner-Grade Depth

**Framing correction this spec encodes:** the factory is not a wizard with steps — it is a **vertical website-generation SaaS** (think "a Lovable/v0 for Australian health practices, with an agency quality layer on top"). The defining behavior: **the AI builds the website while everyone sleeps and pushes it live to a demo server; humans wake up to review, not to supervise.** The theme/design step is not an internal artifact — it is a **client-facing dashboard process**: the AI generates branding guidelines, the client is emailed and reviews them in *their* portal, the agency reviews in *theirs*, and approval triggers the full overnight build to those guidelines.

North star, in a real client's words (from 2080solutions.com.au): *"a website that stands out from the 'generic chiropractic website' crowd."*

Depends on: SPEC-CMS §2–3 (the factory generates INTO the CMS model — Stage 5.0 builds first). Skills covered: `design-director`, **`brand-kit-generator` (NEW)**, `site-composer`, `content-writer`, `slop-critic`, `feedback-interpreter`, `build-qa-checker` + the **overnight run orchestrator** (infrastructure, not a skill).

---

## 1 · The Brand Kit — the client-facing design contract

Replaces "select theme/design" (flowchart W8) and upgrades the design-director's internal briefs into a **first-class client deliverable**.

### Generated from
PRD v2 (differentiators, voice, red lines) · the design-directions library (curated taste recipes) · the competitive scan ("every dentist in Blackburn is blue-and-clinical — you won't be") · the practice's assets (logo → palette derivation, or deliberate contrast) · practice type conventions (ortho ≠ emergency dental ≠ chiro).

### Contents (rendered as a live page, not a PDF)
1. **Palette** — with rationale in plain words ("warm terracotta because every competitor within 3km is clinical blue")
2. **Typography pairing** + scale, shown ON real headlines from their content
3. **Imagery treatment** — photography mood, crop style, what we'll never use (stocky handshakes)
4. **Voice & tone** — 3 before/after copy examples in their actual services
5. **Logo usage** (or the proposed lockup if W14 branch fired)
6. **Rendered component samples** — their hero, their service card, their team block, IN the proposed style with THEIR content — the kit is built from the same block library the site will use, so what they approve is literally what gets built
7. Do/don't strip

### The dashboard process (both sides)
1. `brand-kit-generator` produces 1–3 kits (per the design-director's cast directions) → **agency reviews first** in the Factory tab (kill authority — human decision #2, unchanged)
2. Released → **client notified by email + portal**: "Your brand guidelines are ready" → client views the kit(s) in their dashboard, comments per section, picks one, taps **Approve**
3. Approval **locks the kit as the design contract** — stored versioned in the client record; every downstream generation (site, GBP posts, ad display creative, report styling) reads from it
4. Client comments → `feedback-interpreter` → kit revision → re-notify. Chase-scheduler nudges idle approvals (this is a client-lane stall point; treat like approval #1)

The kit outlives the build: it's what makes month-6 GBP posts and new service pages still look like the same practice.

---

## 2 · The Overnight Run — autonomous generation while everyone sleeps

### Trigger conditions (all must hold — checked by the orchestrator, no human "go")
Brand kit approved · IA approved · assets ≥ minimum viable set (validated) · CMS site provisioned (5.0). The moment the last condition lands — typically evening — the run queues for that night.

### The run (a checkpointed job graph, not one giant prompt)
```
22:00  RUN START  (run record created, token budget set, kill switch armed)
  ├─ per-page fan-out (parallel): site-composer + content-writer
  │    each page: compose block tree → ground-check (every claim traces to
  │    client record) → slop-critic scores → fail = regenerate w/ critique
  │    (max 3 loops, then flag for human)
  ├─ cross-page pass: nav coherence, internal links per ia-planner,
  │    fact-registry references (never inline copies), bilingual pairs if 中文
  ├─ build-qa-checker: links, CWV budget, schema validity, mobile,
  │    ahpra-checker sweep (BLOCKING — a violating page never deploys)
  ├─ static build → DEPLOY to demo server:
  │    https://{client-slug}.demo.20-80.dev  (password + noindex + expiring)
  ├─ screenshot suite: every page, desktop + mobile
  └─ RUN REPORT: pages built, critic scores + what it rejected and why,
       flagged pages needing human eyes, open questions, token cost, duration
05:30  RUN END → morning digest queued
```

- **Multi-candidate mode:** 3 concepts = 3 parallel runs → 3 demo subdomains, one gallery.
- **Checkpointing:** every page is a resumable unit — one failed page flags itself and the run continues; re-runs skip completed pages. A run never dies whole.
- **Budgets & safety:** hard token/cost cap per run (orchestrator kills at cap with partial report) · concurrency limits across clients · nothing client-visible until agency release — the demo URL is unlisted, passworded, watermarked "PREVIEW".

### The wake-up (the product moment)
- **06:30 agency digest** → Today card: *"Hearts Dental built overnight — 14 pages, critic passed 12 first-try, 2 regenerated, 1 flagged (implant pricing page — fee schedule ambiguous). Review →"*
- **Agency review workbench** (Factory tab): screenshot grid per page · critic + QA scores per page · brand-kit conformance diff · per-page actions: approve / regenerate with note / edit directly (CMS) · release-to-client button
- **Client wake-up** (after agency release): *"Your new website preview is ready"* → portal shows the demo (or 3-concept gallery) → per-section comments → comments become `feedback-interpreter` change-sets → **queued for the next overnight run** → iterate nightly until the client taps Approve (= approval #2)
- **Promote to production** = the same built artifact re-pointed to the real domain when DNS is ready (launch chain unchanged) — no rebuild drift between what was approved and what ships.

---

## 3 · Why this is buildable (and what it demands)

The overnight run is the skill-runner in **batch mode** — same gates, same audit, same provenance — plus real job orchestration:

| Requirement | Build item |
|---|---|
| Run records + step telemetry | `runs` table: per-step status, attempts, cost, duration; the retro-writer reads this |
| Resumability | page-level checkpoints in Postgres; idempotent deploy |
| Fan-out with limits | pg-boss batch jobs; per-run and global concurrency caps |
| Cost governance | per-run token budget, per-client monthly generation budget, kill switch |
| Demo infra | wildcard `*.demo.20-80.dev` on the CDN, per-site password, noindex headers, auto-expiry, PREVIEW watermark |
| Failure honesty | partial runs report as partial ("11/14 pages — 3 flagged"), never silently complete |
| Run visibility | live run view in Factory tab (for the curious at 11pm) + the morning digest (for everyone else) |

**What quality actually depends on (unchanged from doc 6, now load-bearing):** the block library + design-directions library are the floor and ceiling of every overnight run. The generator can only compose what the libraries contain. Library sprints are the craft investment; the orchestrator is plumbing.

---

## 4 · What this changes in the flow (deltas to doc 6 / masterplan §7)

| Was | Now |
|---|---|
| design-director briefs (internal) → generation during work | **Brand Kit** as client-facing dashboard deliverable with email notify + portal approval — the design contract |
| "site-composer builds 3 candidates" (implicitly attended) | **Overnight autonomous runs** → demo deploys → morning review digests, both dashboards |
| Client sees concepts when we show them | Client is **notified automatically** on agency release; reviews and comments in their own portal on their own time |
| Revisions applied ad hoc | Comments → change-sets → **queued to the next nightly run**; iteration is a nightly cadence |
| 5 human decisions (unchanged) | Same 5 — but #2/#3 (kit review, candidate review) become **morning rituals over coffee**, not meetings |

The human role in the factory, restated: **evenings feed it (approvals), nights it builds, mornings humans judge.** Agency time per site collapses toward: one kit review + one candidate review + launch button.

---

## 5 · The anti-slop system — eight layers, each targeting a specific cause

Slop is not one failure; it is eight, and each gets its own structural counter. Layers 1–4 make slop hard to *produce*; 5–8 catch what slips and keep taste calibrated over time.

### L1 · Composition floor (can't produce broken/ugly)
The composer assembles human-crafted blocks under direction tokens — it never writes CSS. Every block ships with **3–5 structural variants** (hero: split / full-bleed / editorial / stacked…) and is CI-tested against degenerate real content (one service vs twelve, "Dr Nguyen-Papadopoulos", 60-char suburb strings). The floor of quality is the library's floor, and humans own the library.

### L2 · Fleet similarity budget (won't all look the same) — the scale risk nobody sees until site #30
A site that's individually fine but identical to 29 fleet siblings IS the "generic chiropractic website crowd," rebuilt by us. Enforced, not hoped:
- **Registry of used combinations:** direction × hero variant × palette family × type pairing, recorded per live site, keyed by specialty + geography.
- **Hard rule:** no two practices in the same specialty within overlapping catchment share a direction variant. The design-director's cast is *constrained by what's already deployed nearby* — distinctiveness against both competitors AND our own fleet.
- **Similarity score at review:** each candidate is measured against (a) the nearest fleet sites and (b) the practice's top-3 local competitors — palette distance, hero-layout match, section-rhythm overlap, copy n-gram overlap. Over-threshold → auto re-cast before a human ever reviews it. The score prints on the morning digest.

### L3 · Copy specificity mechanics (no interchangeable words)
- **Grounding (existing):** every claim traces to a client-record fact.
- **The swap test (new, automated):** per section, the critic asks "could this paragraph sit on a competitor's site unchanged?" Yes = rewrite, regardless of grammar quality.
- **Banned-phrase lexicon (living):** "we pride ourselves", "look no further", "nestled in the heart of", "your smile is our passion"… — seeded by the team, grown from every critic finding; hard-fails at generation, not review.
- **Specificity quota:** every page carries ≥ N verifiable practice-specific facts (names, years, suburb, equipment, languages, hours). Filler cannot reach quota — padding becomes impossible, not discouraged.
- **Voice fingerprint:** kickoff verbatims give each practice cadence and vocabulary; copy is judged against *their* fingerprint, not "professional tone".

### L4 · Imagery policy (the #1 visual slop tell)
- **Real photography is the product policy:** the shoot (W15) is priced into the build, not optional garnish; `shot-list-writer` makes it cheap to execute.
- Until real photos exist: art-directed placeholders in the brand kit's treatment (duotone/crop rules make mixed sources coherent), watermarked as **content debt** on the run report — a site can launch with placeholder imagery only as an explicit, tracked exception.
- Banned: generic smiling-stock, handshakes, watermarked-stock lookalikes. The critic's vision pass checks imagery against the kit's treatment rules.

### L5 · The one-bold-move rule
Slop is what averaging looks like. Every brand kit must contain **one signature element** — a type choice, a texture, an unusual hero treatment, a palette move no local competitor uses — and the critic verifies it survived into the built site ("what will a visitor remember?"). Boldness budgeted in one place, quiet everywhere else — that's how real studios work, encoded.

### L6 · Calibrated, comparative critics (not one rubric in a vacuum)
- **Three separate critics** — copy, design coherence, distinctiveness — because one blended score hides failures.
- **Comparative judging:** the distinctiveness critic sees screenshots of the practice's top-3 local competitors and answers "does this stand out in that company?" — the actual market question, not an abstract score.
- **Calibrated to the team's taste:** a rated corpus (team scores ~50 sites: their portfolio, competitors, raw AI output) tunes the rubrics until critic scores correlate with Wally's judgments — taste becomes a golden set like every other skill. Re-calibrated quarterly.

### L7 · Human taste, permanently in the loop at exactly two points
Morning kill-review (never graduates to auto — reputation rides on it) and **library curation**: a quarterly directions-library review that adds new recipes and retires tired ones. The libraries are living design work; the day they freeze, the fleet starts converging.

### L8 · Market feedback closes the loop
Post-launch, the anti-slop claim gets measured: enquiry conversion vs portfolio baseline (a distinctive site that doesn't convert is art, not product) · the +7d survey asks "have patients commented on the new site?" · rank + engagement trends per W4. Directions that consistently convert get promoted in the library; ones that don't get reworked. Taste, verified by revenue.

---

## 6 · Build items (feeds masterplan §13 Stage 5)

- [ ] 5.1b **`brand-kit-generator`** + kit page renderer (from the block library) + client approval flow (email + portal review + comments + lock-as-contract + chasing). **Test:** kit generated for a fictional practice renders with THEIR content in the samples; client approval locks v1; a post-approval edit requires a new version.
- [ ] 5.3a **Overnight run orchestrator**: job graph, page-level checkpoints, critic/regenerate loops, budgets + kill switch, run records + live run view. **Test:** kill a run mid-flight → resume completes only remaining pages; a page failing critic 3× flags and the run still completes partial-honest.
- [ ] 5.3b **Demo infrastructure**: wildcard subdomains, password + noindex + expiry + watermark; promote-to-production repoint. **Test:** demo URL unreachable without password; promoted site is byte-identical to the approved build.
- [ ] 5.3c **Review workbenches**: agency (screenshot grid, per-page scores, regenerate-with-note, release) + client (demo view, per-section comments → change-sets → next-night queue, approve). **Test:** full nightly iterate loop — client comment at 9pm appears rebuilt in the 6:30 digest.
- [ ] 5.3d **Morning digests** into Today + client notification on release (notification routing per Stage 3).
- [ ] 5.3e **Anti-slop enforcement (§5):** fleet similarity registry + similarity scoring at review (L2) · swap-test + banned-phrase lexicon + specificity quotas in generation CI (L3) · imagery policy checks + content-debt tracking (L4) · one-bold-move verification (L5) · three-critic split with competitor-comparative judging + the team-rated calibration corpus (L6) · quarterly library-review ritual scheduled (L7) · post-launch conversion feedback into the directions library (L8). **Test:** a deliberately generic candidate (stock phrases, no signature element, direction reused from a nearby fleet site) is auto-rejected at three different layers before any human sees it; critic scores on a 20-site holdout correlate ≥0.8 with the team's blind ratings.

**Stage-5 DoD upgrade:** the full dry run is now: *conditions met by 6pm → wake up to 3 candidates on 3 demo URLs + digest → agency releases → client comments → next morning the revision is live on the demo → approve → launch.* Two consecutive nights, zero manual generation steps.
