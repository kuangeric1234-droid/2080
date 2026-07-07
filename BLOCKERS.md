# BLOCKERS.md — What the build needs from humans

The loop adds precise entries here when it hits something only a human can provide, then continues with other work. Humans resolve an item by editing it to start with `RESOLVED:` and describing where the credential/data lives (never paste secrets here — put them in the env/secret store and say so). See BUILD-LOOP.md for the pre-known list.

Format per entry:
- **[OPEN|RESOLVED] <short name>** — needed for §13 step X.Y · what exactly · how to provide it

---

- **[OPEN] Anthropic API key** — needed for §13 step 1.3+ (skill runner real model calls) · The runner is built and tested against `MockModelClient` (PROVISIONAL, clearly labelled in output); `AnthropicModelClient` is implemented (`server/src/skills/model.ts`, official SDK, structured outputs, fast tier `claude-haiku-4-5` / top tier `claude-opus-4-8`) but has never made a live call · Provide: create a dev-workspace key at console.anthropic.com, set `ANTHROPIC_API_KEY` in the server environment (never commit it). The runner auto-switches to the real client when the variable is present. Resolving unblocks: live hello-world run, then email-triage (1.5) drafting on real inputs.

- **[OPEN] Gmail OAuth for support@** — needed for §13 step 1.5 (live mail in/out) · The W2 pipeline is built behind `MailSender`/ingest interfaces with a PROVISIONAL recording mock (`server/src/inbox/connectors.ts`); watch-channel renewal, history-diff pull and fallback polling (SPEC-INBOX §4) are NOT yet implemented — they only make sense against the real API · Provide: Google Cloud project + OAuth consent + Gmail API credentials for a delegated account on the support@ group, send-as support@ enabled; put client id/secret + refresh token in the server env (never in the repo) · Unblocks: real ingest, send-as threading, watch/poll/reconciliation build-out. **On wiring: set `INBOX_MODE=shadow` — triage must not act on live mail (see triage-golden-set).**

- **[OPEN] ActiveCollab API token** — needed for §13 step 1.5 (task creation in AC) · Built behind `TaskConnector` with PROVISIONAL `MockActiveCollab` (`mock-ac-*` refs recorded in `tasks.external_ref`) · Provide: an AC API token + the project mapping (client → AC project id) in the server env · Unblocks: real task creation + the completion webhook registration.

- **[OPEN] Team triage golden set (Ish's 150 labelled emails)** — needed before email-triage leaves shadow mode (SPEC-INBOX §6, TEAM-TASKS.md) · The skill, eval harness and metrics (type accuracy / split recall / complaint recall) are built; only a PROVISIONAL 10-case synthetic set exists (`skills/email-triage/v1/golden.provisional.json`) — **email-triage stays in shadow mode on live mail regardless of other blockers until the real set scores ≥95% type accuracy, 100% split recall, 100% complaint recall** · Provide: 150 labelled historical emails (type, splits, urgency) as JSON in the same shape as the provisional file, incl. the hard 30.
