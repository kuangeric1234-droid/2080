// Integrations tab — MCP connectors. Each external service is a connector that holds
// the credential in the platform secret store and exposes a capped tool surface to skills.

const ST = {
  live: '<span class="pill p-ok">live</span>',
  degraded: '<span class="pill p-warn">degraded</span>',
  down: '<span class="pill p-crit">disconnected</span>',
  planned: '<span class="pill p-gray">planned</span>',
  migrating: '<span class="pill p-blue">migrating</span>',
};

// [name, auth, tools(html), does, sync, statusKey, action(html)]
const groups = [
  ['Money & billing', [
    ['Xero', 'OAuth2', '<span class="mono">xero.status</span> <span class="mono">xero.invoice</span>', 'Accounting · invoice-status webhooks fire the factory', 'webhook 09:12', 'live', ''],
    ['Stripe', 'API key + webhook', '<span class="mono">stripe.read</span> <span class="mono">/hooks/stripe</span>', 'Deposits + receptionist subscriptions', '✓ 08:31', 'live', ''],
  ]],
  ['Ads, SEO & analytics', [
    ['Google Ads · MCC', 'OAuth2 · dev token', '<span class="mono">ads.query</span> <span class="mono">ads.mutate</span> <span class="pill p-outline">capped</span>', '21 client accounts · offline conversion upload from the fleet', 'GAQL 06:00', 'live', ''],
    ['Google Analytics 4', 'OAuth2', '<span class="mono">ga4.report</span>', 'Traffic + conversion attribution', 'nightly ✓', 'live', ''],
    ['Search Console', 'OAuth2', '<span class="mono">gsc.query</span>', 'Impressions, queries, index coverage', 'nightly ✓', 'live', ''],
    ['Google Business Profile', 'OAuth2', '<span class="mono">gbp.read</span> <span class="mono">gbp.post</span> <span class="gate g2">G2</span>', 'Rankings, reviews, posts — practice is primary owner', 'nightly ✓', 'live', ''],
    ['Google Tag Manager', 'OAuth2', '<span class="mono">gtm.container</span>', 'Tag deploy on new sites (owner access to practice)', 'on build', 'live', ''],
    ['BrightLocal', 'API key', '<span class="mono">rank.pull</span>', 'Local rank + citation tracking', '05:30 · <b>Northcote stale 48h</b>', 'degraded', '<span class="btn btn-ghost btn-sm">Retry sync</span>'],
  ]],
  ['Comms & social', [
    ['Gmail · support@', 'OAuth2 + Pub/Sub', '<span class="mono">gmail.read</span> <span class="mono">gmail.draft</span>', 'Inbound triage push → W2', 'webhook 09:40', 'live', ''],
    ['Google Workspace Admin', 'OAuth2 · domain-wide', '<span class="mono">gsuite.provision</span>', 'Client mailbox creation (factory launch chain)', 'on build', 'live', ''],
    ['Slack', 'OAuth · bot', '<span class="mono">slack.notify</span>', 'Internal routing + evening digests', 'live', 'live', ''],
    ['Meta Graph · Pages', 'OAuth · page tokens', '<span class="mono">social.post</span> <span class="gate g2">G2</span>', 'FB/IG posting for clients — blocks the social module', '<b style="color:var(--crit)">needs connect</b>', 'down', '<span class="btn btn-pri btn-sm">Reconnect</span>'],
    ['Twilio', 'API key · SIP', '<span class="mono">voice.*</span> <span class="mono">sms.send</span>', 'Telephony + SMS for the receptionist fleet', 'streaming · <b>1 line outage</b>', 'degraded', '<span class="btn btn-ghost btn-sm">View line</span>'],
  ]],
  ['Meetings, scheduling & tasks', [
    ['Fathom', 'webhook', '<span class="mono">/hooks/fathom</span>', 'Meeting transcripts → W5 extraction', 'Fri 15:20', 'live', ''],
    ['ActiveCollab', 'API token', '<span class="mono">tasks.*</span>', 'Task surface (revisit absorbing after Stage 3)', 'API 09:35', 'live', ''],
    ['Calendly', 'OAuth2', '<span class="mono">cal.read</span>', 'Read-only — being absorbed by meeting-scheduler', 'migration', 'migrating', ''],
  ]],
  ['Web & hosting', [
    ['Cloudflare', 'API token', '<span class="mono">dns.*</span> <span class="mono">pages.deploy</span>', 'Client DNS/SSL + static-site CDN (Pages)', '✓', 'live', ''],
    ['WordPress / Emergent', 'app password · REST', '<span class="mono">cms.import</span>', 'Legacy import during the W8 migration', 'on demand', 'live', ''],
  ]],
  ['AI & platform', [
    ['Anthropic API · Claude', 'API key', 'model tiers · <span class="mono">Batches</span> (evals)', 'The intelligence layer — token telemetry per skill/run', 'telemetry live', 'live', ''],
    ['Sentry', 'DSN', 'error + perf', 'Observability alongside the audit trace', 'live', 'live', ''],
    ['Postgres backups', 'internal', 'snapshot + PITR', 'Daily 03:00 + point-in-time recovery', '✓ 03:00', 'live', ''],
  ]],
];

const rows = groups.map(([cat, list]) => `
  <tr><td colspan="6" class="sec-lbl" style="padding:12px 10px 6px">${cat}</td></tr>
  ${list.map(([name, auth, tools, does, sync, s, act]) => `
  <tr>
    <td class="main-cell" style="white-space:nowrap"><span class="dot dk-${s === 'live' ? 'ok' : s === 'degraded' ? 'warn' : s === 'down' ? 'crit' : s === 'migrating' ? 'blue' : 'gray'}"></span> ${name}<div class="sub-cell">${auth}</div></td>
    <td>${tools}</td>
    <td class="xs">${does}</td>
    <td class="xs faint" style="white-space:nowrap">${sync}</td>
    <td>${ST[s]}</td>
    <td style="text-align:right">${act}</td>
  </tr>`).join('')}`).join('');

const integrations = `
<div class="tiles">
  <div class="tile"><div class="lbl">Connectors connected</div><div class="row"><div class="val">20<span class="unit">/21</span></div><div class="delta d-flat">2 degraded · 1 disconnected · 5 planned</div></div></div>
  <div class="tile"><div class="lbl">Oldest data · honest</div><div class="row"><div class="val">48<span class="unit">h</span></div><div class="delta d-flat">BrightLocal · Northcote suppressed</div></div></div>
  <div class="tile"><div class="lbl">Ads API budget · today</div><div class="row"><div class="val">62<span class="unit">%</span></div><div class="delta d-flat">operation budgeter · caps in code</div></div></div>
  <div class="tile"><div class="lbl">OAuth tokens expiring ≤7d</div><div class="row"><div class="val">1</div><div class="delta d-down">Meta page token · reconnect</div></div></div>
</div>

<div class="banner b-info" style="margin-bottom:14px">
  <span>Every integration is an <b>MCP connector</b>. It holds the credential in the platform secret store and exposes a <b>capped tool surface</b> — skills call the tools (e.g. <span class="mono">ads.mutate</span> refuses an over-cap change in code) and never see a raw key. A confused model cannot exceed a budget cap because the tool refuses.</span>
  <span class="bx">credentials · tool layer only</span>
</div>

<div class="card" style="margin-bottom:14px">
  <div class="card-h">
    <h2>Connectors</h2>
    <span class="hint">21 connectors · 6 groups · Sydney region · webhooks enqueue-then-process</span>
    <span class="btn btn-soft btn-sm" style="margin-left:auto">+ Add connector</span>
  </div>
  <table class="t dense">
    <tr><th>Connector · auth</th><th>Exposes</th><th>What it does</th><th>Last sync / lag</th><th>Status</th><th></th></tr>
    ${rows}
  </table>
</div>

<div class="cols">
  <div class="col" style="flex:1.2">
    <div class="card">
      <div class="card-h"><h2>Quota &amp; rate</h2><span class="hint">caps enforced in code, not by the model</span></div>
      <table class="t dense">
        <tr><th>Connector</th><th style="width:150px">Usage today</th><th class="num">Headroom</th></tr>
        <tr><td>Google Ads · operations</td><td><div class="meter m-blue"><i style="width:62%"></i></div></td><td class="num xs">13.2k / 21k</td></tr>
        <tr><td>Gmail push · Pub/Sub</td><td><div class="meter m-ok"><i style="width:24%"></i></div></td><td class="num xs">healthy</td></tr>
        <tr><td>Twilio · concurrent lines</td><td><div class="meter m-warn"><i style="width:70%"></i></div></td><td class="num xs">1 on fallback</td></tr>
        <tr><td>Anthropic · spend (mo)</td><td><div class="meter"><i style="width:41%"></i></div></td><td class="num xs">$214 · $0.025/run</td></tr>
        <tr><td>Cloudflare · Pages builds</td><td><div class="meter m-ok"><i style="width:18%"></i></div></td><td class="num xs">plenty</td></tr>
      </table>
      <div class="xs faint" style="margin-top:8px">Over-budget calls are refused by the connector and logged to the audit trail — never silently dropped.</div>
    </div>
  </div>
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Needs attention</h2></div>
      <div class="stack">
        <div class="flag f-crit">
          <div class="flag-top"><span class="who">Meta Graph disconnected</span><span class="when">page token expired</span></div>
          <div class="flag-body">FB/IG posting can't run until reconnected — app review + page-token refresh. Blocks the social-management module (open q #9).</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Reconnect</span><span class="btn btn-ghost btn-sm">Docs</span></div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">Twilio · Preston line outage</span><span class="when">08:51</span></div>
          <div class="flag-body">Voicemail fallback active, transcribed on recovery. outage-sentinel auto-reverts on carrier heartbeat.</div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">BrightLocal · Northcote stale 48h</span><span class="when">05:30</span></div>
          <div class="flag-body">That client's rank alerts are suppressed until fresh data returns — never a stale alarm.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">Retry sync</span></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Planned / phase 2</h2><span class="hint">decide at the mapped stage</span></div>
      <table class="t dense">
        <tr><td class="main-cell">GoCardless</td><td class="xs">Direct debit for monthly plans</td><td class="xs faint">Stage 4</td></tr>
        <tr><td class="main-cell">Meta Ads</td><td class="xs">FB/IG paid alongside Google Ads</td><td class="xs faint">Stage 4</td></tr>
        <tr><td class="main-cell">Praktika / Core Practice</td><td class="xs">PMS booking + patient reconcile</td><td class="xs faint">Voice phase 2</td></tr>
        <tr><td class="main-cell">HealthEngine</td><td class="xs">Booking availability</td><td class="xs faint">Voice phase 2</td></tr>
        <tr><td class="main-cell">Microsoft / Bing Ads</td><td class="xs">Secondary search network</td><td class="xs faint">later</td></tr>
      </table>
    </div>
  </div>
</div>`;

export default [
  { id: 'integrations', title: 'Integrations', html: integrations },
];
