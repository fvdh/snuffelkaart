// Kaartmaker: welke pagina hoort bij welke eigen markt (id → /markt/<reeks>/). Het adres van een reeks volgt uit alle markten samen
// (seo.ts), dus de browser kan het niet zelf uitrekenen. Alleen openbare gegevens: wat in markets.json staat.
import { ix, markets } from '../../lib/sitedata';

export const GET = () => Response.json(Object.fromEntries(markets.filter(m => m.id.startsWith('km-')).map(m => [m.id, ix.url(m.id)])));
