import { describe, it, expect } from 'vitest';
import { parseHoursNL, toText, hoursLD, keep, hoursFromHtml } from './hours-from-web.mjs';
import { precompute } from './hours-precompute.mjs';

const oh = t => parseHoursNL(t)?.oh ?? null;

// Tekst zoals die op echte kringloopsites staat (steekproef 27 okt 2026).
describe('openingstijden van websites', () => {
  it('lijst per dag, inname-blok erna telt niet mee', () => {
    expect(oh('Openingstijden winkel\nMaandag: 09:30 - 17:00\nDinsdag: 09:30 - 17:00\nWoensdag 09:30 - 17:00\nDonderdag 09:30 - 17:00\nVrijdag 09:30 - 17:00\nZaterdag: 09:30 - 17:00\nZondag: GESLOTEN\nInname van goederen\nMaandag: 09:30 - 17:00\nDinsdag: 10:00 - 12:00'))
      .toBe('Mo-Sa 09:30-17:00');
  });
  it('afkortingen en gesloten dagen', () => {
    expect(oh('openingstijden\nMa: gesloten\nDi: 10:00 - 12:30\nWo: 10:00 - 15:30\nDo: 10:00 - 12:30\nVr: 10:00 - 15:30\nZa: 11:00 - 13:00\nZo: gesloten'))
      .toBe('Tu 10:00-12:30; We 10:00-15:30; Th 10:00-12:30; Fr 10:00-15:30; Sa 11:00-13:00');
  });
  it('kantoortijden ervoor worden overgeslagen, punten als scheiding', () => {
    expect(oh('Openingstijden kantoor/secretariaat: maandag t/m donderdag tussen 8.00 en 16.30 uur en vrijdag tussen 8.00 en 12.00 uur.\nAdres\nDrenthweg 3\nOpeningstijden\nKringloopwinkel Ter Apel\nMaandag 12.00 – 16.00 uur\nDinsdag 09.00 – 16.00 uur\nWoensdag 09.00 – 16.00 uur\nDonderdag 09.00 – 16.00 uur'))
      .toBe('Mo 12:00-16:00; Tu-Th 09:00-16:00');
  });
  it('alles op één regel, met feestdagen gesloten', () => {
    expect(oh('Openingstijden maandag 13:30 – 16:30 dinsdag 9:30 – 16:30 woensdag 9:30 – 16:00 donderdag 9:30 – 16:00 vrijdag 9:30 – 16:00 zaterdag 10:00 – 16:00 Op zon- en feestdagen zijn wij gesloten.'))
      .toBe('Mo 13:30-16:30; Tu 09:30-16:30; We-Fr 09:30-16:00; Sa 10:00-16:00; PH off');
  });
  it('bereik en opsomming van dagen, middagpauze', () => {
    expect(oh('Winkel: di t/m za 10.00–17.00 uur')).toBe('Tu-Sa 10:00-17:00');
    expect(oh('Open: ma, wo en vr van 9:00 - 12:00 en 13:00 - 16:30')).toBe('Mo 09:00-12:00,13:00-16:30; We 09:00-12:00,13:00-16:30; Fr 09:00-12:00,13:00-16:30');
  });
  it('inbrengtijden onder een kop van twee regels tellen niet; twee dagen onder "openingstijden winkel" wel', () => {
    expect(oh('Contact\nEuropalaan 40-42\nOpeningstijden winkel\nWoensdag: 10.00 – 16.00 uur\nZaterdag: 10.00 – 16.00 uur\nInbrengmomenten van nette\n& verkoopbare spullen\nDi & do: 09.00 – 11.00 uur\nWo & za: 10.00 – 15.30 uur'))
      .toBe('We 10:00-16:00; Sa 10:00-16:00');
  });
  it('steekproef 6 nov: koopavond komt bij de dag, "én" als opsomming', () => {
    expect(oh('Openingstijden\nMaandag t/m vrijdag: 9.30 uur tot 18.00\nZaterdag: 9.00 uur tot 17.00\nDonderdag koopavond: 19:00-21:00\nWij zijn gesloten op:\nNieuwjaarsdag'))
      .toBe('Mo-We 09:30-18:00; Th 09:30-18:00,19:00-21:00; Fr 09:30-18:00; Sa 09:00-17:00');
    expect(oh('Openingstijden winkel\nWoensdag én zaterdag van 10-16 uur.\nInname goederen\nMaandag, dinsdag, donderdag en vrijdag van 9-12.30 uur.\nWoensdag en zaterdag van 10-15.30 uur.'))
      .toBe('We 10:00-16:00; Sa 10:00-16:00');
  });
  it('steekproef 6 nov: "open van", "zijn wij gesloten", werkdagen, zon- en feestdagen, tm, doneren', () => {
    expect(oh('Openingstijden\nMaandag: open van 10:00 tot 16:30.\nDinsdag: open van 10:00 tot 16:30.\nWoensdag: open van 10:00 tot 16:30.')).toBe('Mo-We 10:00-16:30');
    expect(oh('openingstijden\nmaandag 13:00 t/m 17:00\ndinsdag 10:00 t/m 17:00\nzaterdag 10:00 t/m 16:00\nzondag zijn wij gesloten\nContact gegevens')).toBe('Mo 13:00-17:00; Tu 10:00-17:00; Sa 10:00-16:00');
    expect(oh('Openingstijden\nWerkdagen van 09.00-17.00 uur\nZaterdags van 09.00-16.00 uur\nDinsdags gesloten\nHardenberg')).toBe('Mo 09:00-17:00; We-Fr 09:00-17:00; Sa 09:00-16:00');
    expect(oh('Openingstijden Rieteweg\nMaandag 13:00 – 17:30 uur\nDinsdag 08:30 – 17:30 uur\nZaterdag 08:30 – 17:00 uur\nZon en feestdagen Gesloten\nVestiging'))
      .toBe('Mo 13:00-17:30; Tu 08:30-17:30; Sa 08:30-17:00; PH off');
    expect(oh('Openingstijden winkel\nMaandag tot en met zaterdag van 9.00 - 17.00 uur\nDoneren goederen\nMaandag tot en met zaterdag van 9.00 tot 13.00 uur.')).toBe('Mo-Sa 09:00-17:00');
    expect(oh('openingstijden: di tm za 10.00 - 16.00 uur')).toBe('Tu-Sa 10:00-16:00');
  });
  it('twee kolommen: eerst de dagen, dan de tijden (De Sjop Texel)', () => {
    expect(oh('Openingstijden\nMaandag:\nDonderdag:\nVrijdag:\nZaterdag:\n10.00 - 16.00 uur\n10.00 - 16.00 uur\n10.00 - 16.00 uur\n10.00 - 16.00 uur\nHier kunt u ons vinden: Kogerstraat 29'))
      .toBe('Mo 10:00-16:00; Th-Sa 10:00-16:00');
    expect(oh('Openingstijden\nMaandag:\nDinsdag:\nWoensdag:\n10.00 - 16.00 uur\n10.00 - 16.00 uur\nContact')).toBeNull(); // ongelijk aantal: twijfel
  });
  it('één dag alleen als het elke week is', () => {
    expect(oh('Openingstijden: elke zaterdag van 10:00 tot 14:00\nFacebook')).toBe('Sa 10:00-14:00');
    expect(oh('Openingstijden\nElke dinsdag van 10:00 -16:00\nTelefoon')).toBe('Tu 10:00-16:00');
    expect(oh('Openingstijden\nDe verkoop is elke derde zaterdag van 10:00 tot 14:00')).toBeNull();
    expect(oh('Openingstijden\nZaterdag 10:00 - 14:00')).toBeNull();
  });
  it('halve lijst (dag met opmerking ertussen) geeft niets', () => {
    expect(oh('Openingstijden winkel\nMaandag\n9.00 - 12.00\nDinsdag\n9.00 - 12.00\nWoensdag\n13.00 - 16.00\nDonderdag (gesloten op 24/12 kerstavond)\n18.00 - 20.30\nVrijdag\nGesloten\nZaterdag (gesloten op 26/12)\n9.00 - 12.00')).toBeNull();
  });
  it('steekproef 27 okt: noot onder de lijst, meervoud, spreekuur, | als scheiding, feestdagen', () => {
    expect(oh('Openingstijden\nMaandag t/m vrijdag:\n8:30 t/m 12:00 en van 13:00 t/m 18:00\nZaterdag:\n9:00 t/m 12:00 en van 13:00 t/m 17:00\nLET OP: WIJ ZIJN OP WOENSDAG HEEL DE DAG GESLOTEN!!'))
      .toBe('Mo-Tu 08:30-12:00,13:00-18:00; Th-Fr 08:30-12:00,13:00-18:00; Sa 09:00-12:00,13:00-17:00');
    expect(oh('Openingstijden :\nOpen op de woensdag van 13 tot 17 uur\nvrijdag van 13 tot 17 uur\nen de zaterdagen van 12 tot 16 uur')).toBe('We 13:00-17:00; Fr 13:00-17:00; Sa 12:00-16:00');
    expect(oh('Ons spreekuur is open op maandag, dinsdag, donderdag en vrijdag van 9:30 tot 12:00')).toBeNull();
    expect(oh('Openingstijden\nMaandag\n08.00 - 12.00u | 12.30-17:00u\nDinsdag\n08.00 - 12.00u | 12.30-17:00u\nZaterdag\n08.00 - 12.00u')).toBe('Mo-Tu 08:00-12:00,12:30-17:00; Sa 08:00-12:00');
    expect(oh('Openingstijden\nMaandag\n09.30 - 17.30 uur\nDinsdag\n09.30 - 17.30 uur\nZaterdag\n09.30 - 17.00 uur\nTijdens feestdagen zijn onze winkels en inleverpunten gesloten.')).toBe('Mo-Tu 09:30-17:30; Sa 09:30-17:00; PH off');
  });
  it('bij twijfel niets', () => {
    expect(oh('openingstijden feestdagen\nWoensdag 24 december 09.30 – 16.00\nDonderdag 25 december GESLOTEN')).toBeNull(); // feestdagen + datums
    expect(oh('geopend van 9:30 tot 17:00 uur')).toBeNull(); // geen dagen
    expect(oh('Op werkdagen van 09:00u tot 12:00u telefonisch bereikbaar')).toBeNull();
    expect(oh('Winkel Noord\nma t/m vr 10:00-17:00\nzo gesloten\n\nWinkel Zuid lorem ipsum dolor sit amet consectetur\nma t/m vr 09:00-16:00\nzo gesloten')).toBeNull(); // twee winkels
    expect(oh('Ma 25 - 3 kinderen')).toBeNull();
  });
  it('uitkomst is geldige OSM-syntax', () => {
    const r = oh('Maandag: 09:30 - 17:00\nDinsdag: 09:30 - 17:00\nZaterdag 10:00 - 16:00. Op feestdagen gesloten');
    expect(precompute(r, '2026-10-26')).not.toBeNull();
  });
  it('html naar tekst', () => {
    expect(toText('<p>Ma:&nbsp;10:00&ndash;12:00</p><script>x</script><li>Di</li>')).toBe('Ma: 10:00–12:00\nDi\n');
  });
});

describe('schema.org in de pagina', () => {
  const ld = x => `<script type="application/ld+json">${JSON.stringify(x)}</script>`;
  it('openingHoursSpecification, feestdag-uitzondering telt niet', () => {
    expect(hoursLD(ld({ '@type': 'Store', openingHoursSpecification: [
      { dayOfWeek: ['https://schema.org/Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '10:00', closes: '17:00' },
      { dayOfWeek: 'Saturday', opens: '10:00:00', closes: '16:00:00' },
      { validFrom: '2026-12-25', validThrough: '2026-12-26', opens: '00:00', closes: '00:00' }] }))?.oh).toBe('Tu-Fr 10:00-17:00; Sa 10:00-16:00');
  });
  it('openingHours als tekst, standaardwaarde van een thema niet', () => {
    expect(hoursLD(ld({ '@graph': [{ '@type': 'LocalBusiness', openingHours: ['Mo-Fr 09:30-17:00', 'Sa 10:00-16:00'] }] }))?.oh).toBe('Mo-Fr 09:30-17:00; Sa 10:00-16:00');
    expect(hoursLD(ld({ openingHours: 'Mo-Su 00:00-23:59' }))).toBeNull();
    expect(hoursLD(ld({ openingHours: 'Mo,Tu,We,Th,Fr,Sa,Su 09:00-17:00' }))).toBeNull();
    expect(hoursLD(ld({ openingHours: 'Mo-Fr 09:30-12:00; Mo-Fr 13:00-17:00; Sa 10:00-12:00' }))?.oh).toBe('Mo-Fr 09:30-12:00,13:00-17:00; Sa 10:00-12:00'); // anders betekent het in OSM alleen 13-17
    expect(hoursLD(ld({ openingHoursSpecification: { dayOfWeek: 'Monday', opens: '00:00', closes: '23:59' } }))).toBeNull();
  });
  it('keten met twee winkels en andere tijden: twijfel', () => {
    expect(hoursLD(ld([{ openingHours: 'Mo-Fr 09:00-17:00' }, { openingHours: 'Tu-Sa 10:00-16:00' }]))).toBeNull();
  });
  it('kop "Openingstijden" direct boven de lijst gaat voor een inbreng-zin erboven', () => {
    expect(oh('Inbreng boven 20 stuks alleen op afspraak!\nOpeningstijden\nMaandag: Gesloten\nDinsdag: 10:00 – 14:00\nWoensdag: 10:00 – 15:00\nZaterdag: 10:00 – 14:00\nZondag: Gesloten'))
      .toBe('Tu 10:00-14:00; We 10:00-15:00; Sa 10:00-14:00');
  });
  it('tabel winkel | inleveren: alleen de winkelkolom (Het Goed)', () => {
    expect(oh('Openingstijden\nWinkel open\nSpullen inleveren Inleveren\nMaandag\n10:00 - 18:00\n10:00 - 17:00\nDinsdag\n10:00 - 18:00\n10:00 - 17:00\nZaterdag\n10:00 - 18:00\n10:00 - 16:30\nZondag\n12:00 - 17:00\ngesloten\nOpeningstijden feestdagen\n'))
      .toBe('Mo-Tu 10:00-18:00; Sa 10:00-18:00; Su 12:00-17:00');
    expect(oh('Maandag\n10:00 - 18:00\n10:00 - 17:00\nDinsdag\n10:00 - 18:00\n10:00 - 17:00\nZaterdag\n10:00 - 18:00\n10:00 - 16:30\n')).toBeNull(); // welke kolom? onbekend
  });
  it('"Spullen inleveren" eronder is een ander blok (GoudGoed)', () => {
    expect(oh('Openingstijden winkel:\nmaandag t/m zaterdag:\n10:00 – 17:00 uur\nSpullen inleveren:\nmaandag t/m zaterdag\nvan 10:00 tot 16:00 uur\n')).toBe('Mo-Sa 10:00-17:00');
  });
  it('hele uren zonder "uur" alleen onder een kop (Appel & Ei)', () => {
    expect(oh('Openingstijden\nMaandag 13 – 17.30\nDinsdag t/m vrijdag 10 – 17.30\nZaterdag 10 – 17\nContact')).toBe('Mo 13:00-17:30; Tu-Fr 10:00-17:30; Sa 10:00-17:00');
    expect(oh('Kerstmarkt\nzaterdag 10 - 12\nzondag 10 - 12\nmaandag 10 - 14')).toBeNull();
  });
  it('twee lijsten zonder dag gemeen: twijfel', () => {
    expect(oh('Openingstijden\nMaandag 10:00 - 17:00\nDinsdag 10:00 - 17:00\n\nGeopend\nDonderdag 13:00 - 16:00\nVrijdag 13:00 - 16:00\n')).toBeNull();
  });
  it('"dinsdags", "zaterdags" (Geurden)', () => {
    expect(oh('Geopend: Maandag 9 uur tot 18 uur\nDinsdags 9 uur tot 18 uur\nWoensdag 9 uur tot 18 uur\nDonderdags Gesloten\nVrijdags 9 uur tot 18 uur\nZaterdags 9 uur tot 16 uur\nOf op afspraak'))
      .toBe('Mo-We 09:00-18:00; Fr 09:00-18:00; Sa 09:00-16:00');
  });
  it('dag met ochtend en middag onder elkaar (Rooie Ben); overlappende kolommen zonder kop: twijfel', () => {
    expect(oh('Openingstijden\nmaandag\n08:30–12:00\n12:30–17:30\ndinsdag\n08:30–12:00\n12:30–17:30\nwoensdag\n08:30–12:00\n12:30–17:30\nzaterdag\nGesloten\nzondag\nGesloten\nContact'))
      .toBe('Mo-We 08:30-12:00,12:30-17:30');
    expect(oh('Openingstijden winkel\nDag\nOchtend\nMiddag\nMaandag\nGesloten\n14.00 –16.00\nDinsdag\n09.00 –11.00\n14.00 –16.00\nWoensdag\n09.00 –11.00\n14.00 –16.00\nZondag\nGESLOTEN\n'))
      .toBe('Mo 14:00-16:00; Tu-We 09:00-11:00,14:00-16:00');
    expect(oh('Openingstijden\nMaandag\n09:30 - 17:30\n09:30 - 17:00\nDinsdag\n09:30 - 17:30\n09:30 - 17:00\nWoensdag\n09:30 - 17:30\n09:30 - 17:00\n')).toBeNull();
  });
  it('lange zin over inleveren tussen kop en lijst telt niet (Woord & Daad)', () => {
    expect(oh('Openingstijden\nU kunt van woensdag t/m vrijdag tussen 10.00 en 11.30 uur uw goederen inleveren. De vrachtwagen rijdt in principe alleen op donderdag.\nWoensdag\n10:00 – 16:00\nDonderdag\n10:00 – 16:00\nVrijdag\n10:00 – 16:00\nZaterdag\n10:00 – 16:00\nVolg ons'))
      .toBe('We-Sa 10:00-16:00');
  });
  it('botsende lijsten: die met de kop "winkel" (In de Vrijloop)', () => {
    expect(oh('Openingstijden Verenigingsruimtes:\nMaandag t/m donderdag van 09:00 – 12:00 en van 13:30 – 17:00 uur.\nVrijdags van 09:00 - 12:00 uur.\nEtages zijn bereikbaar door middel van (trap)liften.\nOpeningstijden Kringloopwinkel:\nIn principe dinsdags, woensdags, donderdags en vrijdags van 13:30 tot 16:30 uur.\n'))
      .toBe('Tu-Fr 13:30-16:30');
  });
});

it('niet gelezen: laatst gelezen tijden blijven tot 60 dagen, met de oude datum', () => {
  const prev = { oh: 'Sa 10:00-17:00', page: 'https://x/contact', read: '2026-10-27T20:00:00Z' }, now = Date.parse('2026-11-02T01:00:00Z');
  const fail = { url: 'https://x', read: '2026-11-02T01:00:00Z', oh: null, page: null, note: 'fout: status 403' };
  expect(keep(fail, prev, now)).toMatchObject({ oh: 'Sa 10:00-17:00', ok: '2026-10-27T20:00:00Z', note: 'fout: status 403 (tijden van 2026-10-27 bewaard)' });
  expect(keep(fail, prev, Date.parse('2027-01-10T00:00:00Z')).oh).toBeNull(); // te oud: weg
  expect(keep({ ...fail, oh: 'Su 12:00-16:00', ok: fail.read }, prev, now).oh).toBe('Su 12:00-16:00'); // nieuw gelezen wint
  expect(keep(fail, undefined, now).oh).toBeNull();
});

describe('meerdere vestigingen op één pagina (Het Boelhuys /winkels)', () => {
  const html = '<p>Drs. F. Bijlweg 65</p><p>Openingstijden</p><p>Maandag</p><p>11:00 – 16:00</p><p>Dinsdag</p><p>11:00 – 16:00</p><p>Zaterdag</p><p>11:00 – 16:00</p><p>Spoorstraat 60</p><p>Openingstijden</p><p>Maandag</p><p>Gesloten</p><p>Dinsdag</p><p>11:00 – 16:00</p><p>Zaterdag</p><p>11:00 – 16:00</p>';
  it('pakt het blok vanaf de eigen straat, zonder adres niets', async () => {
    const { hoursFromHtml } = await import('./hours-from-web.mjs');
    expect(hoursFromHtml(html, 'Spoorstraat 60, 1781JH Den Helder')).toEqual({ oh: 'Tu 11:00-16:00; Sa 11:00-16:00' });
    expect(hoursFromHtml(html)).toBeNull();
  });
});

describe('tijdelijk gesloten (J. Brunekreef)', () => {
  it('herkent het vlak na openingstijden, niet los in een nieuwsbericht', async () => {
    const { tempClosed } = await import('./hours-from-web.mjs');
    expect(tempClosed('Veluweweg 52\nOpeningstijden\n-- tijdelijk gesloten --\n')).toBe(true);
    expect(tempClosed('Wij zijn tijdelijk gesloten wegens ziekte.')).toBe(true);
    expect(tempClosed('Openingstijden\nDi t/m za 10-17\nNieuws: de parkeerplaats is tijdelijk gesloten.')).toBe(false);
    const { byAppointment, hoursFromHtml } = await import('./hours-from-web.mjs');
    expect(byAppointment('Bezoek winkel:\nWij hebben geen vaste openingstijden en adviseren een afspraak te maken')).toBe(true);
    expect(byAppointment('Showroom alleen op afspraak')).toBe(true);
    expect(byAppointment('*Open by appointment only*')).toBe(true); // Old Goods
    expect(byAppointment('Wilt u iets brengen? Maak een afspraak.')).toBe(false);
    // Eigen postcode vlak na de straat beëindigt het blok niet; die van het hoofdkantoor in de voet telt niet mee.
    const tdh = '<p>Adres<br>Tempelierstraat 26<br>4902 XJ Oosterhout</p><p>Openingstijden<br>Maandag<br>Gesloten<br>Dinsdag<br>10.00 – 17.00<br>Zaterdag<br>10.00 – 13.00</p><footer>2511 BH Den Haag Openingstijden Maandag t/m vrijdag 9.00 - 17.00 uur</footer>';
    expect(hoursFromHtml(tdh, 'Tempelierstraat 26, 4902XJ Oosterhout')?.oh).toBe('Tu 10:00-17:00; Sa 10:00-13:00');
  });
});

describe('Engelse site (Outfit Library LESS)', () => {
  it('leest Engelse dagen, "to" en "closed"; op afspraak telt niet', async () => {
    const { parseHoursNL } = await import('./hours-from-web.mjs');
    expect(parseHoursNL('Nieuwe Plein 13 in Arnhem /\nTuesday: appointments only/\nWednesday: 13:00-18:00 /\nThursday: 13:00-18:00 /\nFriday: 13:00-18:00 /\nSaturday: 13:00-18:00 /\nSunday: appointments only')).toEqual({ oh: 'We-Sa 13:00-18:00' });
    expect(parseHoursNL('Opening hours\nMonday to Friday: 10:00-17:00\nSaturday: 10:00-16:00\nSunday: closed')).toEqual({ oh: 'Mo-Fr 10:00-17:00; Sa 10:00-16:00' });
  });
});

describe('twee vestigingen, "Openingstijden en inname" (Kringloop De Liemers)', () => {
  const html = '<p>Kringloop de Liemers</p><p>Hengelder 26A 6902 PA Zevenaar</p><p>Zevenaar</p><p>Hengelder 26A 6902 PA Zevenaar Tel: 0316-529232</p><p>Openingstijden en inname Maandag t/m vrijdag 08:30 uur tot 17:00 uur Zaterdag 10:00 uur tot 17:00 uur.</p><p>s-Heerenberg</p><p>Molenpoort 1-b 7041BD s-Heerenberg Tel: 0314-668458</p><p>Openingstijden en inname Maandag t/m vrijdag 10:00 uur tot 17:00 uur Zaterdag 10:00 uur tot 16:00 uur.</p>';
  it('vindt de vestiging op postcode als de straat anders gespeld is', async () => {
    const { hoursFromHtml } = await import('./hours-from-web.mjs');
    expect(hoursFromHtml(html, 'Hengelderweg 26-A, 6902 PA Zevenaar')).toEqual({ oh: 'Mo-Fr 08:30-17:00; Sa 10:00-17:00' });
    expect(hoursFromHtml(html, 'Molenpoort 1b, 7041BD s-Heerenberg')).toEqual({ oh: 'Mo-Fr 10:00-17:00; Sa 10:00-16:00' });
    expect(hoursFromHtml(html)).toBeNull();
  });
});

describe("tijden zonder streepje of met spaties (proef 9 nov)", () => {
  it("open en dicht onder elkaar zonder streepje (Van Roon Interieurs)", () => {
    expect(parseHoursNL("openingstijden\nMaandag\ngesloten\nDinsdag\n10:00\n17:30\nWoensdag\n10:00\n17:30\nDonderdag\n10:00\n17:30\nVrijdag\n10:00\n17:30\nZaterdag\n10:00\n17:00\nZondag\ngesloten\n")?.oh).toBe("Tu-Fr 10:00-17:30; Sa 10:00-17:00");
  });
  it("\"wo t/m zo 11:00 17:00\" (1001 Lampen)", () => {
    expect(parseHoursNL("1001 Lampen\nopeningstijden: wo t/m zo 11:00 17:00\nHome")?.oh).toBe("We-Su 11:00-17:00");
  });
  it("spaties rond de dubbele punt (Kringloop It Fean)", () => {
    expect(parseHoursNL("Onze openingstijden\nmaandag\n10 : 00 – 17 : 00\ndinsdag\n10 : 00 – 17 : 00\nzaterdag\n10 : 00 – 17 : 00\nzondag\n12 : 00 – 17 : 00\n")?.oh).toBe("Mo-Tu 10:00-17:00; Sa 10:00-17:00; Su 12:00-17:00");
  });
  it("ochtend en middag in kolommen blijven twee tijden, niet één aan elkaar geplakt", () => {
    expect(parseHoursNL("Openingstijden\nmaandag: 10:00-12:00\n13:00-17:00\ndinsdag: 10:00-12:00\n13:00-17:00\nwoensdag: gesloten\n")?.oh ?? "").not.toMatch(/12:00-13:00/);
  });
  it("microdata itemprop=openingHours", () => {
    const h = ["Mo","Tu","We","Th","Fr","Sa"].map(d => `<time itemprop="openingHours" datetime="${d} 10:00-17:00">${d}</time>`).join("");
    expect(hoursFromHtml(`<div>${h}</div>`)?.oh).toBe("Mo-Sa 10:00-17:00");
  });
});

describe("tijden overnemen van Facebook (beheer, 9 nov)", () => {
  const fb = x => parseHoursNL("Openingstijden\n" + x)?.oh;
  it("Nederlandse weergave, dag en tijd onder elkaar", () => expect(fb("Maandag\nGesloten\nDinsdag\n10:00 - 17:00\nWoensdag\n10:00 - 17:00\nZaterdag\n10:00 - 16:00\nZondag\nGesloten")).toBe("Tu-We 10:00-17:00; Sa 10:00-16:00"));
  it("Engelse weergave met AM/PM", () => expect(fb("Tuesday 10:00 AM - 5:00 PM\nWednesday 10:00 AM - 5:00 PM\nSaturday 10:00 AM - 4:00 PM")).toBe("Tu-We 10:00-17:00; Sa 10:00-16:00"));
  it("kort getypt", () => expect(fb("di t/m za 10-17")).toBe("Tu-Sa 10:00-17:00"));
});
