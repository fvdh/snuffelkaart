// Statische pagina's voor zoekmachines (§3.1, ontwerp §08): per plaats, per winkel en per markt, elke nacht opnieuw gebouwd
// uit dezelfde kaartdata als de app. Hier alleen de logica (adressen, wie een pagina krijgt, tijden per week); de opmaak staat in src/pages.
import type { Place, Market } from './model';
import { km, addDays, dayStart, DAYS_LONG, hm, cap, catOf } from './model';

export const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Bestaande adressen in de root; een plaats met zo'n naam krijgt "-plaats" erachter. */
const RESERVED = new Set(['beheer', 'privacy', 'hoe-we-controleren', 'plaatsen', 'markten', 'organisator', 'colofon', 'voorwaarden', 'offline', '404', 'winkel', 'markt', 'data', 'fonts', 'icons', '_astro', 'sitemap', 'robots']);

/** Uniek adres per item: eerst de mooie naam, bij een botsing het korte id erachter. Zelfde invoer → zelfde adressen. */
function unique<T>(items: T[], base: (x: T) => string, id: (x: T) => string): Map<string, T> {
  const count = new Map<string, number>();
  for (const x of items) count.set(base(x), (count.get(base(x)) ?? 0) + 1);
  const out = new Map<string, T>();
  for (const x of [...items].sort((a, b) => id(a).localeCompare(id(b)))) {
    const b = base(x), s = count.get(b)! > 1 || !b ? `${b ? `${b}-` : ''}${slugify(id(x)).slice(-8)}` : b;
    out.set(out.has(s) ? `${s}-${slugify(id(x))}` : s, x);
  }
  return out;
}

export interface City { slug: string; name: string; lat: number; lon: number; shops: Place[]; markets: Market[] }

/** Wie een pagina krijgt. Plaatsen: minstens 2 winkels of markten (één winkel heeft al zijn eigen pagina). */
export function siteIndex(places: Place[], markets: Market[]) {
  const shops = unique(places, p => slugify(`${p.name} ${p.place ?? ''}`), p => p.id);
  const mkts = unique(markets, m => slugify(`${m.name} ${m.date}`), m => m.id);
  const slugOf = new Map<string, string>([...[...shops].map(([s, p]) => [p.id, `/winkel/${s}/`] as const), ...[...mkts].map(([s, m]) => [m.id, `/markt/${s}/`] as const)]);
  const byName = new Map<string, { shops: Place[]; markets: Market[] }>();
  const add = (name: string | null | undefined) => { if (!name) return null; if (!byName.has(name)) byName.set(name, { shops: [], markets: [] }); return byName.get(name)!; };
  for (const p of places) add(p.place)?.shops.push(p);
  for (const m of markets) add(m.place)?.markets.push(m);
  const cities: City[] = [];
  for (const [name, { shops: s, markets: m }] of byName) {
    if (s.length + m.length < 2) continue;
    const all = [...s, ...m], base = slugify(name);
    cities.push({ slug: RESERVED.has(base) ? `${base}-plaats` : base, name, lat: all.reduce((a, x) => a + x.lat, 0) / all.length, lon: all.reduce((a, x) => a + x.lon, 0) / all.length,
      shops: s.sort((a, b) => a.name.localeCompare(b.name, 'nl')), markets: m.sort((a, b) => a.date.localeCompare(b.date)) });
  }
  // ponytail: twee plaatsen met dezelfde naam (Hengelo Ov/Gld) vallen samen; uit elkaar halen als er een gemeenteveld komt.
  cities.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const citySlug = new Map(cities.map(c => [c.name, c.slug]));
  // Organisatoren met een eigen agenda (niet het Gemeenteblad: dat is een vergunning, geen organisator) krijgen een eigen pagina.
  const orgs = new Map<string, { name: string; markets: Market[] }>();
  for (const m of markets) if (m.org && !/^Gemeenteblad/.test(m.org)) { const k = slugify(m.org); if (!orgs.has(k)) orgs.set(k, { name: m.org, markets: [] }); orgs.get(k)!.markets.push(m); }
  const orgSlug = new Map([...orgs].map(([k, o]) => [o.name, k]));
  return { shops, markets: mkts, cities, orgs, url: (id: string) => slugOf.get(id)!, cityUrl: (name: string | null | undefined) => (name && citySlug.has(name) ? `/${citySlug.get(name)}/` : null),
    orgUrl: (name: string | null | undefined) => (name && orgSlug.has(name) ? `/organisator/${orgSlug.get(name)}/` : null) };
}

/** Markten in de buurt (km), vanaf vandaag, op datum. */
export const near = (c: { lat: number; lon: number }, markets: Market[], today: string, maxKm = 15, n = 8) =>
  markets.filter(m => m.date >= today && km(c, m) <= maxKm).sort((a, b) => a.date.localeCompare(b.date) || km(c, a) - km(c, b)).slice(0, n);

/** Openingstijden per weekdag (ma t/m zo), uit de vooruitgerekende dagen vanaf `from`. Feestdagen slaan we over: die zeggen niets over een gewone week. */
export function weekHours(h: [number, number][][] | null, from: string, holidays: string[] = []): { day: string; txt: string }[] | null {
  const w = weekIntervals(h, from, holidays);
  return w && w.map(({ wd, iv }) => ({ day: cap(DAYS_LONG[wd]), txt: iv.length ? iv.map(([a, b]) => `${hm(a)}–${hm(b % 1440)}`).join(', ') : 'dicht' }));
}
/** Intervallen per weekdag (wd: 0 = zondag), ma t/m zo; feestdagen overgeslagen. */
export function weekIntervals(h: [number, number][][] | null, from: string, holidays: string[] = []): { wd: number; iv: [number, number][] }[] | null {
  if (!h) return null;
  const out = new Map<number, [number, number][]>();
  for (let i = 0; i < h.length && out.size < 7; i++) {
    const iso = addDays(from, i), wd = dayStart(iso).getDay();
    if (!out.has(wd) && !holidays.includes(iso)) out.set(wd, h[i]);
  }
  return [1, 2, 3, 4, 5, 6, 0].filter(d => out.has(d)).map(wd => ({ wd, iv: out.get(wd)! }));
}

const SCHEMA_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hhmm = (m: number) => (m >= 1440 ? '23:59' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
/** schema.org openingHoursSpecification: wat Google bij "nu open" en "open op zondag" leest. */
export const hoursSpec = (w: { wd: number; iv: [number, number][] }[]) =>
  w.flatMap(({ wd, iv }) => iv.map(([a, b]) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: SCHEMA_DAY[wd], opens: hhmm(a), closes: hhmm(b) })));

const SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
/** Korte week voor de zoekresultaat-tekst: "ma–vr 10:00–17:00, za 10:00–16:00, zo dicht". */
export function hoursSummary(w: { wd: number; iv: [number, number][] }[]): string {
  const txt = (iv: [number, number][]) => (iv.length ? iv.map(([a, b]) => `${hm(a)}–${hm(b % 1440)}`).join(' en ') : 'dicht');
  const runs: { a: number; b: number; t: string }[] = [];
  for (const { wd, iv } of w) { const t = txt(iv), last = runs[runs.length - 1]; if (last && last.t === t) last.b = wd; else runs.push({ a: wd, b: wd, t }); }
  return runs.map(r => `${SHORT[r.a]}${r.a !== r.b ? `–${SHORT[r.b]}` : ''} ${r.t}`).join(', ');
}

/** Dunne winkelpagina's houden we uit Google (wel op de kaart): ongecontroleerd uit Overture zonder tijden, website of telefoon,
 *  en sloop of pandjeshuis. Zulke pagina's zeggen weinig meer dan "misschien bestaat hij niet meer". */
export const thin = (p: Place) => (p.src === 'overture' && !p.h && !p.website && !p.phone) || ['schroot', 'pandjeshuis'].includes(catOf(p));
