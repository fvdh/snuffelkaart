// Oude marktadressen per datum (/markt/vlooienmarkt-zwolle-2027-03-28/) → de pagina van de reeks (/markt/vlooienmarkt-zwolle-wrzv-hallen/).
// Na de build voegt astro.config.mjs deze regels toe aan dist/_redirects en haalt dit bestand weg (Cloudflare: 301, max ±2000 regels).
import { ix } from '../lib/sitedata';

export function GET() {
  return new Response(ix.oldMarkets.map(([a, b]) => `${a} ${b} 301`).join('\n') + '\n', { headers: { 'Content-Type': 'text/plain' } });
}
