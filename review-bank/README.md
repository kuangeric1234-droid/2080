# review-bank — the Online Presence Review snippet bank

This is 20-80's IP in machine-readable form. It is the reason every review reads
like 20-80 wrote it, and the reason a finding can never appear without a reason.

## The rule

**A model does not write this report.** The pipeline is:

```
deterministic check  →  signal  →  trigger  →  house paragraph
                                                      ↓
                              model fills {{variables}} — and nothing else
```

A model may substitute variables, make the explicitly-marked `judgement` calls
from screenshots, and write the one generated paragraph (`summary.opening`)
from the accepted findings. It may never rewrite, merge, shorten, or "improve"
a snippet, and it may never introduce a finding that no signal produced.

This is not caution for its own sake. Freeform generation would cost the voice
consistency the report is known for, would put AHPRA-unsafe phrasing one bad
sample away, and would make "why did it say that?" unanswerable.

## Files

| File | What it is |
|---|---|
| `v1/snippets.json` | The ~70 paragraphs with their triggers, weights, variables and conflicts. |
| `v1/categories.json` | The eight summary-table rows, their printed dimensions, and how the star score is suggested. |
| `v1/source-paragraphs.txt` | The template's paragraphs, extracted verbatim. The coverage test's evidence — do not edit by hand. |

## Anatomy of a snippet

```json
{
  "id": "tech.analytics.absent",
  "category": "website_technical",
  "dimension": "Analytics",
  "variant": "negative",
  "weight": 3,
  "when": { "all": [
    { "signal": "site.analytics.ga4", "eq": false },
    { "signal": "site.analytics.gtm", "eq": false }
  ]},
  "conflicts": ["tech.analytics.present"],
  "text": "The website doesn't have Google Analytics installed …"
}
```

- **`when`** is either a trigger over signals, or one of four strings:
  - `manual` — the reviewer supplies the facts (review counts, SERP positions, follower numbers)
  - `judgement` — needs a screenshot and a human or vision call ("does this look dated?")
  - `generated` — the model writes it from accepted findings
  - `always` — unconditional (the closing paragraph)
- **`conflicts`** are the two halves of one check. Both halves may never ship in
  the same report; a test enforces that each names the other.
- **`weight`** (1–3) is how hard the finding pushes the category's *suggested*
  star score. The reviewer's override is what ships.
- **`ahpra_blocking: true`** marks a finding that cannot be silently dropped.

## Editing the wording

Edit `v1/snippets.json` directly — text is data, not code, and no deploy is
needed to change a paragraph. Two guardrails apply:

1. `server/test/bank.test.ts` asserts every snippet still traces back to
   `source-paragraphs.txt`. **Rewording an existing snippet will fail that
   test** — deliberately. If the house wording genuinely changes, cut a `v2`
   with a new `source-paragraphs.txt` rather than editing `v1` in place, so
   past reports stay explicable against the bank version that produced them.
2. Adding a new paragraph is a new snippet id plus its trigger. Adding it to
   `source-paragraphs.txt` at the same time is what keeps the coverage test
   honest.

## Coverage today

73 paragraphs in the source template → 71 snippets. The three worked
competitor-row examples collapse into the single `comp.row` template, which
assembles a row from a structured competitor record.

Automation, per category: **Website (Technical)** and **Website (Usability)**
are fully signal-driven. **Website (Business)** and **Social Media** are part
signal, part judgement. **Visibility (SEO)**, **Visibility (SEM)**,
**Reputation** and **Competition** wait on manual entry until a SERP or Places
provider is connected — the snippet bank still writes the paragraph, it just
needs the reviewer to supply the number.
