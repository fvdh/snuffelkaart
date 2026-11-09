// Nieuwe website voor een winkel (beheer: "dit is de goede site"): website zetten en vastzetten, "website weg" eraf,
// en meteen de tijden lezen (homepage + hooguit 3 links naar openingstijden/contact), met dezelfde lezer als elke week.
//   node scripts/zet-site.mjs <id> <url>
// ponytail: tot er in beheer een veld "Website wijzigen" is; daarna doet de wekelijkse lezer de tijden.
import { req } from './db.mjs';
import { hoursFromHtml } from './hours-from-web.mjs';

const [id, site] = process.argv.slice(2);
if (!id || !/^https?:\/\//.test(site ?? '')) throw new Error('gebruik: node scripts/zet-site.mjs <id> <https://…>');
const UA = 'Mozilla/5.0 (compatible; Snuffelkaart/1.0; +https://snuffelkaart.nl/colofon/)';
const get = async u => (await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) })).text();

const [r] = await req(`places?id=eq.${encodeURIComponent(id)}&select=locked,data`);
if (!r) throw new Error(`geen winkel ${id}`);
const { siteDead, ...data } = r.data, locked = new Set([...r.locked, 'website', 'siteDead']);
data.website = site;
const home = await get(site), links = [...new Set([...home.matchAll(/href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)]
  .filter(m => /openingstijd|contact|bezoek|winkel/i.test(m[1] + m[2])).map(m => new URL(m[1], site).href).filter(u => u.startsWith(new URL(site).origin)))].slice(0, 3);
let hit = hoursFromHtml(home, data.addr ?? ''), page = site;
for (const u of links) { if (hit) break; try { hit = hoursFromHtml(await get(u), data.addr ?? ''); page = u; } catch { /* volgende */ } }
if (hit && !(data.h && data.hs !== 'web')) { Object.assign(data, { oh: hit.oh, checked: new Date().toISOString().slice(0, 10), hs: 'web', hu: page }); ['oh', 'checked', 'hs', 'hu'].forEach(k => locked.add(k)); }
await req(`places?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ data, locked: [...locked], updated_at: new Date().toISOString() }) });
console.log(`${data.name}: website ${site}${hit ? `, tijden ${hit.oh} (van ${page})` : ', geen tijden gevonden op de site'}`);
