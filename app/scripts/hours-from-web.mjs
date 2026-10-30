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
const D = '(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|ma|di|wo|do|vrij|vr|zat|za|zon|zo)(?:en|s)?\\.?'; // "de zaterdagen" en "dinsdags" tellen ook
const dayIdx = w => DAY.findIndex(n => n.includes(w.toLowerCase().replace('.', '').replace(/(dag)(en|s)$/, '$1')));
const T = '(\\d{1,2})(?:[:.](\\d{2}))?\\s*(?:uur|u)?';
const RANGE = `${T}\\s*(?:-|–|tot|t/m)\\s*${T}`;
// Eén regel-element: dagen (met t/m of opsomming), dan tijden of "gesloten".
const ENTRY = new RegExp(`\\b${D}(?:\\s*(?:t/m|tot en met|-|–|tot)\\s*${D}|(?:\\s*(?:,|en|&)\\s*${D})*)\\s*:?\\s*(?:van\\s+|tussen\\s+)?(${RANGE}(?:\\s*(?:en|&|,|/|\\|)\\s*(?:van\\s+)?${RANGE})*|gesloten|dicht|closed)`, 'gi');
// Blokken die niet over de winkeltijden gaan.
const NOT_SHOP = /spreekuur|inname|inbreng|inlever|brengen|afgifte|aanlever|ophaal|kantoor|secretariaat|telefon|bereikbaar|feestdag|kerst|oud ?jaar|nieuwjaar|pasen|pinkster|zomer|vakantie|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/i;

const DAYS_FULL = 'maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag', CELL = `(?:\\d{1,2}[:.]\\d{2}\\s*(?:-|–)\\s*\\d{1,2}[:.]\\d{2}|gesloten|dicht)`;
const COLS = new RegExp(`(?:^(?:${DAYS_FULL})\\n${CELL}\\n${CELL}\\n){3,}`, 'gim');
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
    const loose = !r[2] && !r[4] && !/uur|u\b/.test(r[0]); // "10 - 17" zonder minuten of "uur": alleen onder een kop "Openingstijden" (anders misschien een datum)
    const a = mins(r[1], r[2]), b = mins(r[3], r[4]);
    if (!(a >= 360 && b <= 1380 && b > a)) return null; // tussen 6:00 en 23:00, en eerst open dan dicht
    spans.push([a, b]); if (loose) spans.loose = true;
  }
  return spans.length ? { days, spans, loose: !!spans.loose } : null;
}

/** Tekst → { oh, days } of null. Kiest het enige winkelblok; twee verschillende blokken = twijfel = null. */
export function parseHoursNL(text) {
  // Tabel met twee kolommen (dag, winkel, inleveren onder elkaar, zoals bij Het Goed): alleen de eerste kolom als de kop zegt dat dat de winkel is.
  text = text.replace(COLS, (tbl, at) => {
    const head = text.slice(Math.max(0, at - 80), at), rows = [...tbl.matchAll(/^(\S+)\n(.+)\n(.+)$/gm)];
    if (/winkel[\s\S]*(inlever|inname|inbreng|brengen)/i.test(head)) return '\nOpeningstijden winkel\n' + rows.map(r => `${r[1]}: ${r[2]}\n`).join(''); // eigen kop: de kolomkoppen noemen "inleveren"
    // Anders ochtend en middag (Rooie Ben, "Dag | Ochtend | Middag"). Overlappen de kolommen, dan zijn het twee lijsten (zomer en winter, winkel en inname): twijfel.
    const out = [];
    for (const [, d, a, b] of rows) {
      const t = [a, b].filter(c => !/gesloten|dicht/i.test(c)), at2 = c => c.match(/\d{1,2}[:.]\d{2}/g).map(x => mins(...x.split(/[:.]/)));
      if (t.length === 2 && at2(t[1])[0] < at2(t[0])[1]) return '\n';
      out.push(`${d}: ${t.length ? t.join(' en ') : 'gesloten'}\n`);
    }
    return '\n' + out.join('');
  });
  const blocks = []; let cur = null;
  for (const m of text.matchAll(ENTRY)) {
    const e = entry(m); if (!e) continue;
    // Dicht op elkaar = zelfde blok; een tussenkop ("Inname van goederen") begint een nieuw blok.
    const gap = cur ? text.slice(cur.end, m.index) : '';
    if (cur && gap.length < 40 && !/\p{L}{4,}/u.test(gap)) { cur.entries.push(e); cur.end = m.index + m[0].length; continue; }
    cur = { start: m.index, end: m.index + m[0].length, entries: [e] }; blocks.push(cur);
  }
  const weeks = [];
  for (const b of blocks) {
    const lines = text.slice(Math.max(0, b.start - 400), b.start).split('\n').filter(l => l.trim()), inside = text.slice(b.start, b.end);
    const near = text.slice(Math.max(0, b.start - 200), b.start).split('\n').filter(l => l.trim()).slice(-3); // zonder kop: alleen vlak erboven kijken
    // Kop "Openingstijden" vlak boven de lijst: alleen die kop en korte tussenkoppen tellen ("Spullen inleveren:"), geen lange zin
    // erboven of ertussen ("U kunt woensdag tot vrijdag uw goederen inleveren.") die over iets anders gaat.
    const hi = lines.slice(-3).findLastIndex(l => /^\s*openings/i.test(l)), tail = lines.slice(-3);
    const before = hi >= 0 ? [tail[hi], ...tail.slice(hi + 1).filter(l => l.length <= 60)].join(' ') : near.join(' ');
    if (NOT_SHOP.test(before) || NOT_SHOP.test(inside)) continue;
    // Gaat de lijst verder met een dag die we niet konden lezen? Dan is hij half: liever niets dan "za dicht" terwijl ze open zijn.
    if (new RegExp(`^\\s*${D}\\b`, 'i').test(text.slice(b.end, b.end + 60))) continue;
    const header = /openingstijd|openingsuren|winkel|geopend/i.test(before);
    if (!header && b.entries.some(e => e.loose)) continue;
    // "Let op: op woensdag zijn wij gesloten" net onder de lijst gaat voor.
    const note = text.slice(b.end, b.end + 250), shut = [];
    for (const m of note.matchAll(new RegExp(`${D}[^.!\\n]{0,30}?gesloten|gesloten op ${D}`, 'gi'))) shut.push(dayIdx(m[1] ?? m[2]));
    const week = Array(7).fill(null); let clash = false;
    for (const e of b.entries) for (const d of e.days) { const v = e.spans === 'off' ? 'off' : e.spans.map(([a, c]) => `${hhmm(a)}-${hhmm(c)}`).join(','); if (week[d] && week[d] !== v) clash = true; week[d] = v; }
    for (const d of shut) if (d >= 0) week[d] = 'off';
    const named = week.filter(Boolean).length;
    if (clash || named < (header ? 2 : 3) || !week.some(v => v && v !== 'off')) continue; // te weinig om op te bouwen
    weeks.push(Object.assign(week, { shop: /winkel|kringloop/i.test(before) }));
  }
  // Twee blokken mogen alleen samen als ze op elke dag die ze allebei noemen hetzelfde zeggen (tabel + "geopend van ma t/m za" in de tekst).
  // Botsen ze, maar heeft precies één de kop "winkel" ("Openingstijden Kringloopwinkel" onder "… Verenigingsruimtes"), dan die.
  const merged = ws => {
    const week = Array(7).fill(null);
    for (const [n, w] of ws.entries()) {
      if (n && !w.some((v, d) => v && week[d])) return null; // geen enkele dag gemeen: twee verschillende lijsten (winkel en iets anders)
      for (let d = 0; d < 7; d++) if (w[d]) { if (week[d] && week[d] !== w[d]) return null; week[d] = w[d]; }
    }
    return week;
  };
  const shops = weeks.filter(w => w.shop), week = weeks.length ? merged(weeks) ?? (shops.length === 1 ? shops[0] : null) : null;
  if (!week) return null;
  const parts = []; // opeenvolgende dagen met dezelfde tijden samen: Mo-Fr 09:30-16:00
  for (let i = 0; i < 7;) { const v = week[i] ?? 'off'; let j = i; while (j + 1 < 7 && (week[j + 1] ?? 'off') === v) j++; if (v !== 'off') parts.push(`${OSM[i]}${j > i ? '-' + OSM[j] : ''} ${v}`); i = j + 1; }
  let oh = parts.join('; ');
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
      if (!week.some(Boolean) && (typeof x.openingHours === 'string' || Array.isArray(x.openingHours))) {
        // Al OSM-achtig ("Mo-Fr 09:00-17:00"); alleen als elk deel dat ook echt is. Via de week, zodat "Mo-Fr 9-12; Mo-Fr 13-17" één dag wordt.
        for (const part of [x.openingHours].flat().join(';').split(/\s*;\s*/).filter(Boolean)) {
          const m = /^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:[-,](?:Mo|Tu|We|Th|Fr|Sa|Su))*) ((?:[0-2]\d:[0-5]\d-[0-2]\d:[0-5]\d,?)+)$/.exec(part.trim()); if (!m) return;
          const days = new Set(); for (const g of m[1].split(',')) { const [a, b = a] = g.split('-').map(d => OSM.indexOf(d)); for (let i = a; ; i = (i + 1) % 7) { days.add(i); if (i === b) break; } }
          for (const t of m[2].split(',').filter(Boolean)) { const [a, b] = t.split('-').map(v => mins(...v.split(':'))); if (!(a >= 360 && b <= 1380 && b > a)) return; for (const d of days) week[d] = [week[d], t].filter(Boolean).join(','); }
        }
      }
      if (week.some(Boolean)) {
        const parts = [];
        for (let i = 0; i < 7;) { const v = week[i]; let j = i; while (j + 1 < 7 && week[j + 1] === v) j++; if (v) parts.push(`${OSM[i]}${j > i ? '-' + OSM[j] : ''} ${v}`); i = j + 1; }
        found.add(parts.join('; '));
      }
      Object.values(x).forEach(v => typeof v === 'object' && walk(v));
    };
    walk(data);
  }
  // Elke dag van de week precies dezelfde tijden is bijna altijd de standaardwaarde van een plugin, geen echte winkel.
  for (const oh of found) if (/^Mo-Su /.test(oh) && !oh.includes(';')) found.delete(oh);
  return found.size === 1 ? { oh: [...found][0] } : null; // twee winkels met andere tijden (keten): twijfel
}

/** Tijden van een pagina: eerst wat de winkel zichtbaar op de pagina zet, dan schema.org (onzichtbaar, vaker verouderd). */
export const hoursFromHtml = html => parseHoursNL(toText(html)) ?? hoursLD(html);

/** Sleutel voor de cache: host + pad, zonder www en slash. Winkels van één keten op één pagina delen hem. */
export const siteKey = u => { try { const x = new URL(/^https?:/i.test(u) ? u : 'https://' + u); return x.host.replace(/^www\./, '').toLowerCase() + x.pathname.replace(/\/$/, ''); } catch { return null; } };
