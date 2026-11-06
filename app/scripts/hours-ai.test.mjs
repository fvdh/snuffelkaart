import { describe, it, expect } from 'vitest';
import { snippet, check } from './hours-ai.mjs';

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

describe('AI-lezer: welk stuk tekst', () => {
  it('pakt het stuk rond openingstijden, niets zonder dag en tijd', () => {
    expect(snippet(page)).toContain('woensdag tot en met zaterdag');
    expect(snippet('Openingstijden: zie Facebook')).toBeNull();
    expect(snippet('Over ons\nWij verkopen meubels sinds 1990.')).toBeNull();
  });
});
