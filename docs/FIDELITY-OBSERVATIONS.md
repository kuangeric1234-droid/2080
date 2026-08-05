# FIDELITY-OBSERVATIONS.md — what reading the document catches that the harness cannot

`FIDELITY-LEDGER.md` is generated and overwritten on every run. This file is written by hand,
during the periodic human pass: generate the report, read it end to end beside
`Oh Dental Online Presence Review.docx`, and write down what reads as machine-written.

The harness checks structure. It cannot tell that a paragraph is *thin*, that two sentences
contradict each other, or that a section admits it has nothing to say. Every entry below is
something a structural check passed and a read did not.

Each observation carries a count over the 17 reference reports, same rule as the ledger:
**a pattern in fewer than 3 of 17 is one reviewer's habit, not house style.**

---

## Pass 1 — 2026-08-05, after §13.2 step 1.22 (ledger score 5)

### O1 · The report is a third the length of a real one — **critical**

Findings per reference report: **min 13 · median 34 · max 41**. The generated report carries
**10**. Every structural check passes and the document is still visibly shorter than anything
20-80 has sent. This is the parent of the four "thin section" gaps in the ledger and it is the
one that decides whether the report is sendable.

Of the shortfall, Website (Business) is the buildable part — the references average nine findings
there and it is judgement about content, not measurement. SEO, Social Media and Competition are
blocked on the SERP provider, Meta PPCA and the Places key respectively.

### O2 · "Not assessed in this review." — **critical**, and the clearest tell in the document

**0 of 17** reference reports contain any such sentence. Not one. The generated report says it
**five times** — Website (Business), Visibility (SEO), Visibility (SEM), Reputation, Social Media
— and "No competitors were identified for this review" once more under Competition.

A real report handles an unmeasured category by writing `N/A` in the summary table and then
saying something useful in the section anyway, or by not making a fuss about it. A section that
announces its own emptiness tells the reader the document was assembled rather than written. This
is `empty_note` in `categories.json` doing exactly what it was designed to do, and the design was
wrong.

### O3 · The Recommendations opening has no closing paragraph — **major**

Reference reports close the Recommendations block with a standing second paragraph:

> The positive way of seeing this is that there is plenty of room for improvement and with the
> right guidance and implementation, we will be able to help your practice achieve your goals if
> you're willing to step up to the challenge.

**6 of 17** — above the threshold, so it is house copy and belongs in the snippet bank as a
paragraph, not left to a model to reinvent each time. The generated report ends on the diagnosis
and stops.

### O4 · The summary paragraph names the same category as both weak and strong — **major**

Generated, verbatim:

> There are a number of areas of improvement with your online presence, particularly around
> website technical, website usability. Your website technical and website usability already work
> in your favour and are worth building on.

Two defects. It contradicts itself, and it prints internal category keys as prose — "website
technical" is a database column, not something a person writes. Oh Dental writes "your website,
security, usability and sem". This is `mockReviewSummary`, so it is not what a client would see
today, but the grounding validator would pass it: every claim traces to a finding. **A summary can
be fully grounded and still be nonsense**, which is the argument for the golden set in
BLOCKERS.md rather than an argument against the validator.

### O5 · Findings ship with their evidence stripped out — **major**

The reference report:

> The email is hosted on the same server **(mail.ohdental.com.au. IP 43.250.142.92)** as the
> website which isn't ideal…

The generated report, same snippet:

> The email is hosted on the same server as the website which isn't ideal…

`tech.email.same_server` has **no variable** for the mail host — the parenthetical was dropped
when the paragraph was mined into the bank. The finding still states the problem, but it no longer
shows its working, and showing the working is most of why a practice believes the report.

**9 paragraphs across 7 of 17** reports quote concrete evidence in brackets this way: hostnames,
IPs, load times. No single one of those paragraphs recurs three times, so the *phrasing* is not
house copy — but the *practice* is, and the collector already has the values.

### O6 · The exhibit is orphaned at the end of the document — **major**

The last line of the generated report is the caption **"Homepage as it loads at 1440×900"**, sitting
after Competition with nothing around it. Two problems: the screenshot belongs beside the finding
it evidences, not appended after everything; and the caption is machine-speak. A viewport size is
not something a reader needs, and no reference report captions its screenshots at all — they are
pasted inline where the point is being made.

---

## Pass 1a — 2026-08-05, follow-up while building §13.2 1.26

### O7 · "Hasn't been updated since 2018" is a judgement about *design*, not about HTML — **major**

Building the Wayback collector for `biz.website.stale` (7 of 17 reports) turned up a mismatch worth
recording, because it will bite anything else that tries to automate a "looks dated" judgement.

Camberwell Dental Group's report says the website *"hasn't been updated since 2018"*. The Internet
Archive says its homepage HTML last changed **8 months ago**. Both are true. The reviewer means the
design, the brand, the structure — the things a visitor perceives. The archive measures bytes, and
bytes move whenever a plugin updates, a testimonial rotates, or a footer prints the current year.

So the collector fires far less often than a human would, and on the two sites tested live
(`ohdental.com.au` 16 months, `camberwelldentalgroup.com.au` 8 months) it does not fire at all.
**That is the safe direction** — silence rather than telling a practice their site has been frozen
since 2017 when it has not — but it means the signal is not the automation of that paragraph, only
evidence handed to the reviewer who writes it.

Anything that tries to close the Website (Business) gap by measurement will hit the same wall:
of its nine reference findings, most are judgement about content and presentation. That section may
be the honest boundary of what this platform automates.

---

## How to use this file

Entries here are candidates for §13.2 steps, ranked by the same severity words the ledger uses.
They are **not** automatically true — an observation is one read of one document. Before building
against one, quantify it the way the ledger does, and if the count comes back under 3 of 17, strike
it out here with the count rather than deleting it, so the same idea is not raised twice.
