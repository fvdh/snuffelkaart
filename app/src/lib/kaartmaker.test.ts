import { expect, test } from 'vitest';
import { fout, rpcArgs, dbFout, minuten, type Invoer } from './kaartmaker';

const goed: Invoer = { soort: 'Vrijmarkt', naam: 'Vrijmarkt Koningsdag Wijk C', org: 'Oranjecomité Wijk C', plaats: 'Utrecht', adres: 'Ledig Erf', datum: '2027-04-27', van: '08:00', tot: '15:00', lat: 52.08, lon: 5.12, entree: '', info: '', url: '' };
const met = (x: Partial<Invoer>) => fout({ ...goed, ...x }, '2026-11-09');

test('kaartmaker: goede invoer gaat door, met tijden in minuten en lege velden als null', () => {
  expect(met({})).toBeNull();
  expect(rpcArgs(goed)).toMatchObject({ soort: 'Vrijmarkt', van: 480, tot: 900, entree: null, url: null, adres: 'Ledig Erf' });
  expect(minuten('9:30')).toBe(570);
});

test('kaartmaker: dezelfde regels als de database', () => {
  expect(met({ soort: '' })).toMatch(/Kies/);
  expect(met({ naam: 'ab' })).toMatch(/naam/);
  expect(met({ org: ' ' })).toMatch(/organiseert/);
  expect(met({ lat: null })).toMatch(/plek/);
  expect(met({ lat: 48.85, lon: 2.35 })).toMatch(/plek/); // Parijs
  expect(met({ datum: '2026-11-08' })).toMatch(/datum/);
  expect(met({ datum: '2027-12-01' })).toMatch(/datum/); // meer dan een jaar vooruit
  expect(met({ datum: '2026-11-09' })).toBeNull(); // vandaag mag
  expect(met({ van: '15:00', tot: '15:15' })).toMatch(/eindtijd/);
  expect(met({ url: 'javascript:alert(1)' })).toMatch(/https/);
  expect(met({ url: 'https://oranjecomite.nl/koningsdag' })).toBeNull();
});

test('kaartmaker: foutzin uit de database tonen', () => {
  expect(dbFout(new Error('400: {"code":"22023","message":"Kies een plek in Nederland."}'))).toBe('Kies een plek in Nederland.');
  expect(dbFout(new Error('geen verbinding'))).toBe('geen verbinding');
});
