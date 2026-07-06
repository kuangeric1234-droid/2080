# SPEC-SECURITY.md — Auth, Roles, Privacy (AU), and the Breach Runbook

Short spec, mostly decisions. Everything here must exist before real client data enters prod (end of Stage 1).

---

## 1 · Authentication

- **Agency users:** email + password + **mandatory TOTP 2FA** (owner can enforce hardware keys later). Sessions 12h idle / 7d absolute; step-up re-auth for G3 actions and Settings changes.
- **Portal users (practice staff):** **magic link** primary (front desk hates passwords) + optional password; per-contact accounts (never shared logins — approvals must be attributable); device remembering 30d; PWA push tokens bound to the contact.
- **Session hygiene:** httpOnly SameSite cookies; refresh rotation; revoke-all on role change/offboard; login notifications on new device.
- No SSO in v1; design the user table so OIDC can bolt on at SaaS phase.

## 2 · Authorization — the permission matrix (enforced server-side per route + row)

| Capability | Agency owner (Wally) | Specialist (Hamza) | Web (Ish) | Coordinator | Practice owner | Practice manager | Front desk |
|---|---|---|---|---|---|---|---|
| G3 actions (complaints, offboard, high-risk Ads) | ✓ | — | — | — | — | — | — |
| Approve G2 (own domain) | ✓ | Ads/SEO | web/CMS | comms | — | — | — |
| Autonomy dials / Settings / roles | ✓ | — | — | — | — | — | — |
| Billing (agency) | ✓ | view | view | view | — | — | — |
| Client record full | ✓ | ✓ | ✓ | ✓ | own practice | own practice | — |
| Portal: approve designs/brand kit | | | | | ✓ | ✓ | — |
| Portal: site editing | | | | | T1–T3 | T1–T3 | T1 only |
| Portal: billing | | | | | ✓ | view | — |
| Phone AI follow-up list | | | | | ✓ | ✓ | ✓ |
| Portal user management | | | | | ✓ | — | — |

Tenant isolation: every query workspace- and client-scoped at the data layer; **cross-client leak test in CI** (user of practice A requests practice B's resources → 404, verified across every route).

## 3 · Privacy (Privacy Act 1988 / APPs) — what we hold and for how long

| Data class | Examples | Sensitivity | Retention |
|---|---|---|---|
| Practice business data | profiles, sites, metrics, reports | normal | life of client + archived |
| Patient-adjacent contact data | caller name/number/preference, leads, form submissions (non-clinical) | **personal info** | per-practice clock (default 24 mo) then purge |
| Call recordings/transcripts | W1 | personal info | per-practice retention (default 90d recordings / 24 mo transcripts); redaction beyond follow-up needs |
| **Clinical data** | eForms medical history, eConsult | **health information — NOT STORED** | out of platform by decision §14.10; lead forms must not collect clinical detail (form-canary asserts this) |
| Financial | invoices, payments | normal | 7 years (ATO) |
| Credentials/tokens | OAuth, API keys | secret | encrypted at rest (KMS), never in logs/prompts |

- **Collection notices:** portal signup + call greeting disclosure + website form notices (privacy-policy block auto-maintained, SPEC-CMS §7).
- **Access/correction (APP 12/13):** the data-export ZIP doubles as the access-request answer; corrections via the profile.
- **Cross-border:** primary storage AU (Sydney). Subprocessors documented (Anthropic, Google, Twilio, Cloudflare, Stripe, Xero, voice runtime) with data-handling notes in the client agreement; model-API calls carry only what the skill needs (minimisation), no training on our data per API terms.
- **AI-specific posture:** inbound content (email, web, call audio) = untrusted data, never instructions (firewall framing per SPEC-INBOX §3); skills hold no credentials; caps in the tool layer. Log prompts/outputs for audit but scrub secrets and clinical accidents via redaction pass.

## 4 · Notifiable Data Breach (NDB) runbook

1. **Contain** (revoke tokens/sessions, isolate) → 2. **Preserve** evidence (audit log is append-only) → 3. **Assess** within 30 days: serious-harm test (data class × exposure × mitigations) → 4. If notifiable: **notify OAIC + affected individuals** via the affected practices (they own the patient relationships — coordinate, don't bypass) → 5. Post-mortem into this spec. On-call = Wally + technical lead. Practice-facing template letters pre-drafted.

## 5 · Platform hardening checklist

- [ ] Webhook signature verification on every `/hooks/*` (already per SPEC-SPINE §6)
- [ ] Rate limiting per IP + per user; login throttling + lockout-with-notify
- [ ] CSP on portal + dashboard; no third-party scripts on client sites by default
- [ ] Dependency scanning + secrets scanning in CI; infra secrets in the platform store only
- [ ] Backups tested by restore drill (quarterly); DB encryption at rest
- [ ] Demo/preview URLs: passworded, noindex, expiring (SPEC-FACTORY §2)
- [ ] Pen-test (external) before P4 receptionist fleet / before SaaS phase

**Stage DoD test:** the CI isolation suite passes on every route; a G3 action attempted by a specialist is refused server-side; a revoked portal user's push tokens stop working; restore drill from last night's snapshot completes on staging.
