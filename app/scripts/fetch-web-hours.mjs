// Leest openingstijden van de eigen website van winkels zonder tijden (§5.1) → data-raw/web-hours.json.
// Daarna neemt `npm run data:osm -- --cached` ze over, met bronlabel. Netjes: robots.txt, eigen User-Agent,
// per site na elkaar met pauze, hooguit 3 pagina's per winkel, cache van 7 dagen.
// Gebruik: npm run data:web            (alleen nieuwe of verlopen sites)
//          npm run data:web -- --fresh (alles opnieuw)
//          npm run data:web -- --limit=50 (proef)
import fs from 'node:fs';
import { hoursFromHtml, toText, siteKey } from './hours-from-web.mjs';

const PLACES = new URL('../public/data/places.json', import.meta.url), OUT = new URL('../data-raw/web-hours.json', import.meta.url);
const UA = 'Snuffelkaart-PoC/0.1 (openingstijden van kringlopen; freek@draad.nu)';
// Sociale media en gidssites van anderen: niet uitlezen (voorwaarden, databankenrecht §5).
const SKIP = /facebook|instagram|marktplaats|g\.page|google\.|linktr\.ee|tiktok|twitter|x\.com|youtube|wa\.me|allekringloopwinkels|kringloopwinkels?\.(nl|info|com)|kringlopen\.nl|tweedehandswinkels|openingstijden\.|openingstijdenwinkels|telefoonboek|telefoongids|cylex|opendi|hotfrog|yelp|tripadvisor|goudengids|bedrijvenpagina|drimble|infobel|kompass|oozo|plaatsengids|nederlandsewinkels/i;
const WORKERS = 8, PAUSE = 800, MAX_AGE = 7 * 864e5;


const cache = fs.existsSync(OUT) && !process.argv.includes('--fresh') ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const places = JSON.parse(fs.readFileSync(PLACES, 'utf8')).places;
const todo = new Map(); // key → url
for (const p of places) {
  if ((p.h && p.hs !== 'web') || !p.website || SKIP.test(p.website)) continue; // OSM-tijden gaan voor; websitetijden lezen we opnieuw
  const k = siteKey(p.website); if (!k || todo.has(k)) continue;
  if (cache[k] && Date.now() - Date.parse(cache[k].read) < MAX_AGE) continue;
  todo.set(k, /^https?:/i.test(p.website) ? p.website : 'https://' + p.website);
}
const LIMIT = +(process.argv.find(a => a.startsWith('--limit='))?.slice(8) ?? Infinity); // proefrun
for (const k of [...todo.keys()].slice(LIMIT)) todo.delete(k);
const byHost = new Map(); for (const [k, u] of todo) { const h = k.split('/')[0]; byHost.set(h, [...(byHost.get(h) ?? []), [k, u]]); }
console.log(`${todo.size} websites op ${byHost.size} domeinen te lezen (${Object.keys(cache).length} in cache)`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(12000) });
  if (!r.ok || !/html/i.test(r.headers.get('content-type') ?? 'html')) throw new Error(`status ${r.status}`);
  return { html: (await r.text()).slice(0, 2_000_000), url: r.url };
}
/** Probeer de url zoals hij is, en anders via https en met/zonder www (oude http-adressen falen vaak). */
async function getAny(url) {
  const u = new URL(url), alt = [url, `https://${u.host}${u.pathname}${u.search}`, `https://${u.host.startsWith('www.') ? u.host.slice(4) : 'www.' + u.host}${u.pathname}`];
  let err; for (const a of [...new Set(alt)]) { try { return await get(a); } catch (e) { err = e; } } throw err;
}
const robots = new Map();
/** Minimale robots.txt: Disallow-regels voor * of voor ons. */
async function allowed(url) {
  const { origin, pathname } = new URL(url);
  if (!robots.has(origin)) {
    let rules = [];
    try {
      const t = await (await fetch(origin + '/robots.txt', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) })).text();
      let mine = false;
      for (const line of t.split('\n')) {
        const [k, ...v] = line.split(':'), val = v.join(':').split('#')[0].trim(), key = k.trim().toLowerCase();
        if (key === 'user-agent') mine = val === '*' || /snuffelkaart/i.test(val);
        else if (mine && key === 'disallow' && val) rules.push(val);
      }
    } catch { /* geen robots.txt = alles mag */ }
    robots.set(origin, rules);
  }
  return !robots.get(origin).some(r => pathname.startsWith(r));
}
/** Links op dezelfde site die waarschijnlijk de tijden hebben. */
function candidates(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = (m[2].replace(/<[^>]+>/g, ' ') + ' ' + m[1]).toLowerCase();
    const score = /openingstijd|openingsuren|tijden/.test(label) ? 3 : /contact|bezoek|route|adres/.test(label) ? 2 : /winkel/.test(label) ? 1 : 0;
    if (!score) continue;
    try { const u = new URL(m[1], base); if (u.host === new URL(base).host && /^https?:$/.test(u.protocol)) out.push([score, u.href.split('#')[0]]); } catch { /* ongeldige link */ }
  }
  return [...new Map(out.sort((a, b) => b[0] - a[0]).map(([, u]) => [u, u])).keys()].slice(0, 2);
}

async function read(key, url) {
  const res = { url, read: new Date().toISOString(), oh: null, page: null, note: null };
  try {
    if (!(await allowed(url))) { res.note = 'robots.txt'; return res; }
    const first = await getAny(url); let html = first.html, at = first.url;
    let hit = hoursFromHtml(html);
    for (const next of hit ? [] : candidates(html, at)) {
      await sleep(PAUSE); if (!(await allowed(next))) continue;
      try { const r = await get(next); hit = hoursFromHtml(r.html); if (hit) { at = r.url; break; } } catch { /* volgende */ }
    }
    // Postcodes op de pagina (4 cijfers): staat de winkel er niet tussen, dan is het misschien een andere winkel (zie fetch-osm).
    if (hit) { res.oh = hit.oh; res.page = at; res.pc = [...new Set([...toText(html).matchAll(/\b([1-9]\d{3})\s?[A-Z]{2}\b/g)].map(m => m[1]))].slice(0, 12); } else res.note = 'geen tijden gevonden';
  } catch (e) {
    res.note = `fout: ${e.message ?? e.name}`;
    // Echt weg (domein bestaat niet meer, of 404/410), niet even onbereikbaar: onthoud sinds wanneer. Een vorige fout telt als eerste keer.
    if (gone(e)) { const prev = cache[key]; res.dead = prev?.dead ?? (prev?.note?.startsWith('fout') ? prev.read : res.read); }
  }
  return res;
}
const gone = e => e.cause?.code === 'ENOTFOUND' || /status 40[4]|status 410/.test(e.message); // verlopen certificaat, 403, 5xx: kan tijdelijk zijn

const hosts = [...byHost.values()]; let done = 0, found = 0;
const save = () => fs.writeFileSync(OUT, JSON.stringify(cache));
await Promise.all(Array.from({ length: WORKERS }, async () => {
  for (let q; (q = hosts.shift());) for (const [k, u] of q) {
    cache[k] = await read(k, u); done++; if (cache[k].oh) found++;
    if (done % 100 === 0) { console.log(`  ${done}/${todo.size} gelezen, ${found} met tijden`); save(); }
    await sleep(PAUSE);
  }
}));
save();
const all = Object.values(cache), notes = {};
for (const r of all) if (!r.oh) { const n = r.note?.startsWith('fout') ? 'fout (site niet bereikbaar)' : r.note; notes[n] = (notes[n] ?? 0) + 1; }
console.log(`Klaar: ${found} van ${done} nieuw gelezen sites met tijden. In cache: ${all.filter(r => r.oh).length} van ${all.length} met tijden.`, notes);
