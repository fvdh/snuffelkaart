// Inloggen op /beheer zonder e-mail (zolang Supabase-mail niet aankomt): vraagt met de secret key een inloglink aan
// en opent die in je standaardbrowser. De link toont het script niet.
//   node scripts/inloglink.mjs [e-mailadres] [--lokaal]
import fs from 'node:fs';
import { execFile } from 'node:child_process';

const f = new URL('../.env', import.meta.url), env = {};
if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) { const m = /^([A-Z_]+)=(.*)$/.exec(l.trim()); if (m) env[m[1]] = m[2]; }
const url = process.env.SUPABASE_URL ?? env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv.slice(2).find(a => a.includes('@')) ?? 'info@freekvanderhorst.nl';
const site = process.argv.includes('--lokaal') ? 'http://localhost:4321' : 'https://snuffelkaart.ironfront-relay.workers.dev';

const r = await fetch(`${url}/auth/v1/admin/generate_link`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', email, redirect_to: `${site}/beheer` }) });
const j = await r.json();
const link = j.action_link ?? j.properties?.action_link;
if (!r.ok || !link) { console.error(`Lukte niet (${r.status}): ${j.msg ?? j.message ?? j.error_description ?? JSON.stringify(j)}`); process.exit(1); }
execFile('open', [link]);
console.log(`Inloglink voor ${email} geopend in je browser (${site}/beheer).`);
