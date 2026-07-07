# BUILD-LOG.md — Append-only build journal

The loop appends one entry per completed §13 step: step id · what was built · test evidence · files touched · decisions/notes · PROVISIONAL markers where mocks stand in for real integrations.

---

## 1.2 · Postgres schema + demo portfolio seed — 2026-07-07

**Built:** `server/` — plain-SQL migrations + minimal runner (`pg`, one transaction per file, `schema_migrations` ledger). `migrations/0001_spine.sql` implements SPEC-SPINE §2 in full plus §7 extras: 17 tables (workspaces, clients, contacts, timeline_events, requests, flags, tasks, deals, metrics_daily, sync_status, skill_runs, precision_ledger, gate_items, audit_log, notifications, entity_maps, schema_migrations), 20 enums, GIN payload index, circular flags⇄tasks FKs, `updated_at` triggers, and an `app_user` role with UPDATE/DELETE revoked on `timeline_events` and `audit_log` (append-only enforced at DB level, not in app code). Seed: the six demo practices with contacts, the Hearts double-request email split into 2 requests + 2 linked tasks, the Yarra Hills CPA red flag (task attached), the "dentist blackburn 4→9" amber flag, Mrs Lin's rescued 中文 call, 30 days × 8 metric series in `metrics_daily`, honest `sync_status` (23 ok, 1 stale with detail), a pending G2 gate_item on an ack-writer run, audit rows, learned entity_maps. `npm run db:dev` boots a persistent local Postgres via `embedded-postgres` (real PG binaries, no install needed on this machine — no psql/Docker present), migrates + seeds, port 5482.

**Evidence:** vitest 11/11 against an ephemeral embedded Postgres: every table verified to carry NOT NULL `workspace_id` (16+ tables swept via information_schema) · insert missing workspace_id → 23502 · UPDATE/DELETE on timeline_events and audit_log as `app_user` → 42501 while INSERT stays open · tasks CHECK rejects zero and two sources · six practices by slug · Hearts request⇄task linkage bidirectional · 30 distinct metric days · reseed idempotent. `tsc --noEmit` clean; app suite still 5/5.

**Files:** `server/` (new — `migrations/0001_spine.sql`, `src/db/{migrate,seed,dev}.ts`, `test/schema.test.ts`, package/tsconfig), root `.gitignore` (+`.pgdata/`).

**Decisions:** (1) Plain SQL migrations + 40-line runner instead of a migration framework — full control needed for REVOKE/roles/GIN, no lock-in. (2) Embedded Postgres for dev/tests since the machine has no PG/Docker — real binaries, same SQL surface as prod; prod hosting remains on the pre-known blocker list (Fly.io tokens). (3) `initdb --encoding=UTF8 --locale=C` required on Windows (default WIN1252 rejects the bilingual demo data). (4) `requests.type` is text, not enum — SPEC-INBOX owns that taxonomy. (5) Added minimal `workspaces` + `precision_ledger` tables implied by §1/§2 conventions.

## 1.1 · Repo scaffold + app shell — 2026-07-07

**Built:** `app/` — Vite 8 + React 19.2 + Tailwind 4.3 + React Router 7. Token set from `design-comps/platform.html` (light + dark via `prefers-color-scheme` with `[data-theme]` override, no-flash boot script in `index.html`). Tailwind `@theme inline` maps both 20-80 names (`surface`, `ink`, `teal`, `ok/warn/crit/info` + tints) and shadcn semantic aliases (`primary`, `accent`, `ring`…) onto the same CSS vars, so vendored Watermelon registry components restyle at token level with zero per-file edits. App shell: rail (5 groups / 22 tabs per §4 module map, demo badge counts), topbar (title, `/`-focusable search, Melbourne clock, theme toggle, avatar), placeholder pages with honest "arrives with step X.Y" empty states. First vendored registry component: `button.tsx`, restyled to comp scale (11.5px/650, 8px radius).

**Evidence:** `tsc -b` clean · vitest 5/5 (nav completeness, /→/today redirect, nav swap, theme toggle flips `data-theme` + persists, `/` focuses search without swallowing typed slashes) · `vite build` green · headless-Edge screenshots of both themes verified against the comp (rail/topbar/active states/badges correct in light and dark).

**Files:** `app/` (new — config, `src/index.css` tokens, `src/app/{nav,useTheme,AppShell,PagePlaceholder,routes,shell.test}`, `src/components/ui/button.tsx`, `src/lib/utils.ts`).

**Decisions:** (1) Token values follow the design comp, not §3.3's quick list, where they differ (bg `#EEF3F1` vs `#F4F6F5`, ink `#15242B` vs `#1C2A33`, muted `#5A6B74` vs `#5B6C75`) — comp is newer thinking per BUILD-LOOP conflict rule. (2) Rail badge counts + "Automated this week" footer are marked demo constants until queues/skill_runs exist (steps 1.3–1.6). (3) Topbar title is a `div`, not a heading — the page owns the single `h1` (screen-reader sanity, caught by tests).
