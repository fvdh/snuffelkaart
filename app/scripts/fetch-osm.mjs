// Haalt kringloopwinkels uit OpenStreetMap (proefregio Utrecht + Gelderland) en schrijft public/data/places.json.
// Gebruik: npm run data:osm            (haalt opnieuw op via Overpass)
//          npm run data:osm -- --cached (gebruikt data-raw/osm.json)
// ponytail: Overpass met een rechthoek; de echte wekelijkse import gaat via het Geofabrik-extract + osmium (§5.1).
import fs from 'node:fs';
import { precompute, holidays, todayIso, DAYS_AHEAD } from './hours-precompute.mjs';

const BBOX = [51.73, 4.79, 52.52, 6.83]; // z, w, n, o: Utrecht + Gelderland (met randjes van buurprovincies)
const QUERY = `[out:json][timeout:90];(nwr["shop"~"^(second_hand|charity)$"](${BBOX.join(',')}););out center tags;`;
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const UA = 'Snuffelkaart-PoC/0.1 (contact: freek@draad.nu)';
const RAW = new URL('../data-raw/osm.json', import.meta.url);
const OUT = new URL('../public/data/places.json', import.meta.url);

async function fetchOverpass() {
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

// Valse treffers (§14.4). "Kringloop" alleen als naam of keten het zegt; anders eerlijk "tweedehands".
const KRINGLOOP = /kringloop|kringkoop|ringloop|kringwinkel|ecokring|het goed|woord (en|&) daad|2switch|emmaus|rataplan|reshare|humana|snuffel|weggeef|ruilwinkel|goede doel/i;
// Geen tweedehands: winkels met nieuwe spullen. Dumpstores en dergelijke blijven, als tweedehandswinkel.
const NOT_SECOND_HAND = /wereldwinkel|unicef|eine.welt/i;
// Handmatig, per OSM-id: soort corrigeren of weglaten (null), met reden. Bij twijfel: OSM zelf verbeteren.
const FIXES = {
  // 'osm-n123': { kind: 'kringloop', why: 'kringloop volgens eigen website' },
  // 'osm-n456': { kind: null, why: 'gesloten, nog niet uit OSM' },
};
const CHARITY = /dorcas|terres? des hommes|leger des heils|leprawinkel|rode kruis/i;
const kindOf = t => t.shop === 'charity' || CHARITY.test(t.name || '') ? 'goede-doelen' : KRINGLOOP.test(t.name || '') ? 'kringloop' : 'tweedehands';

// Proefregio: precies Utrecht + Gelderland, op de provinciegrenzen van het CBS (via PDOK).
const PROV = new URL('../data-raw/provincies.json', import.meta.url), REGION = ['Utrecht', 'Gelderland'];
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
const regionPolys = (await provinces()).features.filter(f => REGION.includes(f.properties.statnaam))
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
      id: `osm-${e.type[0]}${e.id}`, t: 'k', kind: kindOf(t), name: t.name.trim(), lat: +lat.toFixed(6), lon: +lon.toFixed(6),
      addr: [street, [t['addr:postcode'], city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null, place: city || null,
      h, ohRaw: t.opening_hours && !h ? t.opening_hours : undefined,
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

fs.mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), source: '© OpenStreetMap-bijdragers (ODbL)', bbox: BBOX, from: FROM, days: DAYS_AHEAD, holidays: holidays(FROM), places }));

const n = places.length, pct = x => `${Math.round(100 * x / n)}%`;
const count = f => places.filter(f).length;
const unnamed = raw.elements.filter(e => !e.tags?.name).length;
console.log(`\nKringlopen proefregio: ${n} (van ${raw.elements.length} OSM-objecten, ${unnamed} zonder naam)`);
console.log(`  openingstijden leesbaar: ${count(p => p.h)} (${pct(count(p => p.h))}), onleesbaar: ${count(p => p.ohRaw)}, geen: ${count(p => !p.h && !p.ohRaw)}`);
console.log(`  met controledatum: ${count(p => p.checked)}  adres: ${pct(count(p => p.addr))}  website: ${pct(count(p => p.website))}  telefoon: ${pct(count(p => p.phone))}`);
console.log(`  weggelaten: buiten regio ${dropped.region}, geen tweedehands ${dropped.notSecondHand}, handmatig ${dropped.manual}`);
console.log(`  soort: kringloop ${count(p => p.kind === 'kringloop')}, goede doelen ${count(p => p.kind === 'goede-doelen')}, tweedehands (soort onbekend of geen kringloop) ${count(p => p.kind === 'tweedehands')}`);
console.log(`  geschreven: ${OUT.pathname} (${(fs.statSync(OUT).size / 1024).toFixed(0)} kB)\n`);
