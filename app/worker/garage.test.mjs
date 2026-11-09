import { it, expect, vi, beforeEach } from 'vitest';
import { garage } from './garage.js';

const env = { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'k' };
const ID = 'km-0123456789', later = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
let markt, adressen;
// Nep-Supabase (markets lezen, garage_adressen tellen en invoegen) en nep-PDOK (Dorpsstraat 12 in Bussum, Ver Weg 1 in Groningen).
beforeEach(() => {
  markt = { date: later, status: 'org', data: { adressen: true, place: 'Bussum', lat: 52.2770, lon: 5.1650 } }; adressen = [];
  vi.stubGlobal('fetch', async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname === 'api.pdok.nl') {
      const q = u.searchParams.get('q');
      return Response.json({ response: { docs: /dorpsstraat/i.test(q) ? [{ straatnaam: 'Dorpsstraat', huis_nlt: '12', huisnummer: 12, woonplaatsnaam: 'Bussum', centroide_ll: 'POINT(5.16612 52.27801)' }]
        : /ver weg/i.test(q) ? [{ straatnaam: 'Ver Weg', huis_nlt: '1', huisnummer: 1, woonplaatsnaam: 'Groningen', centroide_ll: 'POINT(6.56 53.21)' }] : [] } });
    }
    if (u.pathname.endsWith('/markets')) return Response.json(u.searchParams.get('id') === `eq.${ID}` ? [markt] : []);
    if (init.method === 'POST') { const r = JSON.parse(init.body); if (adressen.some(a => a.adres === r.adres)) return Response.json([]); adressen.push(r); return Response.json([r], { status: 201 }); }
    return Response.json(adressen);
  });
});
const post = body => garage(new Request('https://snuffelkaart.nl/api/garagesale', { method: 'POST', body: JSON.stringify(body) }), env).then(r => r.json());

it('adres van een buurman: via PDOK, binnen 2 km, opgeslagen zonder status (database zet nieuw)', async () => {
  expect(await post({ markt: ID, adres: 'dorpsstraat 12', wat: 'kinderkleding' })).toEqual({ ok: true, adres: 'Dorpsstraat 12, Bussum' });
  expect(adressen).toEqual([{ market_id: ID, adres: 'Dorpsstraat 12, Bussum', lat: 52.27801, lon: 5.16612, wat: 'kinderkleding' }]);
  expect(await post({ markt: ID, adres: 'Dorpsstraat 12' })).toMatchObject({ ok: true }); // nog een keer: niet dubbel
  expect(adressen).toHaveLength(1);
});

it('geweigerd: geen huisnummer, ander huisnummer dan PDOK, te ver weg, onbekend, voorbij of nog niet goedgekeurd', async () => {
  expect((await post({ markt: ID, adres: 'Dorpsstraat' })).fout).toMatch(/huisnummer/);
  expect((await post({ markt: ID, adres: 'Dorpsstraat 99' })).fout).toMatch(/niet vinden/);
  expect((await post({ markt: ID, adres: 'Ver Weg 1' })).fout).toMatch(/2 km/);
  expect((await post({ markt: 'km-onbekend00', adres: 'Dorpsstraat 12' })).fout).toBeTruthy();
  expect((await post({ markt: "x' or 1=1", adres: 'Dorpsstraat 12' })).fout).toBeTruthy();
  markt.status = 'wacht'; expect((await post({ markt: ID, adres: 'Dorpsstraat 12' })).fout).toMatch(/geen adres/);
  markt.status = 'org'; markt.date = '2020-01-01'; expect((await post({ markt: ID, adres: 'Dorpsstraat 12' })).fout).toMatch(/geen adres/);
  expect(adressen).toHaveLength(0);
});

it('honeypot doet niets; storing geeft een nette zin', async () => {
  expect(await post({ markt: ID, adres: 'Dorpsstraat 12', website: 'spam' })).toEqual({ ok: true });
  expect(adressen).toHaveLength(0);
  vi.stubGlobal('fetch', async () => new Response('kapot', { status: 500 }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect((await post({ markt: ID, adres: 'Dorpsstraat 12' })).fout).toMatch(/iets mis/);
});
