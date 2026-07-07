# BUILD-LOOP.md — The Autonomous Build Loop

This file is the operating manual for the `/loop` that builds the platform. The loop reads this file every iteration.

---

## The loop prompt (copy into Claude Code)

```
/loop Work the 20-80 Platform build autonomously, one step per iteration.

EACH ITERATION:
1. Read CLAUDE.md, BUILD-LOOP.md, BUILD-LOG.md, BLOCKERS.md, and MASTER-BUILD-PLAN.md §13.
2. Pick the FIRST unchecked §13 step whose blockers (if any) are not open in BLOCKERS.md. Respect stage order and the spec-before-build rule.
3. Read that step's spec (specs/SPEC-*.md) fully BEFORE writing code. The spec wins over improvisation.
4. Build exactly that step — nothing speculative, nothing from a later step.
5. Run the step's test/DoD from §13 (plus typecheck + existing tests). Iterate until green. UI steps must pass the §12.3 checklist in BOTH themes with the seeded demo portfolio — never lorem, never default component styling.
6. On green: tick the checkbox in MASTER-BUILD-PLAN.md, append a BUILD-LOG.md entry (step id · what was built · test evidence · files touched · decisions made), and git commit (small, descriptive, Co-Authored-By Claude) and push.
7. BLOCKED? If the step needs anything only a human can provide (credentials, paid accounts, team golden sets, real phone lines, designer sessions, legal review): DO NOT fake it and DO NOT stall. (a) Build the step against a mock/sandbox implementation behind the real interface with contract tests, marked PROVISIONAL in BUILD-LOG.md, OR (b) if even that is impossible, add a precise entry to BLOCKERS.md (what's needed, why, how to provide it, which step it unblocks) and move to the next unblocked step.
8. When BLOCKERS.md has an item marked RESOLVED by a human, wiring that credential/data into its provisional implementation takes priority over new steps.

RULES:
- One §13 step per iteration. Small commits. Never skip tests. Never weaken a test to pass it.
- Golden-set evals: if real team data (sauce) is absent, build the eval harness with a clearly-labelled provisional set (10 synthetic cases max) and record in BLOCKERS.md that the skill CANNOT leave shadow mode until the real set arrives. Skills never go live on synthetic exams.
- Never invent credentials, never deploy anywhere except localhost/CI without tokens explicitly provided in BLOCKERS.md resolutions.
- Never touch specs/intake-source/ originals; never commit secrets; respect .gitignore.
- If MASTER-BUILD-PLAN.md and a spec conflict, the spec is newer thinking: follow the spec and note the conflict in BUILD-LOG.md.
- Every 5 completed steps, run a consistency pass: do the completed steps still integrate (full test suite + a manual smoke of the app shell)? Fix drift before continuing.
- STOP and write a summary to BUILD-LOG.md when: all remaining steps are blocked, a stage boundary is reached (human review gate), or something contradicts the plan in a way that needs a product decision. List exactly what's needed to continue.
```

## Human review gates (the loop stops and waits at these)

- End of Stage 0: review the shell + schema before Stage 1 features build on them.
- End of each stage thereafter (per §13 stage DoD).
- Any BLOCKERS.md item — resolve by editing the item to `RESOLVED: <how/where the credential or data is>` and committing.

## What only humans can do (pre-list — the loop will refine this in BLOCKERS.md)

| Needed | For | When |
|---|---|---|
| Anthropic API key (env: ANTHROPIC_API_KEY, dev workspace) | skill runner real calls (mocked until then) | Stage 0.3+ |
| watermellon-registry cloned locally (`git clone https://github.com/WatermelonCorp/watermellon-registry.git && npm install --legacy-peer-deps`) | Stage 1.1 component vendoring | Stage 0/1 |
| Google Cloud project + OAuth consent + Gmail API creds for support@ | live inbox (built against mock first) | Stage 1.5 wiring |
| ActiveCollab API token | task creation (mocked first) | Stage 1.5 wiring |
| Team sauce per TEAM-TASKS.md (Ish's 150 labels FIRST) | email-triage's real exam; then Hamza's for Stage 3, Wally's for 4–5 | before any skill leaves shadow |
| Fly.io (or chosen) account + tokens, Sydney | first deploy (loop builds/CI-tests locally until then) | end of Stage 0 |
| Voice vendor trial accounts + one AU test number | Stage 2.0 spike (the loop can prepare the spike harness + scripts, not place real calls) | Stage 2 |
| Google Ads MCC + developer token · BrightLocal · GBP API application | Stage 3 wiring (all mocked first) | Stage 3 |
| Stripe + Xero sandbox keys | Stage 4 wiring | Stage 4 |
| Designer sessions (block + directions libraries) & Wally's recorded walkthrough | Stage 5.2 / anti-slop calibration | Stage 5 |

## Files the loop maintains

- `BUILD-LOG.md` — append-only journal: every step, evidence, decisions, provisional markers.
- `BLOCKERS.md` — the human shopping list; humans resolve items in place.
- `MASTER-BUILD-PLAN.md` §13 — checkboxes ticked as steps complete (single source of progress truth).
