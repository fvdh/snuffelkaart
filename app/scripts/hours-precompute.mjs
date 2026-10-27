// Rekent OSM-openingstijden vooruit naar intervallen per dag, zodat de browser de opening_hours-bibliotheek
// (±160 kB gz) niet hoeft te laden. Draait bij de import/de nachtelijke build (§6.1).
// ponytail: 21 dagen vooruit; verder weg is "onbekend". Langer venster = groter bestand.
import OH from 'opening_hours';

process.env.TZ = 'Europe/Amsterdam';
export const DAYS_AHEAD = 21;
const NL = { lat: 52.1, lon: 5.6, address: { country_code: 'nl', state: 'Utrecht' } };

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day = (from, i) => { const d = new Date(`${from}T00:00:00`); d.setDate(d.getDate() + i); return d; };
const min = d => d.getHours() * 60 + d.getMinutes();
export const todayIso = () => iso(new Date());

/** Open-intervallen per dag ([[van, tot], ...] in minuten), of null als de tijden onleesbaar zijn. */
export function precompute(oh, from, n = DAYS_AHEAD) {
  let o; try { o = new OH(oh, NL); } catch { return null; }
  return Array.from({ length: n }, (_, i) => {
    const a = day(from, i), b = day(from, i + 1);
    return o.getOpenIntervals(a, b).map(([s, e]) => [min(s), e >= b ? 1440 : min(e)]);
  });
}

/** Nederlandse feestdagen in het venster. */
export function holidays(from, n = DAYS_AHEAD) {
  const ph = new OH('PH', NL);
  return Array.from({ length: n }, (_, i) => day(from, i)).filter(d => { const noon = new Date(d); noon.setHours(12); return ph.getState(noon); }).map(iso);
}
