// Klikteller (rpc count_click): alleen een teller per dag, plek en soort; niets over wie. Te zien in /beheer → Klikken.
import { SB, KEY } from './auth';

export type Klik = 'view' | 'plan' | 'share' | 'route' | 'site' | 'tel';

export function klik(item_id: string, what: Klik) {
  if (!SB || !KEY || import.meta.env.DEV) return;
  fetch(`${SB}/rest/v1/rpc/count_click`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ item_id, what }) }).catch(() => {});
}

/** Link in een detail ([data-item]) → soort klik, aan de hand van waar hij heen gaat. */
export function linkKind(href: string): Klik | null {
  if (href.startsWith('tel:')) return 'tel';
  if (/^https:\/\/(maps\.apple\.com|www\.google\.com\/maps)/.test(href)) return 'route';
  if (/^https?:\/\//.test(href) && !/openstreetmap\.org/.test(href)) return 'site';
  return null;
}

// Anonieme tellers voor het dashboard (rpc tel, migratie tellers): per dag, soort en sleutel. Nooit wie, nooit een exacte plek.
export type Metric = 'pagina' | 'badge' | 'afstand' | 'plaats' | 'regio' | 'zoekleeg' | 'filter' | 'uur' | 'dagplan';
const sent = new Set<string>();
/** once: hooguit één keer per bezoek (paginalading) tellen, bijv. de regio of een filter dat je aan- en uitzet. */
export function tel(metric: Metric, key = '', once = false) {
  if (!SB || !KEY || import.meta.env.DEV) return;
  if (once) { if (sent.has(metric + key)) return; sent.add(metric + key); }
  fetch(`${SB}/rest/v1/rpc/tel`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ metric, key: key.slice(0, 120) }) }).catch(() => {});
}
/** Afstand in vier groepen, zodat een organisator ziet hoe ver zijn bezoekers zoeken. */
export const kmBucket = (d: number) => (d < 5 ? '0-5' : d < 15 ? '5-15' : d < 30 ? '15-30' : '30+');
/** Vak van 0,1 graad (±10 km): genoeg voor "waar wordt gezocht", te grof om iemand te vinden. */
export const regio = (p: { lat: number; lon: number }) => `${p.lat.toFixed(1)},${p.lon.toFixed(1)}`;
/** Gekozen plek → alleen de plaatsnaam (een postcode met straat wordt de plaats erachter). */
export const placeOf = (s: { label: string; sub: string }) => (/^\d{4}[A-Z]{2}$/.test(s.label) ? s.sub.split(', ').pop() ?? '' : s.label);
