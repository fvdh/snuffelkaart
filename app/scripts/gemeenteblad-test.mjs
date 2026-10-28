// Gemeenteblad-test (M0, zie sources/gemeenteblad.md). Los script, niet gekoppeld aan de app.
// Opgevolgd door fetch-gemeenteblad.mjs (kandidaten in Supabase); dit blijft alleen voor onderzoek.
// Zoekt in de SRU-zoekdienst van Officiële Bekendmakingen (CC-0) naar Gemeenteblad-publicaties over
// markten, haalt van elke treffer de XML-tekst op en schrijft alles naar één JSON-bestand.
// Gebruik: node scripts/gemeenteblad-test.mjs [van] [tot] [uitvoer.json]
//          node scripts/gemeenteblad-test.mjs 2026-09-27 2026-10-27 /tmp/gmb.json
import fs from 'node:fs';

const [FROM = '2026-09-27', TO = '2026-10-27', OUT = 'gemeenteblad-test.json'] = process.argv.slice(2);
const SRU = 'https://repository.overheid.nl/sru';
const UA = 'Snuffelkaart-PoC/0.1 (gemeenteblad-test; freek@draad.nu)';
// Tussen aanhalingstekens: de index stemt zelf ("rommelmarkt" vindt ook "rommelmarkten"); een * werkt níet betrouwbaar.
const TERMS = ['"rommelmarkt"', '"vlooienmarkt"', '"kofferbakmarkt"', '"kofferbakverkoop"', '"braderie"', '"vrijmarkt"', '"garagesale"', '"garage sale"', '"snuffelmarkt"', '"curiosamarkt"'];
const wait = ms => new Promise(r => setTimeout(r, ms));

const query = term => `c.product-area==officielepublicaties AND w.publicatienaam==Gemeenteblad AND dt.available>=${FROM} AND dt.available<=${TO} AND cql.textAndIndexes=${term}`;
const tag = (xml, name) => (xml.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`)) || [])[1] || '';
const text = xml => xml.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;|&\w+;/g, ' ').replace(/\s+/g, ' ').trim();

async function get(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.text();
    console.warn(`${res.status} ${url}`); await wait(3000 * attempt);
  }
  throw new Error(`mislukt: ${url}`);
}

const records = new Map(), counts = {};
for (const term of TERMS) {
  let start = 1;
  counts[term] = 0;
  while (start) {
    const xml = await get(`${SRU}?${new URLSearchParams({ query: query(term), maximumRecords: '100', startRecord: String(start) })}`);
    counts[term] = +tag(xml, 'sru:numberOfRecords');
    for (const r of xml.split('<sru:record>').slice(1)) {
      const id = tag(r, 'dcterms:identifier');
      const rec = records.get(id) || {
        id, title: tag(r, 'dcterms:title'), gemeente: tag(r, 'dcterms:creator'), datum: tag(r, 'dcterms:available'),
        rubriek: tag(r, 'dcterms:type'), punt: tag(r, 'overheidwetgeving:locatiepunt'),
        straat: tag(r, 'overheidwetgeving:straatnaam'), woonplaats: tag(r, 'overheidwetgeving:woonplaats'),
        link: tag(r, 'gzd:preferredUrl'), xml: tag(r, 'gzd:url'), terms: [],
      };
      rec.terms.push(term);
      records.set(id, rec);
    }
    start = +tag(xml, 'sru:nextRecordPosition') || 0;
    await wait(1000);
  }
  console.log(`${term}: ${counts[term]}`);
}

for (const rec of records.values()) {
  try { rec.tekst = text(await get(rec.xml)).slice(0, 4000); } catch (e) { rec.tekst = ''; console.warn(e.message); }
  await wait(1000);
}
fs.writeFileSync(OUT, JSON.stringify({ van: FROM, tot: TO, opgehaald: new Date().toISOString(), counts, records: [...records.values()] }, null, 1));
console.log(`${records.size} unieke publicaties → ${OUT}`);
