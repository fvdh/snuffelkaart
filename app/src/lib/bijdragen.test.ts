import { expect, test } from 'vitest';
import { toOh, prefill, applyExtra, errText, avg, type Day } from './bijdragen';
import { setWindow } from './hours';
import type { Place } from './model';

const d = (from: string, to: string): Day => ({ open: true, from, to }), off: Day = { open: false, from: '10:00', to: '17:00' };

test('tijden uit het formulier → opening_hours, gelijke dagen samen', () => {
  expect(toOh([d('10:00', '17:00'), d('10:00', '17:00'), d('10:00', '17:00'), d('10:00', '17:00'), d('10:00', '17:00'), d('10:00', '16:00'), off])).toBe('Mo-Fr 10:00-17:00; Sa 10:00-16:00; Su off');
  expect(toOh([off, d('09:30', '17:30'), d('09:30', '17:30'), off, off, off, off])).toBe('Mo off; Tu,We 09:30-17:30; Th-Su off');
});

test('formulier vooraf ingevuld met de bekende tijden; onbekend = voorstel', () => {
  setWindow('2026-10-28', []); // woensdag
  const h = Array.from({ length: 21 }, (_, i) => ([2, 3].includes(i % 7) ? [[600, 1020]] : [])) as [number, number][][]; // alleen vr en za (28 okt = wo)
  const days = prefill({ h } as Place, '2026-10-28');
  expect(days.map(x => (x.open ? `${x.from}-${x.to}` : 'dicht'))).toEqual(['dicht', 'dicht', 'dicht', 'dicht', '10:00-17:00', '10:00-17:00', 'dicht']);
  expect(prefill({ h: null } as Place, '2026-10-28')[6].open).toBe(false);
});

test('tijden van bezoekers gaan voor; reviews afgerond op halve ster', () => {
  const [p] = applyExtra([{ id: 'p', h: null, checked: null } as unknown as Place], { hours: { p: { h: [[[600, 1020]]], checked: '2026-10-25', by: 'Marieke' } }, reviews: {}, photos: {} });
  expect(p).toMatchObject({ hs: 'bezoeker', hb: 'Marieke', checked: '2026-10-25' });
  expect(avg([{ stars: 5 }, { stars: 4 }, { stars: 4 }] as never)).toBe(4.5);
});

test('foutmelding uit de database leesbaar', () => {
  expect(errText(new Error('400: {"code":"54000","message":"je hebt vandaag al 10 foto\'s toegevoegd; morgen weer"}'))).toBe("Je hebt vandaag al 10 foto's toegevoegd; morgen weer");
  expect(errText(new TypeError('Failed to fetch'))).toMatch(/Geen verbinding/);
});
