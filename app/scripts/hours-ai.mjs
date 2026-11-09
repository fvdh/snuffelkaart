// Tweede lezer voor websitetijden: een taalmodel (Cloudflare Workers AI, gratis dagtegoed, geen betaalmethode) leest wat de
// parser niet kan ("tussen 11 en 17 uur", pagina's met meerdere vestigingen). Wantrouwig: het model moet de zin letterlijk
// overnemen, elke tijd moet in die zin staan en de uitkomst moet geldige OSM-syntax zijn. Anders null.
// ponytail: één model, één poging per pagina; cache op de tekst (fetch-web-hours) zodat ongewijzigde pagina's niets kosten.
import { createHash } from 'node:crypto';
import { precompute, todayIso } from './hours-precompute.mjs';

const DAYS = /\b(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|ma|di|wo|do|vr|za|zo)\b/i, TIME = /\b\d{1,2}([:.]\d{2})?\s*(uur|u\b|-|–|tot)/i;

/** Stukken tekst rond "openingstijden" (of anders rond dagen met tijden), samen hooguit ~3000 tekens. Null als er geen dag met tijd in staat. */
export function snippet(text) {
  const at = [...text.matchAll(/openingstijd|openingsuren|geopend|wij zijn open|we zijn open/gi)].map(m => m.index);
  if (!at.length) for (const m of text.matchAll(new RegExp(DAYS.source, 'gi'))) if (TIME.test(text.slice(m.index, m.index + 60))) { at.push(m.index); break; }
  const parts = [];
  for (const i of at) {
    const s = text.slice(Math.max(0, i - 150), i + 700);
    if (DAYS.test(s) && TIME.test(s) && !parts.some(p => p.includes(s.slice(150, 300)))) parts.push(s);
    if (parts.join('').length > 2500) break;
  }
  return parts.length ? parts.join('\n…\n').slice(0, 3000) : null;
}
export const hashOf = s => createHash('sha1').update(s).digest('hex').slice(0, 12);

const flat = s => s.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
const OH = /^(?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:[-,](?:Mo|Tu|We|Th|Fr|Sa|Su))* (?:off|[0-2]\d:[0-5]\d-[0-2]\d:[0-5]\d(?:,[0-2]\d:[0-5]\d-[0-2]\d:[0-5]\d)*)(?:; |$))+(?:; PH off)?$/;

// Niet elke week open: "elke eerste en derde zaterdag", "laatste zaterdag van de maand" (proef 6 nov: 't Schuurtje kreeg elke zaterdag).
const MONTHLY = /\b(eerste|tweede|derde|vierde|laatste|oneven)\b[^.\n]{0,40}(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)|van de maand|per maand|om de week|tweewekelijks/i;
const PC = /\b([1-9]\d{3})\s?[a-z]{2}\b/gi;

const D7 = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
/** Zelfde dag in twee regels: in OSM vervangt de tweede de eerste. Het model bedoelt dat bij overlap ("Tu-Sa 10-17; Fr 10-18": vrijdag langer)
 *  maar niet bij een losse avond ("Tu-Fr 9-17; Fr 18:30-20:30": koopavond erbij). Overlap = vervangen, anders erbij; daarna één regel per dag. */
export function mergeDays(oh) {
  const week = Array(7).fill(null), mins = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  for (const part of oh.split('; ')) {
    if (part === 'PH off') continue;
    const [daysTxt, timesTxt] = part.split(' '), spans = timesTxt === 'off' ? [] : timesTxt.split(',');
    for (const g of daysTxt.split(',')) {
      const [a, b = a] = g.split('-').map(d => D7.indexOf(d));
      for (let i = a; ; i = (i + 1) % 7) {
        const old = week[i] ?? [], overlap = old.some(x => spans.some(y => mins(y) < mins(x.slice(6)) && mins(x) < mins(y.slice(6))));
        week[i] = !spans.length || !old.length || overlap ? spans : [...old, ...spans].sort();
        if (i === b) break;
      }
    }
  }
  const parts = [];
  for (let i = 0; i < 7;) { const v = (week[i] ?? []).join(','); let j = i; while (j + 1 < 7 && (week[j + 1] ?? []).join(',') === v) j++; if (v) parts.push(`${D7[i]}${j > i ? '-' + D7[j] : ''} ${v}`); i = j + 1; }
  return parts.join('; ') + (/PH off/.test(oh) ? '; PH off' : '');
}

/** Antwoord van het model controleren. Geeft { oh } of null. addr: adres van de winkel (bij meerdere vestigingen op één pagina). */
export function check(answer, text, today = todayIso(), addr = '') {
  const oh = answer?.oh?.trim?.().replace(/,\s+/g, ','), quote = answer?.bron; // "09:00-12:00, 13:00-16:00" is ook goed (proef: ROEC)
  if (!oh || typeof quote !== 'string' || !OH.test(oh)) return null;
  const T = flat(text), Q = flat(quote), at = T.indexOf(Q);
  if (at < 0 || quote.length < 10) return null; // verzonnen of aangepaste bron
  if (MONTHLY.test(text)) return null;
  // Meerdere vestigingen (meer dan één postcode op de pagina): de dichtstbijzijnde postcode vóór de bron moet die van deze winkel zijn (proef: RaderWerk).
  if (new Set([...text.matchAll(PC)].map(m => m[1])).size > 1) {
    const pc = /\b([1-9]\d{3})\s?[A-Z]{2}\b/i.exec(addr)?.[1], last = [...T.slice(0, at).matchAll(PC)].pop()?.[1];
    if (!pc || last !== pc) return null;
  }
  // Eén dag in de bron, meerdere in het antwoord: aangevuld (proef: Goirle, "op maandag geopend" werd ma t/m za).
  const named = new Set([...Q.matchAll(/\b(ma|di|wo|do|vr|za|zo)(?:andag|nsdag|ensdag|nderdag|ijdag|terdag|ndag)?s?\b/g)].map(m => m[1])).size;
  const days = oh.split('; ').reduce((n, part) => n + (part.match(/^[A-Za-z,-]+/)[0].split(',').reduce((k, g) => { const [x, y = x] = g.split('-').map(d => 'MoTuWeThFrSaSu'.indexOf(d) / 2); return k + ((y - x + 7) % 7) + 1; }, 0)), 0);
  if (days > 1 && named < 2 && !/dagelijks|werkdagen|alle dagen|elke dag|7 dagen/.test(Q)) return null;
  const nums = new Set([...Q.matchAll(/\d{1,2}(?=[:.]\d{2}|\s*(?:uur|u\b|-|tot|en))/g)].map(m => +m[0]));
  for (const m of oh.matchAll(/([0-2]\d):[0-5]\d/g)) if (!nums.has(+m[1])) return null; // elke tijd moet in de bron staan
  for (const m of oh.matchAll(/([0-2]\d):([0-5]\d)-([0-2]\d):([0-5]\d)/g)) { const a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4]; if (!(a >= 360 && b <= 1380 && b > a)) return null; }
  const out = mergeDays(oh);
  return out && precompute(out, today) ? { oh: out } : null;
}

const PROMPT = (name, addr, text) => `Hieronder staat tekst van de website van de tweedehandswinkel "${name}"${addr ? ` (${addr})` : ''}.
Wat zijn de vaste wekelijkse openingstijden van de winkel voor klanten?
Niet: tijden voor inbreng, inname, ophalen, kantoor of telefoon; feestdagen; tijdelijke of seizoenstijden.
Antwoord alleen met JSON: {"oh": "...", "bron": "..."}
- "oh": de tijden in OpenStreetMap-syntax, bijvoorbeeld "Tu-Fr 10:00-17:00; Sa 10:00-16:00". Dagen Mo Tu We Th Fr Sa Su, tijden HH:MM.
- "bron": de zin of regels uit de tekst waar die tijden staan, letterlijk overgenomen.
Geef {"oh": null} als de tijden niet duidelijk zijn, als de winkel niet elke week op vaste dagen open is (bijvoorbeeld eens per maand),
of als er meerdere winkels staan en niet duidelijk is welke bij dit adres hoort.

Tekst:
${text}`;

/* ---------- Geen tijden: wat zegt de site dan wél? ----------
 * Randgevallen die we tegenkomen (en wat we ermee doen):
 *   afspraak        "geen vaste openingstijden", "alleen op afspraak", "by appointment only"   → kaart: op afspraak
 *   dicht           tijdelijk gesloten: verbouwing, ziekte, vakantie, "tot nader bericht"     → kaart: tijdelijk gesloten (t/m datum als die er staat)
 *   onregelmatig    "elke eerste zaterdag", "alleen in de zomer", "wisselende tijden, zie Facebook",
 *                   "open tijdens evenementen"                                                → kaart: de zin van de site, letterlijk
 *   gestopt         "wij zijn gestopt", "definitief gesloten", "opgeheven", "failliet"         → beheer: nakijken (niet zelf verbergen)
 *   verhuisd        "we zijn verhuisd naar …", "nieuwe locatie"                                → beheer: adres nakijken
 *   online          "alleen online", "geen fysieke winkel", "alleen webshop"                   → beheer: nakijken (hoort hij op de kaart?)
 * Elk antwoord moet een letterlijke zin van de pagina zijn, met een woord dat bij de soort past. Twijfel = niets. */
const STATUS_WORDS = /afspraak|appointment|gesloten|dicht\b|closed|gestopt|stoppen|opgeheven|failliet|verhuisd|verhuizen|nieuwe (?:locatie|adres|winkel)|moved|webshop|online|vakantie|verbouw|seizoen|wisselend|van de maand|tot nader bericht|openingstijd|openingsuren|opening hours/gi;
/** Stukken tekst rond woorden die iets zeggen over open of dicht, samen hooguit ~2500 tekens. Null als er niets van dat soort staat. */
export function statusSnippet(text) {
  const parts = [];
  for (const m of text.matchAll(STATUS_WORDS)) {
    if (/^(online|webshop|openingstijd|openingsuren|opening hours)$/i.test(m[0]) && parts.length) continue; // komt overal voor; alleen als er verder niets is
    const s = text.slice(Math.max(0, m.index - 200), m.index + 300);
    if (!parts.some(p => p.includes(s.slice(180, 240)))) parts.push(s);
    if (parts.join('').length > 2200) break;
  }
  return parts.length ? parts.join('\n…\n').slice(0, 2500) : null;
}
const KIND_WORDS = {
  afspraak: /afspraak|appointment/,
  dicht: /tijdelijk|voorlopig|vakantie|verbouw|ziek|tot nader|gesloten|dicht|closed/,
  onregelmatig: /eerste|tweede|derde|vierde|laatste|van de maand|per maand|om de week|seizoen|zomer|winter|lente|herfst|wisselend|facebook|instagram|evenement|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december/,
  gestopt: /gestopt|stoppen|stopt|opgeheven|definitief|failliet|faillissement|sluit|gesloten|closed|laatste dag|afscheid/,
  verhuisd: /verhuis|nieuwe (?:locatie|adres|winkel|plek)|moved|nieuw adres/,
  online: /online|webshop|web shop|internet/,
};
/** Antwoord op de statusvraag controleren. Geeft { k, q, tot? } of null. */
export function checkStatus(ans, text, today = todayIso()) {
  const k = ans?.soort, q = typeof ans?.bron === 'string' ? ans.bron.trim() : '';
  if (!KIND_WORDS[k] || q.length < 10 || q.length > 300) return null;
  const Q = flat(q);
  if (!flat(text).includes(Q) || !KIND_WORDS[k].test(Q)) return null; // verzonnen, aangepast of past niet bij de soort
  if (k === 'online' && !/alleen|uitsluitend|geen (?:fysieke |echte )?winkel|only/.test(Q)) return null; // "ook online" is geen reden
  if (k === 'gestopt' && /tijdelijk|voorlopig|vakantie|verbouw|feestdag|zondag|maandag|kerst/.test(Q)) return null; // dat is gewoon dicht
  const out = { k, q: q.replace(/\s+/g, ' ') };
  if (k === 'dicht' && /^\d{4}-\d{2}-\d{2}$/.test(ans.tot ?? '')) { if (ans.tot < today) return null; out.tot = ans.tot; } // al voorbij: oud bericht
  return out;
}
const STATUS_PROMPT = (name, addr, text, today) => `Hieronder staat tekst van de website van de tweedehandswinkel "${name}"${addr ? ` (${addr})` : ''}. Vandaag is ${today}.
Er staan geen vaste wekelijkse openingstijden. Zegt de tekst iets anders over wanneer of of je de winkel kunt bezoeken?
Antwoord alleen met JSON: {"soort": "...", "bron": "...", "tot": null}
- "soort" is één van:
  "afspraak" (alleen op afspraak, geen vaste tijden),
  "dicht" (tijdelijk gesloten, bijvoorbeeld verbouwing, ziekte of vakantie),
  "onregelmatig" (niet elke week: bijvoorbeeld eens per maand, alleen in een seizoen, wisselende tijden of tijden op Facebook),
  "gestopt" (de winkel is definitief gesloten of opgeheven),
  "verhuisd" (de winkel zit nu op een ander adres),
  "online" (alleen een webshop, geen winkel om te bezoeken),
  "geen" (niets van dit alles, of niet duidelijk).
- "bron": de zin uit de tekst waar het staat, letterlijk overgenomen.
- "tot": alleen bij "dicht": de datum (JJJJ-MM-DD) tot en met wanneer de winkel dicht is, als die er staat; anders null.
Gaat het over een andere winkel, over inbreng of ophalen, of over feestdagen, antwoord dan {"soort": "geen"}.

Tekst:
${text}`;

/** Statusvraag aan het model; zelfde regels voor tegoed en fouten als askAI. Geeft { k, q, tot? } of null. */
export async function askStatus(name, addr, text, opts = {}) {
  const raw = await chat(STATUS_PROMPT(name, addr, text, todayIso()), opts);
  let ans = null; try { ans = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { /* geen JSON */ }
  const ok = checkStatus(ans, text);
  if (!ok && ans?.soort && ans.soort !== 'geen' && process.env.AI_DEBUG) console.log(`  AI-status afgewezen: ${name} → ${raw.replace(/\s+/g, ' ').slice(0, 300)}`);
  return ok;
}

/** Vraag het model (Cloudflare Workers AI, OpenAI-vorm). Gooit bij dagtegoed op of geen toegang een fout met .limit, zodat de aanroeper stopt.
 *  GitHub Models was de eerste keus, maar is op 30 juli 2026 gestopt (het adres antwoordt alleen nog "OK"). */
export async function askAI(name, addr, text, opts = {}) {
  const raw = await chat(PROMPT(name, addr, text), opts);
  let ans = null; try { ans = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { /* geen JSON in het antwoord */ }
  const ok = check(ans, text, undefined, addr);
  if (!ok && process.env.AI_DEBUG) console.log(`  AI afgewezen: ${name} → ${raw.replace(/\s+/g, ' ').slice(0, 300)}`);
  return ok;
}
async function chat(content, { account = process.env.CF_ACCOUNT_ID, token = process.env.CF_AI_TOKEN, model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast' } = {}, tries = 3) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`, {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, max_tokens: 400, messages: [{ role: 'user', content }] }),
  });
  const body = await r.text(), short = body.replace(/\s+/g, ' ').slice(0, 200);
  // 429 met korte wachttijd: even wachten. Anders (dagtegoed op, 401/403 geen toegang): stoppen.
  const wait = +(r.headers.get('retry-after') ?? 0);
  if (r.status === 429 && wait && wait <= 90 && tries > 1) { await new Promise(ok => setTimeout(ok, wait * 1000)); return chat(content, { account, token, model }, tries - 1); }
  if ([401, 403, 429].includes(r.status) || /allocation|quota|neurons/i.test(short)) throw Object.assign(new Error(`model ${r.status}: ${short}`), { limit: true });
  if (!r.ok) throw new Error(`model ${r.status}: ${short}`);
  let j; try { j = JSON.parse(body); } catch { throw Object.assign(new Error(`model gaf geen JSON: ${short}`), { limit: true }); } // verkeerd adres: niet 120 keer proberen
  return j.choices?.[0]?.message?.content ?? '';
}
