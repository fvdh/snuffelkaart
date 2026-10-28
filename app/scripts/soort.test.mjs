import { it, expect } from 'vitest';
import { kindOf, refine } from './soort.mjs';

it('soort: keten, eigen website, gidssite, nadere soort uit de naam', () => {
  expect(kindOf({ name: 'Opnieuw & Co' })).toBe('kringloop');
  expect(kindOf({ name: 'Leger des Heils ReShare' })).toBe('goede-doelen');
  const tw = (name, website, sub) => refine({ kind: 'tweedehands', name, website, sub });
  expect(tw('Teddy', 'https://kringloopteddy.eu').kind).toBe('kringloop');
  expect(tw('Joopies', 'https://allekringloopwinkels.nl/reusel/joopies').kind).toBe('tweedehands');
  expect(tw('Past Vintage').sub).toBe('kleding');
  expect(tw('Used Products Gouda').sub).toBe('pandjeshuis');
  expect(tw('Leen oude bouwmaterialen').sub).toBe('schroot');
  expect(tw('Antiek Vintage', null, 'antiek').sub).toBe('antiek'); // Overture-soort gaat voor
  expect(tw('Swiebertje').sub).toBeUndefined();
});
