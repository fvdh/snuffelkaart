// Provincie per plaats (voor de provinciepagina's): midden van de winkels en markten van een plaats → PDOK reverse → provincie.
// Alleen plaatsen die nog niet in public/data/provincies.json staan; eerste keer ±1000 verzoeken, daarna een handvol per nacht.
// Gebruik: node scripts/provincies.mjs
import fs from 'node:fs';

const FILE = new URL('../public/data/provincies.json', import.meta.url), read = n => JSON.parse(fs.readFileSync(new URL(`../public/data/${n}.json`, import.meta.url), 'utf8'));
const out = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const mid = new Map();
for (const x of [...read('places').places, ...read('markets').markets]) {
  if (!x.place || out[x.place]) continue;
  const m = mid.get(x.place) ?? { lat: 0, lon: 0, n: 0 }; m.lat += x.lat; m.lon += x.lon; m.n++; mid.set(x.place, m);
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let n = 0;
for (const [place, m] of mid) {
  const u = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?lat=${(m.lat / m.n).toFixed(5)}&lon=${(m.lon / m.n).toFixed(5)}&type=gemeente&rows=1&fl=provincienaam`;
  try { const p = (await (await fetch(u)).json()).response?.docs?.[0]?.provincienaam; if (p) { out[place] = p; n++; } } catch { /* volgende nacht opnieuw */ }
  await wait(150);
}
fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(Object.entries(out).sort()), null, 0));
console.log(`provincies: ${n} nieuw, ${Object.keys(out).length} plaatsen bekend`);
