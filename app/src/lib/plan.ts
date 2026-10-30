import { type Item, type LatLon, type Cat, km, catOf, DAYS_LONG, dayStart, hm, mEnd } from './model';
import { intervals, openOn } from './hours';

export interface Issue { lv: 'bad' | 'warn'; txt: string }
export interface Stop { id: string; arrive: number; drive: number; km: number; issue: Issue | null; note: string; wait: number }
/** end: weg bij de laatste stop; home: terug bij het vertrekpunt; km: de hele rit, terug naar het vertrekpunt inbegrepen. */
export interface Sim { stops: Stop[]; end: number; home: number; km: number; bad: number; warn: number }

export const STAY = { k: 40, m: 60 }; // minuten per stop (aanname A1)
const ROAD = 1.3; // hemelsbreed → over de weg (aanname A2)

/** Rekent een dagplan door: aankomsttijd per stop en wat er niet klopt. */
export function simulate(order: Item[], iso: string, startMin: number, from: LatLon): Sim {
  let t = startMin, prev: LatLon = from, total = 0;
  const out: Stop[] = [], dayName = DAYS_LONG[dayStart(iso).getDay()];
  for (const it of order) {
    const d = km(prev, it) * ROAD; total += d;
    const drive = Math.round(d * 1.5 + 3), arrive = t + drive;
    let issue: Issue | null = null, leave = arrive + STAY[it.t], note = '', wait = 0;
    if (it.t === 'k') {
      const r = intervals(it, iso);
      if (!r) issue = { lv: 'warn', txt: 'Openingstijden onbekend: bel even voordat je gaat' };
      else if (!r.length) issue = { lv: 'bad', txt: `Op ${dayName} dicht` };
      else {
        const cur = r.find(([a, b]) => arrive >= a && arrive < b);
        if (cur) { note = `open tot ${hm(cur[1])}`; if (cur[1] - arrive < 25) issue = { lv: 'warn', txt: `Sluit om ${hm(cur[1])}: je hebt maar ${cur[1] - arrive} min` }; }
        else {
          const nx = r.find(([a]) => a > arrive);
          if (nx) { wait = nx[0] - arrive; issue = { lv: 'warn', txt: `Gaat pas om ${hm(nx[0])} open (${wait} min wachten)` }; leave = nx[0] + STAY.k; }
          else issue = { lv: 'bad', txt: `Al dicht als je aankomt (sluit ${hm(r[r.length - 1][1])})` };
        }
      }
    } else {
      if (it.date !== iso) issue = { lv: 'bad', txt: `Is op ${DAYS_LONG[dayStart(it.date).getDay()]}, niet op ${dayName}` };
      else if (it.status === 'cancel') issue = { lv: 'bad', txt: 'Afgelast' };
      else if (it.timeKnown === false) issue = { lv: 'warn', txt: 'Tijden onbekend: kijk bij de organisator' };
    else if (arrive >= mEnd(it)) issue = it.end ? { lv: 'bad', txt: `Markt is dan al voorbij (tot ${hm(it.end)})` } : { lv: 'warn', txt: 'Eindtijd onbekend: misschien ben je te laat' };
      else {
        if (arrive < it.start) { wait = it.start - arrive; issue = { lv: 'warn', txt: `Begint pas om ${hm(it.start)}` }; leave = it.start + STAY.m; }
        else note = it.end ? `tot ${hm(it.end)}` : 'eindtijd onbekend';
        if (it.status === 'unconf') issue = { lv: 'warn', txt: 'Nog niet bevestigd: check de organisator' };
      }
    }
    out.push({ id: it.id, arrive, drive, km: d, issue, note, wait });
    t = leave; prev = it;
  }
  const back = out.length ? km(prev, from) * ROAD : 0;
  return { stops: out, end: t, home: out.length ? t + Math.round(back * 1.5 + 3) : t, km: total + back, bad: out.filter(s => s.issue?.lv === 'bad').length, warn: out.filter(s => s.issue?.lv === 'warn').length };
}

function perms<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
}

// ponytail: alle volgordes proberen, prima tot 8 stops (40.320); daarboven is een heuristiek nodig
export function bestOrder(stops: Item[], iso: string, start: number, from: LatLon): Item[] {
  let best = stops, bc = Infinity;
  for (const p of perms(stops)) {
    const s = simulate(p, iso, start, from);
    const c = s.bad * 1000 + s.warn * 25 + s.km * 1.5 + (s.end - start) * 0.2;
    if (c < bc - 0.001) { bc = c; best = p; }
  }
  return best;
}

/** "Maak een dag voor me": voorstellen van een paar plekken dicht bij elkaar die op `iso` zeker open zijn (bekende tijden; markten
 *  alleen bevestigd). Voorstel i begint bij de i-de dichtstbijzijnde kandidaat en pakt diens buren; dubbele voorstellen vallen weg,
 *  zodat "Ander voorstel" echt iets anders geeft. ponytail: hemelsbreed clusteren, hooguit 12 startpunten; een routeplanner pas als dit veel gebruikt wordt. */
/** Soorten die in een snuffeldag passen. Niet: sloop en restpartijen en opkoop/pandjeshuis; die zoek je zelf op.
 *  "Overige tweedehands" wel (boedelhuizen, brocante), behalve wat aan de naam te zien geen snuffelwinkel is.
 *  ponytail: naamlijst; wordt hij lang, dan een vlag per winkel in /beheer. */
export const DAY_CATS: Cat[] = ['kringloop', 'kleding', 'antiek', 'vlooienmarkt', 'tweedehands'];
const NOT_SNUFFEL = /auto|demont|fiets|bike|scooter|motor|onderdel|witgoed|telefoon|gsm|computer|laptop|kassei|bouwmat|etalagepop/i;
const fitsDay = (i: Item, hide: Cat[]) => { const c = catOf(i as Extract<Item, { t: 'k' }>); return DAY_CATS.includes(c) && !hide.includes(c) && !NOT_SNUFFEL.test(i.name); };
export function dayProposals(items: Item[], iso: string, start: number, from: LatLon, n = 4, maxKm = 20, hide: Cat[] = []): Item[][] {
  const cand = items.filter(i => (i.t === 'k' ? fitsDay(i, hide) && openOn(i, iso) : i.date === iso && (i.status === 'org' || i.status === 'chk')) && km(from, i) < maxKm)
    .sort((a, b) => km(from, a) - km(from, b));
  const out: Item[][] = [], seen = new Set<string>();
  for (const seed of cand.slice(0, 12)) {
    const pick = [...cand].sort((a, b) => km(seed, a) - km(seed, b)).slice(0, n);
    const order = bestOrder(pick, iso, start, from), sim = simulate(order, iso, start, from);
    const ok = order.filter((_, i) => sim.stops[i].issue?.lv !== 'bad' && sim.stops[i].wait <= 30); // wat die dag toch niet past (al dicht, of lang wachten tot hij opengaat) valt af
    const key = ok.map(x => x.id).sort().join();
    if (ok.length && !seen.has(key)) { seen.add(key); out.push(ok); }
  }
  return out;
}

/** Route-links met tussenstops. Google: tot 9 tussenstops in de url (te verifiëren op mobiel, A3). */
export function routeUrl(app: 'google' | 'apple', from: LatLon | null, stops: Item[]): string {
  const ll = (p: LatLon) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
  const last = stops[stops.length - 1], mid = stops.slice(0, -1);
  if (app === 'google') {
    const q = new URLSearchParams({ api: '1', destination: ll(last), travelmode: 'driving' });
    if (from) q.set('origin', ll(from));
    if (mid.length) q.set('waypoints', mid.map(ll).join('|'));
    return `https://www.google.com/maps/dir/?${q}`;
  }
  // Apple Maps: meerdere bestemmingen via herhaalde daddr (te verifiëren per iOS-versie, A3)
  const q = [from ? `saddr=${ll(from)}` : '', ...stops.map(s => `daddr=${ll(s)}`), 'dirflg=d'].filter(Boolean).join('&');
  return `https://maps.apple.com/?${q}`;
}
