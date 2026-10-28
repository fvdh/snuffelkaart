// Supabase is de bron van waarheid (§6.1). Imports schrijven via push, de build leest via export.
//   node scripts/db.mjs push places    public/data/places.json (van fetch-osm.mjs) → Supabase
//   node scripts/db.mjs push markets   public/data/markets.json (van fetch-markets.mjs) → Supabase
//   node scripts/db.mjs export         Supabase → public/data/places.json + markets.json (wat de app laadt)
// Velden in `locked` (met de hand gezet in beheer) overschrijft een import nooit. Terugdraaien: de vorige export staat in git.
// ponytail: REST (PostgREST) met fetch, geen supabase-js; alles in één keer ophalen (±4000 rijen).
import fs from 'node:fs';
import { precompute, holidays, todayIso, DAYS_AHEAD } from './hours-precompute.mjs';

const PUBLIC = ['org', 'chk', 'unconf', 'cancel']; // kandidaat en afgewezen komen niet op de kaart

/** Nieuwe import over een bestaande rij heen: vastgezette velden en een vastgezette status blijven staan. */
export function merge(old, row) {
  if (!old) return row;
  const data = { ...row.data };
  for (const k of old.locked) if (k in old.data) data[k] = old.data[k]; else delete data[k];
  return { ...row, data, ...(row.status && old.locked.includes('status') ? { status: old.status } : {}) };
}

/** Markten die van de site van hun organisator verdwenen zijn (§5.2): niet weg, maar "nog niet bevestigd" tot iemand kijkt. */
export function vanished(existing, incomingIds, freshSources, today) {
  return existing.filter(r => freshSources.includes(r.source) && r.date >= today && !incomingIds.has(r.id)
    && (r.status === 'org' || r.status === 'chk') && !r.locked.includes('status'))
    .map(r => ({ ...r, status: 'unconf', data: { ...r.data, vanished: today } }));
}

/** Rijen → bestanden voor de app (zelfde vorm als vroeger, zodat de app niet verandert). */
export function toFiles(places, markets, from) {
  const p = places.filter(r => r.status === 'actief').map(({ id, data: { oh, ...d } }) => {
    const h = oh ? precompute(oh, from) : null;
    return { ...d, id, ...(h ? { h } : {}) };
  });
  const m = markets.filter(r => PUBLIC.includes(r.status) && r.date >= from).map(({ id, status, data }) => ({ ...data, id, status }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const generated = new Date().toISOString();
  return {
    places: { generated, source: '© OpenStreetMap-bijdragers (ODbL); Overture Maps Foundation (CDLA Permissive 2.0)', from, days: DAYS_AHEAD, holidays: holidays(from), places: p },
    markets: { generated, markets: m },
  };
}

// ---------- Supabase REST ----------
function env() {
  const f = new URL('../.env', import.meta.url);
  if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) { const m = /^([A-Z_]+)=(.*)$/.exec(l.trim()); if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2]; }
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken (app/.env of GitHub-secrets).');
  return { url: `${url}/rest/v1`, headers: { apikey: key, 'Content-Type': 'application/json' } };
}
async function req(path, init = {}) {
  const { url, headers } = env(), res = await fetch(`${url}/${path}`, { ...init, headers: { ...headers, ...init.headers } });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 || init.method === 'POST' ? null : res.json();
}
async function all(table) {
  const out = []; for (let i = 0; ; i += 1000) { const page = await req(`${table}?select=*&order=id`, { headers: { Range: `${i}-${i + 999}` } }); out.push(...page); if (page.length < 1000) return out; }
}
async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += 500)
    await req(`${table}?on_conflict=id`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) });
}

const FILE = name => new URL(`../public/data/${name}.json`, import.meta.url);
const read = name => JSON.parse(fs.readFileSync(FILE(name), 'utf8'));

async function push(what) {
  const now = new Date().toISOString(), today = todayIso();
  if (what === 'places') {
    const old = new Map((await all('places')).map(r => [r.id, r]));
    const rows = read('places').places.map(({ id, h, ...data }) => merge(old.get(id), { id, data, seen_at: now }));
    await upsert('places', rows.map(({ id, data, seen_at }) => ({ id, data, seen_at })));
    await req('import_runs', { method: 'POST', body: JSON.stringify({ source: 'places', counts: { rows: rows.length, new: rows.filter(r => !old.has(r.id)).length } }) });
    console.log(`places: ${rows.length} rijen (${rows.filter(r => !old.has(r.id)).length} nieuw)`);
  } else if (what === 'markets') {
    const file = read('markets'), existing = await all('markets'), old = new Map(existing.map(r => [r.id, r]));
    const rows = file.markets.map(({ id, status, ...data }) => merge(old.get(id), { id, date: data.date, source: data.org, data, status, seen_at: now }));
    const gone = vanished(existing, new Set(rows.map(r => r.id)), file.fresh ?? [], today);
    await upsert('markets', [...rows, ...gone].map(({ id, date, source, data, status, seen_at }) => ({ id, date, source, data, status, seen_at })));
    await req('import_runs', { method: 'POST', body: JSON.stringify({ source: 'markets', counts: { rows: rows.length, new: rows.filter(r => !old.has(r.id)).length, vanished: gone.length } }) });
    console.log(`markets: ${rows.length} edities (${rows.filter(r => !old.has(r.id)).length} nieuw), ${gone.length} verdwenen → nog niet bevestigd`);
  } else throw new Error('push places | push markets');
}

async function exportFiles() {
  const from = todayIso(), f = toFiles(await all('places'), await all('markets'), from);
  if (f.places.places.length < 1000 || !f.markets.markets.length) throw new Error(`Export te klein (${f.places.places.length} winkels, ${f.markets.markets.length} markten). Niets geschreven.`);
  fs.writeFileSync(FILE('places'), JSON.stringify(f.places, (k, v) => (v === null ? undefined : v)));
  fs.writeFileSync(FILE('markets'), JSON.stringify(f.markets));
  console.log(`export vanaf ${from}: ${f.places.places.length} winkels (${f.places.places.filter(p => p.h).length} met tijden), ${f.markets.markets.length} markten`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, arg] = process.argv.slice(2);
  await (cmd === 'push' ? push(arg) : cmd === 'export' ? exportFiles() : Promise.reject(new Error('push places|markets, of export')));
}
