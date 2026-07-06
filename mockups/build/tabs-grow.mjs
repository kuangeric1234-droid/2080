import { colChart } from './shell.mjs';

const prospects = `
<div class="tiles">
  <div class="tile"><div class="lbl">Pipeline value</div><div class="row"><div class="val">$86<span class="unit">k</span></div><div class="delta d-up">▲ $18k this month</div></div></div>
  <div class="tile"><div class="lbl">New leads · week</div><div class="row"><div class="val">5</div><div class="delta d-flat">forms 2 · calls 2 · FB 1</div></div></div>
  <div class="tile"><div class="lbl">Audit microsites · median</div><div class="row"><div class="val">11<span class="unit">min</span></div><div class="delta d-up">lead → live audit link</div></div></div>
  <div class="tile"><div class="lbl">Win rate · Q2</div><div class="row"><div class="val">38<span class="unit">%</span></div><div class="delta d-up">▲ 6pts since loss-miner</div></div></div>
</div>
<div class="kan">
  <div class="kan-col">
    <div class="kan-h"><span class="n">Cold Lead</span><span class="c">3</span><span class="sum">$24k</span></div>
    <div class="deal">
      <div class="dn">Carlton Dental Lounge</div>
      <div class="ds">Carlton · dental · <span class="pill p-blue">web form</span></div>
      <div class="ds" style="margin-top:5px"><span class="pill p-teal">audit generating · 8 min</span></div>
      <div class="df"><span class="xs faint">captured 09:31</span><span class="dv">$12k</span></div>
    </div>
    <div class="deal">
      <div class="dn">Bundoora Physio Co</div>
      <div class="ds">Bundoora · physio · <span class="pill p-blue">missed call</span></div>
      <div class="ds" style="margin-top:5px">After-hours call rescued by our own line — dogfooding ✓. Audit sent, unopened.</div>
      <div class="df"><span class="xs faint">Sat 18:40</span><span class="dv">$8k</span></div>
    </div>
    <div class="deal">
      <div class="dn">Reservoir Myotherapy</div>
      <div class="ds">Reservoir · allied · <span class="pill p-blue">FB funnel</span></div>
      <div class="ds" style="margin-top:5px">Nurture #1 sent · eBooklet downloaded</div>
      <div class="df"><span class="xs faint">Thu</span><span class="dv">$4k</span></div>
    </div>
  </div>
  <div class="kan-col">
    <div class="kan-h"><span class="n">Warm Lead</span><span class="c">2</span><span class="sum">$21k</span></div>
    <div class="deal" style="border-color:var(--accent)">
      <div class="dn">Ivanhoe Smiles</div>
      <div class="ds">Ivanhoe · dental · <span class="pill p-blue">web form</span></div>
      <div class="ds" style="margin-top:5px">Audit opened <b>×4</b> · competitors section 6 min · lead-score <b>72</b> ▲</div>
      <div class="df"><span class="btn btn-pri btn-sm">Send booking link</span><span class="dv">$13k</span></div>
    </div>
    <div class="deal">
      <div class="dn">Coburg Chiro Works</div>
      <div class="ds">Coburg · chiro · <span class="pill p-blue">referral</span></div>
      <div class="ds" style="margin-top:5px">Replied to nurture #2 — "call me after the 15th". Re-nurture timer set.</div>
      <div class="df"><span class="xs faint">score 58</span><span class="dv">$8k</span></div>
    </div>
  </div>
  <div class="kan-col">
    <div class="kan-h"><span class="n">Meeting Held</span><span class="c">1</span><span class="sum">$15k</span></div>
    <div class="deal">
      <div class="dn">Doncaster Dental Studio</div>
      <div class="ds">Doncaster · dental · <span class="pill p-blue">conference</span></div>
      <div class="ds" style="margin-top:5px">Met Fri (Fathom ✓). proposal-writer drafting from transcript + rate card — due 11:00. Wally video script ready to record (3 min).</div>
      <div class="df"><span class="btn btn-pri btn-sm">Review proposal</span><span class="dv">$15k</span></div>
    </div>
  </div>
  <div class="kan-col">
    <div class="kan-h"><span class="n">Proposal Sent</span><span class="c">2</span><span class="sum">$26k</span></div>
    <div class="deal">
      <div class="dn">Kew Family Dental</div>
      <div class="ds">Kew · dental · day 4</div>
      <div class="ds" style="margin-top:5px">Wally video watched <b>×2</b> · pricing page revisited. Deposit-discount playbook live (10% · 7 days left).</div>
      <div class="df"><span class="btn btn-ghost btn-sm">Nudge</span><span class="dv">$14.2k</span></div>
    </div>
    <div class="deal">
      <div class="dn">Brunswick Physio Hub</div>
      <div class="ds">Brunswick · physio · day 12</div>
      <div class="ds" style="margin-top:5px">No opens in 8 days. Final chase Wed, then 30-day silence → lost + survey.</div>
      <div class="df"><span class="xs faint">cooling</span><span class="dv">$11.8k</span></div>
    </div>
  </div>
  <div class="kan-col">
    <div class="kan-h"><span class="n">Won / Lost · Jul</span><span class="c">2</span></div>
    <div class="deal" style="border-color:var(--ok)">
      <div class="dn" style="color:var(--ok)">✓ Aspire One Physio</div>
      <div class="ds">Won 1 Jul · deposit webhook → <b>factory stage 1 fired</b> · portal live in 54s</div>
      <div class="df"><span class="xs faint">Cold → Won in 19 days</span><span class="dv">$9.5k</span></div>
    </div>
    <div class="deal" style="border-color:var(--crit)">
      <div class="dn" style="color:var(--crit)">✗ Preston Denture Clinic</div>
      <div class="ds">Lost 2 Jul · reason survey returned: <b>pricing</b> · loss-miner logged → Q3 pattern report</div>
      <div class="df"><span class="btn btn-ghost btn-sm">Debrief notes</span></div>
    </div>
  </div>
</div>
<div class="xs faint" style="margin-top:10px">Stage transitions fire on events: audit engagement → warm · booking → meeting · approved proposal → sent · deposit webhook → won · reject or 30d silence → lost. Agile CRM import: 34 deals mapped ✓</div>`;

const reports = `
<div class="tiles">
  <div class="tile"><div class="lbl">June reports generated</div><div class="row"><div class="val">18<span class="unit">/23</span></div><div class="delta d-flat">3 awaiting data · 2 in review</div></div></div>
  <div class="tile"><div class="lbl">Sent to clients</div><div class="row"><div class="val">14</div><div class="delta d-flat">4 approved, queued</div></div></div>
  <div class="tile"><div class="lbl">Client open rate</div><div class="row"><div class="val">74<span class="unit">%</span></div><div class="delta d-up">▲ 9pts since interactive</div></div></div>
  <div class="tile"><div class="lbl">New-patient numbers verified</div><div class="row"><div class="val">11<span class="unit">/14</span></div><div class="delta d-up">one-tap confirmations</div></div></div>
</div>
<div class="cols">
  <div class="col" style="flex:1.25">
    <div class="card">
      <div class="card-h"><h2>June batch</h2><span class="hint">report-writer + insight-writer · from W1–W4 data · zero hand-editing target</span></div>
      <table class="t">
        <tr><th>Client</th><th>Status</th><th class="num">ROI</th><th>New patients</th><th>Engagement</th><th></th></tr>
        <tr><td class="main-cell">Hearts Dental</td><td><span class="pill p-ok">sent ✓</span></td><td class="num"><b>16.2:1</b></td><td>14 · <span class="pill p-ok">confirmed ✓</span></td><td class="xs">Sarah · 2 opens · 4 min</td><td><span class="btn btn-ghost btn-sm">View</span></td></tr>
        <tr><td class="main-cell">Trowse Chiropractic</td><td><span class="pill p-ok">sent ✓</span></td><td class="num"><b>19.4:1</b></td><td>11 · <span class="pill p-ok">confirmed ✓</span></td><td class="xs">Dr Trowse · 1 open</td><td><span class="btn btn-ghost btn-sm">View</span></td></tr>
        <tr><td class="main-cell">Smile Council</td><td><span class="pill p-warn">in review</span></td><td class="num">12.8:1</td><td>16 · <span class="pill p-gray">awaiting tap</span></td><td class="xs faint">—</td><td><span class="btn btn-pri btn-sm">Review</span></td></tr>
        <tr><td class="main-cell">Yarra Hills Dental</td><td><span class="pill p-warn">in review</span></td><td class="num">9.1:1</td><td>9 · <span class="pill p-ok">confirmed ✓</span></td><td class="xs faint">—</td><td><span class="btn btn-pri btn-sm">Review</span></td></tr>
        <tr><td class="main-cell">Northcote Physio Group</td><td><span class="pill p-gray">awaiting data</span></td><td class="num faint">—</td><td class="faint xs">BrightLocal stale</td><td class="xs faint">—</td><td><span class="btn btn-ghost btn-sm">Retry</span></td></tr>
        <tr><td class="main-cell">Preston Family Dental</td><td><span class="pill p-ok">sent ✓</span></td><td class="num">7.4:1</td><td>6 · <span class="pill p-warn">claimed — unconfirmed</span></td><td class="xs" style="color:var(--crit)">unopened 2nd month</td><td><span class="btn btn-ghost btn-sm">View</span></td></tr>
      </table>
      <div class="xs faint" style="margin-top:8px">ROI below the 10:1 line triggers an insight paragraph, never silence — Yarra Hills June narrative explains the CPL spike and the fix under way</div>
    </div>
  </div>
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Hearts Dental · June preview</h2><span class="pill p-teal">interactive · portal</span></div>
      <div style="border:1px solid var(--grid);border-radius:9px;padding:12px 14px;background:var(--bg)">
        <div class="sec-lbl">Return on investment</div>
        <div style="font-family:var(--display);font-size:30px;font-weight:650">16.2<span style="font-size:15px;color:var(--muted)"> : 1</span></div>
        <div class="xs muted" style="margin-top:2px">$2,400 retainer → $38,900 attributed treatment value</div>
        <hr class="hr">
        <table class="t dense">
          <tr><td>Enquiries (forms + calls)</td><td class="num"><b>41</b></td></tr>
          <tr><td>· of which rescued after-hours</td><td class="num">5</td></tr>
          <tr><td>New patients — <b>confirmed by practice</b></td><td class="num"><b>14</b></td></tr>
          <tr><td>"dentist blackburn" avg position</td><td class="num">4.2</td></tr>
        </table>
        <hr class="hr">
        <div class="xs" style="line-height:1.55;color:var(--muted)"><b style="color:var(--ink)">insight-writer:</b> Saturday-morning calls are your fastest-growing enquiry window (11 of 41) — the new Saturday hours from 1 Aug should convert this demand; we'll report the before/after in September.</div>
      </div>
      <div class="flag-act" style="margin-top:10px"><span class="btn btn-ghost btn-sm">Open full report</span><span class="btn btn-ghost btn-sm">PDF export</span><span class="xs faint" style="margin-left:auto">new-patient-reconciler: confirmed 3 Jul via one-tap</span></div>
    </div>
  </div>
</div>`;

const billing = `
<div class="tiles">
  <div class="tile"><div class="lbl">MRR</div><div class="row"><div class="val">$61.4<span class="unit">k</span></div><div class="delta d-up">▲ 5.3% vs June</div></div></div>
  <div class="tile"><div class="lbl">Overdue</div><div class="row"><div class="val">$4,850</div><div class="delta d-down">2 invoices</div></div></div>
  <div class="tile"><div class="lbl">Invoices · July run</div><div class="row"><div class="val">23</div><div class="delta d-flat">invoice-runner · Xero synced ✓</div></div></div>
  <div class="tile"><div class="lbl">Project revenue · Q3 booked</div><div class="row"><div class="val">$38<span class="unit">k</span></div><div class="delta d-flat">3 builds</div></div></div>
</div>
<div class="cols">
  <div class="col" style="flex:1.3">
    <div class="card">
      <div class="card-h"><h2>MRR</h2><span class="hint">last 8 months</span></div>
      ${colChart({ w: 640, h: 160, values: [46.2, 48.0, 51.5, 53.1, 54.8, 56.9, 58.3, 61.4], labels: ['Dec','Jan','Feb','Mar','Apr','May','Jun','Jul'], lastLabel: '$61.4k' })}
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Invoices</h2><span class="hint">two-way Xero sync · status via webhook</span><span class="link">All 23 →</span></div>
      <table class="t dense">
        <tr><th>Client</th><th class="mono">Invoice</th><th class="num">Amount</th><th>Due</th><th>Status</th><th></th></tr>
        <tr><td>Hearts Dental</td><td class="mono">INV-2607</td><td class="num">$2,400</td><td class="xs">14 Jul</td><td><span class="pill p-ok">paid ✓ 3 Jul</span></td><td></td></tr>
        <tr><td>Smile Council</td><td class="mono">INV-2608</td><td class="num">$2,900</td><td class="xs">14 Jul</td><td><span class="pill p-gray">sent</span></td><td></td></tr>
        <tr><td>Yarra Hills Dental</td><td class="mono">INV-2609</td><td class="num">$3,200</td><td class="xs">14 Jul</td><td><span class="pill p-gray">sent</span></td><td></td></tr>
        <tr style="background:var(--crit-tint)"><td>Preston Family Dental</td><td class="mono">INV-2554</td><td class="num">$2,100</td><td class="xs">4 Jun</td><td><span class="pill p-crit">overdue 32d</span></td><td><span class="btn btn-pri btn-sm">Dunning</span></td></tr>
        <tr><td>Bundoora Wellness (ex)</td><td class="mono">INV-2571</td><td class="num">$2,750</td><td class="xs">18 Jun</td><td><span class="pill p-warn">overdue 18d</span></td><td><span class="btn btn-ghost btn-sm">Chase</span></td></tr>
        <tr><td>Smile To Go · build 50%</td><td class="mono">INV-2601</td><td class="num">$6,400</td><td class="xs">at concept sign-off</td><td><span class="pill p-blue">milestone</span></td><td></td></tr>
      </table>
    </div>
  </div>
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Dunning</h2><span class="hint">dunning-writer v1.5 · tone-checked</span></div>
      <div class="stack">
        <div class="flag f-crit">
          <div class="flag-top"><span class="who">Preston Family Dental · 32 days</span><span class="gate g2">G2</span></div>
          <div class="flag-body">Step 2 of 3 sent 1 Jul (gentle, references save-call Tue). <b>Step 3 at 45d routes to Wally — never auto-sent</b> <span class="gate g3">G3</span>. Unpaid-30d already feeding at-risk health.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">View thread</span><span class="btn btn-ghost btn-sm">Pause dunning</span></div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">Bundoora Wellness · 18 days</span><span class="gate g1">G1</span></div>
          <div class="flag-body">Offboarded client, final invoice. Step 1 reminder sent 28 Jun; step 2 drafts Thursday.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">Review draft</span></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Revenue mix · July</h2></div>
      <table class="t dense">
        <tr><td>Retainers (23 clients)</td><td class="num">$61,400</td></tr>
        <tr><td>Builds (milestones due)</td><td class="num">$12,800</td></tr>
        <tr><td>Ads spend managed (pass-through)</td><td class="num">$9,800</td></tr>
        <tr><td><b>Recognised July (proj.)</b></td><td class="num"><b>$74,200</b></td></tr>
      </table>
      <div class="xs faint" style="margin-top:8px">Xero remains the ledger — platform mirrors status, never double-enters. Guarantee clocks shown in Guarantee Tracker.</div>
    </div>
  </div>
</div>`;

const guarantee = `
<div class="tiles">
  <div class="tile"><div class="lbl">Active guarantees</div><div class="row"><div class="val">6</div><div class="delta d-flat">6-month promise</div></div></div>
  <div class="tile"><div class="lbl">On track</div><div class="row"><div class="val">4</div><div class="delta d-up">≥ 90% of promised pace</div></div></div>
  <div class="tile"><div class="lbl">Watch</div><div class="row"><div class="val">1</div><div class="delta d-flat">70–90% of pace</div></div></div>
  <div class="tile"><div class="lbl">Off track</div><div class="row"><div class="val">1</div><div class="delta d-down">remediation active</div></div></div>
</div>
<div class="card">
  <div class="card-h"><h2>Guarantee clocks</h2><span class="hint">guarantee-scorer v1.2 · promise vs actuals, computed monthly — remediation playbook fires at &lt;70%</span></div>
  <table class="t">
    <tr><th>Client</th><th>Promise</th><th>Clock</th><th style="width:220px">Progress vs pace</th><th class="num">Actual / needed</th><th>Status</th><th></th></tr>
    <tr>
      <td class="main-cell">Yarra Hills Dental</td><td class="xs">40 new patients in 6 months</td><td class="xs">month 4 of 6</td>
      <td><div class="meter" style="height:8px"><i style="width:61%"></i></div></td>
      <td class="num"><b>26</b> / 27 by now</td><td><span class="pill p-ok">on track · 96%</span></td>
      <td><span class="btn btn-ghost btn-sm">Detail</span></td>
    </tr>
    <tr>
      <td class="main-cell">Smile Council</td><td class="xs">Top-3 for 8 money keywords</td><td class="xs">month 5 of 6</td>
      <td><div class="meter" style="height:8px"><i style="width:75%"></i></div></td>
      <td class="num"><b>6</b> / 8 keywords</td><td><span class="pill p-ok">on track</span></td>
      <td><span class="btn btn-ghost btn-sm">Detail</span></td>
    </tr>
    <tr>
      <td class="main-cell">Northcote Physio Group</td><td class="xs">30 new patients in 6 months</td><td class="xs">month 3 of 6</td>
      <td><div class="meter m-warn" style="height:8px"><i style="width:41%"></i></div></td>
      <td class="num"><b>12</b> / 15 by now</td><td><span class="pill p-warn">watch · 80%</span></td>
      <td><span class="btn btn-pri btn-sm">Boost plan</span></td>
    </tr>
    <tr style="background:var(--crit-tint)">
      <td class="main-cell">Preston Family Dental</td><td class="xs">25 new patients in 6 months</td><td class="xs">month 5 of 6</td>
      <td><div class="meter m-crit" style="height:8px"><i style="width:38%"></i></div></td>
      <td class="num"><b>9</b> / 21 by now</td><td><span class="pill p-crit">off track · 43%</span></td>
      <td><span class="btn btn-pri btn-sm">Remediation</span></td>
    </tr>
    <tr>
      <td class="main-cell">Trowse Chiropractic <span class="pill p-gray">renewal</span></td><td class="xs">Maintain 18:1 organic ROI</td><td class="xs">month 2 of 6</td>
      <td><div class="meter" style="height:8px"><i style="width:33%"></i></div></td>
      <td class="num"><b>19.4:1</b> current</td><td><span class="pill p-ok">on track</span></td>
      <td><span class="btn btn-ghost btn-sm">Detail</span></td>
    </tr>
    <tr>
      <td class="main-cell">Bayside Podiatry</td><td class="xs">35 enquiries/month by month 6</td><td class="xs">starts at launch (H4)</td>
      <td><div class="meter" style="height:8px;background:#EEF2F0"><i style="width:0%"></i></div></td>
      <td class="num faint">—</td><td><span class="pill p-gray">pending</span></td>
      <td><span class="btn btn-ghost btn-sm">Terms</span></td>
    </tr>
  </table>
  <div class="xs faint" style="margin-top:8px">Off-track fires: Wally save-plan brief · meeting cadence doubled · remediation actions tracked here until back over 70%. Guarantee terms are versioned per contract; the clock and the maths are never hand-edited.</div>
</div>
<div class="cols" style="margin-top:14px">
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Preston Family Dental · remediation</h2><span class="pill p-crit">active · week 2</span></div>
      <table class="t dense">
        <tr><td>1 · Ads restructure (Tier C, Wally approved 26 Jun)</td><td><span class="pill p-ok">done ✓</span></td></tr>
        <tr><td>2 · GBP reactivation + review pack refresh</td><td><span class="pill p-teal">in progress</span></td></tr>
        <tr><td>3 · Landing page rebuild from block library</td><td><span class="pill p-gray">queued</span></td></tr>
        <tr><td>4 · Fortnightly check-ins until month 6</td><td><span class="pill p-teal">scheduled</span></td></tr>
      </table>
    </div>
  </div>
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Why it's computed</h2></div>
      <div style="font-size:12.5px;color:var(--muted);line-height:1.6">The tracker reads the same enquiry and new-patient numbers the client confirms monthly (new-patient-reconciler) — the guarantee conversation is about <b style="color:var(--ink)">verified</b> numbers, not claims. When a clock is off-track, the promise, the gap and the remediation plan appear on the next meeting agenda automatically.</div>
    </div>
  </div>
</div>`;

export default [
  { id: 'prospects', title: 'Prospects', html: prospects },
  { id: 'reports', title: 'Reports', html: reports },
  { id: 'billing', title: 'Billing', html: billing },
  { id: 'guarantee', title: 'Guarantee Tracker', html: guarantee },
];
