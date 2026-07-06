// 20-80 mockups — shared page shell + SVG chart helpers

export const NAV = [
  { group: 'Operate', items: [
    { id: 'today', icon: '▦', label: 'Today', badge: '7' },
    { id: 'clients', icon: '👥', label: 'Clients' },
    { id: 'inbox', icon: '✉', label: 'Inbox', badge: '4' },
    { id: 'receptionists', icon: '☎', label: 'Receptionists' },
    { id: 'meetings', icon: '◉', label: 'Meetings' },
  ]},
  { group: 'Monitor', items: [
    { id: 'google-ads', icon: '◎', label: 'Google Ads', badge: '3' },
    { id: 'seo-watchtower', icon: '⌖', label: 'SEO Watchtower', badge: '2' },
    { id: 'site-health', icon: '♥', label: 'Site Health', badge: '1' },
    { id: 'calendar', icon: '◷', label: 'Calendar' },
  ]},
  { group: 'Deliver', items: [
    { id: 'website-factory', icon: '⚒', label: 'Website Factory' },
    { id: 'cms-sites', icon: '▤', label: 'CMS & Sites' },
    { id: 'content-studio', icon: '文', label: 'Content Studio' },
  ]},
  { group: 'Grow', items: [
    { id: 'prospects', icon: '◈', label: 'Prospects' },
    { id: 'reports', icon: '▥', label: 'Reports' },
    { id: 'billing', icon: '▧', label: 'Billing' },
    { id: 'guarantee', icon: '✓', label: 'Guarantee Tracker' },
  ]},
  { group: 'System', items: [
    { id: 'audit-log', icon: '≡', label: 'Audit Log' },
    { id: 'knowledge-skills', icon: '✦', label: 'Knowledge & Skills' },
    { id: 'settings', icon: '⚙', label: 'Settings' },
  ]},
];

export function page(activeId, title, content) {
  const rail = NAV.map(g => `
      <div class="nav-group">
        <div class="nav-cap">${g.group}</div>
        ${g.items.map(it => `
        <a class="nav-item${it.id === activeId ? ' active' : ''}" href="./${it.id}.html">
          <span class="ic">${it.icon}</span>${it.label}
          ${it.badge ? `<span class="nav-badge">${it.badge}</span>` : ''}
        </a>`).join('')}
      </div>`).join('');

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${title} — 20-80 Platform</title>
<link rel="stylesheet" href="./tokens.css">
</head><body>
<div class="app">
  <aside class="rail">
    <div class="logo"><div class="logo-mark">20·80</div><div class="logo-name">20-80 <span>Platform</span></div></div>
    ${rail}
    <div class="rail-foot"><span class="dot dk-warn"></span> 2 integrations degraded <span style="margin-left:auto" class="mono">v0.9</span></div>
  </aside>
  <div class="main">
    <div class="topbar">
      <div class="tb-title">${title}</div>
      <div class="tb-search">Search clients, flags, runs… <span class="slash">/</span></div>
      <div class="tb-right">
        <span class="tb-date">Mon 6 Jul 2026 · 09:42</span>
        <span class="tb-bell">&#128276;</span>
        <div class="avatar">WC</div>
      </div>
    </div>
    <div class="content">
${content}
    </div>
  </div>
</div>
</body></html>`;
}

// ── SVG chart helpers ──────────────────────────────────────────────
// Bar: 4px rounded data-end, square baseline. x,y = top-left of bar; h grows down to baseline.
export function bar(x, yTop, w, h, fill) {
  const r = Math.min(4, h, w / 2);
  const yBase = yTop + h;
  return `<path d="M${x},${yBase} v${-(h - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${h - r} z" fill="${fill}"/>`;
}

// Sparkline: 12 points, 2px line, end dot with 2px surface ring.
export function spark(points, w = 92, h = 26, color = 'var(--series-1)') {
  const min = Math.min(...points), max = Math.max(...points);
  const sx = w / (points.length - 1), pad = 3;
  const sy = v => max === min ? h / 2 : pad + (h - 2 * pad) * (1 - (v - min) / (max - min));
  const pts = points.map((v, i) => `${(i * sx).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const [lx, ly] = pts.split(' ').pop().split(',');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lx}" cy="${ly}" r="3.5" fill="${color}" stroke="var(--surface)" stroke-width="2"/>
  </svg>`;
}

// Line chart with grid, optional dashed comparison series (projection semantics).
export function lineChart({ w = 560, h = 150, series, dashed, yLabels = [], xLabels = [], endLabel }) {
  const padL = 34, padR = endLabel ? 70 : 12, padT = 8, padB = 20;
  const pw = w - padL - padR, ph = h - padT - padB;
  const all = series.concat(dashed || []);
  const min = Math.min(...all) * 0.95, max = Math.max(...all) * 1.05;
  const sx = pw / (series.length - 1);
  const sy = v => padT + ph * (1 - (v - min) / (max - min));
  const path = arr => arr.map((v, i) => `${(padL + i * sx).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const grid = [0, 0.5, 1].map(f => { const y = padT + ph * f; return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="var(--grid)" stroke-width="1"/>`; }).join('');
  const ylab = yLabels.map((t, i) => `<text x="${padL - 6}" y="${padT + ph * (i / (yLabels.length - 1)) + 3.5}" text-anchor="end" font-size="9.5" fill="var(--faint)" style="font-variant-numeric:tabular-nums">${t}</text>`).join('');
  const xlab = xLabels.map((t, i) => `<text x="${padL + pw * (i / (xLabels.length - 1))}" y="${h - 5}" text-anchor="middle" font-size="9.5" fill="var(--faint)">${t}</text>`).join('');
  const lastX = padL + (series.length - 1) * sx, lastY = sy(series[series.length - 1]);
  const dash = dashed ? `<polyline points="${path(dashed)}" fill="none" stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="4 4" stroke-linejoin="round"/>` : '';
  const area = `<polygon points="${padL},${padT + ph} ${path(series)} ${lastX},${padT + ph}" fill="var(--series-1)" opacity="0.08"/>`;
  const end = endLabel ? `<text x="${lastX + 9}" y="${lastY + 3.5}" font-size="10.5" font-weight="600" fill="var(--ink)">${endLabel}</text>` : '';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${grid}${ylab}${xlab}${area}${dash}
    <polyline points="${path(series)}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lastX}" cy="${lastY}" r="4" fill="var(--series-1)" stroke="var(--surface)" stroke-width="2"/>
    ${end}
  </svg>`;
}

// Column chart: thin bars <=24px, value labelled on last bar only.
export function colChart({ w = 560, h = 150, values, labels, lastLabel, color = 'var(--series-1)' }) {
  const padL = 34, padT = 14, padB = 20, padR = 8;
  const pw = w - padL - padR, ph = h - padT - padB;
  const max = Math.max(...values) * 1.08;
  const slot = pw / values.length, bw = Math.min(24, slot * 0.55);
  const grid = [0, 0.5, 1].map(f => { const y = padT + ph * f; return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="var(--grid)" stroke-width="1"/>`; }).join('');
  const bars = values.map((v, i) => {
    const bh = ph * (v / max);
    return bar(padL + i * slot + (slot - bw) / 2, padT + ph - bh, bw, bh, color);
  }).join('');
  const xlab = labels.map((t, i) => `<text x="${padL + i * slot + slot / 2}" y="${h - 5}" text-anchor="middle" font-size="9.5" fill="var(--faint)">${t}</text>`).join('');
  const li = values.length - 1, lbh = ph * (values[li] / max);
  const cap = lastLabel ? `<text x="${padL + li * slot + slot / 2}" y="${padT + ph - lbh - 5}" text-anchor="middle" font-size="10" font-weight="600" fill="var(--ink)" style="font-variant-numeric:tabular-nums">${lastLabel}</text>` : '';
  const ymax = `<text x="${padL - 6}" y="${padT + 3.5}" text-anchor="end" font-size="9.5" fill="var(--faint)"></text>`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${grid}${ymax}${bars}${xlab}${cap}</svg>`;
}
