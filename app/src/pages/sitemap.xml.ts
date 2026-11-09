// Sitemap voor zoekmachines: kaart, vaste pagina's, plaatsen, winkels en markten. Elke nacht opnieuw (lastmod = datum van de data).
import { ix, generated, markets, from, SITE } from '../lib/sitedata';
import { thin, cityThin, PROVINCES, MARKET_KINDS } from '../lib/seo';

export function GET() {
  const day = generated.slice(0, 10);
  const urls = ['/', '/markten/', '/rommelmarkt-dit-weekend/', '/kringloop-open-op-zondag/', ...MARKET_KINDS.map(k => `/${k.slug}/`), ...PROVINCES.map(p => `/provincie/${p.slug}/`), '/plaatsen/', '/hoe-we-controleren/', '/privacy/', '/voorwaarden/', '/colofon/', ...ix.cities.filter(c => !cityThin(c, markets, from)).map(c => `/${c.slug}/`), ...[...ix.orgs.keys()].map(k => `/organisator/${k}/`), ...[...ix.shops.values()].filter(p => !thin(p)).map(p => ix.url(p.id)), ...[...ix.series.keys()].map(s => `/markt/${s}/`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${SITE}${u}</loc><lastmod>${day}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
