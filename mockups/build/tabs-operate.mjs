import { spark } from './shell.mjs';

const today = `
<div class="tiles">
  <div class="tile"><div class="lbl">Open flags</div><div class="row"><div class="val">7</div><div class="delta d-down">▲ 2 vs Friday</div></div></div>
  <div class="tile"><div class="lbl">Approvals waiting</div><div class="row"><div class="val">5</div><div class="delta d-flat">oldest 3h 10m</div></div></div>
  <div class="tile"><div class="lbl">SLA at risk</div><div class="row"><div class="val">2</div><div class="delta d-flat">both due today</div></div></div>
  <div class="tile"><div class="lbl">Calls rescued this week</div><div class="row"><div class="val">12</div>${spark([4,6,5,8,7,9,8,10,9,11,10,12])}</div></div>
</div>
<div class="cols">
  <div class="col" style="flex:1.45">
    <div class="card">
      <div class="card-h"><h2>Flags</h2><span class="hint">ranked by flag-ranker v2.1 · severity × age × client health</span><span class="link">View all 7 →</span></div>
      <div class="stack">
        <div class="flag f-crit">
          <div class="flag-top"><span class="who">Yarra Hills Dental</span><span class="pill p-gray">Google Ads</span><span class="pill p-crit">● CPL red</span><span class="when">5 days running</span></div>
          <div class="flag-body">CPL <b>$61</b> vs target <b>$38</b> (×1.6) on Search — Implants. Tracking health ✓, seasonality ✓, data complete ✓. <b>ads-optimiser v1.4</b> drafted 3 changes (2× Tier B, 1× Tier A).</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Review 3 changes</span><span class="btn btn-ghost btn-sm">Open account</span><span class="xs faint" style="margin-left:auto">predicted CPL after fix: $42</span></div>
        </div>
        <div class="flag f-crit">
          <div class="flag-top"><span class="who">Preston Family Dental</span><span class="pill p-gray">Lifecycle</span><span class="pill p-crit">● At-risk</span><span class="when">since 06:00</span></div>
          <div class="flag-body">Health dropped <b>47 → 39</b> (report unopened 2 months, invoice 32d unpaid, sentiment ↓). G1 privileges suspended for this client. Save-plan brief drafted — <b>Wally only</b> <span class="gate g3">G3</span></div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Open save-plan brief</span><span class="btn btn-ghost btn-sm">Timeline</span></div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">Hearts Dental</span><span class="pill p-gray">Site Health</span><span class="pill p-warn">▲ Canary fail</span><span class="when">06:12</span></div>
          <div class="flag-body">Booking-form canary failed (no confirmation email in 90s). Task <b>#4183</b> created and assigned to Ish. Form was passing at 05:12.</div>
          <div class="flag-act"><span class="btn btn-soft btn-sm">View task</span><span class="btn btn-ghost btn-sm">Run canary again</span></div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">Smile Council</span><span class="pill p-gray">SEO</span><span class="pill p-warn">▲ Keyword wobble</span><span class="when">05:30 sync</span></div>
          <div class="flag-body">"invisalign doncaster" <b>6 → 11</b>. Not a money keyword — holding for 2-day confirmation (day 1 of 2). No CMS deploys in window.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">Watch</span><span class="xs faint" style="margin-left:auto">auto-diagnoses if confirmed tomorrow</span></div>
        </div>
        <div class="flag f-info">
          <div class="flag-top"><span class="who">Smile To Go</span><span class="pill p-gray">Factory · Stage 5</span><span class="pill p-blue">Awaiting choice</span><span class="when">2 days</span></div>
          <div class="flag-body">Concept gallery viewed <b>2×</b> (Dr Nguyen, 9 min total) — no concept chosen yet. Chase #1 scheduled tomorrow 09:00.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">Preview chase email</span><span class="btn btn-ghost btn-sm">Open gallery</span></div>
        </div>
      </div>
    </div>
  </div>
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Approval queue</h2><span class="hint">5 waiting</span><span class="link">Open queue →</span></div>
      <div class="stack">
        <div class="flag f-warn">
          <div class="flag-top"><span class="gate g2">G2</span><span class="who">RSA copy · Yarra Hills</span><span class="when">3h 10m</span></div>
          <div class="flag-body">2 new headlines for Search — Implants. <span class="pill p-ok">✓ AHPRA passed</span> <span class="pill p-gray">ad-copy-writer v2.0</span></div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Approve</span><span class="btn btn-ghost btn-sm">Edit</span><span class="btn btn-crit btn-sm">Reject</span></div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="gate g2">G2</span><span class="who">Review reply · Hearts Dental</span><span class="when">1h 40m</span></div>
          <div class="flag-body">1★ Google review (billing dispute). Drafted apology + offline invite — no clinical detail, no admission. <span class="pill p-ok">✓ AHPRA passed</span></div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Approve &amp; post</span><span class="btn btn-ghost btn-sm">Edit</span></div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="gate g2">G2</span><span class="who">Budget shift · Smile Council</span><span class="when">55m</span></div>
          <div class="flag-body">+18% to Search — Whitening ($27/day → $32/day). <span class="pill p-blue">Tier B · within cap</span> Marginal CPL supports it; impression share lost to budget 31%.</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Approve</span><span class="btn btn-ghost btn-sm">Details</span><span class="xs faint" style="margin-left:auto">total budget unchanged</span></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Morning briefing</h2><span class="hint">daily-briefing-writer v1.2 · 06:05</span></div>
      <div style="font-size:12.5px; line-height:1.6; color:var(--muted)">
        Quiet weekend — <b style="color:var(--ink)">31 calls</b>, 4 after-hours rescued (2 booked). The <b style="color:var(--ink)">Yarra Hills CPL flag</b> is now the oldest red item; the drafted fix has sat 3 hours. Preston Family Dental tipped into <b style="color:var(--ink)">at-risk</b> overnight — brief is ready before your 11:00. June reports: 18 of 23 generated, 3 waiting on BrightLocal, 2 in review. One canary failure at Hearts (task assigned). Nothing waiting on a client today except Smile To Go's concept choice.
      </div>
    </div>
  </div>
</div>`;

const clients = `
<div class="tiles">
  <div class="tile"><div class="lbl">Active clients</div><div class="row"><div class="val">23</div><div class="delta d-up">▲ 2 this quarter</div></div></div>
  <div class="tile"><div class="lbl">Average health</div><div class="row"><div class="val">74</div><div class="delta d-flat">median 77</div></div></div>
  <div class="tile"><div class="lbl">MRR</div><div class="row"><div class="val">$61.4<span class="unit">k</span></div><div class="delta d-up">▲ $3.1k vs June</div></div></div>
  <div class="tile"><div class="lbl">At-risk</div><div class="row"><div class="val">2</div><div class="delta d-down">▲ 1 overnight</div></div></div>
</div>
<div class="card">
  <div class="card-h"><h2>Portfolio</h2><span class="hint">health is computed nightly — 35% KPI · 20% flags · 15% engagement · 10% SLA · 10% sentiment · 10% billing — annotate, never override</span>
    <span class="link">+ Add client</span></div>
  <table class="t">
    <tr><th>Practice</th><th>Type</th><th>Phase</th><th>Health</th><th class="num">MRR</th><th class="num">Flags</th><th>Last report</th><th>Next meeting</th><th></th></tr>
    <tr><td class="main-cell">Trowse Chiropractic<div class="sub-cell">Preston VIC · since 2022</div></td><td>Chiro</td><td><span class="pill p-teal">Operate</span></td><td><span class="dot dk-ok"></span> <b>88</b></td><td class="num">$1,950</td><td class="num">1</td><td>Jun · opened ✓</td><td>QBR · 24 Jul</td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
    <tr><td class="main-cell">Hearts Dental<div class="sub-cell">Blackburn VIC · since 2021</div></td><td>Dental</td><td><span class="pill p-teal">Operate</span></td><td><span class="dot dk-ok"></span> <b>82</b></td><td class="num">$2,400</td><td class="num">2</td><td>Jun · opened ✓</td><td>Monthly · 9 Jul</td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
    <tr><td class="main-cell">Smile Council<div class="sub-cell">Doncaster East VIC · since 2023</div></td><td>Dental</td><td><span class="pill p-teal">Operate</span></td><td><span class="dot dk-ok"></span> <b>77</b></td><td class="num">$2,900</td><td class="num">1</td><td>Jun · opened ✓</td><td>Monthly · 15 Jul</td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
    <tr><td class="main-cell">Northcote Physio Group<div class="sub-cell">Northcote VIC · since 2024</div></td><td>Physio</td><td><span class="pill p-teal">Operate</span></td><td><span class="dot dk-warn"></span> <b>71</b></td><td class="num">$1,700</td><td class="num">0</td><td>Jun · unopened</td><td>Monthly · 21 Jul</td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
    <tr><td class="main-cell">Yarra Hills Dental<div class="sub-cell">Eltham VIC · since 2024 · guarantee month 4/6</div></td><td>Dental</td><td><span class="pill p-teal">Operate</span></td><td><span class="dot dk-warn"></span> <b>58</b></td><td class="num">$3,200</td><td class="num">2</td><td>Jun · opened ✓</td><td>QBR · 8 Jul</td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
    <tr><td class="main-cell">Preston Family Dental<div class="sub-cell">Preston VIC · since 2023 · save-plan drafted</div></td><td>Dental</td><td><span class="pill p-crit">At-risk</span></td><td><span class="dot dk-crit"></span> <b>39</b></td><td class="num">$2,100</td><td class="num">1</td><td>May · unopened</td><td>Save call · 7 Jul</td><td><span class="btn btn-pri btn-sm">Save plan</span></td></tr>
    <tr><td class="main-cell">Smile To Go<div class="sub-cell">Glen Waverley VIC · deposit 22 Jun</div></td><td>Dental</td><td><span class="pill p-blue">Build · Stage 5</span></td><td><span class="dot dk-gray"></span> <span class="faint">—</span></td><td class="num">$0</td><td class="num">1</td><td class="faint">—</td><td class="faint">awaiting concept choice</td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
    <tr><td class="main-cell">Aspire One Physio<div class="sub-cell">Box Hill VIC · deposit 1 Jul</div></td><td>Physio</td><td><span class="pill p-blue">Build · Stage 2</span></td><td><span class="dot dk-gray"></span> <span class="faint">—</span></td><td class="num">$0</td><td class="num">0</td><td class="faint">—</td><td>Kickoff · 10 Jul</td><td><span class="btn btn-ghost btn-sm">Open</span></td></tr>
  </table>
  <div class="xs faint" style="margin-top:8px">Showing 8 of 23 · sorted by health · <span style="color:var(--accent);font-weight:600">j/k</span> to move · <span style="color:var(--accent);font-weight:600">Enter</span> to open</div>
</div>`;

const inbox = `
<div class="tiles">
  <div class="tile"><div class="lbl">New today</div><div class="row"><div class="val">9</div><div class="delta d-flat">support@2080…</div></div></div>
  <div class="tile"><div class="lbl">Auto-triaged (≥0.8)</div><div class="row"><div class="val">7</div><div class="delta d-up">78% of inbound</div></div></div>
  <div class="tile"><div class="lbl">Human queue</div><div class="row"><div class="val">1</div><div class="delta d-flat">confidence 0.64</div></div></div>
  <div class="tile"><div class="lbl">SLA breaches this week</div><div class="row"><div class="val">0</div><div class="delta d-up">zero-loss audit ✓ Fri</div></div></div>
</div>
<div class="cols">
  <div class="col" style="flex:1.05">
    <div class="card" style="padding:8px 10px">
      <table class="t dense">
        <tr><th>From / subject</th><th>Triage</th><th>SLA</th></tr>
        <tr style="background:var(--accent-tint)"><td class="main-cell">Sarah Chen · Hearts Dental<div class="sub-cell">New hygienist starting — bio + Saturday hours</div></td><td><span class="pill p-teal">2 requests</span><div class="xs faint" style="margin-top:2px">conf 0.93 · split</div></td><td class="xs">ack drafted<div class="faint">due 12:00</div></td></tr>
        <tr><td class="main-cell">Dr M. Osei · Smile Council<div class="sub-cell">Can we swap the hero photo before the open day?</div></td><td><span class="pill p-teal">Content edit</span><div class="xs faint" style="margin-top:2px">conf 0.91 · task #4180</div></td><td class="xs">ack sent ✓<div class="faint">due tomorrow</div></td></tr>
        <tr><td class="main-cell">reception@yarrahillsdental<div class="sub-cell">Phone AI said we open at 8 — we open 8:30 Fridays</div></td><td><span class="pill p-blue">FAQ correction</span><div class="xs faint" style="margin-top:2px">conf 0.88 · profile edit G2</div></td><td class="xs">queued<div class="faint">due 15:00</div></td></tr>
        <tr><td class="main-cell" style="color:var(--crit)">B. Fitzgerald (patient)<div class="sub-cell" style="color:var(--crit)">Extremely unhappy with billing — considering leaving</div></td><td><span class="pill p-crit">Complaint</span><div class="xs" style="margin-top:2px;color:var(--crit)">→ Wally direct · <b>no AI ack</b> <span class="gate g3">G3</span></div></td><td class="xs">P1<div class="faint">09:12</div></td></tr>
        <tr><td class="main-cell">Praktika Support<div class="sub-cell">Re: API sandbox credentials for booking pilot</div></td><td><span class="pill p-gray">Vendor</span><div class="xs faint" style="margin-top:2px">conf 0.85 · filed</div></td><td class="xs faint">—</td></tr>
        <tr><td class="main-cell">unknown@gmail.com<div class="sub-cell">"Hi, do you build websites for vets?"</div></td><td><span class="pill p-blue">→ Prospect flow</span><div class="xs faint" style="margin-top:2px">unknown domain · deal created</div></td><td class="xs">nurture<div class="faint">audit queued</div></td></tr>
      </table>
    </div>
  </div>
  <div class="col" style="flex:1.35">
    <div class="card">
      <div class="card-h"><h2>Hearts Dental — "New hygienist starting — bio + Saturday hours"</h2><span class="pill p-teal">email-triage v3.1</span></div>
      <div style="font-size:12.5px;color:var(--muted);line-height:1.55;border:1px solid var(--grid);border-radius:8px;padding:10px 12px;background:var(--bg)">
        Hi team — two things. Our new hygienist <b style="color:var(--ink)">Priya Sharma</b> starts on the 20th, can you add her to the team page? Photo attached, AHDA registered. Also from <b style="color:var(--ink)">1 August we're opening Saturdays 9–1</b> — website, Google and the phone thing all need to know. Thanks! — Sarah
      </div>
      <div class="sec-lbl" style="margin-top:12px">Split into 2 requests · both mapped, zero-loss ✓</div>
      <div class="stack">
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">1 · Team page update — add hygienist bio</span><span class="pill p-gray">task #4181 · Ish</span><span class="when">SLA 3 days</span></div>
          <div class="flag-body">Photo validated (2400px ✓). Bio drafted from AHPRA register + email. <b>Chase scheduled +3d</b> if qualifications not confirmed.</div>
        </div>
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">2 · Saturday hours from 1 Aug</span><span class="pill p-gray">→ CMS change set</span><span class="when">scheduled</span></div>
          <div class="flag-body">propagation-mapper: <b>14 surfaces</b> — hours page, footer ×11, schema, GBP. Phone AI FAQ pack updated same moment. Scheduled for 1 Aug 00:01.</div>
        </div>
      </div>
      <div class="sec-lbl" style="margin-top:12px">Drafted acknowledgement <span class="gate g1" style="margin-left:4px">G1</span> <span class="xs faint" style="text-transform:none;letter-spacing:0">auto-sends 12:00 unless edited</span></div>
      <div style="font-size:12.5px;line-height:1.55;border:1px solid var(--grid);border-radius:8px;padding:10px 12px">
        Hi Sarah — welcome Priya! We'll have her on the team page before the 20th (we'll confirm her AHPRA details as standard). Saturday hours are scheduled to go live everywhere — site, Google profile and phone — at midnight on 1 August, so nothing shows early. You'll get a confirmation for each. — 20-80 team
      </div>
      <div class="flag-act" style="margin-top:10px"><span class="btn btn-pri btn-sm">Send now</span><span class="btn btn-ghost btn-sm">Edit</span><span class="btn btn-ghost btn-sm">Hold</span><span class="xs faint" style="margin-left:auto">reply-drafter v2.4 · logged run #88121</span></div>
    </div>
  </div>
</div>`;

const receptionists = `
<div class="tiles">
  <div class="tile"><div class="lbl">Lines live</div><div class="row"><div class="val">22<span class="unit">/23</span></div><div class="delta d-down">1 outage — fallback on</div></div></div>
  <div class="tile"><div class="lbl">Calls today</div><div class="row"><div class="val">147</div>${spark([9,14,22,31,38,47,61,78,96,113,131,147])}</div></div>
  <div class="tile"><div class="lbl">After-hours rescued · wk</div><div class="row"><div class="val">12</div><div class="delta d-up">5 became bookings</div></div></div>
  <div class="tile"><div class="lbl">Low-confidence review</div><div class="row"><div class="val">3</div><div class="delta d-flat">&lt; 0.70 threshold</div></div></div>
</div>
<div class="cols">
  <div class="col" style="flex:1.5">
    <div class="card">
      <div class="card-h"><h2>Fleet</h2><span class="hint">spam excluded from all stats</span><span class="link">Configure lines →</span></div>
      <div class="grid2">
        <div class="flag f-crit">
          <div class="flag-top"><span class="who">Trowse Chiropractic</span><span class="pill p-crit">● Outage 08:51</span><span class="when">carrier</span></div>
          <div class="flag-body">Ordinary <b>voicemail fallback active</b> — callers hear the practice's own greeting, nothing AI. Recordings transcribe on recovery. Agency alerted; <b>client not alerted</b> (per playbook).</div>
          <div class="flag-act"><span class="btn btn-crit btn-sm">Escalate to carrier</span><span class="btn btn-ghost btn-sm">Status page</span></div>
        </div>
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">Hearts Dental</span><span class="pill p-ok">● Live</span><span class="when">EN · 中文</span></div>
          <div class="flag-body">Today <b>31 calls</b> · 27 AI-handled (87%) · avg conf 0.86 · 4 to front desk. 中文 calls: 6. Last: recall booking confirmed 09:31.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">Transcripts</span><span class="btn btn-ghost btn-sm">FAQ pack v12</span></div>
        </div>
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">Yarra Hills Dental</span><span class="pill p-ok">● Live</span><span class="when">EN</span></div>
          <div class="flag-body">Today <b>24 calls</b> · 21 AI-handled (88%) · avg conf 0.84. 1 emergency keyword → practice script read, P1 SMS sent 08:58, front desk confirmed.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">Transcripts</span><span class="btn btn-ghost btn-sm">Emergency log</span></div>
        </div>
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">Smile Council</span><span class="pill p-ok">● Live</span><span class="when">EN · 中文</span></div>
          <div class="flag-body">Today <b>19 calls</b> · 16 AI-handled (84%) · avg conf 0.88. Insurance FAQs ×5 answered from practice profile — 2 "reception will confirm" handoffs.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">Transcripts</span><span class="btn btn-ghost btn-sm">FAQ pack v9</span></div>
        </div>
      </div>
      <div class="xs faint" style="margin-top:10px">19 more lines healthy · fleet answer rate 7-day: <b style="color:var(--ink)">99.2%</b> · never clinical advice — hard rule, 0 violations in QA sample</div>
    </div>
  </div>
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Needs a human ear</h2><span class="hint">confidence &lt; 0.70</span></div>
      <div class="stack">
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">Mrs Lin → Hearts Dental</span><span class="pill p-gray zh">中文</span><span class="when">Sat 14:22</span></div>
          <div class="flag-body">Asked about <b>Bupa cover for a crown</b>. FAQ answered from profile; booking preference unclear → follow-up SMS sent (both languages), <b>front-desk follow-up item created</b>. Conf <b>0.64</b>.</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">▶ Listen to recording</span><span class="btn btn-ghost btn-sm">Transcript</span></div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">Caller → Northcote Physio</span><span class="pill p-gray">EN</span><span class="when">Sun 19:05</span></div>
          <div class="flag-body">WorkCover claim question mid-call became a reschedule. Handled, but intent switched twice. Conf <b>0.61</b>.</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">▶ Listen to recording</span></div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">Caller → Smile Council</span><span class="pill p-gray">EN</span><span class="when">Fri 17:44</span></div>
          <div class="flag-body">Price of "the invisible braces thing" — quoted from-price per profile, asked reception to confirm. Conf <b>0.68</b>.</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">▶ Listen to recording</span></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>QA sample · week 27</h2><span class="hint">call-qa-sampler v1.3</span></div>
      <table class="t dense">
        <tr><td>Calls sampled</td><td class="num">40</td></tr>
        <tr><td>Correct handling</td><td class="num"><b>38</b> · 95.0%</td></tr>
        <tr><td>Tone flags</td><td class="num">1</td></tr>
        <tr><td>Escalation misses</td><td class="num">1 <span class="xs faint">→ precision-ledger</span></td></tr>
      </table>
    </div>
  </div>
</div>`;

const meetings = `
<div class="tiles">
  <div class="tile"><div class="lbl">Meetings this week</div><div class="row"><div class="val">6</div><div class="delta d-flat">3 agendas ready</div></div></div>
  <div class="tile"><div class="lbl">Open actions</div><div class="row"><div class="val">14</div><div class="delta d-flat">ours 9 · theirs 5</div></div></div>
  <div class="tile"><div class="lbl">Chases scheduled</div><div class="row"><div class="val">3</div><div class="delta d-flat">"theirs" +5d rule</div></div></div>
  <div class="tile"><div class="lbl">Fathom captured · 30d</div><div class="row"><div class="val">21</div><div class="delta d-up">100% of held meetings</div></div></div>
</div>
<div class="cols">
  <div class="col" style="flex:1.2">
    <div class="card">
      <div class="card-h"><h2>This week</h2><span class="hint">agendas pre-built from open flags</span></div>
      <div class="stack">
        <div class="flag f-info">
          <div class="flag-top"><span class="who">Yarra Hills Dental — QBR</span><span class="pill p-blue">Wed 8 Jul · 10:00</span><span class="when">Wally + Hamza</span></div>
          <div class="flag-body"><b>Agenda (agenda-builder v1.8):</b> 1 · CPL recovery plan — 3 drafted changes 2 · Offline conversions: 5 rescued bookings uploaded 3 · Guarantee month 4 of 6 — tracking 92% 4 · Their action: GBP photos (chased ×1)</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Open brief pack</span><span class="btn btn-ghost btn-sm">Edit agenda</span></div>
        </div>
        <div class="flag f-info">
          <div class="flag-top"><span class="who">Hearts Dental — monthly</span><span class="pill p-blue">Thu 9 Jul · 14:30</span><span class="when">Hamza</span></div>
          <div class="flag-body"><b>Agenda:</b> 1 · June report walkthrough (16.2:1 ROI) 2 · New hygienist page going live 20 Jul 3 · Saturday hours — everything scheduled 1 Aug 4 · Review-response precision now 96% — propose G2 → G1</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Open brief pack</span><span class="btn btn-ghost btn-sm">Edit agenda</span></div>
        </div>
        <div class="flag f-crit">
          <div class="flag-top"><span class="who">Preston Family Dental — save call</span><span class="pill p-crit">Tue 7 Jul · 11:00</span><span class="when">Wally only <span class="gate g3">G3</span></span></div>
          <div class="flag-body">Save-plan brief: root causes (2 unopened reports, billing friction, no meeting since April), 3 concessions pre-costed, cadence doubles to fortnightly on acceptance.</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Open save plan</span></div>
        </div>
      </div>
    </div>
  </div>
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Last meeting — extracted</h2><span class="hint">meeting-summariser v2.2 · Fathom</span></div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px"><b style="color:var(--ink)">Hearts Dental · monthly · Fri 3 Jul</b> — 41 min · summary sent to client ✓ · 5 actions extracted, <b>1 deduped</b> against open flag #2291 (linked, no duplicate task)</div>
      <table class="t dense">
        <tr><th>Action</th><th>Owner</th><th>Due</th></tr>
        <tr><td>Send Priya's AHPRA registration number</td><td><span class="pill p-warn">theirs</span></td><td class="xs">10 Jul · <b>chase +5d ✓</b></td></tr>
        <tr><td>Draft open-day GBP post</td><td><span class="pill p-teal">ours</span></td><td class="xs">8 Jul · task #4177</td></tr>
        <tr><td>Whitening page — add finance option</td><td><span class="pill p-teal">ours</span></td><td class="xs">11 Jul · task #4178</td></tr>
        <tr><td>Confirm Saturday roster with team</td><td><span class="pill p-warn">theirs</span></td><td class="xs">15 Jul · chase set</td></tr>
        <tr><td class="faint">Investigate slow booking form <span class="pill p-gray">→ linked #2291</span></td><td><span class="pill p-teal">ours</span></td><td class="xs faint">already open</td></tr>
      </table>
      <div class="flag-act" style="margin-top:8px"><span class="btn btn-ghost btn-sm">Full summary</span><span class="btn btn-ghost btn-sm">Recording 41:12</span></div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Client agenda input</h2><span class="hint">from portal · auto-merged</span></div>
      <div class="flag f-ok" >
        <div class="flag-top"><span class="who">Smile Council</span><span class="when">added Sun via portal</span></div>
        <div class="flag-body">"Can we talk about the open-day promotion budget?" — merged into 15 Jul agenda, upsell brief attached (opportunity: Display remarketing headroom).</div>
      </div>
    </div>
  </div>
</div>`;

export default [
  { id: 'today', title: 'Today', html: today },
  { id: 'clients', title: 'Clients', html: clients },
  { id: 'inbox', title: 'Inbox — support@', html: inbox },
  { id: 'receptionists', title: 'Receptionists', html: receptionists },
  { id: 'meetings', title: 'Meetings', html: meetings },
];
