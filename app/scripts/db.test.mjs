import { it, expect } from 'vitest';
import { merge, vanished, toFiles, placeRows, toExtra } from './db.mjs';

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

it('winkels: verdwenen uit de bron → verborgen; terug → actief; met de hand verborgen blijft verborgen', () => {
  const r = (id, extra = {}) => ({ id, status: 'actief', locked: [], data: { name: id }, ...extra });
  const existing = [r('blijft'), r('weg'), r('vast', { locked: ['status'] }), r('terug', { status: 'verborgen', data: { gone: '2026-10-01' } }), r('beheer', { status: 'verborgen' })];
  const { rows, gone } = placeRows(existing, ['blijft', 'terug', 'beheer', 'nieuw'].map(id => ({ id, data: { name: id } })), '2026-10-28');
  expect(Object.fromEntries(rows.map(x => [x.id, x.status]))).toEqual({ blijft: 'actief', terug: 'actief', beheer: 'verborgen', nieuw: 'actief' });
  expect(rows.find(x => x.id === 'terug').data.gone).toBeUndefined();
  expect(gone.map(x => [x.id, x.status, x.data.gone])).toEqual([['weg', 'verborgen', '2026-10-28']]); // 'vast' is vastgezet in beheer
});

it('extra.json: alleen goedgekeurd, jongste tijden winnen, schermnaam erbij', () => {
  const c = (kind, data, extra = {}) => ({ kind, data, item_id: 'p', user_id: 'u', status: 'goed', created_at: '2026-10-28T10:00:00Z', ...extra });
  const x = toExtra([
    c('tijden', { oh: 'Sa 10:00-17:00', seen: '2026-10-20' }),
    c('tijden', { oh: 'Sa 11:00-16:00', seen: '2026-10-25' }, { created_at: '2026-10-27T10:00:00Z' }), // later ingestuurd, maar recenter gezien: wint
    c('review', { stars: 4, text: '', month: '2026-09' }),
    c('review', { stars: 2, month: '2026-10' }, { status: 'nieuw' }),
    c('foto', { path: 'u/a.webp' }, { user_id: 'onbekend' }),
  ], new Map([['u', 'Marieke']]), '2026-10-31', 'https://x/fotos');
  expect(x.hours.p.h[0]).toEqual([[660, 960]]);
  expect(x.hours.p).toMatchObject({ checked: '2026-10-25', by: 'Marieke' });
  expect(x.reviews.p).toEqual([{ name: 'Marieke', stars: 4, text: undefined, month: '2026-09' }]);
  expect(x.photos.p[0]).toMatchObject({ url: 'https://x/fotos/u/a.webp', name: 'Een bezoeker' });
});
