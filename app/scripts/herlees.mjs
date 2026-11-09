// Na `fetch-web-hours.mjs --site=X` (knop "Opnieuw lezen" in /beheer, workflow herlees.yml): de nieuwe tijden meteen in Supabase
// zetten voor de winkel(s) met die website, zodat de kwartier-run ze binnen 15 minuten publiceert. De wekelijkse winkelrun rekent alles
// daarna opnieuw uit met alle regels (fetch-osm); dit is de korte weg voor één site.
// Zelfde voorrang als fetch-osm: OSM-tijden en met de hand gezette tijden blijven staan; een gedeelde site alleen via een eigen
// vestigingsblok (per postcode) of als precies één winkel de postcode op de pagina heeft.
// Gebruik: node scripts/herlees.mjs voorbeeld.nl [--droog]   (SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY nodig)
import fs from 'node:fs';
import { siteKey } from './hours-from-web.mjs';
import { precompute, todayIso } from './hours-precompute.mjs';

const site = process.argv[2], dry = process.argv.includes('--droog'), { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;
if (!site || !SB || !KEY) { console.error('Gebruik: node scripts/herlees.mjs <site>, met SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const key = siteKey(site), w = JSON.parse(fs.readFileSync(new URL('../data-raw/web-hours.json', import.meta.url), 'utf8'))[key];
if (!w) { console.log(`${key}: niet in de cache, niets te doen`); process.exit(0); }
console.log(`${key}: ${w.oh ?? w.note}${w.page ? ` (${w.page})` : ''}`);

const req = async (path, init = {}) => {
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...init.headers } });
  if (!r.ok) throw new Error(`supabase ${r.status} ${await r.text()}`);
  return r.status === 204 || r.status === 201 ? null : r.json();
};
const host = key.split('/')[0];
const rows = (await req(`places?select=id,status,locked,data&status=eq.actief&data->>website=ilike.${encodeURIComponent(`*${host}*`)}`)).filter(r => r.data.website && siteKey(r.data.website) === key);
const pc = r => /\b([1-9]\d{3})\s?([A-Z]{2})\b/i.exec(r.data.addr ?? '')?.slice(1);
const today = todayIso(), checked = (w.ok ?? w.read).slice(0, 10);
let n = 0;
for (const r of rows) {
  const d = r.data, why = d.h && d.hs !== 'web' ? 'heeft al tijden uit OSM of van een bezoeker' : r.locked.includes('h') ? 'tijden met de hand gezet' : null;
  if (why) { console.log(`  ${d.name}: overgeslagen, ${why}`); continue; }
  const own = w.per?.[pc(r)?.join('').toUpperCase()];
  const shared = rows.length > 1 && !own && !(w.pc?.includes(pc(r)?.[0]) && rows.filter(x => w.pc?.includes(pc(x)?.[0])).length === 1);
  if (shared) { console.log(`  ${d.name}: overgeslagen, gedeelde site zonder eigen blok`); continue; }
  const oh = own?.oh ?? w.oh, page = own?.page ?? w.page, h = oh && precompute(oh, today);
  const { dicht: _, afspraak: __, ...rest } = d;
  const data = h ? { ...rest, h, oh, checked, hs: 'web', hu: page } : w.dicht ? { ...rest, dicht: checked, hu: page } : w.afspraak ? { ...rest, afspraak: checked, hu: page } : null;
  if (!data) { console.log(`  ${d.name}: geen tijden gevonden, niets veranderd`); continue; }
  console.log(`  ${d.name} (${d.addr ?? d.place}): ${h ? oh : w.note}`);
  if (!dry) await req(`places?id=eq.${encodeURIComponent(r.id)}`, { method: 'PATCH', body: JSON.stringify({ data, updated_at: new Date().toISOString() }) }); // updated_at: de kwartier-run publiceert
  n++;
}
console.log(`${n} van ${rows.length} winkel(s) bijgewerkt${dry ? ' (droog)' : ''}`);
