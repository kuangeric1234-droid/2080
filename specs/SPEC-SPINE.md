# SPEC-SPINE.md — Core Data Model, Matcher, Gates, Audit, Notifications

The contracts everything else builds on. Stage 0/1 builds to this; every later spec references it.

---

## 1 · Conventions

- **IDs:** ULIDs (`cl_`, `evt_`, `req_`, `task_`, `flag_`, `deal_`, `run_`, `aud_` prefixes). `workspace_id` on **every** table (single tenant today, SaaS later). Soft-delete via `archived_at`; hard delete only via offboard purge jobs.
- **Money:** integer cents, AUD. **Time:** timestamptz UTC in DB; practice-local rendering via per-client `timezone` (default Australia/Melbourne).
- **All writes attributed:** `actor_type` (human | skill | system) + `actor_id` (+ `skill_version` when skill).

## 2 · Field-level contracts (load-bearing tables)

**clients** — id · workspace_id · slug · name · practice_type (enum: dental/chiro/physio/osteo/specialist/podiatry/optometry/tcm/psych/vet) · lifecycle (enum: prospect/onboarding/build/launch/operate/grow/at_risk/offboarding/archived) · health_score (int, computed) · health_annotations (jsonb) · owner_user_id · timezone · languages (text[]) · plan (jsonb: modules on/off — the partial-handover switch) · autonomy (jsonb: per-skill-category G-level overrides) · guarantee_started_at · created/updated.

**contacts** — id · client_id · name · email[] · phone[] · role (owner/practice_manager/front_desk/billing/clinician) · portal_access (bool) · is_vip · language_pref · notify_prefs (jsonb).

**timeline_events** (append-only) — id · client_id · type (enum: FLAG, EMAIL_IN, EMAIL_OUT, CALL, SMS, MEETING, TASK, PUBLISH, REPORT, INVOICE, PAYMENT, REVIEW, EDIT, APPROVAL, NOTE, SYSTEM) · occurred_at · title · body (text, human-readable) · payload (jsonb, source-specific) · source (enum: gmail/voice/fathom/ads/seo/cms/portal/xero/stripe/manual/skill) · source_ref (external id) · visibility (agency_only | client_visible) — the portal renders client_visible only · created_by. Index: (client_id, occurred_at desc), (type), GIN(payload).

**requests** — id · client_id · thread_id · type (SPEC-INBOX taxonomy) · summary · status (new/triaged/in_progress/waiting_client/done/filed) · sla_due_at · confidence · source (email/portal/phone/meeting) · task_ids[] · missing_assets (jsonb) · language.

**tasks** — id · client_id · external_ref (ActiveCollab id while AC is the surface) · title · assignee · due_at · status · source_request_id / source_flag_id / source_meeting_id (exactly one — every task knows why it exists) · sla_state (ok/at_risk/breached).

**flags** — id · client_id · workflow (W1–W8/sales/system) · severity (info/amber/red) · state (open/watching/snoozed/resolved) · dedupe_key (see flag-ranker) · title · diagnosis (jsonb) · task_id · opened_at/resolved_at · age computed.

**deals** — id · client_id (nullable until won) · stage (cold/warm/meeting/proposal/won/lost) · source_channel · value_estimate_cents · audit_url · stage_history (jsonb[]) · lost_reason.

**metrics_daily** — client_id · date · source (ads/seo/ga4/calls/forms/reviews) · metric (text) · value (numeric) · meta (jsonb). One row per metric-day; reports and health read ONLY from here (never live APIs) — freshness stamped per source in **sync_status** (client_id · source · last_ok_at · state ok/stale/error · detail).

**skill_runs** — id · skill · version · kb_versions (jsonb) · client_id · trigger · input_hash · output (jsonb) · gate (G0–G3) · gate_outcome (auto/approved/edited/rejected/expired) · gate_actor · tokens_in/out · cost_cents · latency_ms · error. **precision_ledger** rows derive from gate_outcome=edited/rejected with the diff.

**audit_log** — id · at · actor_type/actor_id · action (verb.noun: `ads.mutate`, `cms.publish`, `gate.approve`…) · target_type/target_id · client_id · why (text — the rec/request that motivated it) · before_ref/after_ref (snapshot pointers) · rollback_of (nullable) · request_ip (humans). **Append-only, no updates ever.** Retention: life of workspace.

**notifications** — id · user_id · event_class · severity · client_id · title/body/link · channels_sent (jsonb) · read_at · coalesce_key.

## 3 · Entity matcher (deterministic first, then scored)

Order: ① exact source-ref map (phone DID, Ads/BrightLocal/GBP account maps, portal session, AC project) → confidence 1.0. ② contact email exact → 0.98. ③ thread continuity (known thread_id) → 0.97. ④ domain match on client email domains → 0.90 (flag if domain shared by 2+ clients — never auto at ≥2 candidates). ⑤ fuzzy (name in signature + phone match) → ≤0.7.
Rules: **≥0.8 auto-attach · 0.5–0.8 human queue (choice becomes a new mapping row — the matcher learns) · <0.5 + unknown domain → prospect flow.** Never auto-merge two candidate clients; ties always queue. All mappings live in **entity_maps** (kind, external_key, client_id, learned_from).

## 4 · Gate framework mechanics

- Every skill output with gate ≥ G1 creates a **gate_item**: id · skill_run_id · gate · state (pending/approved/edited/rejected/expired/auto) · payload (the proposed action, renderable) · diff (for edits) · expires_at (type-specific; expired ≠ rejected — re-queued or dropped per skill config) · acted_by/at.
- **G1 semantics:** action executes immediately, gate_item recorded as `auto`, **undo window** where the action type supports it (task creation: delete; email: not undoable → that's why emails are G2).
- **Approve = execute exactly the previewed payload** (no re-generation between approval and execution — the payload is frozen; if inputs changed, item invalidates and regenerates).
- **Graduation data:** per (client, skill, category): streak counter of approved-unedited; thresholds in skill config; UI shows streak next to the autonomy dial; flipping writes an audit row.
- **G3:** items render only to users with the g3 permission (SPEC-SECURITY); AI attaches evidence but no draft where spec says none (complaints).

## 5 · Notification routing

Matrix defaults (per user overridable):
| Event class | Red | Amber | Info |
|---|---|---|---|
| Receptionist emergency / outage | Slack DM + SMS + push | Slack channel | digest |
| Gate items (G2 queue) | Slack DM + in-app | in-app + daily digest | digest |
| Monitor flags (Ads/SEO/health) | Slack channel + in-app | in-app + digest | digest |
| Sales (new lead / audit opened) | in-app + Slack channel | digest | digest |
| Client activity (portal edits, approvals) | — | in-app | digest |
- **Digests:** 06:30 daily-briefing (per person: your gates, your flags, your day) + 17:30 eod. **Quiet hours** per user (default 21:00–07:00; red bypasses).
- **Coalescing:** same coalesce_key within 10 min → one notification with count. **Escalation:** red unacked 30 min → next channel up; receptionist emergency unacked 10 min → phone-call fallback to on-call.
- Client-facing notifications (portal/email/SMS) are **not** this system — they're skill outputs through gates.

## 6 · Jobs & webhooks conventions

pg-boss queues named `source.action` (`gmail.process`, `ads.pull`, `run.page`) · every job idempotent via natural key (message_id, date+account, page_id+run_id) · retries 5× exponential, then dead-letter queue surfaced on the Settings/integrations screen · webhook receivers: verify signature → persist raw → enqueue → 200 (<500ms, no work inline) · crons: 05:30 seo.sync, 06:00 ads.pull, 06:30 briefing, 17:30 eod, 22:00 factory.runs, month-end billing.reports.

## 7 · Build items & tests (Stage 0/1)

- [ ] Migrations for §2 + entity_maps + gate_items + sync_status. **Test:** every table rejects rows missing workspace_id; timeline is append-only (UPDATE revoked at DB role level).
- [ ] Matcher per §3. **Test:** 30-event golden set ≥95% correct; shared-domain case queues instead of guessing; queue choice creates a mapping that auto-matches next time.
- [ ] Gate framework per §4. **Test:** approve executes the frozen payload byte-identical; input-drift invalidates; graduation streak counts and resets on edit.
- [ ] Notification router per §5. **Test:** red bypasses quiet hours; coalescing collapses 5 same-key events to 1; unacked red escalates.
- [ ] Audit viewer. **Test:** every action in the other tests appears with actor, why, and rollback pointer where applicable.
