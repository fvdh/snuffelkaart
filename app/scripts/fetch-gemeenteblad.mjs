// Markten uit het Gemeenteblad (§5.2, zie ../sources/gemeenteblad.md): vergunningen en meldingen → kandidaten in Supabase.
// Nooit direct op de kaart: een mens keurt ze in /beheer. CC-0; bron + link staan bij elke kandidaat.
//   node scripts/fetch-gemeenteblad.mjs                 publicaties van de laatste 3 dagen
//   node scripts/fetch-gemeenteblad.mjs --sinds=2026-08-01   (eerste vulling)
// ponytail: regels, geen AI. Wat de regels missen (verzamellijsten, datums zonder jaar) ziet de beheerder in het tekstfragment.
import { all, upsert, req } from './db.mjs';
import { todayIso } from './hours-precompute.mjs';

const SRU = 'https://repository.overheid.nl/sru', UA = 'Snuffelkaart/0.2 (gemeenteblad; freek@draad.nu)';
const TERMS = { rommelmarkt: 'Rommelmarkt', vlooienmarkt: 'Vlooienmarkt', snuffelmarkt: 'Snuffelmarkt', kofferbakmarkt: 'Kofferbakmarkt', kofferbakverkoop: 'Kofferbakmarkt', vrijmarkt: 'Vrijmarkt', garagesale: 'Garagesale', 'garage sale': 'Garagesale', braderie: 'Braderie' }; // braderie als laatste: alleen als er niets beters staat
const RULES = /verordening|beleidsregel|ruimtelijk plan|omgevingsdocument|algemene strekking/i; // regelgeving: de term staat in een opsomming
const MONTHS = ['jan', 'feb', 'mrt|maa', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const month = s => MONTHS.findIndex(m => new RegExp(`^(${m})`, 'i').test(s)) + 1;
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Alle datums met jaar in de tekst ("25 oktober 2026", "10-1-2027", "Zo. 17-01-2027"), uniek en gesorteerd. */
// Termijnen, geen marktdag: "bezwaar … tot en met 26 november", "ter inzage tot", "uiterlijk", besluit- en verzenddatum.
// En een datum direct na "voor"/"vóór" ("Dat doet u voor 29 oktober"): een markt is "op" een datum, niet ervoor.
// Ook als het woord erna komt, in dezelfde zin: "Vanaf 28 oktober 2026 ligt een afschrift … ter inzage" (Schiedam).
const NOT_EVENT = /(bezwaar|beroep|inzage|uiterlijk|zienswijze|besluitdatum|datum besluit|verzenddatum|ontvangen|bekendgemaakt)[^.•/]{0,60}$|\bv[oó]{2}r\s*$/i;
const NOT_EVENT_AFTER = /^[^.•]{0,120}\b(ter inzage|afschrift|bezwaar)/i;
export function dates(text) {
  const out = new Set(), keep = m => !NOT_EVENT.test(text.slice(Math.max(0, m.index - 90), m.index)) && !NOT_EVENT_AFTER.test(text.slice(m.index + m[0].length));
  for (const m of text.matchAll(/\b(\d{1,2})\s+(jan|feb|mrt|maart|apr|mei|jun|jul|aug|sep|okt|nov|dec)[a-z]*\.?\s+(20\d\d)\b/gi)) if (keep(m)) out.add(iso(m[3], month(m[2]), m[1]));
  for (const m of text.matchAll(/\b(\d{1,2})-(\d{1,2})-(20\d\d)\b/g)) if (+m[2] >= 1 && +m[2] <= 12 && keep(m)) out.add(iso(m[3], m[2], m[1]));
  return [...out].filter(d => !isNaN(new Date(d))).sort();
}
/** Eerste tijdvak ("9.00 tot 16.00", "10:00 uur tot 13:00 uur", "Tijd van: 09.00 Tijd tot: 16.30") in minuten. */
export function times(text) {
  const m = /\b(\d{1,2})[.:](\d{2})\s*(?:uur)?\s*(?:tot(?: en met)?|-|–|en|Tijd tot:)\s*(\d{1,2})[.:](\d{2})/i.exec(text);
  return m ? [+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]] : null;
}
/** "Heuvel 11 te Gerwen", "Arevenlaan 3 in Heythuysen", "Hoge Land 19 te Berkel en Rodenrijs" → de plaats. */
export const placeIn = text => /\b\d+[a-z]?\s+(?:te|in)\s+([A-Z][a-zà-ÿ'’]+(?:(?: en | |-)[A-Z][a-zà-ÿ'’]+){0,2})/.exec(text)?.[1] ?? null;
const stage = s => /melding/i.test(s) ? 'melding' : /aanvraag|aangevraagd|ontvangen|kennisgeving/i.test(s) ? 'aanvraag' : 'verleend';

/** Eén publicatie → kandidaat-edities (één per toekomstige datum, hooguit ruim een jaar vooruit). */
export function editions(rec, today, pdokPlace = null) {
  if (RULES.test(rec.rubriek)) return [];
  const all = `${rec.title} ${rec.tekst}`.toLowerCase(), term = Object.keys(TERMS).find(t => all.includes(t));
  if (!term) return [];
  // Braderie alleen met tweedehands erbij; anders kramen met nieuwe spullen (beoordeling 30 okt: 9 van de 9 afgewezen).
  if (term === 'braderie' && !/tweedehands|curiosa/.test(all)) return [];
  // Verzamelpublicatie ("* Aanvraag … voor Sinterklaas … * Aanvraag … voor Vlooienmarkt …"): alleen het item met de markt,
  // anders krijgt de markt de datum, tijd en plek van een ander evenement (Landgraaf, De Ronde Venen, 30 okt).
  const items = rec.tekst.split(/\s[*•]\s/), body = items.length > 2 ? items.filter(p => p.toLowerCase().includes(term)).join(' ') : rec.tekst;
  const until = iso(+today.slice(0, 4) + 1, +today.slice(5, 7), 28);
  const ds = dates(items.length > 2 ? body : `${rec.title} ${rec.tekst}`).filter(d => d >= today && d <= until);
  const [lat, lon] = rec.punt ? rec.punt.split(' ').map(Number) : [pdokPlace?.lat, pdokPlace?.lon];
  if (!ds.length || !Number.isFinite(lat)) return [];
  // Plaats: uit de metadata, anders "Heuvel 11 te Gerwen" in de tekst, en pas dan de gemeente ("Nuenen, Gerwen en Nederwetten").
  const t = times(body), place = rec.woonplaats || placeIn(body) || rec.gemeente;
  return ds.map(date => ({
    id: `${rec.id}-${date}`, date, status: 'kandidaat', source: 'gemeenteblad',
    data: {
      name: `${TERMS[term]} ${place}`, kind: TERMS[term], place, addr: rec.straat ? `${rec.straat}, ${place}` : null, date,
      start: t?.[0] ?? 540, end: t?.[1] ?? null, timeKnown: !!t, entree: 'onbekend', org: `Gemeenteblad ${rec.gemeente}`, url: rec.link, schema: '',
      lat: +lat.toFixed(5), lon: +lon.toFixed(5), exact: !!rec.punt, checked: today, stage: stage(`${rec.rubriek} ${rec.title}`),
      snippet: rec.tekst.replace(/^GEMEENTEBLAD Officiële uitgave van de gemeente [^ ]+( [^ ]+)? ?/, '').slice(0, 700),
    },
  }));
}

/** Zelfde markt die we al hebben (organisator, of een eerdere aanvraag/vergunning): zelfde dag, binnen 1 km. */
export const dupOf = (e, known) => known.some(k => k.date === e.date && Math.hypot((k.data.lat - e.data.lat) * 111, (k.data.lon - e.data.lon) * 68) < 1);

// ---------- ophalen ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const tag = (xml, n) => (xml.match(new RegExp(`<${n}[^>]*>([^<]*)</${n}>`)) || [])[1] || '';
const text = xml => xml.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;|&\w+;/g, ' ').replace(/\s+/g, ' ').trim();
async function get(url) {
  for (let i = 1; i <= 3; i++) { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (r.ok) return r.text(); await wait(3000 * i); }
  throw new Error(`mislukt: ${url}`);
}
async function search(since, to) {
  const recs = new Map();
  for (const term of Object.keys(TERMS)) {
    for (let start = 1; start;) {
      const q = `c.product-area==officielepublicaties AND w.publicatienaam==Gemeenteblad AND dt.available>=${since} AND dt.available<=${to} AND cql.textAndIndexes="${term}"`;
      const xml = await get(`${SRU}?${new URLSearchParams({ query: q, maximumRecords: '100', startRecord: String(start) })}`);
      for (const r of xml.split('<sru:record>').slice(1)) {
        const id = tag(r, 'dcterms:identifier');
        if (!recs.has(id)) recs.set(id, { id, title: tag(r, 'dcterms:title'), gemeente: tag(r, 'dcterms:creator'), rubriek: tag(r, 'dcterms:type'), punt: tag(r, 'overheidwetgeving:locatiepunt'),
          straat: tag(r, 'overheidwetgeving:straatnaam'), woonplaats: tag(r, 'overheidwetgeving:woonplaats'), link: tag(r, 'gzd:preferredUrl'), xml: tag(r, 'gzd:url') });
      }
      start = +tag(xml, 'sru:nextRecordPosition') || 0; await wait(1000);
    }
  }
  return [...recs.values()];
}
async function pdok(gemeente) {
  const r = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?${new URLSearchParams({ q: gemeente, fq: 'type:gemeente', rows: '1' })}`);
  const p = /POINT\(([\d.]+) ([\d.]+)\)/.exec((await r.json()).response?.docs?.[0]?.centroide_ll ?? '');
  return p ? { lon: +p[1], lat: +p[2] } : null;
}

async function main() {
  const today = todayIso(), since = process.argv.find(a => a.startsWith('--sinds='))?.slice(8) ?? new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const recs = (await search(since, today)).filter(r => !RULES.test(r.rubriek));
  const known = (await all('markets')).filter(r => r.date >= today && r.status !== 'afgewezen');
  const out = [];
  for (const r of recs) {
    try { r.tekst = text(await get(r.xml)).slice(0, 4000); } catch { continue; }
    await wait(1000);
    const eds = editions(r, today, r.punt ? null : await pdok(r.gemeente));
    for (const e of eds) if (!dupOf(e, [...known, ...out])) out.push(e);
  }
  await upsert('markets', out, { ignore: true });
  await req('import_runs', { method: 'POST', body: JSON.stringify({ source: 'gemeenteblad', counts: { since, publications: recs.length, candidates: out.length } }) });
  console.log(`Gemeenteblad ${since} t/m ${today}: ${recs.length} publicaties → ${out.length} kandidaten (nieuw of al bekend: Supabase slaat bestaande over)`);
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
