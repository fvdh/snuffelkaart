import { it, expect } from 'vitest';
import { raad, uitBag, straten } from './binnen.mjs';

it('binnen of buiten uit soort en locatie; de locatienaam gaat voor de straat', () => {
  expect(raad({ kind: 'Garagesale', addr: 'Hofstraat 2, Landgraaf' }).indoor).toBe(false);
  expect(raad({ kind: 'Vlooienmarkt', addr: 'Sporthal De Schilp, Schaapweg 2, Rijswijk' })).toEqual({ indoor: true, bron: 'de locatie is Sporthal De Schilp' });
  expect(raad({ kind: 'Snuffelmarkt', addr: 'Sorghvliethal, Jan Salwaplein 1, Veendam' }).indoor).toBe(true);
  expect(raad({ kind: 'Snuffelmarkt', addr: 'Veerplein, Vlaardingen' }).indoor).toBe(false);
  expect(raad({ kind: 'Curiosa', venue: 'Landgoed Middachten' }).indoor).toBe(false);
  expect(raad({ kind: 'Rommelmarkt', addr: 'Plantage, Utrecht' })).toBeNull(); // weten we niet: niet raden
});

it('adres en straat van een bekende markt', () => {
  const bekend = new Map([['hogeweg 8', { indoor: true, naam: 'Vlooienmarkt Raalte' }], ...straten('Sporthal Strijthagen, Hofstraat 2, Landgraaf', 'Landgraaf').map(k => [k, { indoor: true, naam: 'Vlooienmarkt Landgraaf' }])]);
  expect(raad({ kind: 'Rommelmarkt', addr: 'Hogeweg 8, 8101NH Raalte' }, bekend).bron).toBe('zelfde adres als Vlooienmarkt Raalte');
  expect(raad({ kind: 'Vlooienmarkt', addr: 'Hofstraat, Landgraaf', place: 'Landgraaf' }, bekend).bron).toBe('zelfde straat als Vlooienmarkt Landgraaf');
  expect(raad({ kind: 'Vlooienmarkt', addr: 'Hofstraat 9, Landgraaf', place: 'Landgraaf' }, bekend)).toBeNull(); // met huisnummer: alleen het hele adres telt
});

it('Kadaster: sport- en bijeenkomstgebouwen, grote bedrijfshallen; woningen zeggen niets', () => {
  expect(uitBag({ gebruiksdoel: 'sportfunctie' }).indoor).toBe(true);
  expect(uitBag({ gebruiksdoel: 'bijeenkomstfunctie,kantoorfunctie' }).indoor).toBe(true);
  expect(uitBag({ gebruiksdoel: 'industriefunctie', oppervlakte: 2400 }).indoor).toBe(true);
  expect(uitBag({ gebruiksdoel: 'industriefunctie', oppervlakte: 80 })).toBeNull();
  expect(uitBag({ gebruiksdoel: 'woonfunctie' })).toBeNull();
  expect(uitBag(null)).toBeNull();
});
