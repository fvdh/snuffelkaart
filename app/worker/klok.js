// De klok van Snuffelkaart: Cloudflare-cron (elk kwartier) start de GitHub-workflows via workflow_dispatch.
// Waarom niet GitHubs eigen planning: die startte in deze repository niet (28 okt 2026, ook niet na uit/aan). Zie DECISIONS.md.
// Secret GITHUB_TOKEN: fine-grained token, alleen fvdh/snuffelkaart, Actions: read and write. Zonder token doet de klok niets.
// De site zelf blijft statisch: elk verzoek gaat naar de bestanden in dist/ (ASSETS).
const REPO = 'fvdh/snuffelkaart';

/** Welke workflows bij dit tijdstip (UTC) horen. Tijden zoals voorheen in de workflows stonden. */
export function due(d) {
  const h = d.getUTCHours(), m = d.getUTCMinutes(), day = d.getUTCDay(), out = [];
  out.push(['nachtelijk.yml', { modus: h === 2 && m === 30 ? 'alles' : 'kwartier' }]); // elke kwartier: wijzigingen uit beheer; 02:30 alles
  if (m === 0 || m === 30) out.push(['controle.yml', {}]);
  if (h === 2 && m === 0) out.push(['backup.yml', {}]);
  if (day === 1 && h === 0 && m === 30) out.push(['winkels.yml', {}]);
  return out;
}

async function dispatch(env, file, inputs) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${file}/dispatches`, {
    method: 'POST', body: JSON.stringify({ ref: 'main', inputs }),
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'snuffelkaart-klok', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!r.ok) console.error(`${file}: ${r.status} ${await r.text()}`);
}

export default {
  fetch: (req, env) => env.ASSETS.fetch(req),
  async scheduled(event, env, ctx) {
    if (!env.GITHUB_TOKEN) return console.warn('GITHUB_TOKEN ontbreekt: geen workflows gestart');
    ctx.waitUntil(Promise.all(due(new Date(event.scheduledTime)).map(([f, i]) => dispatch(env, f, i))));
  },
};
