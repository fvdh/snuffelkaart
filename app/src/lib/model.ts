export type Kind = 'kringloop' | 'goede-doelen' | 'tweedehands';
export type Confirm = 'org' | 'chk' | 'unconf' | 'cancel';

export interface Place {
  id: string; t: 'k'; kind: Kind; name: string; lat: number; lon: number;
  addr: string | null; place: string | null; h: [number, number][][] | null; checked: string | null;
  website: string | null; phone: string | null; src: 'osm' | 'overture';
  /** Overture: nadere soort van een tweedehandswinkel, en hun betrouwbaarheidsscore. */
  sub?: 'antiek' | 'kleding' | 'schroot' | 'pandjeshuis' | 'vlooienmarkt'; conf?: number;
}

export interface Market {
  id: string; t: 'm'; name: string; kind: string; place: string; lat: number; lon: number;
  date: string; start: number; end: number | null; status: Confirm; checked?: string;
  indoor: boolean; entree: string; kramen?: number; schema: string; org: string;
  area?: string; cancelWhy?: string; sample: true;
}

export type Item = Place | Market;
export interface LatLon { lat: number; lon: number }

export const DEFAULT_CENTER: LatLon = { lat: 52.1561, lon: 5.3878 }; // Amersfoort, midden in het land

/** Afstand in km (haversine). */
export function km(a: LatLon, b: LatLon): number {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Datum als YYYY-MM-DD in lokale tijd. */
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dayStart = (iso: string) => new Date(`${iso}T00:00:00`);
export const addDays = (iso: string, n: number) => { const d = dayStart(iso); d.setDate(d.getDate() + n); return isoDay(d); };
export const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
export const atMinute = (iso: string, min: number) => { const d = dayStart(iso); d.setMinutes(min); return d; };

/** De komende zaterdag en zondag (is het zaterdag of zondag, dan dit weekend). */
export function weekendOf(now: Date): [string, string] {
  const d = now.getDay(), today = isoDay(now);
  if (d === 6) return [today, addDays(today, 1)];
  if (d === 0) return [addDays(today, -1), today];
  const sat = addDays(today, 6 - d);
  return [sat, addDays(sat, 1)];
}

export const DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
export const DAYS_LONG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MON = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MON_LONG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
export const hShort = (min: number) => (min % 60 ? hm(min) : String(min / 60));
export const fkm = (n: number) => (n < 10 ? n.toFixed(1).replace('.', ',') : String(Math.round(n)));
export const dShort = (iso: string) => { const d = dayStart(iso); return `${cap(DAYS[d.getDay()])} ${d.getDate()} ${MON[d.getMonth()]}`; };
export const dLong = (iso: string) => { const d = dayStart(iso); return `${cap(DAYS_LONG[d.getDay()])} ${d.getDate()} ${MON_LONG[d.getMonth()]}`; };
export const mEnd = (m: Market) => m.end ?? m.start + 300; // ponytail: onbekende eindtijd = 5 uur na start, alleen om te rekenen
