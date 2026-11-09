import { describe, it, expect } from 'vitest';
import { snippet, check, mergeDays, checkStatus, statusSnippet } from './hours-ai.mjs';

const page = 'Welkom bij Petit Circuit\nWij zijn geopend van woensdag tot en met zaterdag tussen 11:00 uur en 17:00 uur.\nItems doneren? Dat kan op dinsdag van 9 tot 12 uur.';

describe('AI-lezer: controle op het antwoord', () => {
  it('neemt een antwoord over als bron en tijden kloppen', () => {
    expect(check({ oh: 'We-Sa 11:00-17:00', bron: 'geopend van woensdag tot en met zaterdag tussen 11:00 uur en 17:00 uur' }, page)).toEqual({ oh: 'We-Sa 11:00-17:00' });
  });
  it('weigert een bron die niet op de pagina staat', () => {
    expect(check({ oh: 'We-Sa 11:00-17:00', bron: 'open woensdag t/m zaterdag 11-17' }, page)).toBeNull();
  });
  it('weigert tijden die niet in de bron staan', () => {
    expect(check({ oh: 'We-Sa 10:00-17:00', bron: 'geopend van woensdag tot en met zaterdag tussen 11:00 uur en 17:00 uur' }, page)).toBeNull();
  });
  it('weigert ongeldige syntax, nachttijden en lege antwoorden', () => {
    expect(check({ oh: 'woensdag 11-17', bron: 'geopend van woensdag tot en met zaterdag' }, page)).toBeNull();
    expect(check({ oh: 'We 00:00-23:59', bron: 'geopend van woensdag tot en met zaterdag tussen 11:00 uur en 17:00 uur' }, page)).toBeNull();
    expect(check({ oh: null }, page)).toBeNull();
    expect(check(null, page)).toBeNull();
  });
  it('kleine verschillen in witruimte en streepjes mogen', () => {
    expect(check({ oh: 'Tu-Sa 10:00-16:00', bron: 'Dinsdag t/m zaterdag 10.00 - 16.00 uur' }, 'Openingstijden\nDinsdag t/m zaterdag  10.00 – 16.00 uur')).toEqual({ oh: 'Tu-Sa 10:00-16:00' });
  });
});

describe('AI-lezer: proef 6 nov (Cloudflare)', () => {
  it("niet elke week open: weigeren ('t Schuurtje van Vincentius)", () => {
    const t = 'Het Schuurtje is geopend elke eerste en derde zaterdag van de maand van 9.00 - 15.00 uur. Vanaf 18 januari 2024 ook elke donderdag geopend van 12:00 tot 16:00.';
    expect(check({ oh: 'Th 12:00-16:00; Sa 09:00-15:00', bron: 'geopend elke eerste en derde zaterdag van de maand van 9.00 - 15.00 uur' }, t)).toBeNull();
  });
  it('meerdere vestigingen: alleen de tijden onder het eigen adres (RaderWerk)', () => {
    const t = 'Kringloopwinkel Buitenpost\nMarconistraat 2\n9285 WG Buitenpost\nOpeningstijden:\nMa t/m vr\n10.00 - 16.00\nZaterdag\n10.00-17.00\nRaderwerk Kollum\nVoorstraat 122\n9291 CN Kollum\nOpeningstijden:\ndi t/m za\n10.00 – 17.00 uur';
    const addr = 'Marconistraat 2, 9285WG Buitenpost';
    expect(check({ oh: 'Tu-Sa 10:00-17:00', bron: 'di t/m za 10.00 – 17.00 uur' }, t, undefined, addr)).toBeNull();
    expect(check({ oh: 'Mo-Fr 10:00-16:00; Sa 10:00-17:00', bron: 'Ma t/m vr 10.00 - 16.00 Zaterdag 10.00-17.00' }, t, undefined, addr)).toEqual({ oh: 'Mo-Fr 10:00-16:00; Sa 10:00-17:00' });
  });
  it('spaties na de komma mogen (ROEC)', () => {
    const t = 'Onze openingstijden zijn:\nmaandagavond van 18.30-20.30\ndinsdag van 9.00-12.00 en van 13.00-16.00 en in de avond van 18.30-20.30\ndonderdag van 9.00-12.00 en van 13.00-16.00';
    expect(check({ oh: 'Mo 18:30-20:30; Tu 09:00-12:00, 13:00-16:00, 18:30-20:30; Th 09:00-12:00, 13:00-16:00', bron: 'maandagavond van 18.30-20.30 dinsdag van 9.00-12.00 en van 13.00-16.00 en in de avond van 18.30-20.30 donderdag van 9.00-12.00 en van 13.00-16.00' }, t))
      .toEqual({ oh: 'Mo 18:30-20:30; Tu 09:00-12:00,13:00-16:00,18:30-20:30; Th 09:00-12:00,13:00-16:00' });
  });
  it('één dag in de bron, zes in het antwoord: weigeren (Goirle)', () => {
    const t = 'Onze winkels zijn vanaf 2 november op maandag geopend van 9:30 tot 17:00 uur';
    expect(check({ oh: 'Mo 09:30-17:00; Tu-Fr 09:30-17:00; Sa 09:30-17:00', bron: t }, t)).toBeNull();
    expect(check({ oh: 'Mo 09:30-17:00', bron: t }, t)).toEqual({ oh: 'Mo 09:30-17:00' });
  });
  it('goede antwoorden blijven goed (De Haagse Dames, Reconsider)', () => {
    expect(check({ oh: 'Tu-Sa 12:00-17:00', bron: 'zijn we open van 12.00 tot 17.00 uur op dinsdag tot en met zaterdag' }, 'Met ingang van dinsdag 22 september zijn we open van 12.00 tot 17.00 uur op dinsdag tot en met zaterdag.')).toEqual({ oh: 'Tu-Sa 12:00-17:00' });
    expect(check({ oh: 'Sa 11:00-18:00', bron: 'Zaterdag van 11:00 tot 18:00' }, 'Openingstijden\nZaterdag van 11:00 tot 18:00, en op afspraak!')).toEqual({ oh: 'Sa 11:00-18:00' });
  });
});

describe('AI-lezer: zelfde dag in twee regels (winkelrun 6 nov)', () => {
  it('losse avond komt erbij, overlap vervangt', () => {
    expect(mergeDays('Tu-Fr 09:00-17:00; Fr 18:30-20:30; Sa 09:00-16:00')).toBe('Tu-Th 09:00-17:00; Fr 09:00-17:00,18:30-20:30; Sa 09:00-16:00');
    expect(mergeDays('Tu-Sa 10:00-17:00; Fr 10:00-18:00')).toBe('Tu-Th 10:00-17:00; Fr 10:00-18:00; Sa 10:00-17:00');
    expect(mergeDays('Tu,We 09:00-12:00; We 18:30-20:30; Th 13:30-16:30')).toBe('Tu 09:00-12:00; We 09:00-12:00,18:30-20:30; Th 13:30-16:30');
    expect(mergeDays('Mo-Sa 10:00-17:00; We off')).toBe('Mo-Tu 10:00-17:00; Th-Sa 10:00-17:00');
    expect(mergeDays('Mo-Fr 10:00-17:00; PH off')).toBe('Mo-Fr 10:00-17:00; PH off');
  });
});

describe('AI-lezer: welk stuk tekst', () => {
  it('pakt het stuk rond openingstijden, niets zonder dag en tijd', () => {
    expect(snippet(page)).toContain('woensdag tot en met zaterdag');
    expect(snippet('Openingstijden: zie Facebook')).toBeNull();
    expect(snippet('Over ons\nWij verkopen meubels sinds 1990.')).toBeNull();
  });
});

describe('statusvraag (geen tijden: wat meldt de site?)', () => {
  const T = 'Welkom bij Het Zoldertje.\nWij zijn per 1 maart definitief gestopt. Bedankt voor alle mooie jaren!\nContact: info@zoldertje.nl';
  it('letterlijke zin met een passend woord', () => {
    expect(checkStatus({ soort: 'gestopt', bron: 'Wij zijn per 1 maart definitief gestopt.' }, T)).toEqual({ k: 'gestopt', q: 'Wij zijn per 1 maart definitief gestopt.' });
  });
  it('verzonnen of aangepaste zin: niets', () => {
    expect(checkStatus({ soort: 'gestopt', bron: 'De winkel is definitief gesloten.' }, T)).toBeNull();
  });
  it('soort past niet bij de zin: niets', () => {
    expect(checkStatus({ soort: 'verhuisd', bron: 'Wij zijn per 1 maart definitief gestopt.' }, T)).toBeNull();
  });
  it('vakantie of zondag dicht is geen "gestopt"', () => {
    const t = 'In de bouwvakantie zijn wij gesloten.';
    expect(checkStatus({ soort: 'gestopt', bron: t }, t)).toBeNull();
  });
  it('"ook online" is geen alleen-online', () => {
    const t = 'Bestel ook online in onze webshop!';
    expect(checkStatus({ soort: 'online', bron: t }, t)).toBeNull();
    const u = 'Wij hebben geen fysieke winkel, alleen een webshop.';
    expect(checkStatus({ soort: 'online', bron: u }, u)?.k).toBe('online');
  });
  it('tijdelijk dicht met einddatum; voorbije datum = oud bericht', () => {
    const t = 'Wegens verbouwing zijn wij gesloten tot en met 14 december.';
    expect(checkStatus({ soort: 'dicht', bron: t, tot: '2026-12-14' }, t, '2026-11-09')).toEqual({ k: 'dicht', q: t, tot: '2026-12-14' });
    expect(checkStatus({ soort: 'dicht', bron: t, tot: '2026-10-01' }, t, '2026-11-09')).toBeNull();
  });
  it('onregelmatig: eens per maand', () => {
    const t = 'Wij zijn elke eerste zaterdag van de maand open van 10 tot 15 uur.';
    expect(checkStatus({ soort: 'onregelmatig', bron: t }, t)?.k).toBe('onregelmatig');
  });
  it('"geen" en onbekende soorten: niets', () => {
    expect(checkStatus({ soort: 'geen', bron: 'Welkom bij Het Zoldertje.' }, T)).toBeNull();
    expect(checkStatus({ soort: 'misschien', bron: 'Welkom bij Het Zoldertje.' }, T)).toBeNull();
  });
  it('snippet alleen als er een signaalwoord staat', () => {
    expect(statusSnippet(T)).toContain('definitief gestopt');
    expect(statusSnippet('Welkom! Wij verkopen mooie spullen.')).toBeNull();
  });
});
