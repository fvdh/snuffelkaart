import type { Market } from './model';
import { weekendOf, DEFAULT_CENTER } from './model';

// VOORBEELDMARKTEN, verzonnen (zie DECISIONS.md). Echte markten komen uit de organisator-uitlezers (M0, §5.2).
// Posities als km-verschuiving t.o.v. Amersfoort; datums relatief aan het komende weekend.
type Raw = Omit<Market, 'lat' | 'lon' | 'date' | 't' | 'sample'> & { x: number; y: number; day: 'za' | 'zo' };
const RAW: Raw[] = [
  { id: 'm1', name: 'Rommelmarkt Sporthal De Kamp', kind: 'Rommelmarkt', place: 'Amersfoort', x: 1.9, y: 1.9, day: 'zo', start: 540, end: 900, status: 'org', indoor: true, entree: '€ 2,50', kramen: 120, schema: 'Elke 1e zondag, oktober t/m maart', org: 'Eemhal Evenementen' },
  { id: 'm2', name: 'Vlooienmarkt Bergkwartier', kind: 'Vlooienmarkt', place: 'Amersfoort', x: -0.5, y: 0.3, day: 'za', start: 480, end: 840, status: 'chk', checked: '26 okt', indoor: false, entree: 'gratis', kramen: 60, schema: 'Laatste zaterdag van de maand, april t/m oktober', org: 'Stichting Bergkwartier Markt' },
  { id: 'm3', name: 'Kofferbakmarkt Leusden', kind: 'Kofferbakmarkt', place: 'Leusden', x: 0.6, y: 5.5, day: 'zo', start: 480, end: 780, status: 'unconf', indoor: false, entree: 'gratis', schema: 'Elke 1e zondag', org: 'Buurtvereniging Hamersveld' },
  { id: 'm4', name: 'Braderie Soest-Zuid', kind: 'Braderie', place: 'Soest', x: -6.8, y: 2.6, day: 'za', start: 660, end: 1020, status: 'cancel', cancelWhy: 'Afgelast door de organisator, vanwege de weersverwachting.', indoor: false, entree: 'gratis', kramen: 80, schema: 'Eenmalig', org: 'Winkeliersvereniging Soest-Zuid' },
  { id: 'm5', name: 'Kinderrommelmarkt Hoogland', kind: 'Kinderrommelmarkt', place: 'Hoogland', x: 0.2, y: -4.0, day: 'za', start: 600, end: 780, status: 'chk', checked: '24 okt', indoor: false, entree: 'gratis', kramen: 40, schema: 'Elke laatste zaterdag, mei t/m oktober', org: 'Speeltuinvereniging Hoogland' },
  { id: 'm6', name: 'Indoor Vlooienmarkt Barneveld', kind: 'Vlooienmarkt', place: 'Barneveld', x: 13.0, y: 2.4, day: 'zo', start: 540, end: 960, status: 'org', indoor: true, entree: '€ 4', kramen: 250, schema: 'Elke 1e en 3e zondag', org: 'Hallenmarkten Gelderland' },
  { id: 'm7', name: 'Garagesale-route Vathorst', kind: 'Garagesale-route', place: 'Amersfoort', x: 3.9, y: -4.0, day: 'za', start: 600, end: 900, status: 'chk', checked: '23 okt', indoor: false, entree: 'gratis', schema: 'Eenmalig', org: 'Wijkplatform Vathorst', area: 'Verspreid door de hele wijk; startpunt bij het wijkcentrum.' },
  { id: 'm8', name: 'Rommelmarkt Wijkcentrum De Kruiskamp', kind: 'Rommelmarkt', place: 'Amersfoort', x: 2.3, y: -1.0, day: 'zo', start: 600, end: null, status: 'chk', checked: '25 okt', indoor: true, entree: 'gratis', kramen: 25, schema: 'Elke 1e zondag', org: 'Bewonersvereniging Kruiskamp' },
];

export function sampleMarkets(now: Date): Market[] {
  const [sat, sun] = weekendOf(now), kmLat = 111.2, kmLon = 111.2 * Math.cos(DEFAULT_CENTER.lat * Math.PI / 180);
  return RAW.map(({ x, y, day, ...m }) => ({ ...m, t: 'm', sample: true, date: day === 'za' ? sat : sun, lat: +(DEFAULT_CENTER.lat - y / kmLat).toFixed(5), lon: +(DEFAULT_CENTER.lon + x / kmLon).toFixed(5) }));
}
