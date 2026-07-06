const audit = `
<div class="card" style="margin-bottom:14px; padding:10px 14px">
  <div style="display:flex; gap:8px; align-items:center">
    <span class="sec-lbl" style="margin:0">Filter</span>
    <span class="btn btn-ghost btn-sm">Client: All ▾</span>
    <span class="btn btn-ghost btn-sm">Actor: All ▾</span>
    <span class="btn btn-ghost btn-sm">Workflow: All ▾</span>
    <span class="btn btn-ghost btn-sm">Gate: All ▾</span>
    <span class="btn btn-ghost btn-sm">Today ▾</span>
    <span class="xs faint" style="margin-left:auto">append-only · every action human or AI · who / what / why / rollback</span>
    <span class="btn btn-soft btn-sm">Export CSV</span>
  </div>
</div>
<div class="card">
  <table class="t dense">
    <tr><th>Time</th><th>Actor</th><th>Action</th><th>Client</th><th>Why</th><th>Gate</th><th></th></tr>
    <tr><td class="mono xs">09:31</td><td class="xs"><span class="pill p-gray">clinic-call-agent v4.2</span></td><td>Recall booking confirmed, SMS sent</td><td class="xs">Hearts Dental</td><td class="xs faint">caller request · conf 0.91</td><td><span class="gate g0">G0</span></td><td class="xs faint">run #88160</td></tr>
    <tr><td class="mono xs">09:12</td><td class="xs"><span class="pill p-gray">email-triage v3.1</span></td><td style="color:var(--crit)"><b>Complaint routed to Wally — no AI acknowledgement</b></td><td class="xs">Hearts Dental</td><td class="xs faint">keywords: billing, leaving</td><td><span class="gate g3">G3</span></td><td class="xs faint">quarantined</td></tr>
    <tr><td class="mono xs">09:14</td><td class="xs"><span class="pill p-gray">feedback-interpreter v1.1</span></td><td>Concept B revision set (6 block changes)</td><td class="xs">Smile To Go</td><td class="xs faint">client gallery comments</td><td><span class="gate g1">G1</span></td><td><span class="btn btn-ghost btn-sm">↺</span></td></tr>
    <tr><td class="mono xs">09:02</td><td class="xs"><span class="pill p-gray">cms-edit-assistant v2.3</span></td><td>Publish v215 — FAQ hours correction</td><td class="xs">Yarra Hills</td><td class="xs faint">inbox request · safe lane</td><td><span class="gate g1">G1</span></td><td><span class="btn btn-ghost btn-sm">↺</span></td></tr>
    <tr><td class="mono xs">08:58</td><td class="xs"><span class="pill p-gray">clinic-call-agent v4.2</span></td><td>Emergency script read · P1 SMS to practice</td><td class="xs">Yarra Hills</td><td class="xs faint">keyword "severe swelling"</td><td><span class="gate g0">G0</span></td><td class="xs faint">recording kept</td></tr>
    <tr><td class="mono xs">08:51</td><td class="xs"><span class="pill p-gray">outage-sentinel v1.0</span></td><td>Voicemail fallback activated · agency alerted</td><td class="xs">Trowse Chiro</td><td class="xs faint">carrier heartbeat lost ×3</td><td><span class="gate g0">G0</span></td><td class="xs faint">auto-reverts</td></tr>
    <tr><td class="mono xs">08:47</td><td class="xs"><span class="avatar-xs" style="background:var(--blue)">WC</span> Wally</td><td><b>Approved</b> Tier C budget shift −28%/+31%</td><td class="xs">Yarra Hills</td><td class="xs faint">CPL red flag remediation</td><td><span class="gate g2">G2</span></td><td><span class="btn btn-ghost btn-sm">↺ snap #s-2219</span></td></tr>
    <tr><td class="mono xs">08:47</td><td class="xs"><span class="pill p-gray">ads-optimiser v1.4</span></td><td>Executed batch (validateOnly ✓ → 3 mutations) · snapshot taken · change-watch armed 7d</td><td class="xs">Yarra Hills</td><td class="xs faint">approved by Wally 08:47</td><td><span class="gate g2">G2</span></td><td><span class="btn btn-ghost btn-sm">↺</span></td></tr>
    <tr><td class="mono xs">08:40</td><td class="xs"><span class="pill p-gray">prospect-researcher v2.0</span></td><td>Research pack compiled (site, GBP, 214 reviews, rank baseline)</td><td class="xs">Aspire One</td><td class="xs faint">factory stage 2</td><td><span class="gate g0">G0</span></td><td class="xs faint">run #88141</td></tr>
    <tr><td class="mono xs">06:12</td><td class="xs"><span class="pill p-gray">form-canary v1.2</span></td><td>Canary failed → task #4183 created (P1, Ish)</td><td class="xs">Hearts Dental</td><td class="xs faint">no confirm email in 90s</td><td><span class="gate g0">G0</span></td><td class="xs faint">3rd fail</td></tr>
    <tr><td class="mono xs">06:05</td><td class="xs"><span class="pill p-gray">daily-briefing-writer v1.2</span></td><td>Morning briefing generated</td><td class="xs faint">portfolio</td><td class="xs faint">schedule 06:05</td><td><span class="gate g0">G0</span></td><td class="xs faint">run #88102</td></tr>
    <tr><td class="mono xs">06:00</td><td class="xs"><span class="pill p-gray">ads sync</span></td><td>GAQL daily pull · 21 accounts · change-history reconciled (1 out-of-band edit detected, absorbed)</td><td class="xs faint">portfolio</td><td class="xs faint">cron 06:00</td><td><span class="gate g0">G0</span></td><td class="xs faint">complete</td></tr>
    <tr><td class="mono xs">05:30</td><td class="xs"><span class="pill p-gray">seo sync</span></td><td>BrightLocal pull · <b>14/15 synced</b> · Northcote alerts suppressed (stale)</td><td class="xs faint">portfolio</td><td class="xs faint">cron 05:30</td><td><span class="gate g0">G0</span></td><td class="xs faint">partial — honest</td></tr>
    <tr><td class="mono xs">Sun 21:40</td><td class="xs"><span class="pill p-gray">skill-evaluator v1.6</span></td><td>Nightly regressions: 61 skills · 60 pass · <b style="color:var(--warn)">ad-copy-writer v2.1 promotion blocked</b> (lost to incumbent 88 vs 92)</td><td class="xs faint">—</td><td class="xs faint">golden sets</td><td><span class="gate g0">G0</span></td><td class="xs faint">report</td></tr>
  </table>
  <div class="xs faint" style="margin-top:8px">Showing 14 of 1,204 today · every row links its skill run (inputs hash, output, knowledge versions) · rollback (↺) restores the exact prior state</div>
</div>`;

const skills = `
<div class="tiles">
  <div class="tile"><div class="lbl">Skills registered</div><div class="row"><div class="val">61</div><div class="delta d-flat">58 active · 3 draft</div></div></div>
  <div class="tile"><div class="lbl">Runs · 30d</div><div class="row"><div class="val">8,412</div><div class="delta d-flat">cost $214 · $0.025/run avg</div></div></div>
  <div class="tile"><div class="lbl">Golden-set evals passing</div><div class="row"><div class="val">60<span class="unit">/61</span></div><div class="delta d-flat">nightly + pre-promotion</div></div></div>
  <div class="tile"><div class="lbl">Graduation candidates</div><div class="row"><div class="val">2</div><div class="delta d-up">precision streaks met</div></div></div>
</div>
<div class="cols">
  <div class="col" style="flex:1.4">
    <div class="card">
      <div class="card-h"><h2>Skills</h2><span class="hint">precision from the ledger gates autonomy — a human flips the switch, informed by the number</span><span class="link">All 61 →</span></div>
      <table class="t dense">
        <tr><th>Skill</th><th class="mono">Ver</th><th>Gate</th><th class="num">Precision</th><th class="num">Runs 30d</th><th class="num">Cost</th><th>Eval</th><th></th></tr>
        <tr style="background:var(--ok-tint)"><td class="main-cell">email-triage<div class="sub-cell">fast tier · Haiku-class</div></td><td class="mono">v3.1</td><td><span class="gate g1">G1</span></td><td class="num"><b>97.2%</b> ▲</td><td class="num">1,841</td><td class="num">$11</td><td><span class="pill p-ok">pass</span></td><td><span class="xs" style="color:var(--ok);font-weight:650">streak 6 wk ✓</span></td></tr>
        <tr style="background:var(--ok-tint)"><td class="main-cell">review-responder<div class="sub-cell">Hearts only — per-client trust</div></td><td class="mono">v1.9</td><td><span class="gate g2">G2</span></td><td class="num"><b>96.0%</b> ▲</td><td class="num">38</td><td class="num">$2</td><td><span class="pill p-ok">pass</span></td><td><span class="btn btn-pri btn-sm">Graduate → G1</span></td></tr>
        <tr><td class="main-cell">clinic-call-agent<div class="sub-cell">voice · realtime</div></td><td class="mono">v4.2</td><td><span class="gate g0">G0</span></td><td class="num">95.0%</td><td class="num">3,120</td><td class="num">$96</td><td><span class="pill p-ok">pass</span></td><td class="xs faint">QA sampled</td></tr>
        <tr><td class="main-cell">ads-optimiser<div class="sub-cell">top tier · judgement</div></td><td class="mono">v1.4</td><td><span class="gate g2">G2</span></td><td class="num">91.4%</td><td class="num">204</td><td class="num">$31</td><td><span class="pill p-ok">pass</span></td><td class="xs faint">Tier B streak 3/5 wk</td></tr>
        <tr><td class="main-cell">ahpra-checker<div class="sub-cell">hard gate · never graduates</div></td><td class="mono">v1.8</td><td><span class="gate g0">G0</span></td><td class="num">99.1%</td><td class="num">612</td><td class="num">$9</td><td><span class="pill p-ok">pass</span></td><td class="xs faint">blocking, by design</td></tr>
        <tr><td class="main-cell">proposal-writer<div class="sub-cell">G2 always — client-facing $</div></td><td class="mono">v2.2</td><td><span class="gate g2">G2</span></td><td class="num">—</td><td class="num">6</td><td class="num">$4</td><td><span class="pill p-ok">pass</span></td><td class="xs faint">pairwise vs human ✓</td></tr>
        <tr style="background:var(--warn-tint)"><td class="main-cell">ad-copy-writer<div class="sub-cell">v2.1 promotion blocked Sun</div></td><td class="mono">v2.0</td><td><span class="gate g2">G2</span></td><td class="num">89.7%</td><td class="num">96</td><td class="num">$8</td><td><span class="pill p-warn">v2.1 blocked</span></td><td><span class="btn btn-ghost btn-sm">Eval diff</span></td></tr>
        <tr><td class="main-cell">site-composer<div class="sub-cell">factory · top tier</div></td><td class="mono">v3.0</td><td><span class="gate g2">G2</span></td><td class="num">—</td><td class="num">41</td><td class="num">$38</td><td><span class="pill p-ok">pass</span></td><td class="xs faint">blind test 2/5 spotted</td></tr>
      </table>
    </div>
  </div>
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Knowledge base</h2><span class="hint">versioned IP — pinned per skill run</span></div>
      <table class="t dense">
        <tr><td class="main-cell">AHPRA rules</td><td class="mono">v1.8</td><td class="xs faint">12 Jun</td><td><span class="btn btn-ghost btn-sm">diff</span></td></tr>
        <tr><td class="main-cell">SEO playbook</td><td class="mono">v2.3</td><td class="xs faint">28 May</td><td><span class="btn btn-ghost btn-sm">diff</span></td></tr>
        <tr><td class="main-cell">20-80 philosophy</td><td class="mono">v3.0</td><td class="xs faint">14 Apr</td><td><span class="btn btn-ghost btn-sm">diff</span></td></tr>
        <tr><td class="main-cell">Design directions</td><td class="mono">v1.2</td><td class="xs faint">20 Jun</td><td><span class="btn btn-ghost btn-sm">diff</span></td></tr>
        <tr><td class="main-cell">Block library</td><td class="mono">v2.0</td><td class="xs faint">20 Jun</td><td><span class="btn btn-ghost btn-sm">diff</span></td></tr>
      </table>
      <div class="xs faint" style="margin-top:8px">knowledge-diff-writer summarises every version bump to affected skills' owners</div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Precision ledger · this week</h2><span class="hint">human edits → labelled examples</span></div>
      <div class="stack">
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">31 corrections captured</span></div>
          <div class="flag-body">18 ack edits (tone) · 9 triage relabels · 4 ad-copy rewrites — all added to golden sets; 2 promoted to few-shot examples.</div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">escalation miss · call QA</span></div>
          <div class="flag-body">Week-27 sample: 1 call should have handed to front desk sooner — added as negative example to clinic-call-agent set.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">Review example</span></div>
        </div>
      </div>
    </div>
  </div>
</div>`;

const settings = `
<div class="cols">
  <div class="col" style="flex:1.2">
    <div class="card">
      <div class="card-h"><h2>Integrations</h2><span class="hint">skills never hold credentials — platform tools enforce caps in code</span></div>
      <div class="grid3">
        ${[
          ['Gmail push (support@)', 'ok', 'webhook · 09:40'],
          ['Google Ads API (MCC)', 'ok', 'GAQL 06:00 ✓'],
          ['BrightLocal', 'warn', '1 client stale 48h'],
          ['Fathom', 'ok', 'webhook · Fri'],
          ['Xero', 'ok', 'webhook · 09:12'],
          ['ActiveCollab', 'ok', 'API · 09:35'],
          ['GA4 / GSC', 'ok', 'nightly ✓'],
          ['Google Business Profile', 'ok', 'nightly ✓'],
          ['Stripe (deposits)', 'ok', 'webhook ✓'],
          ['Slack', 'ok', 'routing live'],
          ['Voice platform', 'warn', '1 line outage'],
          ['Postgres backups', 'ok', '03:00 ✓'],
        ].map(([name, s, sub]) => `
        <div style="border:1px solid var(--grid);border-radius:8px;padding:9px 11px;display:flex;align-items:center;gap:8px">
          <span class="dot dk-${s}"></span>
          <div><div style="font-size:12px;font-weight:600">${name}</div><div class="xs faint">${sub}</div></div>
        </div>`).join('')}
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Notification routing</h2><span class="hint">per-person · digests for the rest</span></div>
      <table class="t dense">
        <tr><th>Event</th><th>Wally</th><th>Hamza</th><th>Ish</th></tr>
        <tr><td>P1 · outage / emergency / complaint</td><td>SMS + Slack</td><td>Slack</td><td>Slack</td></tr>
        <tr><td>Approvals waiting &gt; 4h</td><td>Slack</td><td>Slack (Ads/SEO)</td><td>Slack (web)</td></tr>
        <tr><td>Critical flags</td><td>Slack</td><td>Slack</td><td>—</td></tr>
        <tr><td>Daily briefing</td><td>06:05 email</td><td>06:05 email</td><td>06:05 email</td></tr>
        <tr><td>Everything else</td><td colspan="3" class="xs faint">evening digest — eod-summariser</td></tr>
      </table>
    </div>
  </div>
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Autonomy defaults</h2><span class="hint">per skill group · per-client overrides tracked</span></div>
      <table class="t dense">
        <tr><th>Group</th><th>Default</th><th>Overrides</th></tr>
        <tr><td>Communication</td><td><span class="gate g1">G1</span></td><td class="xs">Preston → G2 (at-risk)</td></tr>
        <tr><td>Voice / fleet</td><td><span class="gate g0">G0</span></td><td class="xs">QA-sampled weekly</td></tr>
        <tr><td>Ads mutations</td><td><span class="gate g2">G2</span></td><td class="xs">Hearts, Trowse Tier B → <span class="gate g1">G1</span></td></tr>
        <tr><td>CMS publishes (client-facing)</td><td><span class="gate g2">G2</span></td><td class="xs">safe lane → instant</td></tr>
        <tr><td>Complaints · cancellations · refunds</td><td><span class="gate g3">G3</span></td><td class="xs"><b>no overrides possible</b></td></tr>
        <tr><td>Spend / budgets / launches</td><td><span class="gate g3">G3</span></td><td class="xs">named human only</td></tr>
      </table>
      <div class="xs faint" style="margin-top:8px">G2 → G1 requires a measured precision streak; a human flips the switch. At-risk clients auto-suspend G1.</div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Roles</h2></div>
      <table class="t dense">
        <tr><td><span class="avatar-xs" style="background:var(--blue)">WC</span> Wally Chiang</td><td class="xs">Owner · G3 approver · save-plans</td></tr>
        <tr><td><span class="avatar-xs" style="background:var(--accent)">HK</span> Hamza</td><td class="xs">SEO / SEM · Ads Tier C · H5</td></tr>
        <tr><td><span class="avatar-xs" style="background:var(--warn)">IS</span> Ish</td><td class="xs">Web · factory H2–H4 · CMS</td></tr>
        <tr><td><span class="avatar-xs" style="background:var(--muted)">QG</span> Qing Guo</td><td class="xs">Clinical reviewer · 中文 sign-off</td></tr>
      </table>
      <div class="flag-act" style="margin-top:8px"><span class="btn btn-ghost btn-sm">Invite teammate</span><span class="btn btn-ghost btn-sm">API keys</span></div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Appearance</h2></div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="btn btn-soft btn-sm">● Light</span><span class="btn btn-ghost btn-sm">○ Dark</span>
        <span class="xs faint" style="margin-left:auto">both themes token-level · Segoe UI Variable + Cascadia Code</span>
      </div>
    </div>
  </div>
</div>`;

export default [
  { id: 'audit-log', title: 'Audit Log', html: audit },
  { id: 'knowledge-skills', title: 'Knowledge & Skills', html: skills },
  { id: 'settings', title: 'Settings', html: settings },
];
