import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { page } from './shell.mjs';
import operate from './tabs-operate.mjs';
import monitor from './tabs-monitor.mjs';
import deliver from './tabs-deliver.mjs';
import grow from './tabs-grow.mjs';
import workflows from './tabs-workflows.mjs';
import integrations from './tabs-integrations.mjs';
import system from './tabs-system.mjs';

const tabs = [...operate, ...monitor, ...deliver, ...grow, ...workflows, ...integrations, ...system];
for (const t of tabs) {
  const out = fileURLToPath(new URL(`../html/${t.id}.html`, import.meta.url));
  writeFileSync(out, page(t.id, t.title, t.html));
  console.log(`built ${t.id}.html`);
}
console.log(`${tabs.length} pages built.`);
