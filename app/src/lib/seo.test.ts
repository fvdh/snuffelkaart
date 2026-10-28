import { expect, test } from 'vitest';
import { slugify, siteIndex, weekHours, near } from './seo';
import type { Place, Market } from './model';

const P = (id: string, name: string, place: string | null, lat = 52, lon = 5) => ({ id, t: 'k', kind: 'kringloop', name, place, lat, lon, h: null } as unknown as Place);
const M = (id: string, name: string, place: string, date: string, lat = 52, lon = 5) => ({ id, t: 'm', name, place, date, lat, lon } as unknown as Market);

test('adressen: leesbaar, uniek, geen botsing met vaste pagina\'s', () => {
  expect(slugify("Kringloop 't Hoekje, Nijkerk")).toBe('kringloop-t-hoekje-nijkerk');
  expect(slugify('Café Brocante Zoë')).toBe('cafe-brocante-zoe');
  const ix = siteIndex([P('osm-n1', 'Het Goed', 'Ede'), P('osm-n2', 'Het Goed', 'Ede'), P('osm-n3', 'Uniek', 'Ede'), P('osm-n4', 'Een', 'Privacy'), P('osm-n5', 'Twee', 'Privacy'), P('osm-n6', 'Alleen', 'Elst')],
    [M('m1', 'Rommelmarkt', 'Elst', '2026-11-01')]);
  const shopUrls = ['osm-n1', 'osm-n2', 'osm-n3'].map(ix.url);
  expect(new Set(shopUrls).size).toBe(3);
  expect(ix.url('osm-n3')).toBe('/winkel/uniek-ede/');
  expect(ix.url('osm-n1')).toMatch(/^\/winkel\/het-goed-ede-/);
  expect(ix.cities.map(c => [c.name, c.slug, c.shops.length + c.markets.length])).toEqual([['Ede', 'ede', 3], ['Elst', 'elst', 2], ['Privacy', 'privacy-plaats', 2]]);
  expect(ix.cityUrl('Ede')).toBe('/ede/');
  expect(ix.cityUrl('Nergens')).toBeNull();
  expect(ix.url('m1')).toBe('/markt/rommelmarkt-2026-11-01/');
});

test('weektijden: ma t/m zo, feestdag overgeslagen, eerstvolgende gewone dag telt', () => {
  // vanaf ma 2026-12-21: 25 en 26 dec (vr, za) zijn feestdagen; de week erna geldt voor vr en za
  const h = Array.from({ length: 14 }, (_, i) => (i === 4 || i === 5 ? [] : i % 7 === 6 ? [] : [[600, 1020]])) as [number, number][][];
  expect(weekHours(h, '2026-12-21', ['2026-12-25', '2026-12-26'])).toEqual([
    { day: 'Maandag', txt: '10:00–17:00' }, { day: 'Dinsdag', txt: '10:00–17:00' }, { day: 'Woensdag', txt: '10:00–17:00' }, { day: 'Donderdag', txt: '10:00–17:00' },
    { day: 'Vrijdag', txt: '10:00–17:00' }, { day: 'Zaterdag', txt: '10:00–17:00' }, { day: 'Zondag', txt: 'dicht' }]);
  expect(weekHours(null, '2026-12-21')).toBeNull();
});

test('markten in de buurt: vanaf vandaag, binnen de straal, op datum', () => {
  const ms = [M('a', 'A', 'X', '2026-11-08'), M('b', 'B', 'X', '2026-11-01'), M('oud', 'C', 'X', '2026-10-01'), M('ver', 'D', 'Y', '2026-11-02', 53, 6)];
  expect(near({ lat: 52, lon: 5 }, ms, '2026-10-28').map(m => m.id)).toEqual(['b', 'a']);
});
