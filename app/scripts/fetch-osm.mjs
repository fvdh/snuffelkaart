// Haalt kringloopwinkels uit OpenStreetMap (heel Nederland), voegt Overture toe (data-raw/overture.json,
// zie fetch-overture.mjs) en schrijft public/data/places.json.
// Gebruik: npm run data:osm            (haalt opnieuw op via Overpass)
//          npm run data:osm -- --cached (gebruikt data-raw/osm.json)
// ponytail: Overpass met een rechthoek; de echte wekelijkse import gaat via het Geofabrik-extract + osmium (§5.1).
import fs from 'node:fs';
import { precompute, holidays, todayIso, DAYS_AHEAD } from './hours-precompute.mjs';
import { siteKey } from './hours-from-web.mjs';
import { kindOf, refine } from './soort.mjs';

const BBOX = [50.75, 3.35, 53.56, 7.23]; // z, w, n, o: heel Nederland (knippen op de grens gebeurt hieronder)
const TILES = []; // 3 × 3 vakken: één query voor heel NL loopt op de publieke Overpass-servers vaak in een time-out
for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { const dz = (BBOX[2] - BBOX[0]) / 3, dw = (BBOX[3] - BBOX[1]) / 3; TILES.push([BBOX[0] + a * dz, BBOX[1] + b * dw, BBOX[0] + (a + 1) * dz, BBOX[1] + (b + 1) * dw].map(x => +x.toFixed(3))); }
const query = b => `[out:json][timeout:180];(nwr["shop"~"^(second_hand|charity)$"](${b.join(',')}););out center tags;`;
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const UA = 'Snuffelkaart-PoC/0.1 (contact: freek@draad.nu)';
const RAW = new URL('../data-raw/osm.json', import.meta.url);
const OUT = new URL('../public/data/places.json', import.meta.url);
const OH_OUT = new URL('../data/hours.json', import.meta.url); // id → opening_hours; de nachtelijke build rekent hiermee opnieuw vooruit (refresh-hours.mjs)
const ohSrc = {};

async function fetchTile(QUERY) {
  for (const url of ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(QUERY) });
        const text = await res.text();
        if (res.ok && text.startsWith('{')) return JSON.parse(text);
        console.warn(`${url} gaf ${res.status}, poging ${attempt}`);
      } catch (e) { console.warn(`${url}: ${e.message}`); }
      await new Promise(r => setTimeout(r, 4000 * attempt));
    }
  }
  throw new Error('Geen Overpass-server bereikbaar. Probeer later opnieuw, of gebruik --cached.');
}
async function fetchOverpass() {
  const seen = new Map();
  for (const [i, b] of TILES.entries()) { const j = await fetchTile(query(b)); for (const e of j.elements) seen.set(e.type + e.id, e); console.log(`  vak ${i + 1}/${TILES.length}: ${j.elements.length}`); }
  return { elements: [...seen.values()] };
}

// Geen tweedehands: winkels met nieuwe spullen. Dumpstores en dergelijke blijven, als tweedehandswinkel.
const NOT_SECOND_HAND = /wereldwinkel|unicef|eine.welt/i;
// Handmatig, per OSM-id: soort corrigeren of weglaten (null), met reden. Bij twijfel: OSM zelf verbeteren.
const FIXES = {
  // 'osm-n123': { kind: 'kringloop', why: 'kringloop volgens eigen website' },
  // 'osm-n456': { kind: null, why: 'gesloten, nog niet uit OSM' },
};

// Regio: Nederland (of een paar provincies), op de provinciegrenzen van het CBS (via PDOK).
const PROV = new URL('../data-raw/provincies.json', import.meta.url), REGION = null; // null = heel Nederland; of bijv. ['Utrecht', 'Gelderland']
async function provinces() {
  if (process.argv.includes('--cached') && fs.existsSync(PROV)) return JSON.parse(fs.readFileSync(PROV, 'utf8'));
  const res = await fetch('https://service.pdok.nl/cbs/gebiedsindelingen/2024/wfs/v1_0?service=WFS&version=2.0.0&request=GetFeature&typeName=gebiedsindelingen:provincie_gegeneraliseerd&outputFormat=json&srsName=EPSG:4326');
  const j = await res.json(); fs.mkdirSync(new URL('../data-raw/', import.meta.url), { recursive: true }); fs.writeFileSync(PROV, JSON.stringify(j)); return j;
}
/** Even-oneven-regel; ringen van een multipolygoon (inclusief gaten) tellen samen. */
export function inside([x, y], polys) {
  let c = false;
  for (const poly of polys) for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const regionPolys = (await provinces()).features.filter(f => !REGION || REGION.includes(f.properties.statnaam))
  .flatMap(f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);

const FROM = todayIso();

const raw = process.argv.includes('--cached') ? JSON.parse(fs.readFileSync(RAW, 'utf8')) : await fetchOverpass();
fs.mkdirSync(new URL('../data-raw/', import.meta.url), { recursive: true });
fs.writeFileSync(RAW, JSON.stringify(raw));

let places = raw.elements
  .filter(e => e.tags && e.tags.name)
  .map(e => {
    const t = e.tags, lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
    const city = t['addr:city'] || '';
    const h = t.opening_hours ? precompute(t.opening_hours, FROM) : null;
    return {
      id: `osm-${e.type[0]}${e.id}`, t: 'k', kind: kindOf(t), name: t.name.trim(), lat: +lat.toFixed(5), lon: +lon.toFixed(5),
      addr: [street, [t['addr:postcode'], city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null, place: city || null,
      h, ohRaw: t.opening_hours && !h ? t.opening_hours : undefined, oh: h ? t.opening_hours : undefined,
      checked: t['check_date:opening_hours'] || t.check_date || t['survey:date'] || null,
      website: t.website || t['contact:website'] || null, phone: t.phone || t['contact:phone'] || null,
      wheelchair: t.wheelchair || null, src: 'osm',
    };
  })
  .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

const dropped = { region: 0, notSecondHand: 0, manual: 0 };
places = places.filter(p => {
  if (!inside([p.lon, p.lat], regionPolys)) return dropped.region++, false;
  if (NOT_SECOND_HAND.test(p.name)) return dropped.notSecondHand++, false;
  const fix = FIXES[p.id]; if (fix) { if (fix.kind === null) return dropped.manual++, false; p.kind = fix.kind; }
  return true;
});

// ---------- Overture erbij (§5.1): alleen wat OSM nog niet heeft ----------
// ponytail: ontdubbelen op afstand + naam. Twee echt verschillende winkels binnen 100 m worden er één; een beheerqueue lost dat later op.
const OV = new URL('../data-raw/overture.json', import.meta.url);
const SUB = { antique_store: 'antiek', second_hand_clothing_store: 'kleding', junkyard: 'schroot', pawn_shop: 'pandjeshuis', flea_market: 'vlooienmarkt' };
const STOP = new Set(['kringloop', 'kringloopwinkel', 'kringloopcentrum', 'kringwinkel', 'winkel', 'stichting', 'foundation', 'tweedehands', 'shop', 'store', 'centrum', 'the', 'van', 'het', 'den', 'voor', 'and', 'en']);
const words = s => new Set(s.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length > 2 && !STOP.has(w)));
const sameName = (a, b) => { const B = words(b); return [...words(a)].some(w => B.has(w)); };
const metres = (a, b) => Math.hypot((a.lon - b.lon) * 111320 * Math.cos(a.lat * Math.PI / 180), (a.lat - b.lat) * 110540);
const isDup = (o, p) => { const d = metres(o, p); return d < 100 || (d < 400 && sameName(o.name, p.name)); };
const nice = s => s && s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, c => c.toUpperCase()) : s;
/** Overture geeft 31642158684; wij tonen 0642158684. Buitenlandse nummers krijgen een +. */
const telNL = t => { if (!t) return null; const d = t.replace(/[^\d]/g, ''); return /^31\d{9}$/.test(d) ? '0' + d.slice(2) : /^0\d{9}$/.test(d) ? d : '+' + d; };
const ovStat = { enriched: 0, rows: 0, region: 0, closed: 0, dup: 0, notSecondHand: 0, added: 0, release: null };
if (fs.existsSync(OV)) {
  const ov = JSON.parse(fs.readFileSync(OV, 'utf8')); ovStat.release = ov.release; ovStat.rows = ov.rows.length;
  const osmPlaces = [...places];
  for (const o of ov.rows.sort((a, b) => b.conf - a.conf)) { // hoogste betrouwbaarheid wint bij dubbelingen binnen Overture
    if (!o.name || !Number.isFinite(o.lat)) continue;
    if (!inside([o.lon, o.lat], regionPolys)) { ovStat.region++; continue; }
    if (o.status === 'permanently_closed') { ovStat.closed++; continue; }
    if (NOT_SECOND_HAND.test(o.name)) { ovStat.notSecondHand++; continue; }
    const twin = places.find(p => isDup(o, p));
    if (twin) { // zelfde winkel: lege velden aanvullen uit Overture, OSM houdt voorrang
      ovStat.dup++;
      const fill = { website: o.website || null, phone: telNL(o.phone) };
      let hit = false; for (const k in fill) if (!twin[k] && fill[k]) { twin[k] = fill[k]; (twin.from ??= {})[k] = 'overture'; hit = true; }
      if (hit) ovStat.enriched++;
      continue;
    }
    const city = nice(o.city) || null;
    places.push({
      id: `ov-${o.id.replace(/-/g, '').slice(0, 12)}`, /* ingekort: scheelt ±100 kB, stabiel zolang Overture het id houdt */ t: 'k', kind: kindOf({ name: o.name }), sub: SUB[o.cat] ?? undefined, name: o.name.trim(), lat: +o.lat.toFixed(5), lon: +o.lon.toFixed(5),
      addr: [nice(o.street), [o.postcode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null, place: city,
      h: null, checked: null, website: o.website || null, phone: telNL(o.phone), conf: o.conf, src: 'overture',
    });
    ovStat.added++;
  }
  ovStat.osmOnly = osmPlaces.filter(p => !ov.rows.some(o => metres(o, p) < 150)).length;
}

places.forEach(refine); // soort pas nu: de website kan uit Overture komen

// ---------- Openingstijden van de eigen website van de winkel (fetch-web-hours.mjs) ----------
const WEB = new URL('../data-raw/web-hours.json', import.meta.url), webStat = { used: 0, shared: 0, market: 0, otherShop: 0 };
if (fs.existsSync(WEB)) {
  const web = JSON.parse(fs.readFileSync(WEB, 'utf8')), uses = new Map();
  for (const p of places) if (p.website) { const k = siteKey(p.website); uses.set(k, (uses.get(k) ?? 0) + 1); }
  for (const p of places) {
    const k = !p.h && p.website && siteKey(p.website), w = k && web[k];
    if (!w?.oh) continue;
    if (uses.get(k) > 1) { webStat.shared++; continue; } // ketenpagina (bijv. /contact van het hoofdkantoor): hoort niet bij één winkel
    if (p.sub === 'vlooienmarkt') { webStat.market++; continue; } // vaste markt: tijden gelden alleen op marktdagen, niet elke week
    const pc = /\b([1-9]\d{3})\s?[A-Z]{2}\b/.exec(p.addr ?? '')?.[1];
    // Pagina noemt alleen postcodes uit een andere buurt (eerste 3 cijfers): waarschijnlijk een andere winkel of het hoofdkantoor.
    // Niet exact vergelijken: de postcode in OSM/Overture wijkt vaak een paar huizen af (4131 ↔ 4132).
    if (pc && w.pc?.length && !w.pc.some(x => x.slice(0, 3) === pc.slice(0, 3))) { webStat.otherShop++; continue; }
    const h = precompute(w.oh, FROM); if (!h) continue;
    Object.assign(p, { h, oh: w.oh, checked: w.read.slice(0, 10), hs: 'web', hu: w.page }); webStat.used++;
  }
}

for (const p of places) { if (p.oh) ohSrc[p.id] = p.oh; delete p.oh; }
fs.mkdirSync(new URL('../data/', import.meta.url), { recursive: true }); fs.writeFileSync(OH_OUT, JSON.stringify(ohSrc, null, 0));
fs.mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), source: '© OpenStreetMap-bijdragers (ODbL); Overture Maps Foundation (CDLA Permissive 2.0)', overture: ovStat.release, bbox: BBOX, from: FROM, days: DAYS_AHEAD, holidays: holidays(FROM), places }, (k, v) => (v === null ? undefined : v))); // lege velden weglaten

const n = places.length, pct = x => `${Math.round(100 * x / n)}%`;
const count = f => places.filter(f).length;
const unnamed = raw.elements.filter(e => !e.tags?.name).length;
console.log(`\nWinkels: ${n} (van ${raw.elements.length} OSM-objecten, ${unnamed} zonder naam)`);
console.log(`  openingstijden leesbaar: ${count(p => p.h)} (${pct(count(p => p.h))}), onleesbaar: ${count(p => p.ohRaw)}, geen: ${count(p => !p.h && !p.ohRaw)}`);
console.log(`  met controledatum: ${count(p => p.checked)}  adres: ${pct(count(p => p.addr))}  website: ${pct(count(p => p.website))}  telefoon: ${pct(count(p => p.phone))}`);
console.log(`  weggelaten: buiten regio ${dropped.region}, geen tweedehands ${dropped.notSecondHand}, handmatig ${dropped.manual}`);
console.log(`  soort: kringloop ${count(p => p.kind === 'kringloop')}, goede doelen ${count(p => p.kind === 'goede-doelen')}, tweedehands (soort onbekend of geen kringloop) ${count(p => p.kind === 'tweedehands')}`);
if (ovStat.release) console.log(`  Overture ${ovStat.release}: ${ovStat.rows} plekken → ${ovStat.added} toegevoegd (dubbel met OSM/Overture ${ovStat.dup}, waarvan ${ovStat.enriched} OSM-winkels aangevuld met website/telefoon, buiten regio ${ovStat.region}, gesloten ${ovStat.closed}, geen tweedehands ${ovStat.notSecondHand}); alleen in OSM: ${ovStat.osmOnly}`);
if (fs.existsSync(WEB)) console.log(`  tijden van eigen website: ${webStat.used} winkels (overgeslagen: ${webStat.shared} gedeelde ketenpagina, ${webStat.otherShop} andere postcode op de pagina, ${webStat.market} vaste markt)`);
console.log(`  bron: OSM ${count(p => p.src === 'osm')}, Overture ${count(p => p.src === 'overture')}`);
console.log(`  geschreven: ${OUT.pathname} (${(fs.statSync(OUT).size / 1024).toFixed(0)} kB)\n`);
