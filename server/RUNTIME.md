# RUNTIME.md — how an audit actually executes on the NUC

`DEPLOY.md` gets the box running. This is the decision *above* it: what runs the
audit, where the model fits, and why Claude Code is not the engine.

---

## The short version

**The audit is platform code. The model is a callee, not the driver.**

```
Jotform submission
      ↓  POST /hooks/jotform            (Hono, on the NUC)
intake_request + review + notification + email
      ↓  job: collect                    (deterministic — no model, no key)
~30 signals: HTTP · DNS · TLS · sitemap · markup · Playwright
      ↓  rules engine                    (deterministic)
candidate findings, each naming the signal that earned it
      ↓  three narrow model calls        (Anthropic API, through the skill runner)
   1. fill {{variables}}
   2. judgement calls from screenshots
   3. write the opening summary paragraph
      ↓  human review                    (Wally accepts / edits / scores)
.docx export
```

Everything except the three marked steps runs with **no model and no API key at
all**. That is the point: the report's findings come from measurements, and the
model's job is to phrase what the measurements already decided.

---

## Why Claude Code is not the audit engine

Running the agent CLI as the thing that produces reviews is the obvious idea and
the wrong one. Five reasons, in order of how much they cost:

1. **It cannot be golden-setted.** §12.4 requires a scored golden set before any
   skill ships. An agent that reasons freely over a website produces a different
   report each run; there is nothing stable to score it against. A snippet fired
   by `site.https === false` is testable forever.
2. **No structured-output guarantee.** The skill runner validates every model
   response against `output.schema.json` and retries on mismatch. An agent
   session returns prose.
3. **Cost and latency, per audit, at fleet scale.** A single-shot call to fill
   eight variables is cents and seconds. An agent crawling and reasoning is
   dollars and minutes, times every audit request that arrives.
4. **Excess authority.** Claude Code has shell and filesystem access. Producing
   a client report needs neither. The narrow calls carry the client's crawl data
   and nothing else.
5. **No per-run telemetry.** `skill_runs` records tokens, cost, latency and gate
   outcome for every model call. That table is how skill quality gets managed
   over time; an agent session bypasses it.

There is also the AHPRA problem. A model writing freely can produce a
recommendation that breaches the advertising guidelines. A model choosing
between pre-approved paragraphs cannot.

### Where Claude Code *is* right on this box

- **The build seat.** Writing the code, running migrations, debugging a failing
  collector against a live site. That is what it is for, and running it on the
  NUC over Tailscale means the work happens where the data is.
- **Open-ended research later**, if it earns its place — competitor discovery
  narratives, or reading a practice's Google Business listing. Those are genuinely
  unbounded tasks. They would still write their output into a signal, so the
  report stays snippet-driven.

Rule of thumb: **Claude Code writes the software; the API runs the software.**

---

## The three model calls, precisely

All three go through `src/skills/runner.ts`, so they are gated, logged and
costed like every other skill.

| Call | Gate | Input | Output | If the key is absent |
|---|---|---|---|---|
| `review-variable-filler` | G1 advisory | Snippet text + the signals that fired it | Values for `{{vars}}` only | Variables stay visible as `{{name}}`; Wally types them |
| `review-judge` | G1 advisory | Screenshot + the snippet's `judgement_prompt` | fires / does not fire + one line of reasoning | The judgement snippet waits in the manual worklist |
| `review-summariser` | **G2 approval** | The accepted findings, nothing else | The opening paragraph | No summary; Wally writes it |

Two constraints hold across all three:

- **A model may never introduce a finding.** `review-summariser` receives only
  accepted findings and is checked against them; a sentence that asserts
  something outside that set is a failed run, not a creative one.
- **A model may never reword a snippet.** `literalSegments()` in
  `src/review/bank.ts` extracts the runs of house copy a fill is not allowed to
  touch, and the bank test enforces it in CI.

**Degradation is the honest kind.** With `ANTHROPIC_API_KEY` blank the box still
collects every signal, still fires every deterministic finding, still scores
every category it can. It just stops filling blanks and writing the summary.
Nothing silently becomes worse — it visibly becomes manual.

---

## What still has to be built for this to run unattended

**The job runner (the real gap).** `POST /api/reviews/:id/collect` is
synchronous today. Against a live practice site that is 30–90 seconds inside an
HTTP request, and once Playwright joins the collection it is longer. Before
intake can auto-collect, collection has to become a queued job:

- a `jobs` table (`kind`, `payload`, `state`, `attempts`, `run_after`, `error`)
- one worker inside the API process, polling with a short sleep — no Redis, no
  second service, this is one box doing a handful of audits a day
- an overall deadline per audit, so a site that hangs fails the job instead of
  the box
- retries with backoff, and a dead-letter state that raises a notification
  rather than disappearing

Only then should the webhook enqueue collection automatically. Until it does,
Wally presses **Collect** in the dashboard, which is fine for the volume.

**Playwright on the NUC.** `npx playwright install chromium` plus the render
collectors. Chromium on a NUC is the reason the audit wants a machine that is
awake, and the reason it must not run inside a request.

**Concurrency ceiling.** Cap collection at 1–2 sites at a time. A NUC running
several headless Chromiums while serving the dashboard will do both badly.

---

## Where secrets live

| Secret | Needed by | Absent → |
|---|---|---|
| `DATABASE_URL` | everything | the API will not start |
| `ANTHROPIC_API_KEY` | the three calls above | collection still works; filling and summary do not |
| `JOTFORM_WEBHOOK_TOKEN` | `/hooks/jotform` | **the webhook accepts anything** — set it before pointing Jotform at the box |
| `REVIEW_NOTIFY_EMAIL` | the intake email | notification appears in the dashboard only |

All in `server/.env.local`, gitignored, never in the repo. Note the third row:
the token check is skipped when the variable is unset so local development is
frictionless — which means an unset token on a reachable box is an open
endpoint. Set it.

---

## Pointing Jotform at the box

1. Set `JOTFORM_WEBHOOK_TOKEN` in `.env.local` and restart the service.
2. In the Jotform form editor: **Settings → Integrations → Webhooks**.
3. URL: `https://<host>/hooks/jotform?token=<the token>`.
4. Submit the form once. Expect a row in `intake_requests`, a review in the
   queue, a notification on the bell, and an email.

Jotform needs to reach the box from the public internet, which Tailscale alone
does not provide. Until there is a public hostname, two options:

- **Cloudflare Tunnel** — a hostname and TLS without opening a port. This is the
  smaller step and it is the one to take first.
- **A relay** — Jotform → Zapier/Make → the tailnet. More moving parts, another
  subscription, another place a lead can be dropped. Only worth it if the tunnel
  is refused.

Whichever, keep the token. A public webhook URL with no shared secret is an open
invitation to fill the review queue with junk.
