// Gebeurtenissenlog (rpc ev, migratie gebeurtenissen): wat een bezoek doet, in volgorde, voor /beheer → Inzicht en Live.
// Een bezoek = willekeurige code in sessionStorage (alleen deze tab) met de datum erin: morgen een nieuwe. Geen cookie, IP of account.
// "Dit apparaat niet meetellen" (beheer → Live) zet NIET_METEN in localStorage; dan gaat er niets weg, ook geen dagtellers.
import { SB, KEY } from './auth';

export const NIET_METEN = 'sk-niet-meten';
const SID = 'sk-bezoek';

// Crawlers die JavaScript uitvoeren (Googlebot e.d.) tellen niet mee: op 30 okt bekeek "iemand" 1.135 verschillende pagina's.
export const BOT = /bot|crawl|spider|slurp|google|bing|yandex|baidu|duckduck|facebookexternalhit|lighthouse|headless|preview|pingdom|uptime/i;
export const skip = () => { try { return !!localStorage.getItem(NIET_METEN) || navigator.webdriver || BOT.test(navigator.userAgent); } catch { return false; } };

/** Code van dit bezoek; nieuw = eerste pagina van het bezoek (dan sturen we ook waar het vandaan komt). */
function visit(): { s: string; fresh: boolean } {
  const day = new Date().toLocaleDateString('sv-SE');
  try {
    const v = sessionStorage.getItem(SID);
    if (v?.startsWith(day + ':')) return { s: v.slice(11), fresh: false };
    const s = crypto.getRandomValues(new Uint32Array(2)).reduce((a, n) => a + n.toString(36), '').slice(0, 12).padEnd(8, '0');
    sessionStorage.setItem(SID, `${day}:${s}`);
    return { s, fresh: true };
  } catch { return { s: '', fresh: false }; }
}

/** Bron van een bezoek uit de verwijzer: google, bing, facebook, instagram, badge, direct of de domeinnaam. */
export function source(ref: string, search: string): string {
  if (new URLSearchParams(search).get('via') === 'badge') return 'badge';
  let h = ''; try { h = new URL(ref).hostname.replace(/^www\./, ''); } catch { return 'direct'; }
  if (!h || h === location.hostname.replace(/^www\./, '')) return 'direct';
  const m = /(google|bing|duckduckgo|ecosia|facebook|instagram|chatgpt|perplexity|yahoo)\./.exec(h + '.');
  return m ? m[1] : h.slice(0, 60);
}

const device = () => (matchMedia('(pointer: coarse)').matches ? 'm' : 'd');

export function ev(t: string, k = '') {
  if (!SB || !KEY || import.meta.env.DEV || skip()) return;
  const { s, fresh } = visit(); if (!s) return;
  const p = location.pathname.slice(0, 120), send = (t: string, k: string) => fetch(`${SB}/rest/v1/rpc/ev`, {
    method: 'POST', keepalive: true, headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ s, t, k: k.replace(/[@<>]/g, '').slice(0, 120), p, d: device() }) }).catch(() => {});
  if (fresh) send('binnen', source(document.referrer, location.search));
  send(t, k);
}

/** Paginaweergave: op elke pagina één keer bij het laden. */
export const pv = () => ev('pv');
