import { describe, it, expect } from 'vitest';
import { parseHoursNL, toText } from './hours-from-web.mjs';
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
