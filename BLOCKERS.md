# BLOCKERS.md — What the build needs from humans

The loop adds precise entries here when it hits something only a human can provide, then continues with other work. Humans resolve an item by editing it to start with `RESOLVED:` and describing where the credential/data lives (never paste secrets here — put them in the env/secret store and say so). See BUILD-LOOP.md for the pre-known list.

Format per entry:
- **[OPEN|RESOLVED] <short name>** — needed for §13 step X.Y · what exactly · how to provide it

---

- **[OPEN] Anthropic API key** — needed for §13 step 1.3+ (skill runner real model calls) · The runner is built and tested against `MockModelClient` (PROVISIONAL, clearly labelled in output); `AnthropicModelClient` is implemented (`server/src/skills/model.ts`, official SDK, structured outputs, fast tier `claude-haiku-4-5` / top tier `claude-opus-4-8`) but has never made a live call · Provide: create a dev-workspace key at console.anthropic.com, set `ANTHROPIC_API_KEY` in the server environment (never commit it). The runner auto-switches to the real client when the variable is present. Resolving unblocks: live hello-world run, then email-triage (1.5) drafting on real inputs.
