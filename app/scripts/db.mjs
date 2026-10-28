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

/** Winkels na een import (§5.1). Niet meer in OSM/Overture → verborgen met `gone`; komt hij terug, dan weer actief.
 *  Met de hand verborgen (zonder `gone`) of vastgezet in beheer: blijft zoals het is. */
export function placeRows(existing, incoming, today) {
  const old = new Map(existing.map(r => [r.id, r])), seen = new Set(incoming.map(r => r.id));
  const kept = r => r.locked.includes('status');
  const rows = incoming.map(r => {
    const o = old.get(r.id), m = merge(o, r);
    return { ...m, status: !o ? 'actief' : kept(o) || (o.status === 'verborgen' && !o.data.gone) ? o.status : 'actief' };
  });
  const gone = existing.filter(r => !seen.has(r.id) && r.status === 'actief' && !kept(r))
    .map(r => ({ id: r.id, data: { ...r.data, gone: today }, status: 'verborgen', seen_at: r.seen_at }));
  return { rows, gone };
}

// ---------- Supabase REST ----------
function env() {
  const f = new URL('../.env', import.meta.url);
  if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) { const m = /^([A-Z_]+)=(.*)$/.exec(l.trim()); if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2]; }
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken (app/.env of GitHub-secrets).');
  return { url: `${url}/rest/v1`, headers: { apikey: key, 'Content-Type': 'application/json' } };
}
export async function req(path, init = {}) {
  const { url, headers } = env(), res = await fetch(`${url}/${path}`, { ...init, headers: { ...headers, ...init.headers } });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 || init.method === 'POST' ? null : res.json();
}
export async function all(table) {
  const out = []; for (let i = 0; ; i += 1000) { const page = await req(`${table}?select=*&order=id`, { headers: { Range: `${i}-${i + 999}` } }); out.push(...page); if (page.length < 1000) return out; }
}
/** ignore: alleen nieuwe rijen (bestaande, ook afgewezen kandidaten, blijven zoals ze zijn). */
export async function upsert(table, rows, { ignore = false } = {}) {
  for (let i = 0; i < rows.length; i += 500)
    await req(`${table}?on_conflict=id`, { method: 'POST', headers: { Prefer: `resolution=${ignore ? 'ignore' : 'merge'}-duplicates,return=minimal` }, body: JSON.stringify(rows.slice(i, i + 500)) });
}

const FILE = name => new URL(`../public/data/${name}.json`, import.meta.url);
const read = name => JSON.parse(fs.readFileSync(FILE(name), 'utf8'));

async function push(what) {
  const now = new Date().toISOString(), today = todayIso();
  if (what === 'places') {
    const existing = await all('places'), old = new Map(existing.map(r => [r.id, r]));
    const { rows, gone } = placeRows(existing, read('places').places.map(({ id, h, ...data }) => ({ id, data, seen_at: now })), today);
    // Halve import (Overpass-vak leeg, Overture niet gelezen): niets wegzetten. Meer dan 10% weg is eerder een fout dan echt.
    const active = existing.filter(r => r.status === 'actief').length;
    if (gone.length > active * 0.1) throw new Error(`Import zou ${gone.length} van ${active} winkels verbergen; dat lijkt een fout in de import. Niets geschreven.`);
    await upsert('places', [...rows, ...gone].map(({ id, data, status, seen_at }) => ({ id, data, status, seen_at })));
    const fresh = rows.filter(r => !old.has(r.id)).length;
    await req('import_runs', { method: 'POST', body: JSON.stringify({ source: 'places', counts: { rows: rows.length, new: fresh, gone: gone.length } }) });
    console.log(`places: ${rows.length} rijen (${fresh} nieuw), ${gone.length} niet meer in de bronnen → verborgen`);
  } else if (what === 'markets') {
    const file = read('markets'), existing = await all('markets'), old = new Map(existing.map(r => [r.id, r]));
    const rows = file.markets.map(({ id, status, ...data }) => merge(old.get(id), { id, date: data.date, source: data.org, data, status, seen_at: now }));
    const gone = vanished(existing, new Set(rows.map(r => r.id)), file.fresh ?? [], today);
    await upsert('markets', [...rows, ...gone].map(({ id, date, source, data, status, seen_at }) => ({ id, date, source, data, status, seen_at })));
    await req('import_runs', { method: 'POST', body: JSON.stringify({ source: 'markets', counts: { rows: rows.length, new: rows.filter(r => !old.has(r.id)).length, vanished: gone.length, problems: file.problems ?? [] } }) });
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
