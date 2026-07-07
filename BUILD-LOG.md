# BUILD-LOG.md — Append-only build journal

The loop appends one entry per completed §13 step: step id · what was built · test evidence · files touched · decisions/notes · PROVISIONAL markers where mocks stand in for real integrations.

---

## 1.1 · Repo scaffold + app shell — 2026-07-07

**Built:** `app/` — Vite 8 + React 19.2 + Tailwind 4.3 + React Router 7. Token set from `design-comps/platform.html` (light + dark via `prefers-color-scheme` with `[data-theme]` override, no-flash boot script in `index.html`). Tailwind `@theme inline` maps both 20-80 names (`surface`, `ink`, `teal`, `ok/warn/crit/info` + tints) and shadcn semantic aliases (`primary`, `accent`, `ring`…) onto the same CSS vars, so vendored Watermelon registry components restyle at token level with zero per-file edits. App shell: rail (5 groups / 22 tabs per §4 module map, demo badge counts), topbar (title, `/`-focusable search, Melbourne clock, theme toggle, avatar), placeholder pages with honest "arrives with step X.Y" empty states. First vendored registry component: `button.tsx`, restyled to comp scale (11.5px/650, 8px radius).

**Evidence:** `tsc -b` clean · vitest 5/5 (nav completeness, /→/today redirect, nav swap, theme toggle flips `data-theme` + persists, `/` focuses search without swallowing typed slashes) · `vite build` green · headless-Edge screenshots of both themes verified against the comp (rail/topbar/active states/badges correct in light and dark).

**Files:** `app/` (new — config, `src/index.css` tokens, `src/app/{nav,useTheme,AppShell,PagePlaceholder,routes,shell.test}`, `src/components/ui/button.tsx`, `src/lib/utils.ts`).

**Decisions:** (1) Token values follow the design comp, not §3.3's quick list, where they differ (bg `#EEF3F1` vs `#F4F6F5`, ink `#15242B` vs `#1C2A33`, muted `#5A6B74` vs `#5B6C75`) — comp is newer thinking per BUILD-LOOP conflict rule. (2) Rail badge counts + "Automated this week" footer are marked demo constants until queues/skill_runs exist (steps 1.3–1.6). (3) Topbar title is a `div`, not a heading — the page owns the single `h1` (screen-reader sanity, caught by tests).
