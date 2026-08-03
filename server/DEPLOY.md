# DEPLOY.md — the 20-80 platform on the always-on box

Target: a Windows NUC running 24/7, reachable over Tailscale, serving the API
and its Postgres. The review crawler needs a machine that is awake — Site Health
records uptime history, and a website review runs as a background job that must
outlive the browser tab that started it.

**How to use this:** paste the prompt below into Claude Code *on the NUC*. It is
written to be executed top to bottom, once. Steps 0–7 are permanent; you never
repeat them. Only the `git pull` block near the end recurs.

**If the code is not on the remote yet**, Steps 0, 1, 6 and 7 need no checkout —
prerequisites, Postgres, Tailscale and backups can all be built against an empty
box. Do those now and come back to Steps 2–5 once the build has been pushed. See
the note at the top of Step 2 for how to tell.

---

## The prompt

> Read `server/DEPLOY.md` and set this machine up by following it exactly.
> Work one step at a time and run the **Verify** block before moving on. Stop at
> every **HUMAN** marker and ask me — do not invent passwords, paths or keys.
> If a Verify block fails, diagnose it before continuing rather than pressing on.

---

## Rules for whoever executes this

- **Idempotent.** Every step checks whether it is already done before doing it.
  Re-running this file on a half-configured box must be safe.
- **Never invent a secret.** Passwords, the Anthropic key, and the Tailscale
  login all come from the human at a HUMAN marker.
- **Verify before advancing.** A step whose Verify block fails is a stop, not a
  warning. Silent partial setup is how a box ends up looking healthy and serving
  nothing.
- **Nothing here edits application code.** If a step seems to require a source
  change, stop and report it — the deploy is meant to be orthogonal to the build.

---

## Step 0 · Facts to establish first

Run these and record the answers; later steps depend on them.

```powershell
node --version                       # must be >= 22.9.0
git --version
foreach ($t in 'nssm','tailscale') {
  $found = @(Get-Command $t -ErrorAction Ignore)
  "{0}: {1}" -f $t, $(if ($found) { $found[0].Source } else { 'NOT INSTALLED' })
}
"postgres service: " + $(@(Get-Service postgresql* -ErrorAction Ignore).Name -join ', ')
```

(`-ErrorAction Ignore` rather than `SilentlyContinue` on purpose: the latter
hides the message but still trips a non-zero exit, which reads to an agent as a
failed step when the tool is merely absent.)

**Node must be 22.9.0 or newer.** Below that, `--env-file-if-exists` does not
exist as a flag and the server starts without ever reading `.env.local` — it
will run, connect to the wrong database, and silently use the mock model client.
This is the single most confusing failure mode on the list. If Node is older,
install current LTS from nodejs.org before going further.

Install anything missing above (`winget install NSSM.NSSM`,
`winget install tailscale.tailscale`) before Step 1.

---

## Step 1 · Postgres as a Windows service

The dev setup boots an embedded Postgres as a child process
(`server/src/db/dev.ts`) — excellent on a laptop, wrong here. A 24/7 box wants a
real service that starts on boot and outlives every terminal.

**HUMAN:** install PostgreSQL from the EnterpriseDB Windows installer and choose
a strong `postgres` password. Tell the agent the password when asked; it is
never written into this file or into git.

Then find the binaries (do not assume a version number) and create the database:

```powershell
$pgbin = (Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" | Select-Object -First 1).DirectoryName
& "$pgbin\createdb.exe" -U postgres app
```

`createdb` fails harmlessly if `app` already exists — that is the idempotent case,
not an error worth stopping for.

**Verify**

```powershell
& "$pgbin\psql.exe" -U postgres -d app -c "SELECT current_database(), version();"
```

Expect the database name `app` and a version banner. Note the service listens on
**5432** — the real service — not the 5482 the embedded dev instance uses. Mixing
those two up points the API at a database that stops existing when a dev script
is killed.

---

## Step 2 · Checkout

**HUMAN — check this before cloning.** The remote lags the dev machine badly at
time of writing. `origin/main` is at `9a4646f` (Clients CRM, §10), while local
`main` has three unpushed commits — the whole of Online Presence Review modules
1.0, 1.1 and 1.2. Worse, the collector and engine themselves
(`server/src/review/collect.ts`, `engine.ts`, `signals.ts`, `probe.ts`) are not
committed at all; they are untracked working files.

A clone today gets a dashboard with no review module in it. Pushing the three
commits is necessary but not sufficient — the crawler has to be committed too.
Confirm on the dev machine that `git status` is clean and `git log origin/main..HEAD`
is empty before cloning here.

**Authentication.** If the repo is private, the clone needs credentials. Use
`gh auth login`, or Git Credential Manager, or a fine-grained PAT with read
access. Do not paste a token into a shell command where it lands in history —
let the credential helper store it.

```powershell
git clone https://github.com/kuangeric1234-droid/2080.git "C:\2080"
cd "C:\2080\server"
npm ci
```

Note the path is `C:\2080`, not `C:\2080 Solutions` as on the dev machine. The
space is deliberate to avoid: NSSM's `AppParameters` is a single quoted string,
and a space in the working path turns every later quoting decision into a
guessing game. Keep the deploy path space-free.

**Verify**

```powershell
npm run typecheck
```

Expect no output — `tsc --noEmit` is silent on success. A failure here is a
checkout or dependency problem, not a deploy problem; do not work around it.

---

## Step 3 · Secrets

`server/.env.local` is gitignored (`.gitignore:7`, pattern `.env.*`). **It does
not arrive with the clone.** This surprises people: everything else came down
from git, so the missing file looks like a bug rather than the design.

Create `C:\2080\server\.env.local` with exactly this shape:

```
ANTHROPIC_API_KEY=
DATABASE_URL=postgres://postgres:THEPASSWORD@127.0.0.1:5432/app
PORT=5483
```

**HUMAN:** supply both values — the Anthropic key from console.anthropic.com and
the Postgres password from Step 1. The agent must not copy a key out of any
other file, any chat transcript, or any other machine.

Worth knowing: the key is optional for the crawl. `server/src/review/collect.ts`
produces roughly 25 of ~35 signals from HTTP, DNS and TLS alone — no credential
involved. The key only buys variable-filling and the written summary
(`server/src/skills/model.ts:101`). With it blank the box still runs a complete
signal collection, it just narrates with the mock client.

**Verify**

```powershell
node --env-file-if-exists=.env.local -e "console.log(!!process.env.DATABASE_URL, !!process.env.ANTHROPIC_API_KEY)"
```

Expect `true true`. Two `false`s means the file is in the wrong directory; one
means a line is malformed (no quotes, no spaces around `=`).

---

## Step 4 · Migrate

```powershell
npm run db:migrate
```

**Do not run `npm run db:seed`.** It seeds a demo portfolio of invented
practices. This box will hold real client records, and untangling seeded fakes
from real ones later is worse than it sounds.

**Verify**

```powershell
& "$pgbin\psql.exe" -U postgres -d app -c "\dt"
```

Expect tables through the review schema (migration `0009_review.sql`).

---

## Step 5 · The API as a service

Point NSSM at `node.exe` and the tsx CLI **directly**. Pointing it at `npm.cmd`
is the usual instinct and the usual failure — the shim exits immediately, so the
service reports "started" while nothing listens on the port.

```powershell
nssm install 2080-api "C:\Program Files\nodejs\node.exe"
nssm set 2080-api AppParameters "node_modules\tsx\dist\cli.mjs --env-file-if-exists=.env.local src\index.ts"
nssm set 2080-api AppDirectory "C:\2080\server"
nssm set 2080-api AppStdout "C:\2080\server\logs\api.log"
nssm set 2080-api AppStderr "C:\2080\server\logs\api.err.log"
nssm set 2080-api AppExit Default Restart
nssm start 2080-api
```

**Verify**

```powershell
Start-Sleep -Seconds 3
Invoke-RestMethod http://127.0.0.1:5483/api/health
Get-Content "C:\2080\server\logs\api.log" -Tail 20
```

Expect `ok : True`, and a log line `api listening on http://127.0.0.1:5483`. If
the log also says `ANTHROPIC_API_KEY not set`, the service is not reading
`.env.local` — check `AppDirectory` before anything else.

Reboot the NUC once here and re-run the Verify block. A service that works until
the first restart is not done.

---

## Step 6 · Tailscale and the firewall

**HUMAN:** run `tailscale up` and complete the browser login. Install Tailscale
on the laptop and phone you want to reach the dashboard from.

The server binds all interfaces, so the inbound rule must be scoped to the
tailnet — not left open:

```powershell
netsh advfirewall firewall add rule name="2080 API (Tailscale)" dir=in action=allow protocol=TCP localport=5483 remoteip=100.64.0.0/10
```

`100.64.0.0/10` is Tailscale's address range. An unscoped rule publishes the
client database to every network the NUC ever joins. A scoped rule gives you
access from anywhere on the tailnet and nowhere else.

This is defence in depth rather than the only lock — `/api/*` already sits
behind session auth (`server/src/api.ts:56`); only `/api/health` and login are
public. Both layers stay.

**Verify** — from the laptop, not the NUC:

```powershell
tailscale ip -4                      # run on the NUC to get its address
Invoke-RestMethod http://<nuc-tailscale-ip>:5483/api/health
```

---

## Step 7 · Backups

Postgres on a box in a house. Two things, both non-optional:

- **BitLocker** on the NUC's system drive.
- **A dump on a schedule, to a different physical disk than the data directory.**

```powershell
$env:PGPASSWORD = "THEPASSWORD"
& "$pgbin\pg_dump.exe" -U postgres -d app -F c -f "D:\backups\app.dump"
```

Register that as a daily Scheduled Task running whether or not a user is logged
on, with `PGPASSWORD` set in the task environment (or a `%APPDATA%\postgresql\pgpass.conf`
entry, which is tidier than a password in a task definition).

**Verify** — restore the dump into a throwaway database. An untested backup is a
belief, not a backup.

```powershell
& "$pgbin\createdb.exe" -U postgres restoretest
& "$pgbin\pg_restore.exe" -U postgres -d restoretest "D:\backups\app.dump"
& "$pgbin\psql.exe" -U postgres -d restoretest -c "\dt"
& "$pgbin\dropdb.exe" -U postgres restoretest
```

---

## The front end

Deliberately unfinished, because it is still moving. `app/vite.config.ts` proxies
`/api` to `127.0.0.1:5483`, so the interim is:

```powershell
cd "C:\2080\app"; npm ci; npm run dev -- --host
netsh advfirewall firewall add rule name="2080 App dev (Tailscale)" dir=in action=allow protocol=TCP localport=5173 remoteip=100.64.0.0/10
```

Reach it at `http://<nuc-tailscale-ip>:5173`. If Vite rejects the hostname, use
the raw `100.x.y.z` address or add the name to `server.allowedHosts`.

The better end state is serving the built bundle from Hono so there is one origin
and no proxy — roughly five lines in `server/src/index.ts`. It is not here yet on
purpose: `ReviewPage.tsx` and the review routes are under active construction,
and a deploy step that fights the build is worse than a temporary dev server.

---

## After every `git pull`

Only this recurs:

```powershell
cd "C:\2080"; git pull
cd server; npm ci; npm run db:migrate; nssm restart 2080-api
Invoke-RestMethod http://127.0.0.1:5483/api/health
```

`.env.local` survives pulls untouched — it is gitignored, which is the point.

---

## When something is wrong

| Symptom | Almost always |
|---|---|
| Service "running", port dead | NSSM pointed at `npm.cmd` instead of `node.exe` |
| `ANTHROPIC_API_KEY not set` in the log | `AppDirectory` wrong, so `.env.local` is not found |
| Both env vars read as `false` | Node older than 22.9 — the flag is being ignored |
| Connects, but tables are missing | Pointed at 5482 (embedded dev) instead of 5432 (service) |
| Health OK on NUC, dead from laptop | Firewall rule missing, or scoped to the wrong range |
| Review crawl hangs for minutes | Expected on slow sites — see the overall-deadline note in the review module |

## What this box still cannot do

Per `BLOCKERS.md`, all outbound-only. The Gmail webhook (`/hooks/gmail`) will
eventually need genuine inbound from Google, and that is the point where
Tailscale alone stops being sufficient and a real domain plus TLS enters the
picture. That decision is blocked on Gmail OAuth anyway — do not pre-solve it.
