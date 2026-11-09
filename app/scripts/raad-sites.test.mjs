import { it, expect } from 'vitest';
import { guesses, proof } from './raad-sites.mjs';

it('raadt domeinen uit naam en plaats', () => {
  expect(guesses('Sinkel Harkema', 'Harkema')).toEqual(['sinkelharkema.nl', 'sinkel-harkema.nl', 'sinkelharkemaharkema.nl', 'sinkel-harkema-harkema.nl']);
  expect(guesses("Kringloop 't Hoekje", 'Ede')[0]).toBe('kringlooptHoekje.nl'.toLowerCase());
  expect(guesses('Bob', '')).toEqual([]); // te kort: raak bij iemand anders
});
it('alleen raak met ons telefoonnummer of onze postcode op de site', () => {
  expect(proof('Bel ons: 06-12 34 56 78', '+31 6 12345678', '')).toBe('telefoon');
  expect(proof('Dorpsstraat 1, 1234 ab Ergens', null, 'Dorpsstraat 1, 1234AB Ergens')).toBe('postcode');
  expect(proof('Welkom bij een andere zaak, 9999 ZZ', '0612345678', 'Dorpsstraat 1, 1234 AB Ergens')).toBeNull();
});
