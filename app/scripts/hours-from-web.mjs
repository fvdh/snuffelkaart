// Openingstijden uit de tekst van een winkelwebsite → OSM-syntax (opening_hours). Voorzichtig: bij twijfel null.
// Herkent "Maandag: 09:30 - 17:00", "Ma: gesloten", "di t/m za 10.00–17.00 uur", "ma, wo en vr 13-16 uur".

/** HTML → platte tekst met regeleinden op blokgrenzen. */
export function toText(html) {
  return html.replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|td|th|h\d|section|article|dd|dt)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#8211;|&ndash;|&#8212;|&mdash;/g, '–').replace(/&#\d+;|&\w+;/g, ' ')
    .replace(/[ \t ]+/g, ' ').replace(/ *\n[\s]*/g, '\n').replace(/^ +| +$/gm, '');
}

const DAY = [['maandag', 'ma'], ['dinsdag', 'di'], ['woensdag', 'wo'], ['donderdag', 'do'], ['vrijdag', 'vr', 'vrij'], ['zaterdag', 'za', 'zat'], ['zondag', 'zo', 'zon']];
const OSM = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const D = '(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|ma|di|wo|do|vrij|vr|zat|za|zon|zo)(?:en)?\\.?'; // "de zaterdagen" telt ook
const dayIdx = w => DAY.findIndex(n => n.includes(w.toLowerCase().replace('.', '').replace(/(dag)en$/, '$1')));
const T = '(\\d{1,2})(?:[:.](\\d{2}))?\\s*(?:uur|u)?';
const RANGE = `${T}\\s*(?:-|–|tot|t/m)\\s*${T}`;
// Eén regel-element: dagen (met t/m of opsomming), dan tijden of "gesloten".
const ENTRY = new RegExp(`\\b${D}(?:\\s*(?:t/m|tot en met|-|–|tot)\\s*${D}|(?:\\s*(?:,|en|&)\\s*${D})*)\\s*:?\\s*(?:van\\s+|tussen\\s+)?(${RANGE}(?:\\s*(?:en|&|,|/|\\|)\\s*(?:van\\s+)?${RANGE})*|gesloten|dicht|closed)`, 'gi');
// Blokken die niet over de winkeltijden gaan.
const NOT_SHOP = /spreekuur|inname|inbreng|brengen|afgifte|aanlever|ophaal|kantoor|secretariaat|telefon|bereikbaar|feestdag|kerst|oud ?jaar|nieuwjaar|pasen|pinkster|zomer|vakantie|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/i;

const mins = (h, m) => +h * 60 + (m ? +m : 0);
const hhmm = x => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;

/** Eén ENTRY-match → { days: [0..6], spans: [[van, tot]] | 'off' } of null bij onzin. */
function entry(m) {
  const s = m[0], low = s.toLowerCase();
  const daysPart = low.slice(0, low.search(/\d|gesloten|dicht|closed|van |tussen /));
  const names = [...daysPart.matchAll(new RegExp(D, 'gi'))].map(x => dayIdx(x[1])).filter(i => i >= 0);
  if (!names.length) return null;
  let days = names;
  if (/t\/m|tot en met|-|–|tot/.test(daysPart) && names.length === 2) { days = []; for (let i = names[0]; ; i = (i + 1) % 7) { days.push(i); if (i === names[1] || days.length > 7) break; } }
  if (/gesloten|dicht|closed/.test(low)) return { days, spans: 'off' };
  const spans = [];
  for (const r of low.slice(daysPart.length).matchAll(new RegExp(RANGE, 'gi'))) {
    if (!r[2] && !r[4] && !/uur|u\b/.test(r[0])) return null; // "10 - 12" zonder minuten of "uur": te dubbelzinnig
    const a = mins(r[1], r[2]), b = mins(r[3], r[4]);
    if (!(a >= 360 && b <= 1380 && b > a)) return null; // tussen 6:00 en 23:00, en eerst open dan dicht
    spans.push([a, b]);
  }
  return spans.length ? { days, spans } : null;
}

/** Tekst → { oh, days } of null. Kiest het enige winkelblok; twee verschillende blokken = twijfel = null. */
export function parseHoursNL(text) {
  const blocks = []; let cur = null;
  for (const m of text.matchAll(ENTRY)) {
    const e = entry(m); if (!e) continue;
    // Dicht op elkaar = zelfde blok; een tussenkop ("Inname van goederen") begint een nieuw blok.
    const gap = cur ? text.slice(cur.end, m.index) : '';
    if (cur && gap.length < 40 && !/\p{L}{4,}/u.test(gap)) { cur.entries.push(e); cur.end = m.index + m[0].length; continue; }
    cur = { start: m.index, end: m.index + m[0].length, entries: [e] }; blocks.push(cur);
  }
  const results = new Map();
  for (const b of blocks) {
    const lines = text.slice(Math.max(0, b.start - 200), b.start).split('\n').filter(l => l.trim()), inside = text.slice(b.start, b.end);
    // Staat er direct boven "Openingstijden", dan telt alleen die kop (een inbreng-zin daarboven gaat over iets anders).
    const before = /^\s*openings/i.test(lines.at(-1) ?? '') ? lines.at(-1) : lines.slice(-3).join(' ');
    if (NOT_SHOP.test(before) || NOT_SHOP.test(inside)) continue;
    // Gaat de lijst verder met een dag die we niet konden lezen? Dan is hij half: liever niets dan "za dicht" terwijl ze open zijn.
    if (new RegExp(`^\\s*${D}\\b`, 'i').test(text.slice(b.end, b.end + 60))) continue;
    const header = /openingstijd|openingsuren|winkel|geopend/i.test(before);
    // "Let op: op woensdag zijn wij gesloten" net onder de lijst gaat voor.
    const note = text.slice(b.end, b.end + 250), shut = [];
    for (const m of note.matchAll(new RegExp(`${D}[^.!\\n]{0,30}?gesloten|gesloten op ${D}`, 'gi'))) shut.push(dayIdx(m[1] ?? m[2]));
    const week = Array(7).fill(null); let clash = false;
    for (const e of b.entries) for (const d of e.days) { const v = e.spans === 'off' ? 'off' : e.spans.map(([a, c]) => `${hhmm(a)}-${hhmm(c)}`).join(','); if (week[d] && week[d] !== v) clash = true; week[d] = v; }
    for (const d of shut) if (d >= 0) week[d] = 'off';
    const named = week.filter(Boolean).length;
    if (clash || named < (header ? 2 : 3) || !week.some(v => v && v !== 'off')) continue; // te weinig om op te bouwen
    const parts = []; // opeenvolgende dagen met dezelfde tijden samen: Mo-Fr 09:30-16:00
    for (let i = 0; i < 7;) { const v = week[i] ?? 'off'; let j = i; while (j + 1 < 7 && (week[j + 1] ?? 'off') === v) j++; if (v !== 'off') parts.push(`${OSM[i]}${j > i ? '-' + OSM[j] : ''} ${v}`); i = j + 1; }
    results.set(parts.join('; '), named);
  }
  if (results.size !== 1) return null;
  let oh = [...results.keys()][0];
  if (/feestdagen[^.!\n]{0,60}gesloten|gesloten\s+op\s+(zon- en )?feestdagen/i.test(text)) oh += '; PH off';
  return { oh };
}

const LD_DAY = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
/** schema.org in de pagina (JSON-LD): openingHoursSpecification of openingHours. Eén winkel met geldige tijden, anders null. */
export function hoursLD(html) {
  const found = new Set();
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data; try { data = JSON.parse(m[1]); } catch { continue; }
    const walk = x => {
      if (Array.isArray(x)) return x.forEach(walk);
      if (!x || typeof x !== 'object') return;
      const week = Array(7).fill(null);
      for (const s of [x.openingHoursSpecification ?? []].flat()) {
        if (s.validFrom || s.validThrough || !s.opens || !s.closes) continue; // uitzonderingen (feestdagen) slaan we over
        const [a, b] = [s.opens, s.closes].map(t => /^(\d{1,2}):(\d{2})/.exec(t)).map(t => t && mins(t[1], t[2]));
        if (!(a >= 360 && b <= 1380 && b > a)) return; // 00:00-23:59 is een standaardwaarde van een thema, geen tijd
        for (const d of [s.dayOfWeek].flat()) { const i = LD_DAY[String(d).split('/').pop().toLowerCase()]; if (i >= 0) week[i] = [week[i], `${hhmm(a)}-${hhmm(b)}`].filter(Boolean).join(','); }
      }
      if (week.some(Boolean)) {
        const parts = [];
        for (let i = 0; i < 7;) { const v = week[i]; let j = i; while (j + 1 < 7 && week[j + 1] === v) j++; if (v) parts.push(`${OSM[i]}${j > i ? '-' + OSM[j] : ''} ${v}`); i = j + 1; }
        found.add(parts.join('; '));
      } else if (typeof x.openingHours === 'string' || Array.isArray(x.openingHours)) {
        const oh = [x.openingHours].flat().join('; ').trim();
        // Al OSM-achtig ("Mo-Fr 09:00-17:00"); alleen overnemen als elk deel dat ook echt is.
        if (oh && oh.split(/\s*;\s*/).every(p => /^(Mo|Tu|We|Th|Fr|Sa|Su)([-,](Mo|Tu|We|Th|Fr|Sa|Su))* ([0-2]\d:[0-5]\d-[0-2]\d:[0-5]\d,?)+$/.test(p)) && !/00:00-23:59|00:00-24:00/.test(oh)) found.add(oh);
      }
      Object.values(x).forEach(v => typeof v === 'object' && walk(v));
    };
    walk(data);
  }
  // Elke dag van de week precies dezelfde tijden is bijna altijd de standaardwaarde van een plugin, geen echte winkel.
  for (const oh of found) if (/^Mo-Su |^Mo,Tu,We,Th,Fr,Sa,Su /.test(oh) && !oh.includes(';')) found.delete(oh);
  return found.size === 1 ? { oh: [...found][0] } : null; // twee winkels met andere tijden (keten): twijfel
}

/** Tijden van een pagina: eerst schema.org, dan de tekst. */
export const hoursFromHtml = html => hoursLD(html) ?? parseHoursNL(toText(html));

/** Sleutel voor de cache: host + pad, zonder www en slash. Winkels van één keten op één pagina delen hem. */
export const siteKey = u => { try { const x = new URL(/^https?:/i.test(u) ? u : 'https://' + u); return x.host.replace(/^www\./, '').toLowerCase() + x.pathname.replace(/\/$/, ''); } catch { return null; } };
