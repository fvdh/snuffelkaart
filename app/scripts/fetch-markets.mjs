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

// ---------- Organisatieburo Vitalis (zie ../sources/vitalis.md) ----------
/** Hun iCal-feed → edities. Alleen snuffelmarkten (vlooienmarkt, braderie, platenbeurs); winterfairs e.d. niet. `page` = marktpagina voor het adres. */
export function vitalisIcs(ics) {
  const out = [];
  for (const ev of ics.replace(/\r?\n[ \t]/g, '').split('BEGIN:VEVENT').slice(1)) {
    const g = k => new RegExp(`^${k}[^:\\n]*:(.*)$`, 'm').exec(ev)?.[1]?.trim() ?? '';
    const cats = g('CATEGORIES'), name = g('SUMMARY').replace(/Evenenementenhal/, 'Evenementenhal'), s = /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(g('DTSTART')), e = /T(\d{2})(\d{2})/.exec(g('DTEND'));
    if (!s || !/vlooien|braderie|rommel|kofferbak|platen/i.test(cats) || /winterfair|kerst/i.test(name)) continue;
    const kind = /platen/i.test(cats + name) ? 'Platenbeurs' : /vlooien/i.test(cats) ? 'Vlooienmarkt' : 'Braderie';
    out.push({ uid: g('UID'), name, kind, date: `${s[1]}-${s[2]}-${s[3]}`, start: +s[4] * 60 + +s[5], end: e ? +e[1] * 60 + +e[2] : null, url: g('URL'), page: g('LOCATION') || null });
  }
  return out;
}
/** Marktpagina → hal, adres ("De Haar 11, 9405 TE Assen" onder "Locatie"), entree en standplaatsprijs. */
export function vitalisPlace(html) {
  const t = toText(html), loc = /(?:^|\n)Locatie\n([^\n]+)\n([^\n,]+),\s*(\d{4}\s?[A-Z]{2})\s+([^\n]+)/.exec(t);
  const fee = /Entree(?:prijs|prijzen)?:[ \t]*\n?([^\n]+)/i.exec(t)?.[1] ?? ''; // ook "Entreeprijzen:⏎Volwassenen: € 4"
  return { venue: loc?.[1].trim() ?? null, street: loc?.[2].trim() ?? null, postcode: loc?.[3].replace(/\s/g, '') ?? null, city: loc?.[4].trim() ?? null,
    entree: /€\s?\d/.test(fee) ? `€${/€\s?(\d+(?:,\d{2})?)/.exec(fee)[1]}` : /gratis/i.test(fee) ? 'gratis' : 'onbekend',
    kraamhuur: /Standplaats \d+ meter:?\s*(€\s?\d+(?:,\d{2})?)/i.exec(t)?.[1]?.replace(/\s/g, '') };
}

// ---------- De Evenementenlijn (zie ../sources/evenementenlijn.md) ----------
/** Agenda (homepage) → per blok "Breda, sporthal de Bress / Nieuwe inslag 99, 4817 GN Breda / 8 november 2026 / Open van 09:00 t/m 16:00 uur / … / BINNENMARKT". */
export function evlAgenda(html) {
  const L = toText(html).split('\n').map(l => l.replace(/[\u200b-\u200d\ufeff\ue000-\uf8ff]/g, '').trim()).filter(Boolean), out = []; // hun opmaak zet icoontekens (privégebied) tussen de blokken
  const links = [...html.matchAll(/href="(https:\/\/www\.deevenementenlijn\.nl\/markten\/[^"#?]+)"/g)].map(m => m[1]);
  const dateRe = new RegExp(`^(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(\\d{4})$`, 'i');
  L.forEach((l, i) => {
    const dm = dateRe.exec(l), a = dm && /^(.+),\s*(\d{4}\s?[A-Z]{2})\s+(.+)$/.exec(L[i - 1] ?? ''); if (!a) return;
    const b = L.slice(i + 1, i + 16), end = b.findIndex(x => dateRe.test(x)), blk = end > 0 ? b.slice(0, end) : b;
    const tm = /(\d{1,2}[:.]\d{2})\s*(?:t\/m|tot|[-–])\s*(\d{1,2}[:.]\d{2})/.exec(blk.find(x => /^open/i.test(x)) ?? '');
    const date = `${dm[3]}-${pad(MONTHS.indexOf(dm[2].toLowerCase()) + 1)}-${pad(+dm[1])}`, city = a[3].trim();
    const url = links.find(u => new RegExp(`-0?${+dm[1]}-${dm[2].toLowerCase()}-${dm[3]}/?$`).test(u) && u.includes(city.toLowerCase().split(' ')[0])) ?? 'https://www.deevenementenlijn.nl/';
    const io = blk.find(x => /^(binnen|buiten)markt$/i.test(x)) ?? '';
    out.push({ id: `evl-${city.toLowerCase().replace(/\W+/g, '-')}-${date}`, t: 'm', name: `Rommelmarkt ${city}`, kind: 'Rommelmarkt', place: city,
      venue: L[i - 2].replace(new RegExp(`^${city},?\\s*`, 'i'), '').replace(/^./, c => c.toUpperCase()), addr: `${a[1].trim()}, ${a[2].replace(/\s/g, '').replace(/([A-Z]{2})$/, ' $1')} ${city}`,
      street: a[1].trim(), postcode: a[2].replace(/\s/g, ''), date, start: tm ? mins(tm[1]) : 540, end: tm ? mins(tm[2]) : null, timeKnown: !!tm,
      indoor: /^binnen/i.test(io) ? true : /^buiten/i.test(io) ? false : undefined,
      // "Entree pp €3,- | 65+ €2,50" en "Kraam vanaf €33,-": soms op één regel, soms verdeeld over drie.
      entree: (/Entree[^€]{0,20}€\s?(\d+(?:,\d{2})?)/i.exec(blk.join(' ')) ?? [])[1]?.replace(/^/, '€') ?? 'onbekend',
      kraamhuur: (/Kraam\b[^€]{0,20}€\s?(\d+(?:,\d{2})?)/i.exec(blk.join(' ')) ?? [])[1]?.replace(/^/, '€'),
      org: 'De Evenementenlijn', url, schema: '', status: 'chk' });
  });
  return out;
}

// ---------- Organisatieburo Mikki (zie ../sources/mikki.md) ----------
/** Eventpagina → editie: "Zondag / 1 / november 2026", "Van 09:30 tot 16:00", titel "Vlooienmarkt, Sporthal De Vaart", blok "Adres", toegang en kraamprijs. */
export function mikkiEvent(html, url) {
  const L = toText(html).split('\n').map(l => l.trim()).filter(Boolean), t = L.join('\n');
  const d = new RegExp(`(?:^|\\n)(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\\n(\\d{1,2})\\n(${MONTHS.join('|')})\\s+(\\d{4})`, 'i').exec(t);
  const tm = /Van (\d{1,2}[:.]\d{2}) tot (\d{1,2}[:.]\d{2})/i.exec(t), ai = L.indexOf('Adres'), pc = /^(\d{4}\s?[A-Z]{2})\s+(.+)$/.exec(L[ai + 2] ?? '');
  const head = (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '').replace(/\s*-\s*Mikki\s*$/i, '').replace(/&amp;/g, '&').trim();
  if (!d || ai < 0 || !pc || /kerst/i.test(head)) return null;
  const [kindW, ...rest] = head.split(','), venue = rest.join(',').trim() || null, city = pc[2].trim(), date = `${d[3]}-${pad(MONTHS.indexOf(d[2].toLowerCase()) + 1)}-${pad(+d[1])}`;
  const kind = /kofferbak/i.test(kindW) ? 'Kofferbakmarkt' : /vlooien/i.test(kindW) ? 'Vlooienmarkt' : title(kindW.trim());
  // Toegang staat in lopende tekst ("Toegang voor bezoekers 3,00 …"); gratis alleen als er geen bedrag staat.
  const fee = /Toegang[^\n.]*/i.exec(t)?.[0] ?? '';
  return { id: `mikki-${url.replace(/\/$/, '').split('/').pop()}`, t: 'm', name: `${kind} ${city}`, kind, place: city, venue,
    addr: `${L[ai + 1]}, ${pc[1].replace(/\s/g, '').replace(/([A-Z]{2})$/, ' $1')} ${city}`, street: L[ai + 1], postcode: pc[1].replace(/\s/g, ''),
    date, start: tm ? mins(tm[1]) : 540, end: tm ? mins(tm[2]) : null, timeKnown: !!tm,
    indoor: /park\b|park$|centrum|winkelcentrum|plein|straat/i.test(venue ?? '') ? false : INDOOR.test(venue ?? '') ? true : undefined,
    entree: /\d+[,.]\d{2}/.test(fee) ? `€${/(\d+)[,.](\d{2})/.exec(fee).slice(1).join(',').replace(/,00$/, '')}` : /gratis/i.test(fee) ? 'gratis' : 'onbekend',
    kraamhuur: /\nKraam\n(?:€\s*)?(\d+)[.,](\d{2})/.exec(t)?.slice(1).join(',').replace(/^/, '€'),
    org: 'Organisatieburo Mikki', url, schema: '', status: 'chk' };
}

// ---------- IJ-Hallen (zie ../sources/ijhallen.md) ----------
/** "31 oktober en 1 november 2026", "12 en 13 december 2026" of "7 maart 2027" → ISO-datums (één per dag). */
export function nlDays(s) {
  const parts = s.toLowerCase().split(/\s+(?:en|&)\s+|,\s*/), last = new RegExp(`(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(\\d{4})`).exec(parts.at(-1) ?? '');
  if (!last) return [];
  const y = +last[3], lm = MONTHS.indexOf(last[2]);
  return parts.map(p => {
    const m = new RegExp(`^(\\d{1,2})(?:\\s+(${MONTHS.join('|')}))?`).exec(p.trim()); if (!m) return null;
    const mo = m[2] ? MONTHS.indexOf(m[2]) : lm;
    return `${mo > lm ? y - 1 : y}-${pad(mo + 1)}-${pad(+m[1])}`; // "30 december en 2 januari 2027": december hoort bij 2026
  }).filter(Boolean);
}
/** Agenda → per weekend "31 oktober en 1 november 2026 / 09:00 - 16:30 / 600 kramen / Binnen", één editie per dag. Altijd dezelfde plek (NDSM-werf). */
export function ijAgenda(html) {
  const out = [];
  for (const ul of html.matchAll(/<ul\b[^>]*>([\s\S]*?)<\/ul>/g)) {
    const li = k => toText(new RegExp(`<li class="${k}\\b[^"]*">([\\s\\S]*?)<\\/li>`).exec(ul[1])?.[1] ?? '').trim();
    const days = nlDays(li('date')); if (!days.length) continue;
    const tm = /(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/.exec(li('time')), io = li('location');
    for (const date of days) out.push({ id: `ij-${date}`, t: 'm', name: 'Vlooienmarkt IJ-Hallen', kind: 'Vlooienmarkt', place: 'Amsterdam', venue: 'IJ-Hallen, NDSM-werf',
      addr: 'NDSM-Plein 1, 1033 WC Amsterdam', street: 'NDSM-Plein 1', postcode: '1033WC', date, start: tm ? mins(tm[1]) : 540, end: tm ? mins(tm[2]) : null, timeKnown: !!tm,
      indoor: /^binnen/i.test(io) ? true : /^buiten/i.test(io) ? false : undefined, entree: 'onbekend', kramen: +(/(\d+)\s*kramen/i.exec(li('stalls'))?.[1] ?? 0) || undefined,
      org: 'IJ-Hallen', url: 'https://ijhallen.nl/agenda.php', schema: '', status: 'chk' });
  }
  return out;
}

// ---------- Animo Vlooienmarkten (zie ../sources/animo.md) ----------
/** Kalender → per blok "Doesburg / Sporthal Beumerskamp / [1e Editie!] / zondag 15 november 2026 / Breedestraat 39 / Binnen / … / Meer info".
 *  Het adres is wisselend: "Breedestraat 39", "Monumentenweg 30, 6997AH", "Gruttostraat 14 Velp, 6883 CN", "Invictusstraat 1, Afferden/Druten". */
export function animoCalendar(html) {
  const out = []; let from = 0;
  for (const m of html.matchAll(/<a\b[^>]*href="(\/kalender\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (!/meer info/i.test(m[2].replace(/<[^>]+>/g, ''))) continue;
    const L = toText(html.slice(from, m.index)).split('\n').map(l => l.trim()).filter(Boolean); from = m.index + m[0].length;
    const di = L.findIndex(l => DATE_NL.test(l)); if (di < 2) continue;
    const head = L.slice(0, di).filter(l => !new RegExp(`^(${MONTHS.join('|')})\\s+\\d{4}$`, 'i').test(l) && !/!$/.test(l)).slice(-2);
    const [, d, mon, y] = DATE_NL.exec(L[di]), city = head[0].replace(/^'S-/, "'s-"), parts = (L[di + 1] ?? '').split(/,\s*/);
    const pc = parts.find(p => /^\d{4}\s?[A-Z]{2}$/.test(p))?.replace(/\s/g, '') ?? null, other = parts.slice(1).find(p => !/^\d{4}\s?[A-Z]{2}$/.test(p));
    const street = parts[0].replace(new RegExp(`\\s+${city}$`, 'i'), '').trim(), io = L[di + 2] ?? '';
    out.push({ url: `https://animo-vlooienmarkten.nl${m[1]}`, city, venue: head[1] ?? null, date: `${y}-${pad(MONTHS.indexOf(mon.toLowerCase()) + 1)}-${pad(+d)}`,
      street, postcode: pc, q: `${street} ${other?.split('/')[0] ?? city}`, indoor: /^binnen/i.test(io) ? true : /^buiten/i.test(io) ? false : undefined });
  }
  return out;
}
/** Marktpagina → tijden ("09:00 tot 16:00") en kraamprijs ("Kraam: € 35.00"). */
export function animoEvent(html) {
  const t = toText(html), tm = /(\d{1,2}[:.]\d{2})\s*tot\s*(\d{1,2}[:.]\d{2})/.exec(t), k = /(?:^|\n)Kraam:\s*€\s*(\d+)(?:[.,](\d{2}))?/.exec(t);
  return { open: tm ? [mins(tm[1]), mins(tm[2])] : null, kraamhuur: k ? `€${k[1]}${k[2] && k[2] !== '00' ? `,${k[2]}` : ''}` : undefined };
}

// ---------- JoJo Vlooienmarkten (zie ../sources/jojo.md) ----------
const WEEKDAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
/** Agenda (webshop) → links naar de productpagina's, één per markt. */
export function jojoAgenda(html) {
  const out = new Map();
  for (const m of html.matchAll(/<a\b[^>]*href="(\/product\/\d+\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const t = toText(m[2]).replace(/\s+/g, ' ').trim(); if (t && !/bekijk details/i.test(t) && !out.has(m[1])) out.set(m[1], { url: `https://www.jojovlooienmarkten.nl${m[1]}`, title: t });
  }
  return [...out.values()];
}
/** "1 november" zonder jaar → de eerstvolgende keer op of na `today`. Staat er een weekdag bij ("zondag", "2de paasdag" = maandag) en klopt die
 *  niet met die datum, dan is de pagina oud of fout: null (niet een jaar verder zoeken). */
export function nextDate(day, month, weekday, today) {
  const y = +today.slice(0, 4), md = `${pad(month + 1)}-${pad(day)}`, iso = `${y}-${md}` >= today ? `${y}-${md}` : `${y + 1}-${md}`;
  return weekday == null || new Date(`${iso}T12:00:00Z`).getUTCDay() === weekday ? iso : null;
}
/** Productpagina → editie. Titel "Zondag 1 November Kortenhoef" of "2de Paasdag (29 Maart) Keizerswei Doorn"; hal uit "wordt in sporthal De Fuik",
 *  adres als het er staat ("De Beaufortweg 1 / 3941 PA Doorn"). Tijden: hun marktreglement, "voor het publiek geopend van 9.00-16.00 uur" op alle markten. */
export function jojoEvent(html, url, today = new Date().toISOString().slice(0, 10)) {
  const head = (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '').replace(/\s*\|\s*jojovlooienmarkten\s*$/i, '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  const d = new RegExp(`^(.*?)\\b(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(.+)$`, 'i').exec(head); if (!d || /kerst/i.test(head)) return null;
  const pre = d[1].toLowerCase(), wd = /2de\s+(paas|pinkster)dag/.test(pre) ? 1 : WEEKDAYS.findIndex(w => pre.includes(w));
  const date = nextDate(+d[2], MONTHS.indexOf(d[3].toLowerCase()), wd < 0 ? null : wd, today); if (!date) return null;
  const t = toText(html), a = /(?:^|\n)([^\n]*?[A-Za-z][^\n]*?\s\d+[a-zA-Z]?)\n(\d{4}\s?[A-Z]{2})\s+([^\n]+)/.exec(t), words = d[4].trim().split(' ');
  const city = a ? a[3].trim() : words.at(-1), hall = /wordt in\s+([^\n]+?)\s+een grote/i.exec(t.replace(/\n/g, ' '))?.[1]?.replace(new RegExp(`\\s+in\\s+${city}$`, 'i'), '');
  const venue = hall?.replace(/^./, c => c.toUpperCase()) ?? (words.length > 1 ? words.slice(0, -1).join(' ') : null), k = /1 kraam\s*-\s*€\s*(\d+),(\d{2})/.exec(t);
  return { id: `jojo-${url.split('/product/')[1]?.split('/')[0]}`, t: 'm', name: `Vlooienmarkt ${city}`, kind: 'Vlooienmarkt', place: city, venue,
    addr: a ? `${a[1].trim()}, ${a[2].replace(/\s/g, '').replace(/([A-Z]{2})$/, ' $1')} ${city}` : null, street: a?.[1].trim(), postcode: a?.[2].replace(/\s/g, ''),
    date, start: 540, end: 960, timeKnown: true, indoor: /sporthal|overdekt/i.test(`${venue} ${t}`) ? true : undefined, entree: 'onbekend',
    kraamhuur: k ? `€${k[1]}${k[2] !== '00' ? `,${k[2]}` : ''}` : undefined, org: 'JoJo Vlooienmarkten', url, schema: '', status: 'chk' };
}

// ---------- MDV Evenementen (zie ../sources/mdv.md) ----------
/** Locatiepagina → per hal naam, straat, postcode, plaats ("Sport- en Evenementenhal Margriet / … / Adres: / Nieuwe Damlaan 5 / 3119 KA Schiedam"). */
export function mdvLocations(html) {
  const L = toText(html).split('\n').map(l => l.trim()).filter(Boolean), out = [];
  L.forEach((l, i) => { const pc = /^Adres:$/i.test(l) && /^(\d{4}\s?[A-Z]{2})\s+(.+)$/.exec(L[i + 2] ?? ''); if (pc) out.push({ venue: L[i - 2], street: L[i + 1], postcode: pc[1].replace(/\s/g, ''), city: pc[2].trim() }); });
  return out;
}
/** Agenda (homepage) → per "event-day" datum, tijden, titel "22 November 2026 – (VOLGEBOEKT …) Mega-Rommelmarkt in de Margriethal in Schiedam" en link.
 *  Adres via de plaats uit de titel op de locatiepagina (`locs`). */
export function mdvAgenda(html, locs = []) {
  const out = [];
  for (const blk of html.split(/<div class="event-day">/).slice(1)) {
    const a = /<a href="(https:\/\/www\.mdv-evenementen\.nl\/event\/[^"]+)">([^<]+)<\/a>/.exec(blk); if (!a) continue;
    const head = toText(a[2]).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim(), tm = /<span>(\d{1,2}:\d{2})<\/span>\s*(\d{1,2}:\d{2})/.exec(blk);
    const d = new RegExp(`^(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(\\d{4})`, 'i').exec(head), w = /(\S*rommelmarkt|vlooienmarkt)\s+in\s+de\s+(.+?)\s+in\s+(.+)$/i.exec(head);
    if (!d || !w || /kerst/i.test(head)) continue;
    const city = w[3].trim(), loc = locs.find(l => l.city.toLowerCase() === city.toLowerCase()), date = `${d[3]}-${pad(MONTHS.indexOf(d[2].toLowerCase()) + 1)}-${pad(+d[1])}`;
    out.push({ id: `mdv-${date}-${city.toLowerCase().replace(/\W+/g, '-')}`, t: 'm', name: `Rommelmarkt ${city}`, kind: 'Rommelmarkt', place: city, venue: w[2].trim(),
      addr: loc ? `${loc.street}, ${loc.postcode.replace(/([A-Z]{2})$/, ' $1')} ${loc.city}` : null, street: loc?.street, postcode: loc?.postcode,
      date, start: tm ? mins(tm[1]) : 540, end: tm ? mins(tm[2]) : null, timeKnown: !!tm, indoor: true /* alleen sporthallen */, entree: 'onbekend',
      org: 'MDV Evenementen', url: a[1], schema: '', status: 'chk' });
  }
  return out;
}

/** Adres → coördinaten via PDOK (adres, anders postcode). Null buiten Nederland. */
async function geocode(m) {
  for (const [q, type] of [[m.street && `${m.street} ${m.postcode}`, 'adres'], [m.q, '(adres OR weg)'], [m.postcode, 'postcode'], [m.place, 'woonplaats']]) {
    if (!q) continue;
    const u = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(q)}&fq=type:${type}&rows=1&fl=centroide_ll,weergavenaam`;
    const doc = (await (await fetch(u)).json()).response?.docs?.[0];
    // Vrije tekst ("Centrum, Assen", "Schuberstraat 1 Elst") zoekt ruim: alleen houden als eerste én laatste woord in de uitkomst staan, anders gaf PDOK een andere plek.
    const w = q === m.q ? q.toLowerCase().split(/[\s,]+/).filter(Boolean) : null;
    if (w && !(doc?.weergavenaam && [w[0], w.at(-1)].every(x => doc.weergavenaam.toLowerCase().includes(x)))) continue;
    const p = /POINT\(([\d.]+) ([\d.]+)\)/.exec(doc?.centroide_ll ?? '');
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
async function vitalis(skipped) {
  const eds = vitalisIcs(await (await get('https://vitalismarkten.nl/events.ics')).text()), pages = new Map(), out = [];
  for (const e of eds) {
    if (!e.page) { skipped.push(`${e.url} (geen marktpagina)`); continue; }
    if (!pages.has(e.page)) { await sleep(1500); try { pages.set(e.page, vitalisPlace(await (await get(e.page)).text())); } catch (err) { pages.set(e.page, null); skipped.push(`${e.page} (${err.message})`); } }
    const p = pages.get(e.page); if (!p?.city) { skipped.push(`${e.page} (geen adres)`); continue; }
    out.push({ id: `vitalis-${e.uid.split('@')[0]}`, t: 'm', name: e.name, kind: e.kind, place: p.city, venue: p.venue,
      addr: `${p.street}, ${p.postcode.replace(/([A-Z]{2})$/, ' $1')} ${p.city}`, street: p.street, postcode: p.postcode,
      date: e.date, start: e.start, end: e.end, timeKnown: true,
      indoor: INDOOR.test(`${p.venue} ${e.name}`) || /flowerdome/i.test(e.name) ? true : OUTDOOR.test(p.venue ?? '') ? false : undefined,
      entree: p.entree, kraamhuur: p.kraamhuur, org: 'Organisatieburo Vitalis', url: e.page, schema: '', status: 'chk' });
  }
  return out;
}
async function evenementenlijn() { return evlAgenda(await (await get('https://www.deevenementenlijn.nl/')).text()); }
async function mikki(skipped) {
  const links = new Set(), out = [];
  for (let page = 1, pages = 1; page <= pages; page++) {
    if (page > 1) await sleep(1500);
    const html = await (await get(`https://www.mikki.nl/${page > 1 ? `page/${page}/` : ''}`)).text();
    pages = Math.min(+(/Pagina \d+ van (\d+)/.exec(html)?.[1] ?? 1), 10);
    for (const m of html.matchAll(/href="(https:\/\/www\.mikki\.nl\/event\/[^"#?]+\/)"/g)) links.add(m[1]);
  }
  for (const url of links) {
    await sleep(1500);
    let m; try { m = mikkiEvent(await (await get(url)).text(), url); } catch (e) { skipped.push(`${url} (${e.message})`); continue; }
    if (m) out.push(m); else skipped.push(`${url} (geen datum of adres)`);
  }
  return out;
}
async function ijHallen() { return ijAgenda(await (await get('https://ijhallen.nl/agenda.php')).text()); }
async function animo(skipped) {
  const out = [];
  for (const c of animoCalendar(await (await get('https://animo-vlooienmarkten.nl/kalender')).text())) {
    await sleep(1500);
    let p; try { p = animoEvent(await (await get(c.url)).text()); } catch (e) { p = { open: null }; skipped.push(`${c.url} (${e.message}; zonder tijden)`); }
    out.push({ id: `animo-${c.url.split('/').pop()}-${c.date}`, t: 'm', name: `Vlooienmarkt ${c.city}`, kind: 'Vlooienmarkt', place: c.city, venue: c.venue,
      addr: c.postcode ? `${c.street}, ${c.postcode.replace(/([A-Z]{2})$/, ' $1')} ${c.city}` : `${c.street}, ${c.city}`,
      // Zonder postcode alleen op straat + plaats zoeken (geocode probeert anders "straat undefined").
      street: c.postcode ? c.street : undefined, postcode: c.postcode ?? undefined, q: c.q, date: c.date,
      start: p.open ? p.open[0] : 540, end: p.open ? p.open[1] : null, timeKnown: !!p.open, indoor: c.indoor, entree: 'onbekend', kraamhuur: p.kraamhuur,
      org: 'Animo Vlooienmarkten', url: c.url, schema: '', status: 'chk' });
  }
  return out;
}
async function jojo(skipped) {
  const out = [];
  for (const { url } of jojoAgenda(await (await get('https://www.jojovlooienmarkten.nl/agenda-vlooienmarkten')).text())) {
    await sleep(1500);
    let m; try { m = jojoEvent(await (await get(url)).text(), url); } catch (e) { skipped.push(`${url} (${e.message})`); continue; }
    if (m) out.push(m); else skipped.push(`${url} (geen datum, of weekdag past niet in dit of volgend jaar)`);
  }
  return out;
}
async function mdv() {
  const home = await (await get('https://www.mdv-evenementen.nl/')).text(); await sleep(1500);
  return mdvAgenda(home, mdvLocations(await (await get('https://www.mdv-evenementen.nl/locaties/')).text()));
}
const SOURCES = [['MDV Evenementen', mdv, 'https://www.mdv-evenementen.nl/'], ['JoJo Vlooienmarkten', jojo, 'https://www.jojovlooienmarkten.nl/agenda-vlooienmarkten'], ['Animo Vlooienmarkten', animo, 'https://animo-vlooienmarkten.nl/kalender'], ['IJ-Hallen', ijHallen, 'https://ijhallen.nl/agenda.php'], ['Organisatieburo Mikki', mikki, 'https://www.mikki.nl/'], ['De Evenementenlijn', evenementenlijn, 'https://www.deevenementenlijn.nl/'], ['Organisatieburo Vitalis', vitalis, 'https://vitalismarkten.nl/agenda/'],['Don Events', donEvents, 'https://donevents.nl/marktkalender/'], ['Organisatieburo Wildro', wildro, 'https://wildro.nl/vlooienmarkten/'], ['Organisatie Bureau VAC', vac, 'https://org-vac.nl/'], ['Van Aerle (vlooienmarkten.nl)', vanAerle, 'https://www.vlooienmarkten.nl/agenda-markten/']];

async function main() {
  const today = new Date().toISOString().slice(0, 10), prevAll = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).markets : [];
  const markets = [], report = [];
  // --only=<woord>: alleen die organisator(en) opnieuw lezen, de rest houdt de vorige stand (hooguit één keer per dag per site).
  const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).toLowerCase();
  for (const [org, read] of SOURCES) {
    if (only && !org.toLowerCase().includes(only)) { markets.push(...prevAll.filter(m => m.org === org && m.date >= today)); continue; }
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
