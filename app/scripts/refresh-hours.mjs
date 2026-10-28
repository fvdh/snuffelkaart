// Nachtelijke build (§6.1): rekent de openingstijden in places.json opnieuw vooruit vanaf vandaag, zonder OSM opnieuw
// op te halen. Bron: data/hours.json (geschreven door fetch-osm.mjs). Zonder dit worden tijden na 21 dagen "onbekend".
import fs from 'node:fs';
import { precompute, holidays, todayIso, DAYS_AHEAD } from './hours-precompute.mjs';

export function refresh(data, src, from) {
  for (const p of data.places) if (src[p.id]) p.h = precompute(src[p.id], from) ?? undefined;
  return { ...data, generated: new Date().toISOString(), from, days: DAYS_AHEAD, holidays: holidays(from) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const OUT = new URL('../public/data/places.json', import.meta.url);
  const src = JSON.parse(fs.readFileSync(new URL('../data/hours.json', import.meta.url), 'utf8'));
  const data = refresh(JSON.parse(fs.readFileSync(OUT, 'utf8')), src, todayIso());
  fs.writeFileSync(OUT, JSON.stringify(data));
  console.log(`openingstijden vooruitgerekend vanaf ${data.from}: ${data.places.filter(p => p.h).length} winkels`);
}
