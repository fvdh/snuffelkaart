import { it, expect, vi, beforeEach } from 'vitest';
import { api, geldigAdres } from './mail.js';
import { weekend, kies, mail } from '../scripts/weekmail.mjs';

const env = { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'k', RESEND_API_KEY: 'r' };
const T = '11111111-2222-4333-8444-555555555555';
let rijen, verstuurd, calls;
// Nep-Supabase (alleen wat mail.js doet), nep-PDOK en nep-Resend.
beforeEach(() => {
  rijen = []; verstuurd = []; calls = [];
  vi.stubGlobal('fetch', async (url, init = {}) => {
    const u = new URL(url), m = init.method ?? 'GET'; calls.push(`${m} ${u.hostname}${u.pathname}`);
    if (u.hostname === 'api.pdok.nl') return Response.json({ response: { docs: /haarlem/i.test(u.searchParams.get('q')) ? [{ type: 'woonplaats', weergavenaam: 'Haarlem, Haarlem, Noord-Holland', woonplaatsnaam: 'Haarlem', centroide_ll: 'POINT(4.6383 52.3874)' }] : [] } });
    if (u.hostname === 'api.resend.com') { verstuurd.push(JSON.parse(init.body)); return Response.json({ id: 'x' }); }
    const q = Object.fromEntries(u.searchParams), match = r => Object.entries(q).every(([k, v]) => k === 'select' || k === 'limit' || (v === 'is.null' ? r[k] == null : v.startsWith('eq.') ? String(r[k]) === decodeURIComponent(v.slice(3)) : v.startsWith('gt.') ? r[k] > v.slice(3) : true));
    if (m === 'GET') return Response.json(rijen.filter(match));
    if (m === 'POST') { const r = { ...JSON.parse(init.body), token: T, aangemaakt: new Date().toISOString(), bevestigd: null }; rijen.push(r); return Response.json([r], { status: 201 }); }
    if (m === 'PATCH') { const hit = rijen.filter(match); hit.forEach(r => Object.assign(r, JSON.parse(init.body))); return Response.json(hit); }
    if (m === 'DELETE') { rijen = rijen.filter(r => !match(r)); return new Response(null, { status: 204 }); }
  });
});
const post = (velden, path = '/api/aanmelden') => api(new Request(`https://snuffelkaart.nl${path}`, { method: 'POST', body: new URLSearchParams(velden) }), env);
const get = path => api(new Request(`https://snuffelkaart.nl${path}`), env);
const naar = r => { expect(r.status).toBe(303); return Object.fromEntries(new URL(r.headers.get('location')).searchParams); };

it('aanmelden voor de weekendmail: plaats via PDOK, rij zonder bevestiging, één bevestigingsmail', async () => {
  expect(naar(await post({ lijst: 'weekend', email: ' Jan@Voorbeeld.nl ', plek: 'haarlem', km: '50', via: '/haarlem/' }))).toEqual({ stap: 'mail', lijst: 'weekend' });
  expect(rijen).toMatchObject([{ email: 'jan@voorbeeld.nl', lijst: 'weekend', plek: 'Haarlem', lat: 52.3874, km: 50, bevestigd: null, via: '/haarlem/' }]);
  expect(verstuurd).toHaveLength(1);
  expect(verstuurd[0]).toMatchObject({ to: 'jan@voorbeeld.nl', from: expect.stringContaining('@snuffelkaart.nl') });
  expect(verstuurd[0].html).toContain(`/api/bevestig?t=${T}`);
  // nog een keer binnen het uur: geen tweede mail, hetzelfde antwoord
  expect(naar(await post({ lijst: 'weekend', email: 'jan@voorbeeld.nl', plek: 'Haarlem' })).stap).toBe('mail');
  expect(verstuurd).toHaveLength(1);
});

it('fouten: verkeerd adres, onbekende plaats, honeypot doet niets', async () => {
  expect(naar(await post({ lijst: 'weekend', email: 'geen-adres', plek: 'Haarlem' }))).toMatchObject({ stap: 'fout', waarom: 'adres' });
  expect(naar(await post({ lijst: 'weekend', email: 'a@b.nl', plek: 'Atlantis' }))).toMatchObject({ stap: 'fout', waarom: 'plek' });
  expect(naar(await post({ lijst: 'kaartmaker', email: 'a@b.nl', website: 'spam' })).stap).toBe('mail');
  expect(naar(await post({ lijst: 'iets', email: 'a@b.nl' })).stap).toBe('fout');
  await post({ lijst: 'kaartmaker', email: 'x@y.nl', via: 'https://evil.example/' }); expect(rijen[0].via).toBeNull(); rijen = []; verstuurd = [];
  expect(rijen).toHaveLength(0); expect(verstuurd).toHaveLength(0);
});

it('bevestigen en afmelden; afmelden via GET vraagt eerst om een klik', async () => {
  await post({ lijst: 'kaartmaker', email: 'a@b.nl', notitie: 'Breda, juni' });
  expect(naar(await get(`/api/bevestig?t=${T}`))).toEqual({ stap: 'ok', lijst: 'kaartmaker' });
  expect(rijen[0].bevestigd).toBeTruthy();
  expect(naar(await get(`/api/afmelden?t=${T}`))).toEqual({ stap: 'afmelden', t: T });
  expect(rijen).toHaveLength(1);
  expect(naar(await post({ 'List-Unsubscribe': 'One-Click' }, `/api/afmelden?t=${T}`)).stap).toBe('uit');
  expect(rijen).toHaveLength(0);
  expect(naar(await get('/api/bevestig?t=onzin'))).toMatchObject({ stap: 'fout', waarom: 'link' });
});

it('storing bij Supabase: nette foutpagina, geen 500', async () => {
  vi.stubGlobal('fetch', async () => new Response('kapot', { status: 500 }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(naar(await post({ lijst: 'kaartmaker', email: 'a@b.nl' }))).toMatchObject({ stap: 'fout', waarom: 'storing' });
});

it('adrescontrole', () => {
  expect(['a@b.nl', 'jan.de.vries+snuf@gmail.com'].every(geldigAdres)).toBe(true);
  expect(['a@b', 'a b@c.nl', '@c.nl', 'a@b.n'].some(geldigAdres)).toBe(false);
});

it('weekmail: weekend, markten binnen de straal, afgelast niet; mail met afmeldkop', () => {
  expect(weekend('2026-11-05')).toEqual(['2026-11-07', '2026-11-08']); // donderdag
  expect(weekend('2026-11-08')).toEqual(['2026-11-07', '2026-11-08']); // zondag zelf
  const sub = { email: 'a@b.nl', plek: 'Haarlem', lat: 52.3874, lon: 4.6383, km: 25, token: T };
  const mk = (id, date, lat, lon, status = 'org') => ({ id, name: `Markt ${id}`, place: 'X', date, start: 540, end: 960, lat, lon, status, entree: '€ 3' });
  const ms = [mk('ver', '2026-11-08', 51.44, 5.47), mk('zo', '2026-11-08', 52.40, 4.63), mk('za', '2026-11-07', 52.43, 4.82), mk('af', '2026-11-07', 52.39, 4.64, 'cancel'), mk('later', '2026-11-14', 52.39, 4.64)];
  const l = kies(ms, sub, weekend('2026-11-05'));
  expect(l.map(x => x.m.id)).toEqual(['za', 'zo']);
  const m = mail(sub, l, weekend('2026-11-05'));
  expect(m.subject).toBe('2 markten rond Haarlem dit weekend');
  expect(m.headers['List-Unsubscribe']).toBe(`<https://snuffelkaart.nl/api/afmelden?t=${T}>`);
  expect(m.html).toContain('zaterdag 7 nov · 9:00–16:00');
  expect(m.html).toContain('/kaart/?plek=Haarlem&amp;lat=52.3874&amp;lon=4.6383&amp;markten=za,zo'.replace(/&amp;/g, '&'));
});

it('kaartmaker klaar: één mail met de link, notitie veilig in de html', async () => {
  const { klaarMail } = await import('../scripts/kaartmaker-mail.mjs');
  const m = klaarMail({ email: 'a@b.nl', notitie: 'Breda <b>juni</b>' });
  expect(m.to).toBe('a@b.nl');
  expect(m.html).toContain('https://snuffelkaart.nl/kaartmaker/');
  expect(m.html).toContain('&lt;b&gt;juni');
});
