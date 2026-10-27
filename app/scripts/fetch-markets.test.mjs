import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { donCalendar, donProduct, holidayDate, wildroEvent, vacAgenda, vacAddress, aerleAgenda, aerleProduct, vitalisIcs, vitalisPlace, evlAgenda, mikkiEvent, nlDays, ijAgenda, animoCalendar, animoEvent, jojoAgenda, jojoEvent, nextDate, mdvLocations, mdvAgenda, carbootAgenda } from './fetch-markets.mjs';

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

describe('uitlezer Vitalis', () => {
  it('iCal-feed geeft snuffelmarkten met datum en tijden, zonder winterfairs', () => {
    const eds = vitalisIcs(fx('vitalis-events.ics'));
    expect(eds[0]).toEqual({ uid: '424@vitalismarkten.nl', name: 'Eelde Flowerdome vlooienmarkt', kind: 'Vlooienmarkt', date: '2026-11-01', start: 600, end: 960,
      url: 'https://vitalismarkten.nl/events/eelde-flowerdome-vlooienmarkt/', page: 'https://vitalismarkten.nl/markten/eelde-flowerdome-vlooienmarkt/' });
    expect(eds.some(e => /winterfair/i.test(e.name))).toBe(false);
    expect(eds.find(e => e.kind === 'Platenbeurs')).toBeTruthy();
    expect(eds.find(e => e.name === 'Hardenberg Evenementenhal')).toBeTruthy();
  });
  it('marktpagina geeft hal, adres, entree en standplaatsprijs', () => {
    expect(vitalisPlace(fx('vitalis-markt.html'))).toEqual({ venue: 'Assen Expo', street: 'De Haar 11', postcode: '9405TE', city: 'Assen', entree: '€5', kraamhuur: '€25' });
    expect(vitalisPlace('<p>Entreeprijzen:</p><p>Volwassenen: € 4,= per persoon</p><p>in de entreehal</p>').entree).toBe('€4');
  });
});

describe('uitlezer De Evenementenlijn', () => {
  it('agenda geeft per markt adres, datum, tijden, binnen, entree en kraamprijs', () => {
    const eds = evlAgenda(fx('evenementenlijn-agenda.html'));
    expect(eds.length).toBe(16);
    expect(eds[2]).toEqual({
      id: 'evl-breda-2026-11-08', t: 'm', name: 'Rommelmarkt Breda', kind: 'Rommelmarkt', place: 'Breda', venue: 'Sporthal de Bress', addr: 'Nieuwe inslag 99, 4817 GN Breda',
      street: 'Nieuwe inslag 99', postcode: '4817GN', date: '2026-11-08', start: 540, end: 960, timeKnown: true, indoor: true, entree: '€3', kraamhuur: '€33',
      org: 'De Evenementenlijn', url: 'https://www.deevenementenlijn.nl/markten/breda-sporthal-de-bress-08-november-2026/', schema: '', status: 'chk',
    });
  });
});

describe('uitlezer Mikki', () => {
  it('eventpagina geeft datum, tijden, hal, adres, toegang en kraamprijs', () => {
    const url = 'https://www.mikki.nl/event/vlooienmarkt-sporthal-de-vaart-2/';
    expect(mikkiEvent(fx('mikki-event.html'), url)).toMatchObject({ id: 'mikki-vlooienmarkt-sporthal-de-vaart-2', name: 'Vlooienmarkt Purmerend', venue: 'Sporthal De Vaart',
      addr: 'Koggenland, 1447 CN Purmerend', date: '2026-11-01', start: 570, end: 960, indoor: true, entree: '€3', kraamhuur: '€32,50', url });
    expect(mikkiEvent('<title>Kerstmarkt, Centrum - Mikki</title>', url)).toBeNull();
  });
});

describe('uitlezer IJ-Hallen', () => {
  it('agenda geeft per dag een editie met tijden, kramen en binnen, op de vaste plek', () => {
    const eds = ijAgenda(fx('ijhallen-agenda.html'));
    expect(eds.length).toBe(14);
    expect(eds.slice(0, 2).map(e => e.date)).toEqual(['2026-10-31', '2026-11-01']);
    expect(eds[0]).toEqual({ id: 'ij-2026-10-31', t: 'm', name: 'Vlooienmarkt IJ-Hallen', kind: 'Vlooienmarkt', place: 'Amsterdam', venue: 'IJ-Hallen, NDSM-werf',
      addr: 'NDSM-Plein 1, 1033 WC Amsterdam', street: 'NDSM-Plein 1', postcode: '1033WC', date: '2026-10-31', start: 540, end: 990, timeKnown: true, indoor: true,
      entree: 'onbekend', kramen: 600, org: 'IJ-Hallen', url: 'https://ijhallen.nl/agenda.php', schema: '', status: 'chk' });
    expect(new Set(eds.map(e => e.id)).size).toBe(eds.length);
  });
  it('datums over de maand- en jaargrens, en één dag', () => {
    expect(nlDays('31 oktober en 1 november 2026')).toEqual(['2026-10-31', '2026-11-01']);
    expect(nlDays('12 en 13 december 2026')).toEqual(['2026-12-12', '2026-12-13']);
    expect(nlDays('31 december en 1 januari 2027')).toEqual(['2026-12-31', '2027-01-01']);
    expect(nlDays('7 maart 2027')).toEqual(['2027-03-07']);
    expect(nlDays('Boek een kraam')).toEqual([]);
  });
});

describe('uitlezer Animo', () => {
  it('kalender geeft per markt plaats, hal, datum, adres en binnen', () => {
    const cal = animoCalendar(fx('animo-kalender.html'));
    expect(cal.length).toBe(11);
    expect(cal[0]).toEqual({ url: 'https://animo-vlooienmarkten.nl/kalender/doesburg', city: 'Doesburg', venue: 'Sporthal Beumerskamp', date: '2026-11-15',
      street: 'Breedestraat 39', postcode: null, q: 'Breedestraat 39 Doesburg', indoor: true });
    // "1e Editie!" en "Nieuwjaarsmarkt!" zijn geen hal; adres in drie vormen.
    expect(cal.find(c => c.city === 'Hoog-Keppel')).toMatchObject({ venue: 'Hessenhal', street: 'Monumentenweg 30', postcode: '6997AH' });
    expect(cal.find(c => c.city === 'Velp')).toMatchObject({ street: 'Gruttostraat 14', postcode: '6883CN' });
    expect(cal.find(c => c.city === 'Druten')).toMatchObject({ venue: 'Sportcentrum De Gelenberg', q: 'Invictusstraat 1 Afferden' });
    expect(cal.find(c => c.city === 'Warnsveld').venue).toBe('Sportcentrum De Kei');
    expect(cal[1].city).toBe("'s-Heerenberg");
    expect(new Set(cal.map(c => c.url)).size).toBe(cal.length);
  });
  it('marktpagina geeft tijden en kraamprijs', () => {
    expect(animoEvent(fx('animo-markt.html'))).toEqual({ open: [540, 960], kraamhuur: '€35' });
    expect(animoEvent('<p>Kraam: € 32.50</p>')).toEqual({ open: null, kraamhuur: '€32,50' });
  });
});

describe('uitlezer JoJo', () => {
  const today = '2026-10-27';
  it('agenda geeft de productpagina\'s', () => {
    const links = jojoAgenda(fx('jojo-agenda.html'));
    expect(links.length).toBe(5);
    expect(links[0]).toEqual({ url: 'https://www.jojovlooienmarkten.nl/product/23744253/zondag-1-november-kortenhoef', title: 'Zondag 1 November Kortenhoef' });
  });
  it('jaar ontbreekt: eerstvolgende datum vanaf vandaag, weekdag moet kloppen', () => {
    expect(nextDate(1, 10, 0, today)).toBe('2026-11-01');
    expect(nextDate(28, 1, 0, today)).toBe('2027-02-28');
    expect(nextDate(27, 9, null, today)).toBe('2026-10-27'); // vandaag telt mee
    expect(nextDate(1, 10, 1, today)).toBeNull(); // 1 november 2026 is geen maandag: niet doorschuiven naar 2027
    expect(nextDate(26, 9, 2, today)).toBe('2027-10-26'); // gisteren → volgend jaar (dinsdag 26 oktober 2027)
  });
  it('productpagina geeft datum, plaats, hal, tijden uit het reglement en kraamprijs', () => {
    const url = 'https://www.jojovlooienmarkten.nl/product/22586651/zondag-22-november-bussum';
    expect(jojoEvent(fx('jojo-markt.html'), url, today)).toEqual({ id: 'jojo-22586651', t: 'm', name: 'Vlooienmarkt Bussum', kind: 'Vlooienmarkt', place: 'Bussum',
      venue: 'Sporthal De Zandzee', addr: null, street: undefined, postcode: undefined, date: '2026-11-22', start: 540, end: 960, timeKnown: true, indoor: true,
      entree: 'onbekend', kraamhuur: '€28', org: 'JoJo Vlooienmarkten', url, schema: '', status: 'chk' });
  });
  it('tweede paasdag in het volgende jaar, met adres', () => {
    const url = 'https://www.jojovlooienmarkten.nl/product/24074654/2de-paasdag-29-maart-keizerswei-doorn';
    expect(jojoEvent(fx('jojo-markt-adres.html'), url, today)).toMatchObject({ place: 'Doorn', venue: 'Keizerswei', addr: 'De Beaufortweg 1, 3941 PA Doorn',
      street: 'De Beaufortweg 1', postcode: '3941PA', date: '2027-03-29', indoor: undefined });
  });
});

describe('uitlezer MDV Evenementen', () => {
  it('locatiepagina geeft per hal het adres', () => {
    const locs = mdvLocations(fx('mdv-locaties.html'));
    expect(locs.length).toBe(5);
    expect(locs[0]).toEqual({ venue: 'Sport- en Evenementenhal Margriet', street: 'Nieuwe Damlaan 5', postcode: '3119KA', city: 'Schiedam' });
  });
  it('agenda geeft datum, tijden, hal en via de plaats het adres', () => {
    const eds = mdvAgenda(fx('mdv-agenda.html'), mdvLocations(fx('mdv-locaties.html')));
    expect(eds.map(e => e.date)).toEqual(['2026-10-25', '2026-11-22', '2026-12-20']);
    expect(eds[1]).toEqual({ id: 'mdv-2026-11-22-schiedam', t: 'm', name: 'Rommelmarkt Schiedam', kind: 'Rommelmarkt', place: 'Schiedam', venue: 'Margriethal',
      addr: 'Nieuwe Damlaan 5, 3119 KA Schiedam', street: 'Nieuwe Damlaan 5', postcode: '3119KA', date: '2026-11-22', start: 540, end: 1020, timeKnown: true, indoor: true,
      entree: 'onbekend', org: 'MDV Evenementen', url: 'https://www.mdv-evenementen.nl/event/22-november-2026-mega-rommelmarkt-in-de-margriethal-in-schiedam/', schema: '', status: 'chk' });
  });
});

describe('uitlezer Carbootsale Horst', () => {
  it('homepage geeft per zondag datum, tijden, entree en plek', () => {
    const eds = carbootAgenda(fx('carbootsalehorst.html'));
    expect(eds.length).toBe(10);
    expect(new Set(eds.map(e => e.id)).size).toBe(10);
    expect(eds[0]).toEqual({ id: 'carboot-horst-2027-04-04', t: 'm', name: 'Carbootsale Horst', kind: 'Kofferbakmarkt', place: 'Horst', venue: 'Evenemententerrein Kasteelpark Ter Horst',
      addr: 'Peeldijkje, 5961 NK Horst', q: 'Peeldijkje Horst', postcode: '5961NK', date: '2027-04-04', start: 510, end: 930, timeKnown: true, indoor: false, entree: '€5',
      kramen: 450, org: 'Carbootsale Horst (MCC Events)', url: 'https://carbootsalehorst.nl/data/zondag-4-april-2027/', schema: '', status: 'chk' });
  });
});
