// De klok van Snuffelkaart: Cloudflare-cron (elk kwartier) start de GitHub-workflows via workflow_dispatch.
// Waarom niet GitHubs eigen planning: die startte in deze repository niet (28 okt 2026, ook niet na uit/aan). Zie DECISIONS.md.
// Secret GITHUB_TOKEN: fine-grained token, alleen fvdh/snuffelkaart, Actions: read and write. Zonder token doet de klok niets.
// De site zelf blijft statisch: elk verzoek gaat naar de bestanden in dist/ (ASSETS), behalve / (oude kaartlinks) en /api/ (mail-aanmeldingen).
import { api } from './mail.js';

const REPO = 'fvdh/snuffelkaart', DEEP = /[?&](open|plek|org|dag|s|plan|nu)=/;

/** Welke workflows bij dit tijdstip (UTC) horen. Tijden zoals voorheen in de workflows stonden. */
export function due(d) {
  const h = d.getUTCHours(), m = d.getUTCMinutes(), day = d.getUTCDay(), out = [];
  out.push(['nachtelijk.yml', { modus: h === 2 && m === 30 ? 'alles' : 'kwartier' }]); // elke kwartier: wijzigingen uit beheer; 02:30 alles
  if (m === 0 || m === 30) out.push(['controle.yml', {}]);
  if (h === 2 && m === 0) out.push(['backup.yml', {}]);
  if (day === 1 && h === 0 && m === 30) out.push(['winkels.yml', {}]);
  if (day === 4 && h === 14 && m === 0) out.push(['weekmail.yml', {}]); // donderdag 15:00 (winter) / 16:00 (zomer): markten van het weekend
  return out;
}

/** Eén website opnieuw lezen (knop in /beheer → Websitelezer). Alleen voor beheerders: de inlog van de beheerder gaat mee
 *  en Supabase (rpc is_admin) beslist. De GitHub-sleutel blijft hier; de browser ziet hem nooit. */
export const SITE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[a-z0-9._~%/-]*)?$/i;
async function herlees(req, env) {
  const site = String((await req.json().catch(() => ({}))).site ?? '').trim().toLowerCase();
  if (!SITE.test(site) || site.length > 120) return Response.json({ fout: 'Geen geldige site.' }, { status: 400 });
  const auth = req.headers.get('Authorization') ?? '';
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/is_admin`, { method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}' });
  if (!r.ok || (await r.json()) !== true) return Response.json({ fout: 'Alleen voor beheerders.' }, { status: 403 });
  if (!env.GITHUB_TOKEN) return Response.json({ fout: 'GITHUB_TOKEN ontbreekt in de worker.' }, { status: 500 });
  return (await dispatch(env, 'herlees.yml', { site })) ? Response.json({ ok: true }) : Response.json({ fout: 'GitHub weigerde de run.' }, { status: 502 });
}

async function dispatch(env, file, inputs) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${file}/dispatches`, {
    method: 'POST', body: JSON.stringify({ ref: 'main', inputs }),
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'snuffelkaart-klok', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!r.ok) console.error(`${file}: ${r.status} ${await r.text()}`);
  return r.ok;
}

export default {
  fetch(req, env) {
    // De kaart woonde op / tot de homepage kwam (nov 2026): oude links (?open=, ?plek=, ?dag=, gedeelde rondjes) naar /kaart/ met dezelfde vraag.
    const u = new URL(req.url);
    if (u.pathname === '/api/herlees' && req.method === 'POST') return herlees(req, env);
    if (u.pathname.startsWith('/api/')) return api(req, env); // mail-aanmeldingen (worker/mail.js)
    if (u.pathname === '/' && DEEP.test(u.search)) return Response.redirect(`${u.origin}/kaart/${u.search}`, 302);
    return env.ASSETS.fetch(req);
  },
  async scheduled(event, env, ctx) {
    if (!env.GITHUB_TOKEN) return console.warn('GITHUB_TOKEN ontbreekt: geen workflows gestart');
    ctx.waitUntil(Promise.all(due(new Date(event.scheduledTime)).map(([f, i]) => dispatch(env, f, i))));
  },
};
