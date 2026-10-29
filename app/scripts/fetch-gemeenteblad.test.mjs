import { it, expect } from 'vitest';
import fs from 'node:fs';
import { dates, times, editions, dupOf } from './fetch-gemeenteblad.mjs';

const recs = Object.fromEntries(JSON.parse(fs.readFileSync(new URL('./fixtures/gemeenteblad.json', import.meta.url), 'utf8')).map(r => [r.id, r]));
const today = '2026-10-28';

it('datums en tijden in Nederlandse notaties', () => {
  expect(dates('op 25 oktober 2026 en 14 feb. 2027, Zo. 17-01-2027, 10-1-2027')).toEqual(['2026-10-25', '2027-01-10', '2027-01-17', '2027-02-14']);
  expect(dates('U kunt bezwaar maken tegen dit besluit Dit kan tot en met 26 november 2026 bij')).toEqual([]);
  expect(times('tussen 9.00 en 16.00')).toEqual([540, 960]);
  expect(times('van 10:00 uur tot 13:00 uur')).toEqual([600, 780]);
  expect(times('Tijd van: 09.00 Tijd tot: 16.30')).toEqual([540, 990]);
});

it('melding Maasgouw: één kandidaat met tijden en coördinaat', () => {
  const [e, ...rest] = editions(recs['gmb-2026-491414'], today);
  expect(rest).toEqual([]);
  expect(e).toMatchObject({ id: 'gmb-2026-491414-2026-11-01', status: 'kandidaat', source: 'gemeenteblad', data: { kind: 'Vlooienmarkt', start: 540, end: 960, timeKnown: true, exact: true, stage: 'melding' } });
});

it('Vlaardingen: een reeks zondagen; verordening: niets; zonder coördinaat: plaats van PDOK', () => {
  expect(editions(recs['gmb-2026-497816'], today, { lat: 51.9, lon: 4.34 }).length).toBeGreaterThan(5);
  expect(editions(recs['gmb-2026-480381'], today)).toEqual([]);
  const [z] = editions(recs['gmb-2026-487430'], today, { lat: 51.65, lon: 5.88 });
  expect(z).toMatchObject({ date: '2027-08-29', data: { kind: 'Rommelmarkt', exact: false, timeKnown: false, stage: 'verleend' } });
  expect(editions(recs['gmb-2026-487430'], today)).toEqual([]); // geen plek: overslaan
});

it('dubbel: zelfde dag binnen 1 km', () => {
  const e = { date: '2026-11-01', data: { lat: 51.18, lon: 5.9 } };
  expect(dupOf(e, [{ date: '2026-11-01', data: { lat: 51.183, lon: 5.902 } }])).toBe(true);
  expect(dupOf(e, [{ date: '2026-11-08', data: { lat: 51.18, lon: 5.9 } }])).toBe(false);
});

it('een termijn na "voor" is geen marktdag (Best: bezwaar … Dat doet u voor 29 oktober)', () => {
  expect(dates('houden vlooienmarkt op 22-11-2026 en 14-2-2027. Bezwaar maken. Dat doet u voor 29 oktober 2026 via de site')).toEqual(['2026-11-22', '2027-02-14']);
  expect(dates('Rommelmarkt op 7 november 2026 van 9.00 tot 15.00 uur')).toEqual(['2026-11-07']);
});

it('een inzagedatum met "ter inzage" erna is geen marktdag (Schiedam)', () => {
  const tekst = 'evenement Society Bazaar te Schiedam op 17 oktober 2026 van 14.00 uur tot 22.00 uur en 18 oktober 2026 van 12.00 uur tot 21.00 uur. Braderie voor families. Vanaf 28 oktober 2026 ligt een afschrift van de verleende vergunning, gedurende zes weken gerekend vanaf de datum van het besluit, ter inzage bij het Stadskantoor.';
  expect(dates(tekst)).toEqual(['2026-10-17', '2026-10-18']);
  expect(editions({ id: 'gmb-x', rubriek: 'Overig', title: 'Braderie Schiedam', tekst, punt: '51.92 4.38', woonplaats: 'Schiedam' }, '2026-10-20').map(e => e.date)).toEqual([]);
});
