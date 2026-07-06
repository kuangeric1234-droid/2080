# TEAM-TASKS.md — The Sauce Collection

**For: Hamza, Wally, Ish · Time needed: roughly one focused day each · Deadline target: before Stage 1 build starts**

---

## Why we're asking for this (read this first — 2 minutes)

The platform's AI skills don't get good from clever instructions. They get good from **your past work**. Here's the mechanism, in plain terms:

1. **Every skill takes an exam before it's allowed to work.** The exam questions are real situations from our history, and the answer key is *what you actually did*. An email-triage skill must classify 150 real support emails the way Ish would. The SEO diagnosis skill must reach the same verdict Hamza reached on 25 real ranking drops — using only the data that existed at the time. No skill goes live until it passes its exam. **No archive = no exam = we'd be shipping guesses.**

2. **The AI imitates what it's shown, and by default it's been shown the whole internet.** That's exactly what "AI slop" is — the average of everything, belonging to no one: "we pride ourselves on quality care," generic blue chiropractor sites, keyword suggestions any tool would spit out. The only cure is showing it *your* work instead: your emails become its email voice, your audits become its audit method, your design decisions become its taste. **Slop is what the AI produces when we haven't given it your sauce. The sauce is the moat.**

3. **This same material becomes the sellable IP.** When the platform is licensed to other agencies later, what they're buying is the codified version of what you're about to hand over. Collecting it well now is literally building the asset.

**Logistics:** drop everything into the shared drive under `/sauce/<your-area>/`. Formats don't matter — CSVs, screenshots, Fathom links, even voice memos on your phone (we transcribe everything). Don't polish anything; raw and real beats tidy. One rule: **no patient/clinical data in anything** — practice-level only.

---

## HAMZA — Ads & SEO (the marketer's sauce) · ~1 day total

### Ads → trains `ads-auditor`, `keyword-recommender`, `ads-optimiser`
- [ ] **Change history exports** for the 4–5 accounts you're proudest of (Google Ads UI → Change History → last 12–24 months → download). *Zero writing required.*
- [ ] **The "why" pass:** pick ~15 changes from those exports that mattered, and for each, one line or a voice memo: what you saw, why you did it, what happened. This teaches the reasoning, not just the action.
- [ ] **2–3 full account audits you've done** (any format — notes, docs, even the email you sent after). Before-state, what you found, what you fixed, the result. This IS the auditor's exam.
- [ ] **Your master negative keyword list(s)** and the waste patterns you always kill ("jobs", "courses", "free", supplier terms…).
- [ ] **Keyword wins & flops:** ~10 keywords you added that converted, ~5 that looked good but flopped, and why. The recommender is graded on rediscovering your winners.
- [ ] **30-min voice memo:** walk through "CPL jumped on a dental account — what do I check, in what order?" Your mental checklist, out loud, unedited.

### SEO → trains `seo-diagnose`, `opportunity-writer`
- [ ] **The 25 diagnoses spreadsheet** (template provided): client · keyword · what dropped · what you checked · your verdict · the fix · did it recover. This is the single most valuable artifact in the whole collection.
- [ ] **Your BrightLocal reading ritual** (15-min voice memo): what you look at first, what's noise, when you worry vs wait. This calibrates the "wobble vs real" rules.
- [ ] **GBP optimisation checklist** you run for a new client, plus 2–3 examples of opportunity calls you made that hit page 1.
- [ ] **With Ish:** the suburb & practitioner pronunciation list for the phone AI (Nunawading, Dr Nguyen, Templestowe…) — just a list; we handle the audio.

---

## WALLY — Sales, philosophy, voice, reports (the founder's sauce) · ~1 day + one 1-hour recorded session

### Sales → trains `audit-report-generator`, `proposal-writer`, `nurture-writer`, `loss-miner`
- [ ] **10 past proposals: 5 won, 5 lost** — with a one-liner each on why it won/lost. Lost ones are as valuable as won ones (they're the negative examples).
- [ ] **3–5 prospect assessments you did by hand** (the audits/looks you gave practices before they signed). The audit generator's exam is matching your judgement.
- [ ] **Voice memo: the meet & greet** — how you open, the questions you ask, the objections you hear (price, "my nephew does websites", "we tried ads before") and exactly how you answer them.
- [ ] **The rate card logic** and your "good-fit client" criteria — who you say no to, and why.

### Reports & client voice → trains `report-writer`, `insight-writer`, `client-update-writer`
- [ ] **10 gold-standard monthly reports** — and critically, **at least 2 from down months**, because how you explain a bad month IS the retention strategy, and the AI must learn your version of honesty.
- [ ] **~20 client emails you're proud of** (tone bank — the AI will write client emails in this voice, not "AI assistant voice").
- [ ] **2–3 complaint situations and how you handled them.** The AI will never draft these (hard rule), but it must recognize them instantly — your examples train the tripwire.

### Design philosophy → trains `design-director`, `brand-kit-generator`, `slop-critic` — **the anti-slop session itself**
- [ ] **The 1-hour recorded walkthrough (with the team):** pull up 5 portfolio sites and narrate — why this palette, why this layout, what makes it THIS practice's site, what you rejected along the way, and what screams "generic chiropractic website" when you see competitors. We transcribe this into the design-directions library and the critic's rules. **This session is where the taste gets captured — it is the single biggest defense against slop websites.**
- [ ] **Voice memo: how you extract differentiators in kickoffs** — the questions that get past "we care about our patients." (If Fathom has 2–3 past kickoff recordings, links to those are gold.)

### Receptionist → trains `clinic-call-agent` guardrails
- [ ] **Emergency script wording** per practice type (dental trauma vs chiro vs physio) — the exact sentences you'd approve.
- [ ] The **never-list**: things the phone AI must never say or do, in your words.
- [ ] Benchmark numbers you carry in your head per practice type (what's a good CPL, review velocity, enquiries/month) — these seed the benchmark registry.

---

## ISH — Inbox, web builds, CMS (the operator's sauce) · ~1 day

### Inbox → trains `email-triage` (the first skill to go live — your labels ARE its exam)
- [ ] **Label 150 emails** from the support@ archive using the sheet we provide (type, urgency, does it split into multiple requests, who'd you route it to). ~2–3 hours. Flag the ~30 genuinely ambiguous ones — those become the hard section of the exam.
- [ ] **Voice memo: your routing instincts** — how you tell an ads request from a content request, what "urgent" actually means from a client, the clients who always understate/overstate.

### Web builds & CMS → seeds the block library, trains `build-qa-checker`, `cms-edit-assistant`
- [ ] **The recurring-changes list:** every type of change clients actually ask for, roughly ranked by frequency (hours, staff, photos, price lists…). This defines the client editor's Tier 1.
- [ ] **Your real peer-review checklist** — what you actually check before a site ships (not the official one; the one in your head).
- [ ] **Block inventory pass:** for 5 representative sites, list the sections each page is made of (hero, team grid, fees table, FAQ…). This seeds the block library scope — the components the AI will compose from.
- [ ] **The gotchas list:** things that always break or bite (forms, DNS, that one plugin, mobile menus with long practice names…). Every item becomes a QA check.
- [ ] **With Hamza:** the pronunciation list (above).

---

## EVERYONE — the taste calibration (~1 hour each, done async)

- [ ] **Rate 50 websites blind** (link sheet provided: a mix of our portfolio, local competitors, and raw AI-generated sites — unlabelled): score each 1–5 and one line on why. Your ratings calibrate the automated design critic until **its scores agree with your taste** — that's how "no slop" becomes a measurable gate instead of a hope. Disagreements between the three of you are fine; they're informative.

---

## What happens to all of it

Exams (golden sets) each skill must pass before going live → voice/examples inside the skills so output sounds like you → the design-directions library and critic rules from Wally's walkthrough → the benchmark registry from the numbers → the pronunciation lexicon for the phone AI. Every piece maps to a named skill in MASTER-BUILD-PLAN.md §11. Nothing is wasted, and nothing is used beyond this platform.

**The one-sentence version of why this matters:** the AI will do the work 100× faster than us, but it can only do it *as well as us* if it has seen how we do it — everything you hand over is the difference between a platform that ships slop and one that ships 20-80.
