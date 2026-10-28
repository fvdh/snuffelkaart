// Sitemap voor zoekmachines: kaart, vaste pagina's, plaatsen, winkels en markten. Elke nacht opnieuw (lastmod = datum van de data).
import { ix, generated, SITE } from '../lib/sitedata';

export function GET() {
  const day = generated.slice(0, 10);
  const urls = ['/', '/plaatsen/', '/hoe-we-controleren/', '/privacy/', '/voorwaarden/', '/colofon/', ...ix.cities.map(c => `/${c.slug}/`), ...[...ix.shops.values()].map(p => ix.url(p.id)), ...[...ix.markets.values()].map(m => ix.url(m.id))];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${SITE}${u}</loc><lastmod>${day}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
