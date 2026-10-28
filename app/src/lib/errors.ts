// M6 monitoring: JavaScript-fouten bij bezoekers anoniem naar Supabase (rpc log_error), te zien in /beheer → Bronnen.
// ponytail: hooguit 3 per paginabezoek en elke melding één keer; geen bibliotheek (Sentry e.d.) zolang dit genoeg zegt.
import { SB, KEY } from './auth';

let sent = 0;
const seen = new Set<string>();

export function report(msg: string, src = '') {
  if (!SB || !KEY || sent >= 3 || seen.has(msg) || /ResizeObserver loop|Script error\.?$/.test(msg)) return; // ruis van de browser zelf
  seen.add(msg); sent++;
  fetch(`${SB}/rest/v1/rpc/log_error`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ msg: msg.slice(0, 500), src: `${location.pathname} ${src}`.slice(0, 300), ua: navigator.userAgent.slice(0, 200) }) }).catch(() => {});
}

export function watchErrors() {
  if (import.meta.env.DEV || typeof window === 'undefined') return; // niet tijdens ontwikkelen of bij het bouwen op de server
  addEventListener('error', e => report(e.message || String(e.error), e.filename ? `${e.filename.split('/').pop()}:${e.lineno}` : ''));
  addEventListener('unhandledrejection', e => report(`Promise: ${e.reason?.message ?? String(e.reason)}`));
}
