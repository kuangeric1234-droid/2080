# 20-80 Platform

AI operations platform for 20-80 Solutions (2080solutions.com.au) — agency dashboard, client portal, AI receptionist fleet, autonomous website factory, CMS, and sales engine for Australian health practices.

## Start here

| File | What it is |
|---|---|
| [MASTER-BUILD-PLAN.md](MASTER-BUILD-PLAN.md) | **Source of truth.** Architecture, ~90-skill registry, build order (§13) with tests. Build sessions work §13 top to bottom. |
| [specs/](specs/) | Ten practitioner-grade depth specs (SPINE · INBOX · SECURITY · VOICE · ADS · SEO · SALES · REPORTS · CMS · FACTORY). No stage builds without its spec. |
| [CLAUDE.md](CLAUDE.md) | Coding guidelines for AI-assisted build sessions. |
| [TEAM-TASKS.md](TEAM-TASKS.md) | The "sauce collection" — team homework that trains the skills (golden sets, voice, taste). |
| [BUSINESS-MASTERPLAN.html](BUSINESS-MASTERPLAN.html) | The whole business as one visual document (open in a browser). |
| [mockups/](mockups/) | Static HTML mockups of all 19 dashboard tabs (`mockups/html/index` via any tab file). |

## Component library

UI components come from the Watermelon UI registry (excluded from this repo). To restore it:

```bash
git clone https://github.com/WatermelonCorp/watermellon-registry.git
cd watermellon-registry && npm install --legacy-peer-deps
```

## Design docs (claude.ai artifacts)

Blueprint · UI Spec · Automation Deep-Dive · Live Demo · Master Plan · Factory Spec · Business Masterplan · Build To-Do — links in MASTER-BUILD-PLAN.md header.
