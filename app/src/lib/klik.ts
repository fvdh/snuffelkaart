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
