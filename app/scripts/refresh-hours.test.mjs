import { it, expect } from 'vitest';
import { refresh } from './refresh-hours.mjs';

it('rekent tijden opnieuw vooruit vanaf de nieuwe dag', () => {
  const data = { from: '2026-10-01', places: [{ id: 'a', h: [[]] }, { id: 'b' }] };
  const out = refresh(data, { a: 'Sa 10:00-17:00' }, '2026-10-31'); // za 31 okt
  expect(out.from).toBe('2026-10-31');
  expect(out.places[0].h[0]).toEqual([[600, 1020]]);
  expect(out.places[0].h).toHaveLength(21);
  expect(out.places[1].h).toBeUndefined();
});
