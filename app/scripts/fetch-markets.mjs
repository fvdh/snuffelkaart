// Markten van de eigen agenda van organisatoren (§5.2) → public/data/markets.json.
// Eerste organisator: Don Events (zie ../sources/donevents.md voor robots.txt en voorwaarden).
// Regels: alleen feiten, hooguit één keer per dag, eigen User-Agent, bron + link, status "gecontroleerd".
// Gebruik: npm run data:markets
import fs from 'node:fs';
import { toText } from './hours-from-web.mjs';

const UA = 'Snuffelkaart-PoC/0.1 (markten van organisatoren; freek@draad.nu)';
const OUT = new URL('../public/data/markets.json', import.meta.url);
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const INDOOR = /hal\b|hallen|hangar|sport|expo|beurs|fabriek|loods|manege|huis van|centrum|evenementen|compl?ex|theater/i, OUTDOOR = /buiten|openlucht|parkeerterrein|plein\b|weiland/i;
const pad = n => String(n).padStart(2, '0');
const mins = t => { const [h, m] = t.split(/[:.]/); return +h * 60 + +m; };
const title = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** Kalenderpagina → per markt de link plus wat er in het kalenderblok staat ("Eemnes, Huis van Eemnes", "9:00-16:00"):
 *  terugval voor marktpagina's zonder adres of tijden. */
export function donCalendar(html) {
  // Elk kalenderblok eindigt met een knop ("meer info" / "kraam boeken") naar de eigen marktpagina; de tekst ervoor hoort erbij.
  const out = new Map(); let from = 0;
  for (const m of html.matchAll(/<a\b[^>]*href="(https:\/\/donevents\.nl\/product\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (!/meer info|boeken/i.test(m[2].replace(/<[^>]+>/g, ''))) continue;
    const url = m[1].replace(/\/?$/, '/'), t = toText(html.slice(from, m.index)); from = m.index + m[0].length;
    if (out.has(url)) continue;
    const tm = [...t.matchAll(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/g)].pop();
    const where = t.split('\n').map(l => l.trim()).filter(l => /^[^\d–-][^,]{1,40},\s*[^,]{2,60}$/.test(l) && !/kramen|parkeren|koopjes/i.test(l)).pop();
    out.set(url, { url, where: where ?? null, time: tm ? [mins(tm[1]), mins(tm[2])] : null });
  }
  return [...out.values()];
}

/** Feestdagen in een titel ("2e paasdag 2027") → datum. Pasen via de algoritme van Meeus/Jones/Butcher. */
export function holidayDate(text) {
  const m = /(2e paasdag|tweede paasdag|2e pinksterdag|tweede pinksterdag|hemelvaart\w*|koningsdag)\s+(\d{4})/i.exec(text); if (!m) return null;
  const y = +m[2], a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, mm = Math.floor((a + 11 * h + 22 * l) / 451);
  const easter = Date.UTC(y, Math.floor((h + l - 7 * mm + 114) / 31) - 1, ((h + l - 7 * mm + 114) % 31) + 1), day = 864e5, w = m[1].toLowerCase();
  const t = w.includes('paas') ? easter + day : w.includes('pinkster') ? easter + 50 * day : w.startsWith('hemelvaart') ? easter + 39 * day
    : (() => { const kd = Date.UTC(y, 3, 27); return new Date(kd).getUTCDay() === 0 ? kd - day : kd; })();
  return new Date(t).toISOString().slice(0, 10);
}

/** Pagina van één markt → edities (één per dag). `cal` = het kalenderblok als terugval. Null zonder datum of plaats. */
export function donProduct(html, url, cal = null) {
  const t = toText(html), head = (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '').replace(/&#8211;|&ndash;/g, '-').replace(/\s*-\s*Don Events\s*$/i, '');
  const dm = new RegExp(`(\\d{1,2})(?:\\s*(?:&|en)\\s*(\\d{1,2}))?\\s+(${MONTHS.join('|')})\\s+(\\d{4})`, 'i').exec(head) ?? new RegExp(`(\\d{1,2})(?:\\s*(?:&|en)\\s*(\\d{1,2}))?\\s+(${MONTHS.join('|')})\\s+(\\d{4})`, 'i').exec(t);
  // Adres als "1186 DA Amstelveen" of "Zeist 3705 GK".
  const loc = /Locatiegegevens\n([^\n]+)\n([^\n]+)\n(?:(\d{4}\s?[A-Z]{2})\s+([^\n]+)|([^\n]+?)\s+(\d{4}\s?[A-Z]{2}))\n/.exec(t);
  const hol = dm ? null : holidayDate(head);
  // Zonder adres: plaats en hal uit de kalender ("Eemnes, Huis van Eemnes" of "Munitiefabriek, Zaandam").
  const calWhere = cal?.where?.split(/,\s*/), headCity = /(?:markt|sale|verkoop)\s+(?:in\s+)?([A-Za-zÀ-ÿ'][^\d]*?)\s+(?:-|–|\(|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|\d|de\s|het\s)/i.exec(head)?.[1];
  const hc = headCity?.split(',')[0].trim();
  const city = (loc ? (loc[4] ?? loc[5]) : calWhere?.find(w => hc && w.toLowerCase().includes(hc.toLowerCase())) ?? hc)?.replace(/\s*\(.*?\)/g, '').trim();
  if ((!dm && !hol) || !city) return null;
  const days = dm ? [dm[1], dm[2]].filter(Boolean).map(Number) : [null];
  // Alleen "geopend van … tot …"; losse tijden op de pagina zijn vaak opbouw of inbreng. Anders de tijd uit de kalender.
  const tm = /geopend van (\d{1,2}[:.]\d{2}) tot (\d{1,2}[:.]\d{2})/i.exec(t);
  const times = tm ? [mins(tm[1]), mins(tm[2])] : cal?.time ?? null;
  const kind = title((/(vlooienmarkt|kofferbak\w*|rommelmarkt|jaarmarkt|braderie|snuffelmarkt|kerstmarkt)/i.exec(head)?.[1]) ?? 'vlooienmarkt');
  const venue = loc ? loc[1].trim() : calWhere?.find(w => w.trim().toLowerCase() !== city.toLowerCase())?.trim() ?? null;
  const postcode = loc ? (loc[3] ?? loc[6]).replace(/\s/g, '') : null, street = loc ? loc[2].trim() : null, slug = url.replace(/\/$/, '').split('/').pop();
  return days.map(d => ({
    id: `don-${slug}${days.length > 1 ? `-${d}` : ''}`, t: 'm', name: `${kind} ${title(city)}`, kind: kind.replace(/^Kofferbak\w*/, 'Kofferbakmarkt'),
    place: title(city), venue, addr: loc ? `${street}, ${postcode.replace(/([A-Z]{2})$/, ' $1')} ${title(city)}` : null, postcode, street,
    date: dm ? `${dm[4]}-${pad(MONTHS.indexOf(dm[3].toLowerCase()) + 1)}-${pad(d)}` : hol,
    // Zonder tijden op de pagina én in de kalender: start onbekend; 9:00 is alleen een plek om te tekenen, timeKnown = false.
    start: times ? times[0] : 540, end: times ? times[1] : null, timeKnown: !!times,
    indoor: INDOOR.test(venue ?? '') ? true : OUTDOOR.test(venue ?? '') ? false : undefined, /* onbekend = niet raden */ entree: 'onbekend', kramen: +(/(\d{2,4})\s*kramen/i.exec(t)?.[1] ?? 0) || undefined,
    kraamhuur: /Kraamhuur:?\s*(€\s?[\d,.\-]+)/i.exec(t)?.[1]?.replace(/,-$/, ',00'), org: 'Don Events', url, schema: '', status: 'chk',
  }));
}

// ---------- Organisatieburo Wildro (zie ../sources/wildro.md) ----------
const WILDRO_SKIP = /kerst|lichtfestival|winterfair|koopavond/i;
/** Evenement uit hun API (The Events Calendar) + "Locatie"-regel van de eventpagina → editie. Null voor kerst e.d. */
export function wildroEvent(ev, pageHtml) {
  const cats = ev.categories.map(c => c.name), title = ev.title.replace(/&#8211;/g, '–').replace(/\s+/g, ' ').trim();
  if (WILDRO_SKIP.test(title) || cats.includes('Kerstmarkten') || !cats.some(c => /braderie|vlooien|rommel|kofferbak/i.test(c))) return null;
  const t = toText(pageHtml), where = /(?:^|\n)Locatie\n([^\n]+)\n/.exec(t)?.[1]?.trim();
  if (!where) return null;
  const city = where.split(',').pop().trim(), [d, s] = ev.start_date.split(' '), e = ev.end_date.split(' ')[1];
  const flea = cats.includes('Vlooienmarkten') && /vlooien/i.test(title);
  return {
    id: `wildro-${ev.url.replace(/\/$/, '').split('/').pop()}`, t: 'm', name: title, kind: flea ? 'Vlooienmarkt' : 'Braderie', place: city, venue: null,
    addr: where, q: where, date: d, start: s === '00:00:00' ? 540 : mins(s), end: e === '23:59:00' ? null : mins(e), timeKnown: s !== '00:00:00',
    indoor: /hal\b|hallen|eurohal/i.test(title + ' ' + where) ? true : /centrum|winkelcentrum|plein|straat|laan\b/i.test(title + ' ' + where) ? false : undefined,
    entree: 'onbekend', kraamhuur: /Kraam:\s*(€\s?\d+(?:,\d{2})?)/i.exec(t)?.[1], org: 'Organisatieburo Wildro', url: ev.url, schema: '', status: 'chk',
  };
}

// ---------- Organisatie Bureau VAC (zie ../sources/vac.md) ----------
const DATE_NL = new RegExp(`(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\\s+(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(\\d{4})`, 'i');
/** Agenda (homepage) → één editie per blok "zondag 1 november 2026 / Heel / Sporthal / Binnen 09:00 – 16:00 / … / Bekijk deze markt". */
export function vacAgenda(html) {
  const out = []; let from = 0;
  for (const m of html.matchAll(/<a\b[^>]*href="(https:\/\/org-vac\.nl\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (!/Bekijk deze markt/i.test(m[2].replace(/<[^>]+>/g, ''))) continue;
    const lines = toText(html.slice(from, m.index)).split('\n').map(l => l.trim()).filter(Boolean); from = m.index + m[0].length;
    const di = lines.findLastIndex(l => DATE_NL.test(l)); if (di < 0) continue;
    const [, d, mon, y] = DATE_NL.exec(lines[di]), b = lines.slice(di + 1), io = b.find(l => /^(binnen|buiten)\b/i.test(l)) ?? '';
    const tm = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/.exec(io), fee = b[b.findIndex(l => /bezoekersentree/i.test(l)) + 1] ?? '';
    const slug = m[1].replace(/\/$/, '').split('/').pop(), word = /(vlooienmarkt|kofferbak\w*|rommelmarkt|braderie|straatmarkt|voorjaarsmarkt|najaarsmarkt|zomermarkt|jaarmarkt)/.exec(slug)?.[1] ?? 'vlooienmarkt';
    const kind = /kofferbak/.test(word) ? 'Kofferbakmarkt' : title(word), date = `${y}-${pad(MONTHS.indexOf(mon.toLowerCase()) + 1)}-${pad(+d)}`;
    out.push({
      id: `vac-${slug}-${date}`, t: 'm', name: `${kind} ${b[0]}`, kind, place: b[0], venue: b[1] && !/^(binnen|buiten)/i.test(b[1]) ? b[1] : null, addr: null,
      date, start: tm ? mins(tm[1]) : 540, end: tm ? mins(tm[2]) : null, timeKnown: !!tm, indoor: /^binnen/i.test(io) ? true : /^buiten/i.test(io) ? false : undefined,
      entree: /gratis/i.test(fee) ? 'gratis' : /€/.test(fee) ? fee.replace(/,-$/, ',00') : 'onbekend', kraamhuur: (b[b.findIndex(l => /^marktkraam$/i.test(l)) + 1] ?? '').match(/[\d,.]+/)?.[0]?.replace(/^/, '€'),
      org: 'Organisatie Bureau VAC', url: m[1], schema: '', status: 'chk',
    });
  }
  return out;
}
/** Markt- of locatiepagina → straat en postcode onder "Adres" of "Adres en route". */
export function vacAddress(html) {
  const a = /(?:^|\n)Adres(?: en route)?\n[^\n]+\n([^\n]+)\n(\d{4}\s?[A-Z]{2})\s+([^\n]+)/.exec(toText(html));
  return a ? { street: a[1].trim(), postcode: a[2].replace(/\s/g, ''), city: a[3].trim() } : null;
}

// ---------- Van Aerle, vlooienmarkten.nl (zie ../sources/vanaerle.md) ----------
/** Marktkalender-tabel → per rij datum, aantal dagen, naam, hal, plaats, kraamprijs, soort, link. */
export function aerleAgenda(html) {
  const out = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const td = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]), a = /href="([^"]+\/product\/[^"]+)"[^>]*>([^<]+)</.exec(row[1]);
    const dm = /(\d{2})-(\d{2})-(\d{4})[\s\S]*?\((\d+) dag/.exec(td[0] ?? ''); if (!dm || !a || td.length < 6) continue;
    const txt = h => toText(h).replace(/\s+/g, ' ').trim();
    out.push({ url: a[1].replace(/^http:/, 'https:'), date: `${dm[3]}-${dm[2]}-${dm[1]}`, days: +dm[4], name: a[2].replace(/\s+-\s+.*$|\s+\d+\s+kramen.*$/i, '').trim(),
      venue: txt(td[2]), city: txt(td[3]), price: /\d+(?:,\d{2})?/.exec(txt(td[4]))?.[0], type: txt(td[5]) });
  }
  return out;
}
/** Productpagina → velden onder vaste kopjes (Openingstijden, Toegangsprijs, Adres, Postcode…). */
export function aerleProduct(html) {
  const L = toText(html).split('\n').map(l => l.trim()), v = k => { const i = L.indexOf(k); return i >= 0 ? L[i + 1] : null; };
  const tm = /(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/.exec(v('Openingstijden') ?? ''), fee = v('Toegangsprijs') ?? '';
  // Een bedrag gaat voor ("€ 6 voor volwassenen, Gratis Parkeren" is niet gratis); 00:00 - 00:00 = niet ingevuld.
  const open = tm && mins(tm[2]) > mins(tm[1]) ? [mins(tm[1]), mins(tm[2])] : null;
  return { open, entree: /\d/.test(fee) ? `€${/\d+(?:,\d{2})?/.exec(fee)[0]}` : /gratis/i.test(fee) ? 'gratis' : 'onbekend',
    street: v('Adres'), postcode: v('Postcode')?.replace(/\s/g, '') ?? null, city: v('Plaats'), venue: v('Locatienaam') };
}

/** Adres → coördinaten via PDOK (adres, anders postcode). Null buiten Nederland. */
async function geocode(m) {
  for (const [q, type] of [[m.street && `${m.street} ${m.postcode}`, 'adres'], [m.q, '(adres OR weg)'], [m.postcode, 'postcode'], [m.place, 'woonplaats']]) {
    if (!q) continue;
    const u = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(q)}&fq=type:${type}&rows=1&fl=centroide_ll`;
    const p = /POINT\(([\d.]+) ([\d.]+)\)/.exec((await (await fetch(u)).json()).response?.docs?.[0]?.centroide_ll ?? '');
    if (p) return { lon: +(+p[1]).toFixed(5), lat: +(+p[2]).toFixed(5), exact: type !== 'woonplaats' && type !== 'postcode' };
  }
  return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(u) { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r; }

async function donEvents(skipped) {
  const links = donCalendar(await (await get('https://donevents.nl/marktkalender/')).text()), out = [];
  for (const cal of links) {
    await sleep(1500); // netjes: één pagina per 1,5 s
    let eds; try { const r = await get(cal.url); eds = donProduct(await r.text(), r.url, cal); } catch (e) { skipped.push(`${cal.url} (${e.message})`); continue; }
    if (!eds) { skipped.push(`${cal.url} (geen datum of plaats)`); continue; }
    out.push(...eds);
  }
  return out;
}
async function wildro(skipped) {
  const out = [];
  for (let page = 1, pages = 1; page <= pages; page++) {
    const j = await (await get(`https://wildro.nl/wp-json/tribe/events/v1/events?per_page=50&page=${page}&start_date=${new Date().toISOString().slice(0, 10)}`)).json();
    pages = j.total_pages ?? 1;
    for (const ev of j.events) {
      await sleep(1500);
      let m; try { m = wildroEvent(ev, await (await get(ev.url)).text()); } catch (e) { skipped.push(`${ev.url} (${e.message})`); continue; }
      if (m) out.push(m); else skipped.push(`${ev.url} (geen snuffelmarkt of geen locatie)`);
    }
  }
  return out;
}
async function vac(skipped) {
  const eds = vacAgenda(await (await get('https://org-vac.nl/')).text()), addr = new Map();
  for (const e of eds) {
    if (!addr.has(e.url)) { await sleep(1500); try { addr.set(e.url, vacAddress(await (await get(e.url)).text())); } catch (err) { addr.set(e.url, null); skipped.push(`${e.url} (${err.message})`); } }
    const a = addr.get(e.url); if (a) Object.assign(e, { street: a.street, postcode: a.postcode, addr: `${a.street}, ${a.postcode.replace(/([A-Z]{2})$/, ' $1')} ${a.city}` });
  }
  return eds;
}
async function vanAerle(skipped) {
  const rows = aerleAgenda(await (await get('https://www.vlooienmarkten.nl/agenda-markten/')).text()), out = [];
  for (const row of rows) {
    await sleep(1500);
    let p; try { p = aerleProduct(await (await get(row.url)).text()); } catch (e) { skipped.push(`${row.url} (${e.message})`); continue; }
    const kind = /vlooien|snuffel|rommel/i.test(row.type + row.name) ? 'Vlooienmarkt' : /verzamel/i.test(row.type + row.name) ? 'Verzamelbeurs' : title(row.type || 'Markt');
    const venue = p.venue ?? row.venue, city = p.city ?? row.city;
    for (let i = 0; i < row.days; i++) {
      const date = new Date(Date.parse(row.date + 'T12:00:00Z') + i * 864e5).toISOString().slice(0, 10);
      const name = row.name === row.name.toUpperCase() ? title(row.name).replace(/\b(in|op|bij)\s+(\w)/g, (m, w, c) => `${w} ${c.toUpperCase()}`) : row.name;
      out.push({ id: `aerle-${row.url.replace(/\/$/, '').split('/').pop()}-${date}`, t: 'm', name, kind, place: city, venue,
        addr: p.street && p.postcode ? `${p.street}, ${p.postcode.replace(/([A-Z]{2})$/, ' $1')} ${city}` : null, street: p.street, postcode: p.postcode,
        date, start: p.open ? p.open[0] : 540, end: p.open ? p.open[1] : null, timeKnown: !!p.open,
        indoor: /buiten|openlucht|tuin\b|kasteeltuin/i.test(`${row.name} ${venue}`) || /^centrum\b/i.test(venue) ? false : INDOOR.test(venue) || /binnen/i.test(row.name) ? true : undefined,
        entree: p.entree, kraamhuur: row.price ? `€${row.price}` : undefined, org: 'Van Aerle (vlooienmarkten.nl)', url: row.url, schema: '', status: 'chk' });
    }
  }
  return out;
}
const SOURCES = [['Don Events', donEvents, 'https://donevents.nl/marktkalender/'], ['Organisatieburo Wildro', wildro, 'https://wildro.nl/vlooienmarkten/'], ['Organisatie Bureau VAC', vac, 'https://org-vac.nl/'], ['Van Aerle (vlooienmarkten.nl)', vanAerle, 'https://www.vlooienmarkten.nl/agenda-markten/']];

async function main() {
  const today = new Date().toISOString().slice(0, 10), prevAll = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).markets : [];
  const markets = [], report = [];
  for (const [org, read] of SOURCES) {
    const skipped = []; let eds = [];
    try { eds = await read(skipped); } catch (e) { skipped.push(`hele bron: ${e.message}`); }
    const placed = [];
    for (const e of eds) { const geo = await geocode(e); if (!geo) { skipped.push(`${e.url} (adres niet in NL)`); continue; } if (e.date >= today) { const { postcode, street, q, ...m } = e; placed.push({ ...m, ...geo, checked: today }); } }
    // Veilige import (§6.1) per organisator: niets, of veel minder dan vorige keer → de vorige stand houden.
    const prev = prevAll.filter(m => m.org === org && m.date >= today);
    const keep = !placed.length || (prev.length && placed.length < prev.length / 2 && !process.argv.includes('--force'));
    markets.push(...(keep ? prev : placed));
    report.push(`${org}: ${keep ? `TEGENGEHOUDEN (${placed.length}, vorige keer ${prev.length}), vorige stand behouden` : `${placed.length} edities`}, overgeslagen ${skipped.length}`, ...skipped.map(s => '  - ' + s));
  }
  if (!markets.length) { console.error('Geen enkele markt. Niets geschreven.'); process.exit(1); }
  fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), sources: SOURCES.map(([org, , url]) => ({ org, url })), markets }));
  console.log(report.join('\n') + `\nTotaal ${markets.length} edities (${markets.filter(m => !m.exact).length} zonder exacte plek).`);
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
