import { expect, test } from 'vitest';
import { queue, alerts, parseLatLon, type MRow } from './beheer';

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

test('aandacht: problemen uit de laatste marktenrun en een bron die al ruim een dag stilstaat', () => {
  const now = new Date('2026-10-28T09:00:00Z');
  const runs = [
    { id: 1, source: 'markets', at: '2026-10-27T02:40:00Z', counts: { problems: [{ org: 'Wildro', why: 'fout: HTTP 500' }] } },
    { id: 2, source: 'markets', at: '2026-10-28T02:40:00Z', counts: { problems: [{ org: 'VAC', why: '0 edities gevonden, vorige keer 9: vorige stand behouden' }] } },
    { id: 3, source: 'gemeenteblad', at: '2026-10-26T02:50:00Z', counts: {} },
    { id: 4, source: 'places', at: '2026-10-19T00:40:00Z', counts: {} },
  ];
  expect(alerts(runs, now)).toEqual(['VAC: 0 edities gevonden, vorige keer 9: vorige stand behouden', 'Gemeenteblad: laatste run op 2026-10-26, de nachtelijke run is mislukt', 'Winkels (OSM, Overture, websites): laatste run op 2026-10-19, de wekelijkse run is mislukt']);
  expect(alerts([{ ...runs[1], counts: {} }, { ...runs[2], at: '2026-10-28T02:50:00Z' }, { ...runs[3], at: '2026-10-26T00:40:00Z' }], now)).toEqual([]);
});

test('pin verplaatsen: coördinaten of een kaartlink', () => {
  expect(parseLatLon('52.0907, 5.1214')).toEqual({ lat: 52.0907, lon: 5.1214 });
  expect(parseLatLon('https://www.google.com/maps/place/X/@52.3731339,4.8922222,17z/data=!3m1')).toEqual({ lat: 52.37313, lon: 4.89222 });
  expect(parseLatLon('https://maps.google.com/?q=51.9244,4.4777')).toEqual({ lat: 51.9244, lon: 4.4777 });
  expect(parseLatLon('https://www.openstreetmap.org/?mlat=52.1&mlon=5.2#map=19/52.1/5.2')).toEqual({ lat: 52.1, lon: 5.2 });
  expect(parseLatLon('https://www.openstreetmap.org/#map=19/52.15/5.25')).toEqual({ lat: 52.15, lon: 5.25 });
  expect(parseLatLon('5.12, 52.09')).toBeNull(); // omgedraaid: valt buiten Nederland
  expect(parseLatLon('Dorpsstraat 1')).toBeNull();
});
