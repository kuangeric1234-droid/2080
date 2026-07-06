const factory = `
<div class="tiles">
  <div class="tile"><div class="lbl">Builds in flight</div><div class="row"><div class="val">3</div><div class="delta d-flat">capacity 6</div></div></div>
  <div class="tile"><div class="lbl">Deposit → launch · median</div><div class="row"><div class="val">15<span class="unit">days</span></div><div class="delta d-up">target ≤ 15 ✓</div></div></div>
  <div class="tile"><div class="lbl">Human decisions pending</div><div class="row"><div class="val">2</div><div class="delta d-flat">H1 · H5</div></div></div>
  <div class="tile"><div class="lbl">First-mock SLA (48h)</div><div class="row"><div class="val">100<span class="unit">%</span></div><div class="delta d-up">last 8 builds</div></div></div>
</div>
<div class="card" style="margin-bottom:14px">
  <div class="card-h"><h2>Builds in flight</h2><span class="hint">8 stages · 24 skills · 5 human decisions (H1 kickoff PRD · H2 design briefs · H3 concept kill-review · H4 launch · H5 Ads enable)</span></div>
  <table class="t">
    <tr><th>Client</th><th>Stage</th><th style="width:190px">Progress</th><th>Current step</th><th>Waiting on</th><th>SLA</th><th></th></tr>
    <tr>
      <td class="main-cell">Smile To Go<div class="sub-cell">deposit 22 Jun · day 14</div></td>
      <td><span class="pill p-teal">5 · Three concepts</span></td>
      <td><div style="display:flex;gap:3px">${[1,1,1,1,2,0,0,0].map(s => `<span style="flex:1;height:5px;border-radius:3px;background:${s===1?'var(--accent)':s===2?'var(--warn)':'var(--accent-tint)'}"></span>`).join('')}</div></td>
      <td class="xs">Concept gallery live — 3 concepts passed slop-critic + H3 kill-review</td>
      <td><span class="pill p-warn">client choice · 2d</span></td>
      <td class="xs">chase #1 tomorrow</td>
      <td><span class="btn btn-ghost btn-sm">Open gallery</span></td>
    </tr>
    <tr>
      <td class="main-cell">Aspire One Physio<div class="sub-cell">deposit 1 Jul · day 5</div></td>
      <td><span class="pill p-teal">2 · First mock</span></td>
      <td><div style="display:flex;gap:3px">${[1,2,0,0,0,0,0,0].map(s => `<span style="flex:1;height:5px;border-radius:3px;background:${s===1?'var(--accent)':s===2?'var(--warn)':'var(--accent-tint)'}"></span>`).join('')}</div></td>
      <td class="xs">PRD v1 + IA drafted · style tile composing — mock due in <b>31h</b></td>
      <td><span class="pill p-gray">machine</span></td>
      <td class="xs" style="color:var(--ok);font-weight:600">on track</td>
      <td><span class="btn btn-ghost btn-sm">View PRD</span></td>
    </tr>
    <tr>
      <td class="main-cell">Bayside Podiatry<div class="sub-cell">deposit 16 Jun · day 20</div></td>
      <td><span class="pill p-teal">7 · Launch chain</span></td>
      <td><div style="display:flex;gap:3px">${[1,1,1,1,1,1,2,0].map(s => `<span style="flex:1;height:5px;border-radius:3px;background:${s===1?'var(--accent)':s===2?'var(--warn)':'var(--accent-tint)'}"></span>`).join('')}</div></td>
      <td class="xs">DNS ✓ SSL ✓ GA4 ✓ GBP built ✓ — <b>Ads account built, paused</b></td>
      <td><span class="pill p-crit">H5 · specialist enable</span></td>
      <td class="xs">Hamza · today</td>
      <td><span class="btn btn-pri btn-sm">Review &amp; enable</span></td>
    </tr>
  </table>
</div>
<div class="cols">
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Human decisions pending</h2></div>
      <div class="stack">
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">H5 · Bayside Podiatry — enable Ads</span><span class="gate g2">G2</span><span class="when">Hamza</span></div>
          <div class="flag-body">campaign-builder output: 2 campaigns, $40/day total, 28 keywords, RSAs AHPRA-checked ✓. Account paused until a named human enables. <b>Spend never starts itself.</b></div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Open campaign review</span></div>
        </div>
        <div class="flag f-info">
          <div class="flag-top"><span class="who">H1 · Aspire One — PRD v2 approval</span><span class="when">after Fri kickoff</span></div>
          <div class="flag-body">kickoff-miner will diff PRD v1 → v2 with client quotes preserved. Strategist approves before design briefs unlock.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">Preview PRD v1</span></div>
        </div>
      </div>
    </div>
  </div>
  <div class="col" style="flex:1.2">
    <div class="card">
      <div class="card-h"><h2>Factory feed</h2><span class="hint">latest events</span></div>
      <table class="t dense">
        <tr><td class="xs faint" style="white-space:nowrap">09:14</td><td>Smile To Go · concept B revision set applied — feedback-interpreter parsed 4 comments into 6 block changes</td></tr>
        <tr><td class="xs faint">08:40</td><td>Aspire One · practice-researcher pack ready — 3 competitors, 214 reviews mined, suburb profile</td></tr>
        <tr><td class="xs faint">08:22</td><td>Bayside · gsuite-provisioner created 4 mailboxes; DNS propagated ✓</td></tr>
        <tr><td class="xs faint">Fri</td><td>Smile To Go · slop-critic <b>failed concept C draft 2</b> ("uniform rhythm; stock-photo feel") → site-composer re-ran, passed draft 3</td></tr>
        <tr><td class="xs faint">Fri</td><td>Aspire One · intake pushed back on thin answer to "what makes you different" — client re-answered with 3 specifics ✓</td></tr>
        <tr><td class="xs faint">Thu</td><td>Bayside · shot-list-writer issued 12-photo list from IA; 9 of 12 uploaded, validator rejected 1 (resolution)</td></tr>
      </table>
    </div>
  </div>
</div>`;

const cms = `
<div class="tiles">
  <div class="tile"><div class="lbl">Sites on W8 CMS</div><div class="row"><div class="val">9<span class="unit">/24</span></div><div class="delta d-up">▲ 2 migrated in June</div></div></div>
  <div class="tile"><div class="lbl">Scheduled change sets</div><div class="row"><div class="val">4</div><div class="delta d-flat">next: 1 Aug 00:01</div></div></div>
  <div class="tile"><div class="lbl">Publishes this week</div><div class="row"><div class="val">11</div><div class="delta d-flat">all versioned · rollback ready</div></div></div>
  <div class="tile"><div class="lbl">Rollbacks · 30d</div><div class="row"><div class="val">1</div><div class="delta d-flat">client hero swap, reverted 4 min</div></div></div>
</div>
<div class="cols">
  <div class="col" style="flex:1.3">
    <div class="card">
      <div class="card-h"><h2>Change sets</h2><span class="hint">guardrail chain: ahpra-checker → seo-guard → propagation-mapper → tone-checker</span></div>
      <div class="stack">
        <div class="flag f-info">
          <div class="flag-top"><span class="who">Hearts Dental · Saturday hours from 1 Aug</span><span class="pill p-blue">scheduled · 1 Aug 00:01</span><span class="when">from Inbox #4181</span></div>
          <div class="flag-body">propagation-mapper fan-out: hours page · footer ×11 · LocalBusiness schema · GBP hours · phone-AI FAQ pack v13. <b>14 surfaces, one change set.</b> Before/after preview built (desktop + mobile).</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Preview all 14</span><span class="btn btn-ghost btn-sm">Reschedule</span><span class="pill p-ok">✓ AHPRA n/a</span><span class="pill p-ok">✓ seo-guard clear</span></div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">Smile Council · homepage hero swap</span><span class="pill p-warn">sensitive lane · agency review</span><span class="when">client request, portal</span></div>
          <div class="flag-body">Money page → routed to same-day review. seo-guard: H1 and title untouched ✓; image alt rewritten. Client asked via prompt box: "make the top photo the new surgery one".</div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Approve &amp; publish</span><span class="btn btn-ghost btn-sm">Preview</span><span class="xs faint" style="margin-left:auto">clean-edit streak: 7 — instant lane at 10</span></div>
        </div>
        <div class="flag f-crit">
          <div class="flag-top"><span class="who">Preston Family Dental · "pain-free implants guaranteed" banner</span><span class="pill p-crit">blocked · rewrite loop</span><span class="when">client edit</span></div>
          <div class="flag-body">ahpra-checker <b>hard block</b>: outcome guarantee + "pain-free" clinical claim. Two compliant rewrites offered to client in portal; original never published.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">View rewrites</span><span class="btn btn-ghost btn-sm">Notify client</span></div>
        </div>
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">Yarra Hills · Friday hours FAQ correction</span><span class="pill p-ok">safe lane · published 09:02</span><span class="when">from Inbox</span></div>
          <div class="flag-body">Structured field edit (hours) → instant publish after compliance scan. Phone-AI pack updated in the same transaction. v214 → v215.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">View diff</span><span class="btn btn-ghost btn-sm">Rollback</span></div>
        </div>
      </div>
    </div>
  </div>
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Publish history</h2><span class="hint">every publish versioned · who/what/why</span></div>
      <table class="t dense">
        <tr><th>When</th><th>Site · change</th><th></th></tr>
        <tr><td class="xs faint" style="white-space:nowrap">09:02</td><td class="xs">yarrahills v215 · FAQ hours <span class="pill p-gray">cms-edit-assistant</span></td><td><span class="btn btn-ghost btn-sm">↺</span></td></tr>
        <tr><td class="xs faint">Fri 16:20</td><td class="xs">trowse v98 · sciatica page draft staged <span class="pill p-gray">site-composer</span></td><td><span class="btn btn-ghost btn-sm">↺</span></td></tr>
        <tr><td class="xs faint">Fri 11:05</td><td class="xs">smilecouncil v141 · fee page update <span class="pill p-gray">Sarah · portal</span></td><td><span class="btn btn-ghost btn-sm">↺</span></td></tr>
        <tr><td class="xs faint">Thu 15:44</td><td class="xs">hearts v187 · whitening finance block <span class="pill p-gray">content-writer</span></td><td><span class="btn btn-ghost btn-sm">↺</span></td></tr>
        <tr><td class="xs faint">Thu 09:30</td><td class="xs">northcote v76 · <b style="color:var(--crit)">rollback</b> hero swap (broken crop) — 4 min exposure</td><td><span class="btn btn-ghost btn-sm">log</span></td></tr>
      </table>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Client editing tiers</h2><span class="hint">graduation by clean-edit streak</span></div>
      <table class="t dense">
        <tr><td>Tier 1 · structured fields</td><td class="num">9 clients</td></tr>
        <tr><td>Tier 2 · "change anything by asking"</td><td class="num">7 clients</td></tr>
        <tr><td>Tier 3 · visual block editor</td><td class="num">3 clients</td></tr>
        <tr><td>Tier 4 · unmanaged zones (contract)</td><td class="num">0 clients</td></tr>
      </table>
    </div>
  </div>
</div>`;

const studio = `
<div class="tiles">
  <div class="tile"><div class="lbl">In translation EN⇄中文</div><div class="row"><div class="val">6</div><div class="delta d-flat">2 in review</div></div></div>
  <div class="tile"><div class="lbl">Glossary terms</div><div class="row"><div class="val">412</div><div class="delta d-up">▲ 18 this month</div></div></div>
  <div class="tile"><div class="lbl">Translation-memory leverage</div><div class="row"><div class="val">64<span class="unit">%</span></div><div class="delta d-up">▲ 6pts — cost falling</div></div></div>
  <div class="tile"><div class="lbl">Content published · Jul</div><div class="row"><div class="val">14</div><div class="delta d-flat">pages 4 · GBP 8 · blog 2</div></div></div>
</div>
<div class="cols">
  <div class="col" style="flex:1.35">
    <div class="card">
      <div class="card-h"><h2>Translation queue</h2><span class="hint">translator-zh v2.0 · glossary + TM enforced · 中文 is first-class, not a bolt-on</span></div>
      <table class="t">
        <tr><th>Item</th><th>Direction</th><th class="num">TM match</th><th>Status</th><th></th></tr>
        <tr><td class="main-cell">Hearts · implants service page<div class="sub-cell zh">种植牙 — 从评估到修复的完整流程</div></td><td class="xs">EN → 中文</td><td class="num">58%</td><td><span class="pill p-warn">review · Qing</span></td><td><span class="btn btn-pri btn-sm">Open review</span></td></tr>
        <tr><td class="main-cell">Hearts · new-patient FAQ pack v13<div class="sub-cell">12 answers · phone AI + site</div></td><td class="xs">EN → 中文</td><td class="num">81%</td><td><span class="pill p-teal">drafting</span></td><td><span class="btn btn-ghost btn-sm">Preview</span></td></tr>
        <tr><td class="main-cell">Smile Council · open-day promo<div class="sub-cell zh">开放日 — 免费口腔检查预约</div></td><td class="xs">EN → 中文</td><td class="num">42%</td><td><span class="pill p-warn">review · Qing</span></td><td><span class="btn btn-pri btn-sm">Open review</span></td></tr>
        <tr><td class="main-cell">Mrs Lin follow-up SMS template<div class="sub-cell">receptionist fleet · both languages</div></td><td class="xs">中文 → EN</td><td class="num">90%</td><td><span class="pill p-ok">published ✓</span></td><td><span class="btn btn-ghost btn-sm">View</span></td></tr>
        <tr><td class="main-cell">June report · Hearts (bilingual)<div class="sub-cell">client requested 中文 summary section</div></td><td class="xs">EN → 中文</td><td class="num">66%</td><td><span class="pill p-teal">drafting</span></td><td><span class="btn btn-ghost btn-sm">Preview</span></td></tr>
      </table>
      <div class="xs faint" style="margin-top:8px">Glossary is versioned IP — clinical terms locked (e.g. 根管治疗 = root canal therapy, never 根管疗法) · reviewer sign-off required for clinical pages</div>
    </div>
  </div>
  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>Content drafts</h2><span class="hint">every claim traces to a client-record field</span></div>
      <div class="stack">
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">Hearts · open-day GBP post</span><span class="when">task #4177</span></div>
          <div class="flag-body">Drafted from meeting quote + event details. <span class="pill p-ok">✓ slop-critic</span> <span class="pill p-ok">✓ AHPRA</span> <span class="pill p-ok">✓ grounded 4/4 claims</span></div>
          <div class="flag-act"><span class="btn btn-pri btn-sm">Approve</span><span class="gate g2">G2</span><span class="btn btn-ghost btn-sm">Edit</span></div>
        </div>
        <div class="flag f-crit">
          <div class="flag-top"><span class="who">Trowse · sciatica blog draft 1</span><span class="when">re-running</span></div>
          <div class="flag-body"><span class="pill p-crit">✗ slop-critic</span> "we pride ourselves on…" + 2 unsourced claims. content-writer re-drafting against practice profile v8 — draft 2 due 11:00.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">View critique</span></div>
        </div>
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">Smile To Go · launch announcement kit</span><span class="when">stage 7 prep</span></div>
          <div class="flag-body">GBP opening post + 2 socials + email to waitlist. Held until H4 launch button.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">Preview kit</span></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Glossary manager</h2><span class="hint">v2.4 · 412 terms</span></div>
      <table class="t dense">
        <tr><td class="zh">种植牙</td><td>dental implant</td><td class="xs faint">locked</td></tr>
        <tr><td class="zh">牙齿矫正</td><td>orthodontics</td><td class="xs faint">locked</td></tr>
        <tr><td class="zh">洗牙</td><td>scale &amp; clean</td><td class="xs faint">preferred</td></tr>
        <tr><td class="zh">补牙</td><td>filling</td><td class="xs faint">preferred</td></tr>
      </table>
      <div class="flag-act" style="margin-top:8px"><span class="btn btn-ghost btn-sm">Open glossary</span><span class="btn btn-ghost btn-sm">Propose term</span></div>
    </div>
  </div>
</div>`;

export default [
  { id: 'website-factory', title: 'Website Factory', html: factory },
  { id: 'cms-sites', title: 'CMS & Sites', html: cms },
  { id: 'content-studio', title: 'Content Studio', html: studio },
];
