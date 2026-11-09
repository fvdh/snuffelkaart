import { it, expect } from 'vitest';
import worker, { due, SITE } from './klok.js';

const at = iso => due(new Date(iso)).map(([f, i]) => f + (i.modus ? `:${i.modus}` : ''));
it('klok: elk kwartier publiceren, 02:30 alles, back-up, controle en winkels op hun tijd', () => {
  expect(at('2026-10-28T12:15:00Z')).toEqual(['nachtelijk.yml:kwartier']);
  expect(at('2026-10-28T12:30:00Z')).toEqual(['nachtelijk.yml:kwartier', 'controle.yml']);
  expect(at('2026-10-28T02:00:00Z')).toEqual(['nachtelijk.yml:kwartier', 'controle.yml', 'backup.yml']);
  expect(at('2026-10-28T02:30:00Z')).toEqual(['nachtelijk.yml:alles', 'controle.yml']);
  expect(at('2026-11-02T00:30:00Z')).toEqual(['nachtelijk.yml:kwartier', 'controle.yml', 'winkels.yml']); // maandag
  expect(at('2026-11-05T14:00:00Z')).toEqual(['nachtelijk.yml:kwartier', 'controle.yml', 'weekmail.yml']); // donderdag
});

it('oude kaartlinks op / gaan naar /kaart/, de rest naar de bestanden', async () => {
  const env = { ASSETS: { fetch: () => new Response('bestand') } };
  const go = async u => { const r = await worker.fetch(new Request(u), env); return r.status === 302 ? r.headers.get('location') : await r.text(); };
  expect(await go('https://snuffelkaart.nl/?open=k1&plan=1')).toBe('https://snuffelkaart.nl/kaart/?open=k1&plan=1');
  expect(await go('https://snuffelkaart.nl/?dag=2026-11-08&v=600&s=a,b')).toBe('https://snuffelkaart.nl/kaart/?dag=2026-11-08&v=600&s=a,b');
  expect(await go('https://snuffelkaart.nl/')).toBe('bestand');
  expect(await go('https://snuffelkaart.nl/?utm_source=x')).toBe('bestand');
});

it('opnieuw lezen: alleen een gewone sitenaam, geen pad met rare tekens', () => {
  for (const ok of ['themusketeer.nl', 'aktiefonline.nl/kringloopwinkels/winterswijk', 'www.dorcas.nl']) expect(SITE.test(ok)).toBe(true);
  for (const nee of ['', 'localhost', 'a.nl/../x?y', 'a.nl;rm -rf', 'https://a.nl']) expect(SITE.test(nee)).toBe(false);
});
