import { type Item, type LatLon, type Cat, catOf, km, isoDay, minutesOf, mEnd, spotKey } from './model';
import { intervals } from './hours';

/** open: alleen wat open is of nog opengaat op het gekozen moment. Staat standaard uit (Freek). Het moment (nu, of een dag + tijd)
 *  staat los van de filters. hide: winkelsoorten die uit staan. only: alleen deze id's ("Bewaard op de kaart"). */
export interface Filters { type: 'all' | 'k' | 'm'; open: boolean; gratis: boolean; overdekt: boolean; q: string; hide: Cat[]; only?: string[] | null }

/** Waar een plek in de lijst valt op het gekozen moment (dag + minuut). Markten op een andere dag: 'other'. */
export type Group = 'open' | 'later' | 'unknown' | 'other' | 'closed' | 'cancel';
export const GROUPS: Group[] = ['open', 'later', 'other', 'unknown', 'closed', 'cancel'];
export function groupOf(it: Item, day: string, min: number): Group {
  if (it.t === 'k') {
    const iv = intervals(it, day);
    if (!iv) return 'unknown';
    if (iv.some(([a, b]) => min >= a && min < b)) return 'open';
    return iv.some(([a]) => a > min) ? 'later' : 'closed';
  }
  if (it.status === 'cancel') return 'cancel';
  if (it.date !== day) return 'other';
  if (min >= mEnd(it)) return 'closed';
  return min >= it.start ? 'open' : 'later';
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** min: het gekozen moment; zonder: nu (vandaag) of 10:00 (een andere dag). */
export function matches(it: Item, f: Filters, now: Date, day = isoDay(now), min = day === isoDay(now) ? minutesOf(now) : 600): boolean {
  if (f.only && !f.only.includes(it.id)) return false;
  if (f.type !== 'all' && it.t !== f.type) return false;
  if (it.t === 'k' && f.hide.includes(catOf(it))) return false;
  if (f.gratis && it.t === 'm' && it.entree !== 'gratis') return false;
  if (f.overdekt && it.t === 'm' && !it.indoor) return false;
  if (f.q) { const q = norm(f.q); if (!norm(`${it.name} ${it.place ?? ''}`).includes(q)) return false; }
  if (!f.open) return true;
  // onbekende tijden: nooit bij "open", dat kunnen we niet beloven (A6)
  const g = groupOf(it, day, min);
  return g === 'open' || g === 'later';
}

/** Gefilterd en puur op afstand gesorteerd. De lijst deelt de dichtstbijzijnde daarna in secties in (groupRows), zodat een
 *  winkel zonder bekende tijden op 400 m niet achter alle winkels met tijden in heel Nederland komt (UX-review 29 okt). */
export function visible(items: Item[], f: Filters, now: Date, origin: LatLon, day = isoDay(now), min?: number): { it: Item; d: number }[] {
  return items.filter(it => matches(it, f, now, day, min))
    .map(it => ({ it, d: km(origin, it) }))
    .sort((a, b) => a.d - b.d);
}

/** Rijen in secties (open, gaat nog open, markten op andere dagen, tijden onbekend, dicht, afgelast), binnen een sectie op afstand. */
export function groupRows<T extends { it: Item }>(rows: T[], day: string, min: number): { g: Group; rows: T[] }[] {
  const by = new Map<Group, T[]>();
  for (const r of rows) { const g = groupOf(r.it, day, min); by.set(g, [...(by.get(g) ?? []), r]); }
  return GROUPS.filter(g => by.has(g)).map(g => ({ g, rows: by.get(g)! }));
}

/** Markten op dezelfde plek op meer dagen: alleen de eerstvolgende op de kaart; n = hoeveel data er achter die pin zitten. */
export function stackMarkets(items: Item[]): { items: Item[]; n: Map<string, number> } {
  const first = new Map<string, Extract<Item, { t: 'm' }>>(), cnt = new Map<string, number>();
  for (const it of items) if (it.t === 'm') {
    const k = spotKey(it), f = first.get(k); cnt.set(k, (cnt.get(k) ?? 0) + 1);
    if (!f || f.date > it.date) first.set(k, it);
  }
  return { items: items.filter(it => it.t !== 'm' || first.get(spotKey(it)) === it), n: new Map([...first].map(([k, it]) => [it.id, cnt.get(k)!])) };
}
