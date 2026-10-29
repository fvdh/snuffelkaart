// M5: bijdragen van bezoekers. Goedgekeurd komt uit /data/extra.json (export, zie db.mjs toExtra); eigen bijdragen live via REST.
import type { Place } from './model';
import { addDays, isoDay } from './model';
import { intervals, isHoliday } from './hours';

export type Review = { name: string; stars: number; text?: string; month: string };
export type Photo = { url: string; caption?: string; name: string };
export type Extra = { hours: Record<string, { h: [number, number][][]; checked: string; by: string }>; reviews: Record<string, Review[]>; photos: Record<string, Photo[]> };
export type Kind = 'tijden' | 'review' | 'foto';
export type Contribution = { id: number; item_id: string; kind: Kind; data: Record<string, any>; status: 'nieuw' | 'goed' | 'afgewezen'; reason: string | null; created_at: string };

export const NO_EXTRA: Extra = { hours: {}, reviews: {}, photos: {} };

/** Tijden van bezoekers gaan voor (ze zijn met de hand gekeurd en meestal het recentst). */
export function applyExtra(places: Place[], x: Extra): Place[] {
  return places.map(p => { const v = x.hours[p.id]; return v ? { ...p, h: v.h, checked: v.checked, hs: 'bezoeker' as const, hb: v.by } : p; });
}

export const DAYS_OSM = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export const DAYS_NL = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
export type Day = { open: boolean; from: string; to: string };

/** Week uit het formulier → opening_hours (OSM-syntax, zodat dezelfde rekenaar het vooruitrekent). Gelijke dagen achter elkaar worden één reeks. */
export function toOh(days: Day[]): string {
  const val = (d: Day) => (d.open ? `${d.from}-${d.to}` : 'off'), out: string[] = [];
  for (let i = 0; i < 7;) {
    let j = i; while (j + 1 < 7 && val(days[j + 1]) === val(days[i])) j++;
    out.push(`${DAYS_OSM[i]}${j > i ? (j === i + 1 ? ',' : '-') + DAYS_OSM[j] : ''} ${val(days[i])}`);
    i = j + 1;
  }
  return out.join('; ');
}

/** Formulier vooraf invullen met wat we nu weten (eerste blok per dag; een feestdag slaan we over). Onbekend: alle dagen uit, zodat
 *  niemand met één tik een gok bevestigt (UX-review 29 okt); wie een dag aanzet, begint bij 10–17. */
export function prefill(p: Place, today: string): Day[] {
  return Array.from({ length: 7 }, (_, wd) => {
    const back = (new Date(`${today}T12:00`).getDay() + 6) % 7;
    let iso = addDays(today, wd - back); if (iso < today) iso = addDays(iso, 7);
    if (isHoliday(iso)) iso = addDays(iso, 7);
    const iv = p.h ? intervals(p, iso) : null;
    if (!iv) return { open: false, from: '10:00', to: '17:00' };
    if (!iv.length) return { open: false, from: '10:00', to: '17:00' };
    const t = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return { open: true, from: t(iv[0][0]), to: t(iv[iv.length - 1][1]) };
  });
}

/** Gemiddelde, afgerond op een halve ster. */
export const avg = (rs: Review[]) => (rs.length ? Math.round((rs.reduce((a, r) => a + r.stars, 0) / rs.length) * 2) / 2 : 0);

/** Foto verkleinen en opnieuw opslaan: max. 1600 px, WebP. Daarbij verdwijnen ook de EXIF-gegevens (locatie, toestel). */
export async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob(b => (b ? ok(b) : no(new Error('Deze foto kunnen we niet lezen.'))), 'image/webp', 0.82));
}

/** Foutmelding van Supabase ("400: {…"message":"…"}") → de zin uit de database, of een nette Nederlandse zin. */
export function errText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (e instanceof TypeError) return 'Geen verbinding. Probeer het straks nog eens.';
  if (/duplicate key.*profiles_name/.test(m)) return 'Deze schermnaam is al bezet.';
  const j = /\{.*\}/s.exec(m); try { const msg = j && JSON.parse(j[0]).message; if (msg) return msg.replace(/^./, (c: string) => c.toUpperCase()); } catch { /* geen JSON */ }
  return 'Dat lukte niet. Probeer het later opnieuw.';
}

export const monthNow = (now: Date) => isoDay(now).slice(0, 7);
