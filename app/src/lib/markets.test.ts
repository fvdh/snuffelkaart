import { expect, test } from 'vitest';
import { applyStatus, type Live } from './markets';
import type { Market, Place } from './model';

const m = (id: string, date: string, status: Market['status'] = 'chk') => ({ id, t: 'm', date, status, name: id, kind: 'Rommelmarkt', place: 'X', lat: 52, lon: 5, start: 540, end: null, org: 'O', schema: '' } as unknown as Market);
const p = (id: string) => ({ id, t: 'k', name: id } as unknown as Place);

test('statusbestand: afgelast meteen zichtbaar, niet meer gepubliceerd weg (alleen binnen 14 dagen), verborgen winkel weg', () => {
  const live: Live = { at: '2026-10-28T09:00:00Z', markets: [{ id: 'a', status: 'cancel', cancelWhy: 'Storm' }, { id: 'b', status: 'chk', cancelWhy: null }], hidden: ['k2'] };
  const out = applyStatus([m('a', '2026-10-31'), m('b', '2026-11-01'), m('weg', '2026-11-02'), m('ver', '2026-12-20')], [p('k1'), p('k2')], live);
  expect(out.markets.map(x => [x.id, x.status, x.cancelWhy])).toEqual([['a', 'cancel', 'Storm'], ['b', 'chk', undefined], ['ver', 'chk', undefined]]);
  expect(out.places.map(x => x.id)).toEqual(['k1']);
});

test('statusbestand leeg of onbereikbaar: niets weghalen', () => {
  const ms = [m('a', '2026-10-31')], ps = [p('k1')];
  expect(applyStatus(ms, ps, null)).toEqual({ markets: ms, places: ps });
  expect(applyStatus(ms, ps, { at: '2026-10-28T09:00:00Z', markets: [], hidden: [] }).markets).toEqual(ms);
});
