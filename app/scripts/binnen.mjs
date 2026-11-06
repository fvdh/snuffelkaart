// Binnen of buiten (nov 2026): vult `indoor` aan bij markten waar de organisator het niet zegt, met de reden erbij (binnenBron, staat in de app).
// Draait elke nacht na het inlezen van de markten en vóór de export (nachtelijk.yml). Wat al bekend is, of in beheer vastgezet, blijft staan.
// Volgorde, de eerste die iets weet wint:
//   1. soort      garagesale en braderie zijn buiten
//   2. locatie    de naam van de plek (eerste deel van venue of adres): "Sporthal De Schilp", "Niedorphal" → binnen; "Veerplein" → buiten
//   3. adres      hetzelfde adres als een markt waarvan we het wel weten
//   4. Kadaster   het gebouw op precies dit huisnummer (BAG via PDOK): sport- of bijeenkomstfunctie, of een grote bedrijfshal → binnen.
//                 Niet bij kofferbakmarkten: die staan vaak op de parkeerplaats van zo'n gebouw.
// Gebruik: node scripts/binnen.mjs [--dry]
import { req, all } from './db.mjs';

const BINNEN = /hal(len)?\b|\barena\b|autotron|gelredome|dome\b|\bexpo\b|beurs|sport ?(centrum|center|complex)|\bmfa\b|multifunctione|dorpshuis|buurthuis|wijkcentrum|gemeenschapshuis|\bkerk\b|\bzaal\b|schouwburg|theater|manege|\bloods\b|congres|martiniplaza|jaarbeurs|ahoy|mecc/i;
const BUITEN = /plein\b|parkeer(terrein|plaats)|weiland|\bweide\b|strand|evenemententerrein|kermisterrein|\bhaven\b|\bkade\b|boulevard|openlucht|landgoed|\bnabij\b/i;
const adresSleutel = a => (a ? a.toLowerCase().replace(/\s+/g, ' ').split(',')[0].trim() : null);
/** Straten in een adres, zonder huisnummer ("Sporthal Strijthagen, Hofstraat 2, Landgraaf" → "hofstraat|landgraaf"). */
export const straten = (addr, place) => (addr ?? '').toLowerCase().split(',').map(x => /^([a-z][a-z .'-]*?)(\s+\d.*)?$/.exec(x.trim())?.[1]).filter(Boolean).filter(x => x !== (place ?? '').toLowerCase()).map(x => `straat:${x}|${(place ?? '').toLowerCase()}`);

/** Regels 1 t/m 3 (zonder netwerk). bekend: adres → { indoor, naam } van markten waarvan we het weten. */
export function raad(m, bekend = new Map()) {
  if (/^garagesale$/i.test(m.kind)) return { indoor: false, bron: 'een garagesale is bij mensen thuis, niet in een hal' };
  if (/^braderie$/i.test(m.kind)) return { indoor: false, bron: 'een braderie is op straat' };
  for (const t of [m.venue, m.addr].filter(Boolean)) {
    const eerste = t.split(',')[0];
    if (BINNEN.test(eerste)) return { indoor: true, bron: `de locatie is ${eerste.trim()}` };
    if (BUITEN.test(eerste)) return { indoor: false, bron: `de locatie is ${eerste.trim()}` };
  }
  const k = adresSleutel(m.addr), b = k && bekend.get(k);
  if (b) return { indoor: b.indoor, bron: `zelfde adres als ${b.naam}` };
  // Alleen een straat, zonder huisnummer: dezelfde straat in dezelfde plaats als een markt waarvan we het weten.
  if (m.addr && !/\d/.test(m.addr)) for (const s of straten(m.addr, m.place)) { const b2 = bekend.get(s); if (b2) return { indoor: b2.indoor, bron: `zelfde straat als ${b2.naam}` }; }
  return null;
}

/** Regel 4: het gebouw op dit adres volgens de BAG. Alleen als het huisnummer klopt; 2A voor 2 alleen als de organisator de locatie bij naam noemt. */
export function uitBag(vbo) {
  const doel = vbo?.gebruiksdoel ?? '';
  if (/sportfunctie/.test(doel)) return { indoor: true, bron: 'het gebouw op dit adres is een sportgebouw, volgens het Kadaster' };
  if (/bijeenkomstfunctie/.test(doel)) return { indoor: true, bron: 'het gebouw op dit adres is voor bijeenkomsten, volgens het Kadaster' };
  if (/industriefunctie/.test(doel) && vbo.oppervlakte >= 500) return { indoor: true, bron: 'op dit adres staat een bedrijfshal, volgens het Kadaster' };
  return null;
}

async function bag(addr, venue) {
  const nr = /\s(\d+)\b/.exec(addr.split(',')[0])?.[1]; if (!nr) return null;
  const u = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?${new URLSearchParams({ q: addr, fq: 'type:adres', rows: '1', fl: 'weergavenaam,huisnummer,huisletter,huisnummertoevoeging,adresseerbaarobject_id' })}`;
  const d = (await (await fetch(u)).json()).response?.docs?.[0];
  if (!d || String(d.huisnummer) !== nr || ((d.huisletter || d.huisnummertoevoeging) && !venue)) return null;
  const r = await fetch(`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?f=json&identificatie=${d.adresseerbaarobject_id}`);
  return r.ok ? (await r.json()).features?.[0]?.properties ?? null : null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dry = process.argv.includes('--dry'), today = new Date().toISOString().slice(0, 10);
  const rows = (await all('markets')).filter(r => r.date >= today);
  const bekend = new Map();
  // Adressen leren van markten waar de organisator het zegt; niet van "Openlucht …" of "Overdekte …" (dan wisselt het per editie), en alleen als ze het eens zijn.
  for (const r of rows) {
    const k = adresSleutel(r.data.addr); if (!k || typeof r.data.indoor !== 'boolean' || r.data.binnenBron || /openlucht|buiten|binnen|overdekt|indoor/i.test(r.data.name)) continue;
    for (const key of [k, ...straten(r.data.addr, r.data.place)]) { const b = bekend.get(key); bekend.set(key, b && (b.oneens || b.indoor !== r.data.indoor) ? { oneens: true } : { indoor: r.data.indoor, naam: r.data.name }); }
  }
  for (const [k, b] of bekend) if (b.oneens) bekend.delete(k);
  for (const r of rows) if (/openlucht|buiten|binnen|overdekt|indoor/i.test(r.data.name ?? '')) [adresSleutel(r.data.addr), ...straten(r.data.addr, r.data.place)].forEach(k => bekend.delete(k)); // gemengde locatie
  const open = rows.filter(r => r.data.indoor === undefined && !r.locked.includes('indoor'));
  const cache = new Map(); let n = 0;
  for (const r of open) {
    const m = { ...r.data, kind: r.data.kind ?? '' };
    let g = raad(m, bekend);
    if (!g && m.addr && !/kofferbak/i.test(m.kind)) {
      if (!cache.has(m.addr)) cache.set(m.addr, await bag(m.addr, m.venue).catch(() => null));
      g = uitBag(cache.get(m.addr));
    }
    if (!g) continue;
    r.data.binnenBron = g.bron; n++; console.log(`${g.indoor ? 'binnen' : 'buiten'}  ${m.name} (${r.date}): ${g.bron}`);
    if (!dry) await req(`markets?id=eq.${encodeURIComponent(r.id)}`, { method: 'PATCH', body: JSON.stringify({ data: { ...r.data, indoor: g.indoor, binnenBron: g.bron } }) });
  }
  console.log(`${n} van ${open.length} markten zonder binnen/buiten aangevuld${dry ? ' (dry)' : ''}.`);
  if (process.argv.includes('--rest')) for (const r of open.filter(r => !r.data.binnenBron)) console.log('  ?', r.date, r.data.name, '|', r.data.venue ?? '', '|', r.data.addr ?? '');
}
