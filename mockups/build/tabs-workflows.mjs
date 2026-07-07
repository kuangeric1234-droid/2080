// Workflows tab — automation runtime: what's running, how it's running, and in-place tuning.

// Render a skill pipeline as a chain of nodes. n = { s, t } where
// s ∈ done | active | gate | block | queued, t = skill label.
function chain(nodes) {
  return nodes.map((n, i) => {
    const arrow = i ? '<span class="wf-arrow">→</span>' : '';
    const pulse = n.s === 'active' ? '<span class="pulse"></span>' : '';
    return `${arrow}<span class="wf-node ${n.s}">${pulse}${n.t}</span>`;
  }).join('');
}

function wfRow({ dot, name, trigger, thru, nodes, now, act }) {
  return `
  <div class="wf-row">
    <div class="wf-name">
      <div class="n"><span class="dot dk-${dot}"></span>${name}</div>
      <div class="s">${trigger} · <span class="mono">${thru}</span></div>
    </div>
    <div class="wf-chain">${chain(nodes)}</div>
    <div class="wf-now">${now}</div>
    <div class="wf-act">${act}</div>
  </div>`;
}

const runtime = [
  wfRow({
    dot: 'ok', name: 'W1 · Receptionist', trigger: 'per call', thru: '312 calls today',
    nodes: [
      { s: 'done', t: 'language-id' }, { s: 'done', t: 'clinic-call-agent' },
      { s: 'active', t: 'booking-capture' }, { s: 'queued', t: 'call-summary' },
      { s: 'queued', t: 'offline-conv-upload' },
    ],
    now: '<b>3 calls live</b> · Mrs Lin mid-booking (中文). Emergency stream armed. First-audio p95 740ms.',
    act: '<span class="btn btn-ghost btn-sm">Tune</span>',
  }),
  wfRow({
    dot: 'ok', name: 'W2 · Inbox triage', trigger: 'Gmail push', thru: '41 emails today',
    nodes: [
      { s: 'done', t: 'email-triage' }, { s: 'active', t: 'reply-drafter' },
      { s: 'gate', t: 'ahpra-checker' }, { s: 'queued', t: 'task → ActiveCollab' },
      { s: 'queued', t: 'completion-writer' },
    ],
    now: '2 acks drafted, awaiting G2 send. <b>1 complaint</b> split out → Wally, no AI ack.',
    act: '<span class="btn btn-soft btn-sm">Tuning ↓</span>',
  }),
  wfRow({
    dot: 'warn', name: 'W3 · Ads optimise', trigger: 'cron 06:00 + events', thru: '21 accounts',
    nodes: [
      { s: 'done', t: 'ads sync' }, { s: 'done', t: 'benchmark-gate' },
      { s: 'done', t: 'ads-optimiser' }, { s: 'gate', t: 'H · Tier C approve' },
      { s: 'queued', t: 'validateOnly → execute' }, { s: 'queued', t: 'change-watch 7d' },
    ],
    now: 'Yarra Hills budget shift <b>−28% / +31%</b> queued behind a named human. Spend never self-starts.',
    act: '<span class="btn btn-ghost btn-sm">Tune</span>',
  }),
  wfRow({
    dot: 'warn', name: 'W4 · SEO watchtower', trigger: 'cron 05:30', thru: '14/15 synced',
    nodes: [
      { s: 'done', t: 'seo sync' }, { s: 'done', t: 'diff-engine' },
      { s: 'active', t: 'seo-diagnose' }, { s: 'queued', t: 'opportunity-writer' },
    ],
    now: 'Northcote stale 48h → its alerts <b>suppressed</b> (honest). Diagnosing "dentist blackburn 4→9".',
    act: '<span class="btn btn-ghost btn-sm">Tune</span>',
  }),
  wfRow({
    dot: 'ok', name: 'W5 · Meetings', trigger: 'Fathom webhook', thru: '3 today',
    nodes: [
      { s: 'done', t: 'meeting-summariser' }, { s: 'active', t: 'action-extractor' },
      { s: 'queued', t: 'dedupe vs tasks' }, { s: 'queued', t: 'agenda-builder' },
    ],
    now: 'Extracting actions from Hearts QBR · dedupes against 2 open flags before creating tasks.',
    act: '<span class="btn btn-ghost btn-sm">Tune</span>',
  }),
  wfRow({
    dot: 'ok', name: 'Website Factory', trigger: 'deposit webhook', thru: '3 builds in flight',
    nodes: [
      { s: 'done', t: 'intake' }, { s: 'done', t: 'prd-generator' }, { s: 'done', t: 'site-composer' },
      { s: 'active', t: 'slop-critic' }, { s: 'gate', t: 'H3 · kill-review' }, { s: 'queued', t: 'concept gallery' },
    ],
    now: 'Smile To Go · 3 concepts composing. slop-critic re-ran concept C (uniform rhythm) → passed draft 3.',
    act: '<span class="btn btn-ghost btn-sm">Tune</span>',
  }),
  wfRow({
    dot: 'ok', name: 'Sales · Prospect', trigger: 'lead capture', thru: '6 live deals',
    nodes: [
      { s: 'done', t: 'lead-capture' }, { s: 'done', t: 'prospect-researcher' },
      { s: 'active', t: 'audit-report-generator' }, { s: 'gate', t: 'G2 · first 90d' }, { s: 'queued', t: 'nurture-writer' },
    ],
    now: 'Aspire One audit microsite composing — target live <b>&lt;15 min</b> from capture.',
    act: '<span class="btn btn-ghost btn-sm">Tune</span>',
  }),
  wfRow({
    dot: 'gray', name: 'ad-copy-writer loop', trigger: 'paused for tuning', thru: 'v2.1 blocked',
    nodes: [
      { s: 'done', t: 'ad-copy-writer' }, { s: 'block', t: 'skill-evaluator' }, { s: 'queued', t: 'RSA push' },
    ],
    now: '<span style="color:var(--warn)">v2.1 promotion blocked Sun</span> (88 vs incumbent 92). Held on v2.0 until it beats the golden set.',
    act: '<span class="btn btn-ghost btn-sm">Eval diff</span>',
  }),
];

const workflows = `
<div class="tiles">
  <div class="tile"><div class="lbl">Workflows live</div><div class="row"><div class="val">12<span class="unit">/14</span></div><div class="delta d-flat">2 paused for tuning</div></div></div>
  <div class="tile"><div class="lbl">Runs in flight now</div><div class="row"><div class="val">34</div><div class="delta d-flat">across 12 workflows</div></div></div>
  <div class="tile"><div class="lbl">Waiting at a gate</div><div class="row"><div class="val">5</div><div class="delta d-up">human approvals · actionable</div></div></div>
  <div class="tile"><div class="lbl">Changes in shadow test</div><div class="row"><div class="val">3</div><div class="delta d-flat">eval-gated before they go live</div></div></div>
</div>

<div class="card" style="margin-bottom:14px">
  <div class="card-h">
    <h2>Automation runtime</h2>
    <span class="hint">every workflow is a chain of versioned skills — the lit node is executing now, amber is a gate waiting on a human</span>
    <span class="link">All 14 →</span>
  </div>
  <div style="display:flex;gap:14px;align-items:center;padding:2px 0 8px">
    <span class="legend"><span class="k"><span class="wf-node active" style="padding:1px 6px"><span class="pulse"></span></span> running now</span>
    <span class="k"><span class="wf-node done" style="padding:1px 6px">■</span> done</span>
    <span class="k"><span class="wf-node gate" style="padding:1px 6px">■</span> gate · human</span>
    <span class="k"><span class="wf-node block" style="padding:1px 6px">■</span> blocked</span>
    <span class="k"><span class="wf-node queued" style="padding:1px 6px">■</span> queued</span></span>
  </div>
  ${runtime.join('')}
</div>

<div class="cols">
  <div class="col" style="flex:1.55">
    <div class="card">
      <div class="card-h">
        <h2>Tuning · W2 Inbox triage</h2>
        <span class="hint">editing a draft copy — nothing here touches production until it clears shadow + eval</span>
        <span class="link">Version history →</span>
      </div>
      <div class="banner b-info" style="margin-bottom:10px">
        <span>You're editing <b>draft v3.2</b> of this workflow. Live runs stay on v3.1 while your changes shadow-test.</span>
        <span class="bx">shadow: 2 steps changed</span>
      </div>

      <div class="wf-step">
        <div class="idx">1</div>
        <div class="sbody">
          <div class="sname">email-triage <span class="pill p-gray">fast · Haiku</span><span class="gate g1">G1</span></div>
          <div class="smeta">Classify + dedupe threads · auto-task at confidence <b>≥ 0.80</b> → <span style="color:var(--blue)">proposing ≥ 0.78</span> · precision 97.2%</div>
        </div>
        <div class="sctrl">
          <span class="btn btn-ghost btn-sm">Threshold ▾</span>
          <span class="btn btn-ghost btn-sm">Edit prompt</span>
          <span class="btn btn-ghost btn-sm">Model ▾</span>
        </div>
      </div>

      <div class="wf-step edited">
        <div class="idx">2</div>
        <div class="sbody">
          <div class="sname">reply-drafter <span class="pill p-blue">edited</span><span class="gate g2">G2</span></div>
          <div class="smeta">Draft acknowledgement in Wally's voice. You added 2 few-shot examples + tightened the SLA line. <span class="mono">diff +14 −3</span></div>
        </div>
        <div class="sctrl">
          <span class="btn btn-ghost btn-sm">View diff</span>
          <span class="btn btn-ghost btn-sm">Gate ▾</span>
          <span class="btn btn-ghost btn-sm">Revert</span>
        </div>
      </div>

      <div class="wf-step">
        <div class="idx">3</div>
        <div class="sbody">
          <div class="sname">ahpra-checker <span class="pill p-gray">hard gate</span><span class="gate g0">G0</span></div>
          <div class="smeta"><span style="color:var(--faint)">🔒 Locked — a hard compliance gate can't be reordered, weakened, or removed from any workflow.</span></div>
        </div>
        <div class="sctrl">
          <span class="btn btn-ghost btn-sm">Rules corpus</span>
        </div>
      </div>

      <div class="wf-step">
        <div class="idx">4</div>
        <div class="sbody">
          <div class="sname">task → ActiveCollab <span class="pill p-outline">tool</span></div>
          <div class="smeta">Create the tracked task · SLA matrix per request type · source-attributed on the timeline.</div>
        </div>
        <div class="sctrl">
          <span class="btn btn-ghost btn-sm">SLA matrix</span>
          <span class="btn btn-ghost btn-sm">Disable step</span>
        </div>
      </div>

      <div class="wf-step">
        <div class="idx">5</div>
        <div class="sbody">
          <div class="sname">completion-writer <span class="pill p-gray">fast · Haiku</span><span class="gate g1">G1</span></div>
          <div class="smeta">"It's done" message on the completion webhook — the cheapest loyalty builder, so it stays G1.</div>
        </div>
        <div class="sctrl">
          <span class="btn btn-ghost btn-sm">Edit prompt</span>
          <span class="btn btn-ghost btn-sm">Gate ▾</span>
        </div>
      </div>

      <div class="flag-act" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--grid)">
        <span class="btn btn-pri btn-sm">Send draft to shadow</span>
        <span class="btn btn-ghost btn-sm">+ Add step</span>
        <span class="btn btn-ghost btn-sm">Reorder</span>
        <span class="xs faint" style="margin-left:auto">every change is versioned, audited, and reversible — same lifecycle as a skill promotion</span>
      </div>
    </div>
  </div>

  <div class="col" style="flex:1">
    <div class="card">
      <div class="card-h"><h2>How a change goes live</h2><span class="hint">no edit skips a stage</span></div>
      <div class="stack">
        <div class="flag f-info">
          <div class="flag-top"><span class="who">1 · Draft</span><span class="when">you, now</span></div>
          <div class="flag-body">Edit prompts, gates, thresholds, order on a copy. Production keeps running the live version.</div>
        </div>
        <div class="flag f-info">
          <div class="flag-top"><span class="who">2 · Shadow</span><span class="pill p-blue">1–2 weeks</span></div>
          <div class="flag-body">Runs on real inputs, takes <b>no</b> actions. Its would-be output is compared to what actually happened.</div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">3 · Eval gate</span><span class="pill p-warn">must beat incumbent</span></div>
          <div class="flag-body">skill-evaluator regresses the golden set. Ships only if the new version scores higher — else it's blocked.</div>
        </div>
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">4 · Promote</span><span class="when">a named human</span></div>
          <div class="flag-body">A person flips it live. Audit-logged with rollback to the exact prior version.</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Changes in shadow</h2><span class="hint">live experiments, zero client risk</span></div>
      <div class="stack">
        <div class="flag f-ok">
          <div class="flag-top"><span class="who">email-triage · 0.80 → 0.78</span><span class="when">day 6 / 14</span></div>
          <div class="flag-body">+12 emails auto-tasked that a human would have, <b>0 misroutes</b>. On track to promote.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">Shadow report</span></div>
        </div>
        <div class="flag f-warn">
          <div class="flag-top"><span class="who">ads-optimiser · +bid-nudge lane</span><span class="when">day 3 / 14</span></div>
          <div class="flag-body">2 nudges would have fired mid-learning-period — cooldown rule caught them. Reviewing before continuing.</div>
          <div class="flag-act"><span class="btn btn-ghost btn-sm">Shadow report</span></div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-h"><h2>Recent tuning</h2><span class="hint">who changed what · reversible</span></div>
      <table class="t dense">
        <tr><td class="xs faint" style="white-space:nowrap">Fri</td><td class="xs">Hamza · W3 raised CPL amber to ×1.4 <span class="pill p-gray">v1.4→1.5</span></td><td><span class="btn btn-ghost btn-sm">↺</span></td></tr>
        <tr><td class="xs faint">Thu</td><td class="xs">Ish · Factory added "one-bold-move" critic gate <span class="pill p-gray">promoted</span></td><td><span class="btn btn-ghost btn-sm">↺</span></td></tr>
        <tr><td class="xs faint">Wed</td><td class="xs">Wally · review-responder Hearts G2→G1 <span class="pill p-gray">graduated</span></td><td><span class="btn btn-ghost btn-sm">↺</span></td></tr>
        <tr><td class="xs faint">Tue</td><td class="xs">Hamza · W4 confirmation window 2d→1d (3-pack exit) <span class="pill p-gray">v2.3</span></td><td><span class="btn btn-ghost btn-sm">↺</span></td></tr>
      </table>
    </div>
  </div>
</div>`;

export default [
  { id: 'workflows', title: 'Workflows', html: workflows },
];
