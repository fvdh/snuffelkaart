import { it, expect } from 'vitest';
import { merge, vanished, toFiles } from './db.mjs';

it('import laat met de hand gezette velden en status staan', () => {
  const old = { id: 'a', status: 'cancel', locked: ['status', 'name'], data: { name: 'Goede naam', place: 'Oud' } };
  const row = merge(old, { id: 'a', status: 'chk', data: { name: 'Foute naam', place: 'Nieuw' } });
  expect(row).toMatchObject({ status: 'cancel', data: { name: 'Goede naam', place: 'Nieuw' } });
  expect(merge(undefined, { id: 'b', status: 'chk', data: {} }).status).toBe('chk');
});

it('verdwenen van de site: nog niet bevestigd, alleen bij een verse uitlezing', () => {
  const r = (id, extra = {}) => ({ id, source: 'Don', date: '2026-11-08', status: 'chk', locked: [], data: {}, ...extra });
  const rows = [r('weg'), r('blijft'), r('vast', { locked: ['status'] }), r('oud', { date: '2026-10-01' }), r('ander', { source: 'Mikki' })];
  const gone = vanished(rows, new Set(['blijft']), ['Don'], '2026-10-28');
  expect(gone.map(x => x.id)).toEqual(['weg']);
  expect(gone[0]).toMatchObject({ status: 'unconf', data: { vanished: '2026-10-28' } });
  expect(vanished(rows, new Set(), [], '2026-10-28')).toEqual([]); // organisator niet gelezen → niets aanraken
});

it('export: verborgen en kandidaten niet op de kaart, tijden vooruitgerekend', () => {
  const places = [{ id: 'p', status: 'actief', data: { name: 'A', oh: 'Sa 10:00-17:00' } }, { id: 'q', status: 'verborgen', data: { name: 'B' } }];
  const markets = [{ id: 'm', date: '2026-10-31', status: 'chk', data: { date: '2026-10-31', start: 600 } }, { id: 'k', date: '2026-10-31', status: 'kandidaat', data: { date: '2026-10-31' } }];
  const f = toFiles(places, markets, '2026-10-31');
  expect(f.places.places.map(p => p.id)).toEqual(['p']);
  expect(f.places.places[0].h[0]).toEqual([[600, 1020]]);
  expect(f.places.places[0].oh).toBeUndefined();
  expect(f.markets.markets.map(m => m.id)).toEqual(['m']);
});
