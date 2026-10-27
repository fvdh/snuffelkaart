import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { donCalendar, donProduct, holidayDate, wildroEvent, vacAgenda, vacAddress, aerleAgenda, aerleProduct } from './fetch-markets.mjs';

// Opgeslagen pagina's van Don Events (27 okt 2026): breekt de site-opbouw, dan faalt deze test.
const fx = f => fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');

describe('uitlezer Don Events', () => {
  it('kalender geeft de losse marktpagina\'s', () => {
    const links = donCalendar(fx('donevents-kalender.html'));
    expect(links.length).toBeGreaterThan(20);
    expect(links[0]).toEqual({ url: 'https://donevents.nl/product/vlooienmarkt-amstelveen-de-emergohal-zondag-1-november-2026/', where: 'Amstelveen, Emergohal', time: [540, 960] });
    expect(new Set(links.map(l => l.url)).size).toBe(links.length);
  });
  it('marktpagina geeft datum, tijden, adres en feiten', () => {
    const url = 'https://donevents.nl/product/vlooienmarkt-amstelveen-de-emergohal-zondag-1-november-2026/';
    expect(donProduct(fx('donevents-product.html'), url)).toEqual([expect.objectContaining({
      id: 'don-vlooienmarkt-amstelveen-de-emergohal-zondag-1-november-2026', name: 'Vlooienmarkt Amstelveen', kind: 'Vlooienmarkt',
      date: '2026-11-01', start: 540, end: 960, venue: 'De Emergohal', addr: 'Langs de akker 3, 1186 DA Amstelveen', indoor: true,
      kramen: 160, kraamhuur: '€34,00', org: 'Don Events', status: 'chk', url,
    })]);
  });
  it('twee dagen worden twee edities; zonder adres niets', () => {
    const html = '<title>Mega vlooienmarkt Zaandam 7 &amp; 8 november 2026 - Don Events</title><p>Locatiegegevens</p><p>Munitiefabriek</p><p>Industrieweg 1</p><p>1500 AA Zaandam</p><p>Markt geopend van 9:00 tot 16:00 uur</p>';
    const eds = donProduct(html.replace('&amp;', '&'), 'https://donevents.nl/product/mega-zaandam/');
    expect(eds.map(e => [e.id, e.date])).toEqual([['don-mega-zaandam-7', '2026-11-07'], ['don-mega-zaandam-8', '2026-11-08']]);
    expect(donProduct('<title>Markt 1 november 2026</title>', 'https://donevents.nl/product/x/')).toBeNull();
  });
  it('zonder adres: plaats, hal en tijden uit de kalender; plaats vóór postcode; feestdag als datum', () => {
    const [e] = donProduct('<title>VLOOIENMARKT Eemnes zondag 15 november 2026 - Don Events</title><p>Kom naar de markt</p>', 'https://donevents.nl/product/eemnes/', { where: 'Eemnes, Huis van Eemnes', time: [540, 960] });
    expect(e).toMatchObject({ place: 'Eemnes', venue: 'Huis van Eemnes', addr: null, date: '2026-11-15', start: 540, end: 960, timeKnown: true });
    const [z] = donProduct('<title>VLOOIENMARKT zeist zondag 27 december 2026 - Don Events</title><p>Locatiegegevens</p><p>Sporthal Dijnselburg</p><p>Burgemeester schenkpad 2</p><p>Zeist 3705 GK</p>', 'https://donevents.nl/product/zeist/');
    expect(z).toMatchObject({ place: 'Zeist', addr: 'Burgemeester schenkpad 2, 3705 GK Zeist', timeKnown: false, end: null });
    expect(donProduct('<title>VLOOIENMARKT Dordrecht maandag 2e paasdag 2027 - Don Events</title><p>Locatiegegevens</p><p>de Reeweghal</p><p>Halmaheiraplein 35</p><p>3312 GH Dordrecht</p>', 'https://donevents.nl/product/d/')[0].date).toBe('2027-03-29');
    expect([holidayDate('2e paasdag 2026'), holidayDate('2e pinksterdag 2027'), holidayDate('hemelvaartsdag 2027'), holidayDate('koningsdag 2027')]).toEqual(['2026-04-06', '2027-05-17', '2027-05-06', '2027-04-27']);
  });
});

describe('uitlezer Wildro', () => {
  const evs = JSON.parse(fx('wildro-events.json')), by = end => evs.find(e => e.url.endsWith(end));
  it('API + eventpagina geeft datum, tijden, plek en soort', () => {
    expect(wildroEvent(by('nobellaan-assen/'), fx('wildro-event.html'))).toMatchObject({
      id: 'wildro-braderie-winkelcentrum-nobellaan-assen', name: 'Braderie winkelcentrum Nobellaan Assen', kind: 'Braderie', place: 'Assen',
      addr: 'Nobellaan, Assen', date: '2026-10-31', start: 600, end: 1020, indoor: false, kraamhuur: '€40', status: 'chk',
    });
  });
  it('vlooienmarkt in een hal is binnen; kerstmarkten niet', () => {
    expect(wildroEvent(by('braderie-zuidbroek-4/'), '<p>Locatie</p><p>Eurohal, Zuidbroek</p>')).toMatchObject({ kind: 'Vlooienmarkt', indoor: true, place: 'Zuidbroek' });
    expect(wildroEvent(by('kerstmarktgramsbergen/'), fx('wildro-event.html'))).toBeNull();
  });
});

describe('uitlezer Bureau VAC', () => {
  it('agenda geeft datum, plaats, hal, binnen, tijden, entree en kraamprijs', () => {
    const eds = vacAgenda(fx('vac-agenda.html'));
    expect(eds.length).toBeGreaterThan(5);
    expect(eds[0]).toMatchObject({ date: '2026-11-01', place: 'Heel', venue: 'Sporthal Reutsdael', name: 'Vlooienmarkt Heel', indoor: true, start: 540, end: 960,
      entree: '€2,50', kraamhuur: '€32,00', url: 'https://org-vac.nl/product/sporthal-reutsdael-01-11-26/', status: 'chk' });
    expect(new Set(eds.map(e => e.id)).size).toBe(eds.length);
  });
  it('locatiepagina geeft het adres', () => {
    expect(vacAddress(fx('vac-markt.html'))).toEqual({ street: 'Sportparklaan 62', postcode: '6097CW', city: 'Heel' });
  });
});

describe('uitlezer Van Aerle', () => {
  it('kalendertabel geeft datum, dagen, naam, hal, plaats, prijs, soort', () => {
    const rows = aerleAgenda(fx('aerle-agenda.html'));
    expect(rows.length).toBeGreaterThan(10);
    expect(rows[1]).toEqual({ url: 'https://www.vlooienmarkten.nl/product/vlooienmarkt-zutphen/', date: '2026-11-01', days: 1, name: 'Vlooienmarkt Zutphen', venue: 'Hanzehal', city: 'Zutphen', price: '37', type: 'Vlooienmarkt' });
    expect(rows[0].name).toBe('Super Snuffelmarkt Expo Houten');
    expect(rows.find(r => r.days === 2)).toBeTruthy();
  });
  it('productpagina geeft tijden (niet de inbrengtijden), entree en adres', () => {
    expect(aerleProduct(fx('aerle-product.html'))).toEqual({ open: [540, 960], entree: '€4,50', street: 'Fanny Blankers Koenweg 2', postcode: '7203AA', city: 'Zutphen', venue: 'Hanzehal' });
  });
  it('bedrag gaat voor "Gratis Parkeren"; 00:00 - 00:00 is geen tijd', () => {
    const page = (open, fee) => `<p>Openingstijden</p><p>${open}</p><p>Toegangsprijs</p><p>${fee}</p>`;
    expect(aerleProduct(page('09:00 - 16:00', '€ 6 voor volwassenen, Gratis Parkeren'))).toMatchObject({ entree: '€6', open: [540, 960] });
    expect(aerleProduct(page('00:00 - 00:00', 'Gratis entree'))).toMatchObject({ entree: 'gratis', open: null });
  });
});
