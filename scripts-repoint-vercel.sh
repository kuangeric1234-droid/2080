#!/usr/bin/env bash
# Re-point Vercel at whatever hostname the tunnel currently has, and redeploy.
#
# The quick tunnel's hostname dies with the cloudflared process. When that
# happens Vercel keeps serving the dashboard and every /api call 404s — no
# error, no log, just a dashboard that silently cannot load anything. This
# turns that from a debugging session into one command.
set -euo pipefail
cd "$(dirname "$0")"

HOST="${1:-}"
if [ -z "$HOST" ]; then
  echo "usage: $0 <tunnel-hostname>    e.g. $0 abc-def-ghi.trycloudflare.com" >&2
  echo "(cloudflared prints it on startup: 'Your quick Tunnel has been created')" >&2
  exit 1
fi
HOST="${HOST#https://}"; HOST="${HOST%/}"

echo "checking $HOST reaches the API..."
curl -fsS -m 20 "https://$HOST/api/health" | grep -q '"ok":true' \
  || { echo "FAIL: https://$HOST/api/health did not return ok — is cloudflared running?" >&2; exit 1; }

python - "$HOST" <<'PY'
import io, json, sys
host = sys.argv[1]
p = 'app/vercel.json'
d = json.load(io.open(p, encoding='utf-8'))
for r in d['rewrites']:
    if r['source'].startswith('/api/'):
        r['destination'] = f'https://{host}/api/:path*'
io.open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, indent=2) + '\n')
print(f'vercel.json -> {host}')
PY

npx --yes vercel@latest deploy --prod --yes --cwd app --scope kuangeric1234-9409s-projects
echo "done. verify: curl https://<vercel-url>/api/health"
