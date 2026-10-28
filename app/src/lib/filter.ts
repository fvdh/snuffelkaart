import { type Item, type LatLon, type Cat, catOf, km, isoDay, weekendOf, minutesOf } from './model';
import { placeNow, openOn } from './hours';

/** 'all' is het startpunt: alles, met per regel of het nu open is of wanneer de markt is. Tijdfilters zijn een keuze. */
export type TimeFilter = 'all' | 'now' | 'today' | 'weekend' | 'date';
/** hide: winkelsoorten die uit staan. Leeg = alles zien. only: alleen deze id's ("Bewaard op de kaart"). */
export interface Filters { type: 'all' | 'k' | 'm'; time: TimeFilter; date: string | null; gratis: boolean; overdekt: boolean; q: string; hide: Cat[]; only?: string[] | null }


const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function matches(it: Item, f: Filters, now: Date): boolean {
  if (f.only && !f.only.includes(it.id)) return false;
  if (f.type !== 'all' && it.t !== f.type) return false;
  if (it.t === 'k' && f.hide.includes(catOf(it))) return false;
  if (f.gratis && it.t === 'm' && it.entree !== 'gratis') return false;
  if (f.overdekt && it.t === 'm' && !it.indoor) return false;
  if (f.q) { const q = norm(f.q); if (!norm(`${it.name} ${it.place ?? ''}`).includes(q)) return false; }
  if (f.time === 'all') return true;
  if (it.t === 'k' && !it.h) return f.time !== 'now'; // onbekende tijden: nooit bij "Nu open", wel elders (A6)
  if (f.time === 'now') return it.t === 'k' && !!placeNow(it, now).open || (it.t === 'm' && it.date === isoDay(now) && it.status !== 'cancel' && minutesOf(now) >= it.start && minutesOf(now) < (it.end ?? it.start + 300));
  const days = f.time === 'weekend' ? weekendOf(now) : [f.time === 'today' ? isoDay(now) : (f.date ?? isoDay(now))];
  return it.t === 'k' ? days.some(d => openOn(it, d)) : days.includes(it.date);
}

/** Gefilterd en gesorteerd op afstand; afgelast en onbekend achteraan. */
export function visible(items: Item[], f: Filters, now: Date, origin: LatLon): { it: Item; d: number }[] {
  return items.filter(it => matches(it, f, now))
    .map(it => ({ it, d: km(origin, it) }))
    .sort((a, b) => rank(a.it) - rank(b.it) || a.d - b.d);
}
const rank = (it: Item) => (it.t === 'm' && it.status === 'cancel' ? 2 : it.t === 'k' && !it.h ? 1 : 0);
