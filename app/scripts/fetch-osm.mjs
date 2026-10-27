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

// Valse treffers (§14.4): vintage-boetieks en weggeefwinkels zijn geen kringloop, maar wel interessant. We markeren, filteren niet.
const KRINGLOOP = /kringloop|kringwinkel|tweedehands|2e ?hands|het goed|emmaus|rataplan|leger des heils|reshare|dorcas|terre des hommes|humana|snuffel|weggeef|goede doel|stichting/i;
const VINTAGE = /vintage|used|retro|2switch|second ?hand|design|curiosa|antiek/i;
const kindOf = t => t.shop === 'charity' ? 'goede-doelen' : KRINGLOOP.test(t.name || '') ? 'kringloop' : VINTAGE.test(t.name || '') ? 'tweedehands' : 'kringloop';

const FROM = todayIso();

const raw = process.argv.includes('--cached') ? JSON.parse(fs.readFileSync(RAW, 'utf8')) : await fetchOverpass();
fs.mkdirSync(new URL('../data-raw/', import.meta.url), { recursive: true });
fs.writeFileSync(RAW, JSON.stringify(raw));

const places = raw.elements
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

fs.mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), source: '© OpenStreetMap-bijdragers (ODbL)', bbox: BBOX, from: FROM, days: DAYS_AHEAD, holidays: holidays(FROM), places }));

const n = places.length, pct = x => `${Math.round(100 * x / n)}%`;
const count = f => places.filter(f).length;
console.log(`\nKringlopen proefregio: ${n} (van ${raw.elements.length} OSM-objecten, ${raw.elements.length - n} zonder naam)`);
console.log(`  openingstijden leesbaar: ${count(p => p.h)} (${pct(count(p => p.h))}), onleesbaar: ${count(p => p.ohRaw)}, geen: ${count(p => !p.h && !p.ohRaw)}`);
console.log(`  met controledatum: ${count(p => p.checked)}  adres: ${pct(count(p => p.addr))}  website: ${pct(count(p => p.website))}  telefoon: ${pct(count(p => p.phone))}`);
console.log(`  soort: kringloop ${count(p => p.kind === 'kringloop')}, goede doelen ${count(p => p.kind === 'goede-doelen')}, tweedehands (waarschijnlijk geen kringloop) ${count(p => p.kind === 'tweedehands')}`);
console.log(`  geschreven: ${OUT.pathname} (${(fs.statSync(OUT).size / 1024).toFixed(0)} kB)\n`);
