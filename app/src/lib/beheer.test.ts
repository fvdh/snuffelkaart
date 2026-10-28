import { expect, test } from 'vitest';
import { queue, type MRow } from './beheer';

const row = (id: string, date: string, status: string, data: Record<string, any> = {}): MRow =>
  ({ id, date, status, locked: [], data: { name: id, lat: 52, lon: 5, exact: true, timeKnown: true, stage: 'verleend', ...data } });

test('wachtrij: dringend eerst, dubbel herkend, aanvraag is twijfel, vastgezet en gepubliceerd blijven eruit', () => {
  const q = queue([
    row('later', '2026-12-01', 'kandidaat', { lat: 53 }),
    row('aanvraag', '2026-11-20', 'kandidaat', { stage: 'aanvraag', lat: 51 }),
    row('dubbel', '2026-11-02', 'kandidaat'),
    row('bekend', '2026-11-02', 'chk', { lat: 52.003 }),
    row('weg', '2026-11-30', 'unconf', { vanished: '2026-10-27', lat: 50 }),
    { ...row('weg-gekeurd', '2026-11-30', 'unconf', { vanished: '2026-10-27' }), locked: ['status'] },
    row('voorbij', '2026-10-01', 'kandidaat'),
  ], '2026-10-28');
  expect(q.map(j => j.row.id)).toEqual(['dubbel', 'aanvraag', 'weg', 'later']);
  expect(q.map(j => [j.urgent, j.verdict])).toEqual([[true, 'rej'], [false, 'doubt'], [false, 'doubt'], [false, 'good']]);
  expect(q[0].why[0]).toMatch(/“bekend”.*\d+ m/);
});
