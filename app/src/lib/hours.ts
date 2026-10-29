import { type Place, type Market, DAYS, cap, hm, hShort, minutesOf, dayStart, addDays, isoDay, mEnd, dShort } from './model';

/** Status zoals de UI hem toont: een klasse voor de kleur en een korte tekst. */
export type StatusCls = 'open' | 'warn' | 'later' | 'closed' | 'oday' | 'unknown' | 'mkt' | 'cancel';
export interface Status { cls: StatusCls; txt: string; open?: boolean }

// Openingstijden zijn bij de import vooruitgerekend (scripts/hours-precompute.mjs): per winkel een lijst
// intervallen per dag, vanaf `from`. Buiten dat venster is een dag "onbekend".
let WIN = { from: isoDay(new Date()), holidays: new Set<string>() };
export function setWindow(from: string, holidays: string[]) { WIN = { from, holidays: new Set(holidays) }; }
const idx = (iso: string) => Math.round((dayStart(iso).getTime() - dayStart(WIN.from).getTime()) / 864e5);

/** Is deze dag een Nederlandse feestdag (binnen het venster)? */
export const isHoliday = (iso: string) => WIN.holidays.has(iso);

/** Openingsintervallen op een dag, in minuten sinds middernacht. null = onbekend. */
export function intervals(p: Place, iso: string): [number, number][] | null {
  const i = idx(iso);
  return p.h && i >= 0 && i < p.h.length ? p.h[i] : null;
}
export const openOn = (p: Place, iso: string) => !!intervals(p, iso)?.length;

export const UNKNOWN: Status = { cls: 'unknown', txt: 'Openingstijden onbekend' };

/** Status van een kringloop op dit moment. */
export function placeNow(p: Place, now: Date): Status {
  const today = isoDay(now), iv = intervals(p, today);
  if (!iv) return UNKNOWN;
  const min = minutesOf(now), cur = iv.find(([a, b]) => min >= a && min < b);
  if (cur) {
    // open tot middernacht en morgen vanaf 0:00 verder? dan sluit hij morgen (02:00), of nooit als hij dan ook tot 24:00 open is
    const next = cur[1] === 1440 ? intervals(p, addDays(today, 1))?.[0] : null;
    const close = next && next[0] === 0 ? (next[1] === 1440 ? null : 1440 + next[1]) : cur[1], left = close == null ? Infinity : close - min;
    return left <= 30 ? { cls: 'warn', txt: `Sluit over ${left} min`, open: true } : { cls: 'open', txt: close == null ? 'Open' : `Open · sluit ${hm(close % 1440)}`, open: true };
  }
  const later = iv.find(([a]) => a > min);
  if (later) return { cls: 'later', txt: `Opent om ${hm(later[0])}` };
  for (let i = 1; i <= 7; i++) {
    const iso = addDays(today, i), nx = intervals(p, iso);
    if (!nx) break;
    if (nx.length) return { cls: 'closed', txt: `Dicht · opent ${i === 1 ? 'morgen' : DAYS[dayStart(iso).getDay()]} ${hm(nx[0][0])}` };
  }
  return { cls: 'closed', txt: 'Dicht' };
}

/** Status op een gekozen moment later ("za 31 om 10:00"): open als je er bent, gaat later open, of dicht. */
export function placeAt(p: Place, iso: string, min: number): Status {
  const iv = intervals(p, iso);
  if (!iv) return UNKNOWN;
  const d = cap(DAYS[dayStart(iso).getDay()]);
  if (!iv.length) return { cls: 'closed', txt: `${d} dicht` };
  const cur = iv.find(([a, b]) => min >= a && min < b);
  if (cur) return { cls: 'open', txt: `Open · tot ${hm(cur[1] % 1440)}`, open: true };
  const later = iv.find(([a]) => a > min);
  if (later) return { cls: 'later', txt: `${d} open vanaf ${hm(later[0])}` };
  return { cls: 'closed', txt: `Om ${hm(min)} al dicht (${d} ${rng(iv)})` };
}

const rng = (iv: [number, number][]) => iv.map(([a, b]) => `${hShort(a)}–${hShort(b)}`).join(', ');
/** Samenvatting voor één dag: "Za 10–16" of "Za dicht". */
export function placeDay(p: Place, iso: string): Status {
  const iv = intervals(p, iso);
  if (!iv) return UNKNOWN;
  const d = cap(DAYS[dayStart(iso).getDay()]);
  return iv.length ? { cls: 'oday', txt: `${d} ${rng(iv)}` } : { cls: 'closed', txt: `${d} dicht` };
}
export function placeWeekend(p: Place, [sat, sun]: [string, string]): Status {
  const a = intervals(p, sat), b = intervals(p, sun);
  if (!a || !b) return UNKNOWN;
  return { cls: a.length || b.length ? 'oday' : 'closed', txt: `Za ${a.length ? rng(a) : 'dicht'} · zo ${b.length ? rng(b) : 'dicht'}` };
}

export const mSpan = (m: Market) => (m.timeKnown === false ? 'tijden bij de organisator' : m.end ? `${hShort(m.start)}–${hShort(m.end)} uur` : `vanaf ${hShort(m.start)} uur`);
export function marketStatus(m: Market, now: Date): Status {
  const today = isoDay(now), when = m.date === today ? 'Vandaag' : dShort(m.date);
  if (m.status === 'cancel') return { cls: 'cancel', txt: `Afgelast · ${when.toLowerCase()}` };
  const min = minutesOf(now);
  if (m.date === today && min >= m.start && min < mEnd(m)) return { cls: 'open', txt: m.end ? `Nu bezig · tot ${hm(m.end)}` : 'Nu bezig', open: true };
  return { cls: 'mkt', txt: `${when} · ${mSpan(m)}` };
}

const LONG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
/** Week ma t/m zo rond `from` voor het detail. null = onbekend. */
export function week(p: Place, from: string): { iso: string; label: string; txt: string }[] | null {
  if (!p.h) return null;
  const back = (dayStart(from).getDay() + 6) % 7; // terug naar maandag
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(from, i - back), iv = intervals(p, iso);
    const txt = !iv ? '–' : iv.length ? iv.map(([a, b]) => `${hm(a)} – ${hm(b % 1440)}`).join(', ') : isHoliday(iso) ? 'Dicht (feestdag)' : 'Dicht';
    return { iso, label: cap(LONG[dayStart(iso).getDay()]), txt };
  });
}
