import { lineChart } from './shell.mjs';

const googleAds = `
<div class="tiles">
  <div class="tile"><div class="lbl">Accounts linked (MCC)</div><div class="row"><div class="val">21</div><div class="delta d-flat">06:00 GAQL sync ✓</div></div></div>
  <div class="tile"><div class="lbl">Spend MTD</div><div class="row"><div class="val">$9.8<span class="unit">k</span></div><div class="delta d-flat">pacing 101%</div></div></div>
  <div class="tile"><div class="lbl">Portfolio CPL · 30d</div><div class="row"><div class="val">$41</div><div class="delta d-up">▼ $4 vs May</div></div></div>
  <div class="tile"><div class="lbl">Offline conversions · wk</div><div class="row"><div class="val">5</div><div class="delta d-up">rescued calls → bookings</div></div></div>
</div>
<div class="cols">
  <div class="col" style="flex:1.5">
    <div class="card">
      <div class="card-h"><h2>Accounts</h2><span class="hint">flag gates: tracking ✓ · seasonality ✓ · data completeness ✓ before any CPL flag</span><span class="link">All 21 →</span></div>
      <table class="t">
        <tr><th>Account</th><th class="num">Spend MTD</th><th>Pacing</th><th class="num">CPL / target</th><th class="num">Conv 30d</th><th class="num">Imp. share</th><th>Autonomy</th><th></th></tr>
        <tr style="background:var(--crit-tint)"><td class="main-cell">Yarra Hills Dental<div class="sub-cell">3 campaigns · Search</div></td><td class="num">$1,340</td><td><div class="meter m-crit" style="width:70px"><i style="width:64%"></i></div></td><td class="num" style="color:var(--crit);font-weight:650">$61 / $38</td><td class="num">22</td><td class="num">54%</td><td><span class="pill p-blue">Tier B</span></td><td><span class="btn btn-pri btn-sm">3 changes</span></td></tr>
        <tr><td class="main-cell">Smile Council<div class="sub-cell">4 campaigns · Search + PMax</div></td><td class="num">$1,610</td><td><div class="meter m-warn" style="width:70px"><i style="width:58%"></i></div></td><td class="num" style="color:var(--warn);font-weight:650">$49 / $38</td><td class="num">33</td><td class="num">61%</td><td><span class="pill p-blue">Tier B</span></td><td><span class="btn btn-ghost btn-sm">Watch d3/5</span></td></tr>
        <tr><td class="main-cell">Hearts Dental<div class="sub-cell">3 campaigns · Search</div></td><td class="num">$980</td><td><div class="meter m-ok" style="width:70px"><i style="width:52%"></i></div></td><td class="num" style="color:var(--ok);font-weight:650">$31 / $40</td><td class="num">32</td><td class="num">68%</td><td><span class="pill p-teal">Tier A+B</span></td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
        <tr><td class="main-cell">Trowse Chiropractic<div class="sub-cell">2 campaigns · Search</div></td><td class="num">$610</td><td><div class="meter m-ok" style="width:70px"><i style="width:49%"></i></div></td><td class="num" style="color:var(--ok);font-weight:650">$24 / $30</td><td class="num">25</td><td class="num">72%</td><td><span class="pill p-teal">Tier A+B</span></td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
        <tr><td class="main-cell">Northcote Physio Group<div class="sub-cell">2 campaigns · Search</div></td><td class="num">$540</td><td><div class="meter m-ok" style="width:70px"><i style="width:47%"></i></div></td><td class="num">$36 / $36</td><td class="num">15</td><td class="num">58%</td><td><span class="pill p-gray">Tier A</span></td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
      </table>
      <div class="xs faint" style="margin-top:8px">CPL flags: amber at target ×1.3 for 5 days · red at ×1.6 · Tier C (total budgets, new structures, &gt;25% moves) is <b>human forever</b> — caps enforced in the tool layer, not the prompt</div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Change-watch · Hearts budget shift</h2><span class="hint">executed 30 Jun · day 5 of 7 · auto-rollback armed</span><span class="pill p-ok">tracking prediction ✓</span></div>
      ${lineChart({ w: 700, h: 150, series: [38,36,35,33,32,31,31], dashed: [38,37,35,34,33,32,31], yLabels: ['$40','$34','$28'], xLabels: ['30 Jun','1 Jul','2 Jul','3 Jul','4 Jul','5 Jul','6 Jul'], endLabel: '$31 CPL' })}
      <div class="legend" style="margin-top:6px"><span class="k"><span class="ln" style="background:var(--series-1)"></span> actual CPL</span><span class="k"><span class="ln" style="background:var(--faint);height:0;border-top:2px dashed var(--faint)"></span> predicted</span><span style="margin-left:auto" class="xs faint">rollback snapshot #s-2214 · one budget change per campaign per 5–7 days</span></div>
    </div>
  </div>
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Recommendation queue</h2><span class="hint">validateOnly → execute → snapshot → watch</span></div>
      <div class="stack">
        <div class="flag f-crit">
          <div class="flag-top"><span class="who">Yarra Hills · Search — Implants</span><span class="pill p-crit">high risk</span><span class="gate g2">G2</span></div>
          <div class="flag-body">Shift $9/day from Implants to Emergency (−28% / +31%) — <b>&gt;25% = Tier C</b>, needs named human. Marginal CPL $84 vs $29. Dry-run ✓ passed.</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Approve as Wally</span><span class="btn btn-ghost btn-sm">Modify</span><span class="btn btn-crit btn-sm">Reject</span></div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">Yarra Hills · 14 negatives</span><span class="pill p-warn">med risk</span><span class="gate g2">G2</span></div>
          <div class="flag-body">Search terms classified off-intent ("dentures repair kit", "free implants"…). Spend saved est. $6/day. Batch dry-run ✓.</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Approve batch</span><span class="btn btn-ghost btn-sm">Review terms</span></div>
        </div>
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">Yarra Hills · bid target −12%</span><span class="pill p-ok">low risk</span><span class="gate g1">G1</span></div>
          <div class="flag-body">tCPA nudge within ±15% band, learning period clear. Auto-applies 12:00; visible here first.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">Hold</span><span class="xs faint" style="margin-left:auto">cooldown ✓ · last change 14d ago</span></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Google's own recommendations</h2></div>
      <div style="font-size:12.5px;color:var(--muted);line-height:1.55">Feed this week: <b style="color:var(--ink)">11 received · 9 dismissed via API</b> (broad-match expansions, budget raises). 2 adopted after review (sitelink assets). Our layer optimises for the client, not for Google.</div>
      <div class="flag-act" style="margin-top:8px"><span class="btn btn-ghost btn-sm">Review dismissals</span></div>
    </div>
  </div>
</div>`;

const seo = `
<div class="banner b-warn" style="margin-bottom:14px">▲ BrightLocal 05:30 sync — <b>14 of 15 clients synced.</b> Northcote Physio data is stale (48h); alerts suppressed for that client only.<span class="bx">Retry sync</span></div>
<div class="tiles">
  <div class="tile"><div class="lbl">Keywords tracked</div><div class="row"><div class="val">412</div><div class="delta d-flat">EN 348 · 中文 64</div></div></div>
  <div class="tile"><div class="lbl">Money keywords green</div><div class="row"><div class="val">87<span class="unit">%</span></div><div class="delta d-up">▲ 3pts vs June</div></div></div>
  <div class="tile"><div class="lbl">Drops in confirmation</div><div class="row"><div class="val">2</div><div class="delta d-flat">2-day rule holding</div></div></div>
  <div class="tile"><div class="lbl">Opportunities open</div><div class="row"><div class="val">5</div><div class="delta d-flat">3 on next agendas</div></div></div>
</div>
<div class="cols">
  <div class="col" style="flex:1.35">
    <div class="card">
      <div class="card-h"><h2>Drops</h2><span class="hint">diagnosis reads our own CMS deploy log first</span></div>
      <div class="stack">
        <div class="flag f-crit">
          <div class="flag-top"><span class="who">Hearts Dental · "dentist blackburn"</span><span class="pill p-crit">4 → 9 · confirmed</span><span class="when">day 2 of 2 ✓</span></div>
          <div class="flag-body"><b>seo-diagnose v2.3:</b> No CMS deploys in window ✓. GBP categories unchanged ✓. <b>Competitor (Blackburn Dental Hub) shipped a new service page + 12 reviews in 9 days.</b> Our page last touched 214 days ago; thinner FAQ block, no pricing section.</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Open fix plan (3 items)</span><span class="btn btn-ghost btn-sm">SERP snapshot</span><span class="xs faint" style="margin-left:auto">est. 11 leads/mo at stake</span></div>
        </div>
        <div class="flag f-crit">
          <div class="flag-top"><span class="who">Yarra Hills · "emergency dentist eltham"</span><span class="pill p-crit">3-pack exit</span><span class="when">immediate — no wait</span></div>
          <div class="flag-body">Money keyword + 3-pack exit <b>skips the 2-day wait</b>. GBP signal: primary category reverted after Google edit 4 Jul. Fix drafted: restore category + post.</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Apply GBP fix</span><span class="gate g2">G2</span><span class="btn btn-ghost btn-sm">GBP history</span></div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">Smile Council · "invisalign doncaster"</span><span class="pill p-warn">6 → 11 · unconfirmed</span><span class="when">day 1 of 2</span></div>
          <div class="flag-body">Single-keyword wobble, not a money keyword — holding for tomorrow's sync before diagnosing. No deploys, no GBP changes.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">Watch</span></div>
        </div>
      </div>
    </div>
  </div>
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Opportunities</h2><span class="hint">opportunity-writer v1.6 · page-2 cusp + gap scan</span></div>
      <div class="stack">
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">Trowse · "sciatica treatment preston"</span><span class="pill p-ok">#11 → cusp</span></div>
          <div class="flag-body">Page 2 with rising clicks. One content block + 2 internal links predicted to reach page 1. Effort: S.</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Queue content task</span></div>
        </div>
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">Hearts · "牙医 blackburn"</span><span class="pill p-ok">unranked · demand found</span></div>
          <div class="flag-body">Search demand in 中文 with zero local competition. Translated service page via Content Studio; glossary ready.</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Brief translator-zh</span></div>
        </div>
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">Smile Council · schema gap</span><span class="pill p-ok">quick win</span></div>
          <div class="flag-body">FAQ schema missing on 6 service pages; competitor shows rich results. schema-validator batch ready.</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Apply batch</span><span class="gate g1">G1</span></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Watchtower coverage</h2></div>
      <table class="t dense">
        <tr><td>Clients enrolled</td><td class="num">15</td></tr>
        <tr><td>"New site" mode (post-launch)</td><td class="num">2</td></tr>
        <tr><td>Rank checks this morning</td><td class="num">412</td></tr>
        <tr><td>Suppressed (stale data)</td><td class="num" style="color:var(--warn);font-weight:650">1 client</td></tr>
      </table>
    </div>
  </div>
</div>`;

const siteHealth = `
<div class="tiles">
  <div class="tile"><div class="lbl">Sites monitored</div><div class="row"><div class="val">24</div><div class="delta d-flat">checks every 60s</div></div></div>
  <div class="tile"><div class="lbl">Uptime · 30d</div><div class="row"><div class="val">99.97<span class="unit">%</span></div><div class="delta d-flat">13m total downtime</div></div></div>
  <div class="tile"><div class="lbl">SSL expiring ≤ 30d</div><div class="row"><div class="val">2</div><div class="delta d-flat">auto-renew scheduled</div></div></div>
  <div class="tile"><div class="lbl">Form canaries passing</div><div class="row"><div class="val">23<span class="unit">/24</span></div><div class="delta d-down">Hearts booking form ✗</div></div></div>
</div>
<div class="flag f-crit" style="margin-bottom:14px">
  <div class="flag-top"><span class="who">Hearts Dental — booking form canary failed</span><span class="pill p-crit">● failing since 06:12</span><span class="when">3 consecutive runs</span></div>
  <div class="flag-body">Canary submits a test booking every 24h — confirmation email not received within 90s. Form POST returns 200 but the notification hook times out. <b>Task #4183 assigned to Ish · P1.</b> Last human-verified submission: Fri 20:14.</div>
  <div class="flag-act"><span class="btn btn-pri btn-sm">Open task</span><span class="btn btn-ghost btn-sm">Run canary now</span><span class="btn btn-ghost btn-sm">Form logs</span><span class="xs faint" style="margin-left:auto">est. 3–5 enquiries/day at risk</span></div>
</div>
<div class="card">
  <div class="card-h"><h2>All sites</h2><span class="hint">uptime · SSL · Core Web Vitals · canary</span><span class="link">All 24 →</span></div>
  <table class="t">
    <tr><th>Site</th><th class="num">Uptime 30d</th><th class="num">Resp.</th><th class="num">SSL days</th><th>LCP</th><th>CLS</th><th>Canary</th><th>Last incident</th><th></th></tr>
    <tr style="background:var(--crit-tint)"><td class="main-cell">heartsdental.com.au</td><td class="num">99.98%</td><td class="num">412 ms</td><td class="num">64</td><td><span class="pill p-ok">2.1s</span></td><td><span class="pill p-ok">0.02</span></td><td><span class="pill p-crit">✗ 06:12</span></td><td class="xs">form hook timeout</td><td><span class="btn btn-pri btn-sm">Fix</span></td></tr>
    <tr><td class="main-cell">yarrahillsdental.com.au</td><td class="num">100%</td><td class="num">388 ms</td><td class="num">211</td><td><span class="pill p-ok">1.9s</span></td><td><span class="pill p-ok">0.01</span></td><td><span class="pill p-ok">✓ 05:40</span></td><td class="xs faint">—</td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
    <tr><td class="main-cell">smilecouncil.com.au</td><td class="num">99.99%</td><td class="num">421 ms</td><td class="num"><span style="color:var(--warn);font-weight:650">21</span></td><td><span class="pill p-ok">2.3s</span></td><td><span class="pill p-ok">0.03</span></td><td><span class="pill p-ok">✓ 05:41</span></td><td class="xs">SSL renews 12 Jul</td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
    <tr><td class="main-cell">trowsechiro.com.au</td><td class="num">100%</td><td class="num">352 ms</td><td class="num">148</td><td><span class="pill p-ok">1.7s</span></td><td><span class="pill p-ok">0.01</span></td><td><span class="pill p-ok">✓ 05:42</span></td><td class="xs faint">—</td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
    <tr><td class="main-cell">northcotephysio.com.au</td><td class="num">99.91%</td><td class="num">640 ms</td><td class="num">92</td><td><span class="pill p-warn">2.9s</span></td><td><span class="pill p-ok">0.04</span></td><td><span class="pill p-ok">✓ 05:44</span></td><td class="xs">4m outage 28 Jun</td><td><span class="btn btn-ghost btn-sm">Perf plan</span></td></tr>
    <tr><td class="main-cell">prestonfamilydental.com.au</td><td class="num">100%</td><td class="num">401 ms</td><td class="num"><span style="color:var(--warn);font-weight:650">28</span></td><td><span class="pill p-ok">2.2s</span></td><td><span class="pill p-warn">0.11</span></td><td><span class="pill p-ok">✓ 05:45</span></td><td class="xs">CLS from promo banner</td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
    <tr><td class="main-cell">smiletogo.com.au <span class="pill p-blue">staging</span></td><td class="num faint">—</td><td class="num">318 ms</td><td class="num">339</td><td><span class="pill p-ok">1.6s</span></td><td><span class="pill p-ok">0.00</span></td><td class="faint xs">enrols at launch</td><td class="xs faint">—</td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
  </table>
  <div class="xs faint" style="margin-top:8px">Showing 7 of 24 · WordPress-era sites carry an extra plugin-vulnerability scan until W8 migration</div>
</div>`;

const calendar = `
<style>
.cal { display:grid; grid-template-columns:repeat(7,1fr); border:1px solid var(--line); border-radius:10px; overflow:hidden; background:var(--line); gap:1px; }
.cal .dh { background:var(--surface); padding:6px 8px; font-size:10px; font-weight:600; letter-spacing:.07em; text-transform:uppercase; color:var(--faint); }
.cal .d { background:var(--surface); min-height:88px; padding:5px 6px; font-size:11px; }
.cal .d .dn { font-size:10.5px; color:var(--muted); font-variant-numeric:tabular-nums; margin-bottom:3px; font-weight:600; }
.cal .d.out { background:#FAFBFB; } .cal .d.out .dn { color:#C2CCC9; }
.cal .d.today { box-shadow: inset 0 0 0 2px var(--accent); } .cal .d.today .dn { color:var(--accent); }
.ev { display:block; font-size:10px; font-weight:600; border-radius:4px; padding:1px 5px; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ev-pub { background:var(--accent-tint); color:var(--accent); }
.ev-soc { background:var(--blue-tint); color:var(--blue); }
.ev-rep { background:#EEF2F0; color:var(--muted); }
.ev-meet { background:var(--warn-tint); color:var(--warn); }
.ev-seas { background:none; border:1px dashed #C9D4D0; color:var(--muted); font-weight:500; }
</style>
<div class="page-head" style="margin-bottom:10px">
  <h1>July 2026</h1><span class="sub">publishes · posts · reports · meetings · seasonal</span>
  <div class="actions">
    <div class="legend"><span class="k"><span class="sw" style="background:var(--accent-tint);border:1px solid var(--accent)"></span> publish</span><span class="k"><span class="sw" style="background:var(--blue-tint);border:1px solid var(--blue)"></span> GBP/social</span><span class="k"><span class="sw" style="background:var(--warn-tint);border:1px solid var(--warn)"></span> meeting</span><span class="k"><span class="sw" style="background:#EEF2F0;border:1px solid var(--faint)"></span> report</span><span class="k"><span class="sw" style="border:1px dashed #C9D4D0"></span> seasonal</span></div>
    <span class="btn btn-ghost btn-sm">‹ June</span><span class="btn btn-ghost btn-sm">August ›</span>
  </div>
</div>
<div class="cal">
  <div class="dh">Mon</div><div class="dh">Tue</div><div class="dh">Wed</div><div class="dh">Thu</div><div class="dh">Fri</div><div class="dh">Sat</div><div class="dh">Sun</div>
  <div class="d out"><div class="dn">29</div></div>
  <div class="d out"><div class="dn">30</div></div>
  <div class="d"><div class="dn">1</div><span class="ev ev-seas">School holidays → 12 Jul</span><span class="ev ev-soc">GBP posts ×4</span></div>
  <div class="d"><div class="dn">2</div><span class="ev ev-rep">June data close</span></div>
  <div class="d"><div class="dn">3</div><span class="ev ev-meet">Hearts monthly</span></div>
  <div class="d"><div class="dn">4</div></div>
  <div class="d"><div class="dn">5</div></div>
  <div class="d today"><div class="dn">6 · today</div><span class="ev ev-rep">Reports batch 18/23</span></div>
  <div class="d"><div class="dn">7</div><span class="ev ev-meet">Preston save call</span><span class="ev ev-soc">GBP posts ×3</span></div>
  <div class="d"><div class="dn">8</div><span class="ev ev-meet">Yarra Hills QBR</span><span class="ev ev-rep">Reports batch 2</span></div>
  <div class="d"><div class="dn">9</div><span class="ev ev-meet">Hearts monthly</span></div>
  <div class="d"><div class="dn">10</div><span class="ev ev-meet">Aspire One kickoff</span></div>
  <div class="d"><div class="dn">11</div></div>
  <div class="d"><div class="dn">12</div><span class="ev ev-seas">Holidays end</span></div>
  <div class="d"><div class="dn">13</div><span class="ev ev-pub">Trowse sciatica page</span></div>
  <div class="d"><div class="dn">14</div><span class="ev ev-soc">GBP posts ×4</span></div>
  <div class="d"><div class="dn">15</div><span class="ev ev-meet">Smile Council monthly</span><span class="ev ev-rep">Invoice run</span></div>
  <div class="d"><div class="dn">16</div><span class="ev ev-pub">Smile Council schema batch</span></div>
  <div class="d"><div class="dn">17</div></div>
  <div class="d"><div class="dn">18</div></div>
  <div class="d"><div class="dn">19</div></div>
  <div class="d"><div class="dn">20</div><span class="ev ev-pub">Hearts team page live</span><span class="ev ev-soc">Open-day post</span></div>
  <div class="d"><div class="dn">21</div><span class="ev ev-meet">Northcote monthly</span></div>
  <div class="d"><div class="dn">22</div><span class="ev ev-soc">GBP posts ×4</span></div>
  <div class="d"><div class="dn">23</div><span class="ev ev-pub">Smile To Go build-out</span></div>
  <div class="d"><div class="dn">24</div><span class="ev ev-meet">Trowse QBR</span></div>
  <div class="d"><div class="dn">25</div></div>
  <div class="d"><div class="dn">26</div></div>
  <div class="d"><div class="dn">27</div><span class="ev ev-seas">Dental Health Week prep</span></div>
  <div class="d"><div class="dn">28</div><span class="ev ev-rep">July reports prep</span></div>
  <div class="d"><div class="dn">29</div><span class="ev ev-soc">GBP posts ×4</span></div>
  <div class="d"><div class="dn">30</div></div>
  <div class="d"><div class="dn">31</div><span class="ev ev-rep">Invoice run · dunning</span></div>
  <div class="d out"><div class="dn">1</div><span class="ev ev-pub">Hearts Sat hours ×14 surfaces</span></div>
  <div class="d out"><div class="dn">2</div></div>
</div>
<div class="xs faint" style="margin-top:10px">season-planner v1.1 drafts campaign windows from practice type + VIC calendar — Dental Health Week (3–9 Aug) briefs due 27 Jul</div>`;

export default [
  { id: 'google-ads', title: 'Google Ads', html: googleAds },
  { id: 'seo-watchtower', title: 'SEO Watchtower', html: seo },
  { id: 'site-health', title: 'Site Health', html: siteHealth },
  { id: 'calendar', title: 'Calendar', html: calendar },
];
