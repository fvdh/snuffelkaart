// Website raden voor winkels zonder site (9 nov): naam.nl, naam-plaats.nl … en alleen als bewijs op die site staat (ons telefoonnummer
// of onze postcode). Gevonden = voorstel in beheer (data.siteGuess, vastgezet zodat een import het niet wist); pas na "Goed" wordt het
// de website, en leest de websitelezer er de tijden van. Proef: 7 van 150 raak.
//   node scripts/raad-sites.mjs          (winkels die we de laatste 90 dagen niet probeerden)
//   node scripts/raad-sites.mjs --dry    (alleen tonen)
import fs from 'node:fs';
import { all, req } from './db.mjs';
import { toText } from './hours-from-web.mjs';

const UA = 'Mozilla/5.0 (compatible; Snuffelkaart/1.0; +https://snuffelkaart.nl/colofon/)', DRY = process.argv.includes('--dry');
const TRIED = new URL('../data-raw/site-raad.json', import.meta.url), tried = fs.existsSync(TRIED) ? JSON.parse(fs.readFileSync(TRIED, 'utf8')) : {};

const plain = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’&.]/g, '').replace(/\b(bv|vof|stichting)\b/g, '');
/** Kandidaten: naam aan elkaar, met streepjes, en met de plaats erachter. Te kort (≤4) of te lang gokt alleen maar raak bij iemand anders. */
export function guesses(name, place) {
  const w = plain(name).split(/[^a-z0-9]+/).filter(Boolean), pl = plain(place ?? '').split(/[^a-z0-9]+/).filter(Boolean);
  const bases = [w.join(''), w.join('-'), [...w, ...pl].join(''), [...w, ...pl].join('-')].filter(b => b.length >= 5 && b.length < 40);
  return [...new Set(bases)].map(b => `${b}.nl`);
}
/** Staat de winkel op die site? Telefoon (laatste 9 cijfers) of postcode. */
export function proof(text, phone, addr) {
  const tel = (phone ?? '').split(';')[0].replace(/\D/g, '').replace(/^31/, '0').slice(-9), pc = /\b([1-9]\d{3})\s?([A-Z]{2})\b/i.exec(addr ?? '');
  if (tel.length === 9 && text.replace(/\D/g, '').includes(tel)) return 'telefoon';
  if (pc && new RegExp(`\\b${pc[1]}\\s?${pc[2]}\\b`, 'i').test(text)) return 'postcode';
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const now = Date.now(), today = new Date().toISOString().slice(0, 10);
  const rows = (await all('places')).filter(r => r.status === 'actief' && !r.data.website && !r.data.siteGuess && (r.data.phone || r.data.addr)
    && !(tried[r.id] && now - Date.parse(tried[r.id]) < 90 * 864e5));
  console.log(`${rows.length} winkels zonder website om te proberen`);
  const get = async d => { try { const r = await fetch(`https://${d}`, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(8000) }); return r.ok ? { url: r.url, html: await r.text() } : null; } catch { return null; } };
  let hits = 0;
  const queue = [...rows];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let r; (r = queue.shift());) {
      for (const d of guesses(r.data.name, r.data.place)) {
        const page = await get(d); if (!page) continue;
        const bewijs = proof(toText(page.html), r.data.phone, r.data.addr); if (!bewijs) continue;
        const end = new URL(page.url), url = end.host.replace(/^www\./, '') === d ? `${end.origin}/` : page.url; // doorgestuurd (Google Sites): de hele pagina
        hits++; console.log(`  ${r.data.name} (${r.data.place}) → ${url} [${bewijs}]`);
        if (!DRY) await req(`places?id=eq.${encodeURIComponent(r.id)}`, { method: 'PATCH', body: JSON.stringify({ data: { ...r.data, siteGuess: { url, bewijs, d: today } }, locked: [...new Set([...r.locked, 'siteGuess'])], updated_at: new Date().toISOString() }) });
        break;
      }
      tried[r.id] = today;
    }
  }));
  if (!DRY) fs.writeFileSync(TRIED, JSON.stringify(tried));
  console.log(`Klaar: ${hits} websites gevonden van ${rows.length} winkels${DRY ? ' (proef, niets geschreven)' : ', staan in beheer → Winkels → Nakijken'}`);
}
