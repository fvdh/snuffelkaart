// Tweede lezer voor websitetijden: een taalmodel (GitHub Models, gratis met de GITHUB_TOKEN van de workflow) leest wat de
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

/** Antwoord van het model controleren. Geeft { oh } of null. */
export function check(answer, text, today = todayIso()) {
  const oh = answer?.oh?.trim?.(), quote = answer?.bron;
  if (!oh || typeof quote !== 'string' || !OH.test(oh)) return null;
  if (!flat(text).includes(flat(quote)) || quote.length < 10) return null; // verzonnen of aangepaste bron
  const nums = new Set([...flat(quote).matchAll(/\d{1,2}(?=[:.]\d{2}|\s*(?:uur|u\b|-|tot|en))/g)].map(m => +m[0]));
  for (const m of oh.matchAll(/([0-2]\d):[0-5]\d/g)) if (!nums.has(+m[1])) return null; // elke tijd moet in de bron staan
  for (const m of oh.matchAll(/([0-2]\d):([0-5]\d)-([0-2]\d):([0-5]\d)/g)) { const a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4]; if (!(a >= 360 && b <= 1380 && b > a)) return null; }
  return precompute(oh, today) ? { oh } : null;
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

/** Vraag het model. Gooit bij 429 (dagtegoed op) een fout met .limit, zodat de aanroeper stopt. */
export async function askAI(name, addr, text, { token = process.env.GITHUB_TOKEN, model = 'openai/gpt-4.1-mini' } = {}, tries = 3) {
  const r = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: PROMPT(name, addr, text) }] }),
  });
  // 429 met korte wachttijd = minuutgrens (±15 per minuut): even wachten. Lange wachttijd of 403 = dagtegoed op of geen toegang: stoppen.
  const wait = +(r.headers.get('retry-after') ?? 0);
  if (r.status === 429 && wait && wait <= 90 && tries > 1) { await new Promise(ok => setTimeout(ok, wait * 1000)); return askAI(name, addr, text, { token, model }, tries - 1); }
  if (r.status === 429 || r.status === 403) throw Object.assign(new Error(`model ${r.status}${wait ? `, opnieuw over ${wait} s` : ''}`), { limit: true });
  if (!r.ok) throw new Error(`model ${r.status}`);
  const j = await r.json();
  const raw = j.choices?.[0]?.message?.content ?? '';
  let ans = null; try { ans = JSON.parse(raw); } catch { /* geen JSON */ }
  const ok = check(ans, text);
  if (!ok && process.env.AI_DEBUG) console.log(`  AI afgewezen: ${name} → ${raw.replace(/\s+/g, ' ').slice(0, 300)}`);
  return ok;
}
