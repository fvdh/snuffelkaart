import { type Item, type LatLon, type Cat, catOf, km, isoDay, minutesOf } from './model';
import { intervals, openOn } from './hours';

/** open: alleen wat open is op de gekozen dag; vandaag: wat nu open is of nog opengaat. Staat standaard uit. De dag zelf staat los van de filters: hij geldt overal,
 *  ook in het dagplan (DECISIONS: één dagkeuze). hide: winkelsoorten die uit staan. only: alleen deze id's ("Bewaard op de kaart"). */
export interface Filters { type: 'all' | 'k' | 'm'; open: boolean; gratis: boolean; overdekt: boolean; q: string; hide: Cat[]; only?: string[] | null }


const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function matches(it: Item, f: Filters, now: Date, day = isoDay(now)): boolean {
  if (f.only && !f.only.includes(it.id)) return false;
  if (f.type !== 'all' && it.t !== f.type) return false;
  if (it.t === 'k' && f.hide.includes(catOf(it))) return false;
  if (f.gratis && it.t === 'm' && it.entree !== 'gratis') return false;
  if (f.overdekt && it.t === 'm' && !it.indoor) return false;
  if (f.q) { const q = norm(f.q); if (!norm(`${it.name} ${it.place ?? ''}`).includes(q)) return false; }
  if (!f.open) return true;
  // onbekende tijden: nooit bij "open", dat kunnen we niet beloven (A6)
  if (day === isoDay(now)) { const m = minutesOf(now); return it.t === 'k' ? !!intervals(it, day)?.some(([, b]) => b > m) : it.date === day && it.status !== 'cancel' && m < (it.end ?? it.start + 300); }
  return it.t === 'k' ? openOn(it, day) : it.date === day && it.status !== 'cancel';
}

/** Gefilterd en gesorteerd op afstand; afgelast en onbekend achteraan. */
export function visible(items: Item[], f: Filters, now: Date, origin: LatLon, day = isoDay(now)): { it: Item; d: number }[] {
  return items.filter(it => matches(it, f, now, day))
    .map(it => ({ it, d: km(origin, it) }))
    .sort((a, b) => rank(a.it) - rank(b.it) || a.d - b.d);
}
const rank = (it: Item) => (it.t === 'm' && it.status === 'cancel' ? 2 : it.t === 'k' && !it.h ? 1 : 0);
