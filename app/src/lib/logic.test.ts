import { describe, it, expect, beforeEach } from 'vitest';
import type { Place, Cat } from './model';
import { weekendOf, DEFAULT_CENTER, catOf } from './model';
import { placeNow, placeDay, placeAt, isHoliday, week, setWindow, intervals } from './hours';
import { simulate, bestOrder, routeUrl, dayProposals } from './plan';
import { matches, visible, groupOf, groupRows } from './filter';
import { sampleMarkets } from './markets';
import { parsePdok } from './pdok';
// dezelfde code als de import gebruikt
import { precompute, holidays } from '../../scripts/hours-precompute.mjs';

/** Een winkel met tijden zoals de import ze vooruitrekent, vanaf `from`. */
let FROM = '2026-10-26';
const win = (from: string) => { FROM = from; setWindow(from, holidays(from)); };
const P = (oh: string | null, extra: Partial<Place> = {}): Place => ({ id: 'p', t: 'k', kind: 'kringloop', name: 'Test', lat: 52.156, lon: 5.388, addr: null, place: 'Amersfoort', h: oh ? (precompute(oh, FROM) as [number, number][][]) : null, checked: null, website: null, phone: null, src: 'osm', ...extra });
const TUE = new Date('2026-10-27T14:20:00'); // dinsdag
const SAT = new Date('2026-10-31T09:10:00');
beforeEach(() => win('2026-10-26'));

describe('openingstijden (vooruitgerekend)', () => {
  it('open, sluit bijna, opent later, dicht, onbekend', () => {
    expect(placeNow(P('Tu-Sa 10:00-17:00'), TUE)).toMatchObject({ cls: 'open', txt: 'Open · sluit 17:00' });
    expect(placeNow(P('Tu 10:00-14:30'), TUE)).toMatchObject({ cls: 'warn', txt: 'Sluit over 10 min' });
    expect(placeNow(P('Sa 10:00-16:00'), SAT)).toMatchObject({ cls: 'later', txt: 'Opent om 10:00' });
    expect(placeNow(P('Th-Sa 11:00-16:00'), TUE).txt).toBe('Dicht · opent do 11:00');
    expect(placeNow(P(null), TUE).cls).toBe('unknown');
  });
  it('dagoverzicht, venstergrens', () => {
    expect(placeDay(P('Mo-Sa 10:00-17:30'), '2026-10-31').txt).toBe('Za 10–17:30');
    expect(intervals(P('Mo-Su 10:00-17:00'), '2026-12-31')).toBeNull(); // buiten het venster van 21 dagen
    expect(placeNow(P('Mo-Su 00:00-24:00'), TUE)).toMatchObject({ cls: 'open', txt: 'Open' }); // dag en nacht open
  });
  it('feestdagen: Koningsdag en Kerst', () => {
    win('2027-04-20');
    expect(isHoliday('2027-04-27')).toBe(true);
    expect(placeDay(P('Tu-Sa 10:00-17:00; PH off'), '2027-04-27').txt).toBe('Di dicht');
    win('2026-12-21');
    expect(week(P('Mo-Sa 10:00-17:00; PH off'), '2026-12-25')!.find(d => d.iso === '2026-12-25')!.txt).toBe('Dicht (feestdag)');
    expect(isHoliday('2026-10-27')).toBe(false);
  });
});

describe('openingstijden: randgevallen (M4)', () => {
  it('rond middernacht', () => {
    const late = P('Fr 22:00-02:00');
    expect(placeNow(late, new Date('2026-10-30T23:30:00'))).toMatchObject({ cls: 'open', txt: 'Open · sluit 2:00' });
    expect(placeNow(late, new Date('2026-10-31T00:30:00'))).toMatchObject({ cls: 'open', txt: 'Open · sluit 2:00' });
    expect(placeNow(late, new Date('2026-10-31T01:45:00'))).toMatchObject({ cls: 'warn', txt: 'Sluit over 15 min' });
    expect(placeNow(late, new Date('2026-10-30T23:59:00')).open).toBe(true);
    expect(placeNow(P('Mo-Su 10:00-24:00'), new Date('2026-10-27T23:45:00'))).toMatchObject({ cls: 'warn', txt: 'Sluit over 15 min' });
    expect(placeNow(P('Tu 10:00-17:00'), new Date('2026-10-27T17:00:00')).open).toBeUndefined(); // precies sluitingstijd: dicht
    expect(placeNow(P('Tu 10:00-17:00'), new Date('2026-10-27T09:59:00'))).toMatchObject({ cls: 'later', txt: 'Opent om 10:00' });
  });
  it('wintertijd (25 okt 2026) en zomertijd (28 mrt 2027): dag van 25 of 23 uur verschuift niets', () => {
    win('2026-10-24');
    expect(intervals(P('Su 10:00-17:00'), '2026-10-25')).toEqual([[600, 1020]]);
    expect(intervals(P('Mo-Su 00:00-24:00'), '2026-10-25')).toEqual([[0, 1440]]);
    expect(intervals(P('Mo 10:00-17:00'), '2026-10-26')).toEqual([[600, 1020]]); // dag na de wissel: juiste index
    expect(placeNow(P('Su 10:00-17:00'), new Date('2026-10-25T16:45:00'))).toMatchObject({ cls: 'warn', txt: 'Sluit over 15 min' });
    win('2027-03-27');
    expect(intervals(P('Su 10:00-17:00'), '2027-03-28')).toEqual([[600, 1020]]);
    expect(intervals(P('Mo 09:00-12:00'), '2027-03-29')).toEqual([[540, 720]]);
    expect(placeNow(P('Su 10:00-17:00'), new Date('2027-03-28T10:05:00'))).toMatchObject({ cls: 'open' });
  });
  it('feestdagen in het voorjaar, zoals de opening_hours-bibliotheek ze kent; PH-tijden', () => {
    // Bibliotheek: Goede Vrijdag en 5 mei (elk jaar) tellen als feestdag, 1e Paas- en Pinksterdag (zondag) niet.
    // Bewust zo gelaten (DECISIONS.md): "dicht" op Goede Vrijdag is de veilige fout, met de banner "bel even".
    win('2027-03-26');
    expect(['2027-03-26', '2027-03-28', '2027-03-29'].filter(isHoliday)).toEqual(['2027-03-26', '2027-03-29']);
    win('2027-04-26');
    expect(['2027-04-27', '2027-05-05', '2027-05-06'].every(isHoliday)).toBe(true);
    expect(placeDay(P('Mo-Sa 10:00-17:00; PH 12:00-16:00'), '2027-05-06').txt).toBe('Do 12–16');
    expect(placeDay(P('Mo-Sa 10:00-17:00'), '2027-05-06').txt).toBe('Do 10–17'); // zonder PH-regel: gewone tijden (we weten niet beter)
    win('2027-05-10');
    expect(isHoliday('2027-05-17')).toBe(true); // 2e Pinksterdag
  });
});

describe('filters', () => {
  const f = { type: 'all' as const, open: true, gratis: false, overdekt: false, q: '', hide: [] as Cat[] };
  it('open volgt de gekozen dag; onbekende tijden nooit bij open', () => {
    expect(matches(P(null), f, TUE)).toBe(false);
    expect(matches(P(null), { ...f, open: false }, TUE)).toBe(true);
    const zat = P('Sa 10:00-17:00');
    expect(matches(zat, f, TUE)).toBe(false); // dinsdag: dicht
    expect(matches(P('Tu 16:00-18:00'), f, TUE)).toBe(true); // gaat vandaag nog open
    expect(matches(P('Tu 09:00-12:00'), f, TUE)).toBe(false); // vandaag al dicht
    expect(matches(zat, f, TUE, '2026-10-31')).toBe(true); // gekozen dag zaterdag
  });
  it('winkelsoort uitzetten; een kringloop met antiek blijft kringloop', () => {
    const all = { ...f, open: false }, antiek = P(null, { kind: 'tweedehands', sub: 'antiek' });
    expect(catOf(antiek)).toBe('antiek');
    expect(matches(antiek, { ...all, hide: ['antiek'] }, TUE)).toBe(false);
    expect(matches(P(null, { sub: 'antiek' }), { ...all, hide: ['antiek'] }, TUE)).toBe(true);
    expect(matches(P(null, { kind: 'tweedehands' }), { ...all, hide: ['tweedehands'] }, TUE)).toBe(false);
  });
  it('zoeken negeert hoofdletters en accenten', () => {
    expect(matches(P('Mo-Su 00:00-24:00', { name: 'Kringloop Één' }), { ...f, q: 'een' }, TUE)).toBe(true);
  });
  it('moment later: open als je er bent, gaat later open, al dicht', () => {
    const shop = P('Sa 09:00-17:00');
    expect(placeAt(shop, '2026-10-31', 600)).toMatchObject({ cls: 'open', txt: 'Open · tot 17:00' });
    expect(placeAt(P('Sa 13:00-17:00'), '2026-10-31', 600)).toMatchObject({ cls: 'later', txt: 'Za open vanaf 13:00' });
    expect(placeAt(P('Sa 08:00-09:30'), '2026-10-31', 600).cls).toBe('closed');
    expect(placeAt(P('Tu 10:00-17:00'), '2026-10-31', 600).txt).toBe('Za dicht');
    expect(matches(P('Sa 08:00-09:30'), f, TUE, '2026-10-31', 600)).toBe(false); // open filter volgt de vertrektijd
  });
  it('secties: op afstand, dan ingedeeld; dichtbij zonder tijden komt niet achter heel Nederland', () => {
    const at = (km: number) => ({ lat: DEFAULT_CENTER.lat + km / 111, lon: DEFAULT_CENTER.lon });
    const ver = P('Tu 10:00-17:00', { id: 'ver', ...at(30) }), dichtbij = P(null, { id: 'dichtbij', ...at(0.4) }), later = P('Tu 16:00-18:00', { id: 'later', ...at(2) });
    const rows = visible([ver, dichtbij, later], { ...f, open: false }, TUE, DEFAULT_CENTER);
    expect(rows.map(r => r.it.id)).toEqual(['dichtbij', 'later', 'ver']);
    expect(groupRows(rows, '2026-10-27', 860).map(x => [x.g, x.rows.map(r => r.it.id)])).toEqual([['open', ['ver']], ['later', ['later']], ['unknown', ['dichtbij']]]);
    const markets = sampleMarkets(TUE);
    expect(groupOf(markets.find(x => x.status === 'cancel')!, '2026-10-31', 600)).toBe('cancel');
    expect(groupOf({ ...markets[0], status: 'org', date: '2026-11-07' }, '2026-10-31', 600)).toBe('other');
  });
  it('weekend van een dag', () => {
    expect(weekendOf(TUE)).toEqual(['2026-10-31', '2026-11-01']);
    expect(weekendOf(new Date('2026-11-01T10:00:00'))).toEqual(['2026-10-31', '2026-11-01']);
  });
});

describe('dagplan', () => {
  const markets = sampleMarkets(TUE), m = (id: string) => markets.find(x => x.id === id)!;
  it('afgelast en verkeerde dag zijn fout, onbekend en onbevestigd zijn aandachtspunt', () => {
    const s = simulate([m('m4'), m('m1'), P(null, { id: 'u' }), m('m3')], '2026-10-31', 570, DEFAULT_CENTER);
    expect(s.stops.map(x => x.issue?.lv)).toEqual(['bad', 'bad', 'warn', 'bad']);
    const zo = simulate([m('m3')], '2026-11-01', 570, DEFAULT_CENTER);
    expect(zo.stops[0].issue).toMatchObject({ lv: 'warn', txt: expect.stringContaining('Nog niet bevestigd') });
  });
  it('wachttijd bij een te vroege aankomst (voor het voorstel later te vertrekken)', () => {
    const s = simulate([P('Sa 13:00-17:00', { id: 'laat', lat: DEFAULT_CENTER.lat, lon: DEFAULT_CENTER.lon })], '2026-10-31', 570, DEFAULT_CENTER);
    expect(s.stops[0].wait).toBe(13 * 60 - s.stops[0].arrive);
    expect(simulate([P('Sa 09:00-17:00', { id: 'vroeg' })], '2026-10-31', 570, DEFAULT_CENTER).stops[0].wait).toBe(0);
  });
  it('slimste volgorde lost een te vroege aankomst op', () => {
    const shop = P('Tu-Sa 10:00-16:00', { id: 'shop' }), order = [shop, m('m2')];
    expect(simulate(order, '2026-10-31', 570, DEFAULT_CENTER).warn).toBe(1);
    const best = bestOrder(order, '2026-10-31', 570, DEFAULT_CENTER);
    expect(best.map(x => x.id)).toEqual(['m2', 'shop']);
    expect(simulate(best, '2026-10-31', 570, DEFAULT_CENTER).warn).toBe(0);
  });
  it('terug bij het vertrekpunt na de laatste stop', () => {
    const s = simulate([P('Sa 09:00-17:00', { id: 'a', lat: DEFAULT_CENTER.lat + 0.1, lon: DEFAULT_CENTER.lon })], '2026-10-31', 570, DEFAULT_CENTER);
    expect(s.home).toBeGreaterThan(s.end);
    expect(simulate([], '2026-10-31', 570, DEFAULT_CENTER).home).toBe(570);
  });
  it('route-links bevatten alle stops', () => {
    const shop = P('Tu-Sa 10:00-16:00', { id: 'shop' });
    const u = new URL(routeUrl('google', DEFAULT_CENTER, [m('m2'), shop, m('m5')]));
    expect(u.searchParams.get('waypoints')!.split('|')).toHaveLength(2);
    expect(routeUrl('apple', null, [m('m2'), shop]).match(/daddr=/g)).toHaveLength(2);
  });
});

describe('plaats zoeken (PDOK)', () => {
  const pc = (n: string, x = 5.39) => ({ type: 'postcode', weergavenaam: n, centroide_ll: `POINT(${x} 52.15)` });
  it('vier cijfers worden één plek; woonplaats krijgt gemeente', () => {
    expect(parsePdok([pc('Appelmarkt, 3811CT Amersfoort'), pc('Arnhemsestraat, 3811LE Amersfoort', 5.38)], '3811')).toEqual([{ lat: 52.15, lon: 5.39, label: '3811', sub: 'Amersfoort' }]);
    expect(parsePdok([pc('Appelmarkt, 3811CT Amersfoort')], '3811ct')[0]).toMatchObject({ label: '3811CT', sub: 'Appelmarkt, Amersfoort' });
    const w = (n: string) => ({ type: 'woonplaats', weergavenaam: n, centroide_ll: 'POINT(5.25 52.09)' });
    expect(parsePdok([w('Zeist, Zeist, Utrecht'), w('Den Dolder, Zeist, Utrecht')], 'z').map(s => s.sub)).toEqual(['Utrecht', 'Gemeente Zeist, Utrecht']);
  });
});

describe('dag voor me', () => {
  const at = (id: string, lat: number, oh: string | null) => P(oh, { id, name: id, lat, lon: 5.388 });
  const shops = [at('a', 52.156, 'Sa 10:00-17:00'), at('b', 52.160, 'Sa 10:00-17:00'), at('c', 52.165, 'Mo-Fr 10:00-17:00'), at('d', 52.170, null), at('e', 52.175, 'Sa 09:00-17:00'), at('ver', 53.5, 'Sa 10:00-17:00')];
  const from = { lat: 52.156, lon: 5.388 }, ids = (x: { id: string }[]) => x.map(i => i.id).sort();
  it('alleen wat die dag open is, met bekende tijden, binnen bereik', () => {
    expect(ids(dayProposals(shops, '2026-10-31', 570, from)[0])).toEqual(['a', 'b', 'e']);
  });
  it('doordeweeks andere winkels; niets open = geen voorstel', () => {
    expect(ids(dayProposals(shops, '2026-10-27', 570, from)[0])).toEqual(['c']);
    expect(dayProposals(shops, '2026-11-01', 570, from)).toEqual([]);
  });
  it('geen sloop, opkoop of overige tweedehands; uitgezette soorten ook niet', () => {
    const more = [...shops, at('sloop', 52.157, 'Sa 08:00-17:00'), at('antiek', 52.158, 'Sa 10:00-17:00')];
    more[6] = { ...more[6], kind: 'tweedehands', sub: 'schroot' } as typeof more[6];
    more[7] = { ...more[7], kind: 'tweedehands', sub: 'antiek' } as typeof more[7];
    const all = dayProposals(more, '2026-10-31', 570, from, 10).flat().map(x => x.id);
    expect(all).not.toContain('sloop');
    expect(all).toContain('antiek');
    const fiets = { ...at('fiets', 52.157, 'Sa 10:00-17:00'), kind: 'tweedehands', name: 'Fietsen Tweedehands' } as typeof shops[0];
    expect(dayProposals([...more, fiets], '2026-10-31', 570, from, 10).flat().map(x => x.id)).not.toContain('fiets');
    expect(dayProposals(more, '2026-10-31', 570, from, 10, 20, ['antiek']).flat().map(x => x.id)).not.toContain('antiek');
  });
  it('geen dubbele voorstellen', () => {
    const p = dayProposals(shops, '2026-10-31', 570, from, 2).map(x => ids(x).join());
    expect(p.length).toBeGreaterThan(1);
    expect(new Set(p).size).toBe(p.length);
  });
});
