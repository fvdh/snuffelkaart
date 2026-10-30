import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { Item, LatLon, Place, Market } from '../lib/model';
import { spotKey, dDay, dShort, dLong, fkm, hm, isoDay, addDays, dayStart, minutesOf, DAYS, DAYS_LONG, km, cap, CATS } from '../lib/model';
import { placeNow, placeDay, placeAt, marketStatus, week, isHoliday, openOn, intervals, type Status } from '../lib/hours';
import { simulate, bestOrder, routeUrl, dayProposals } from '../lib/plan';
import { groupRows, type Filters, type Group } from '../lib/filter';
import { searchSpots, type Spot } from '../lib/pdok';
import { providers, oauthUrl, verifyCode, SB, KEY, type Session } from '../lib/auth';
import { Ic, Tile, St, Conf, Banner, CAT, kindLabel, isUnsure, EASE, reduced, pop } from './ui';
import { PhotoStrip, ReviewsSection, NameField, PILL, WHAT, type Bij } from './Bijdragen';
import { errText } from '../lib/bijdragen';

export interface Ctx {
  now: Date; f: Filters; online: boolean; dataFrom: string | null; install: { add: () => void; no: () => void } | null; origin: LatLon; originLabel: string | null; locDenied: boolean; spot: boolean; me: LatLon | null; locating: boolean;
  pickSpot: (s: Spot) => void; recent: Spot[]; markets: Market[]; favs: string[]; bij: Bij; planStops: string[]; planDay: string;
  /** Het gekozen moment: nu (live) of een dag + vertrektijd. Geldt voor lijst, kaart en detail; het dagplan heeft een eigen dag en tijd. */
  day: string; min: number; live: boolean; setWhen: (w: { day: string; start: number } | null) => void; st: (it: Item) => Status;
  setF: (p: Partial<Filters>) => void; open: (id: string, from?: HTMLElement | null) => void; toggleStop: (id: string) => void; toggleFav: (id: string) => void;
  here: From; locate: (quiet?: boolean) => void; back: () => void; openPlan: () => void; openMe: () => void; openDag: () => void; openWaar: () => void; share: (it: Item) => void; user: string | null;
}

/** Status op het gekozen moment: nu ("Open · sluit 17:00"), of later ("Open · tot 17:00", "Za open vanaf 13:00"). */
export function statusFor(it: Item, now: Date, day: string, min?: number): Status {
  if (it.t === 'm') return marketStatus(it, now);
  return min == null && day === isoDay(now) ? placeNow(it, now) : min == null ? placeDay(it, day) : placeAt(it, day, min);
}
export const momentLabel = (c: { live: boolean; day: string; min: number; now: Date }) => c.live ? `Nu · ${hm(minutesOf(c.now))}` : `${c.day === isoDay(c.now) ? 'Vandaag' : dayPill(c.day)} · ${hm(c.min)}`;
export const IOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent) && 'ontouchend' in document;

const dayPill = (iso: string) => { const d = dayStart(iso); return `${DAYS[d.getDay()]} ${d.getDate()}`; };
/** "Wanneer ga je?": vandaag, morgen, het komende weekend, of een andere dag binnen twee weken. */
export function DayPick({ day, now, set, label = 'Wanneer ga je?' }: { day: string; now: Date; set: (iso: string) => void; label?: string }) {
  const today = isoDay(now), tom = addDays(today, 1), [more, setMore] = useState(false);
  const wk = Array.from({ length: 6 }, (_, i) => addDays(today, i + 2)).filter(d => [6, 0].includes(dayStart(d).getDay())).slice(0, 2);
  const fixed = [today, tom, ...wk], other = !fixed.includes(day);
  return (<div className="daypick">
    <span className="dp-l" id="dp-l">{label}</span>
    <div className="typeseg" role="group" aria-labelledby="dp-l">
      {fixed.map(d => <button key={d} aria-pressed={d === day} onClick={() => { set(d); setMore(false); }} aria-label={dLong(d)}>{d === today ? 'Vandaag' : d === tom ? 'Morgen' : dayPill(d)}</button>)}
      <button aria-pressed={other} aria-expanded={more} onClick={() => setMore(!more)}>{other ? dayPill(day) : 'Andere dag'}</button></div>
    {more && <div className="daystrip" role="group" aria-label="Kies een dag">{Array.from({ length: 14 }, (_, i) => { const iso = addDays(today, i), d = dayStart(iso); return (
      <button key={iso} className="day" aria-pressed={day === iso} onClick={() => { set(iso); setMore(false); }} aria-label={dLong(iso) + (isHoliday(iso) ? ', feestdag' : '')}><span>{i === 0 ? 'vand.' : DAYS[d.getDay()]}</span><b className="tnum">{d.getDate()}</b><i className={`mk${isHoliday(iso) ? '' : ' none'}`} /></button>); })}</div>}
  </div>);
}

/** Status kort voor in een regel: de sectiekop zegt al "nu open", dus hier alleen wat je moet weten ("tot 17:30", "opent 11:00").
 *  Onbekend: niets, ook dat zegt de kop al (UX 29 okt: elke regel herhaalde de kop). */
export function shortStatus(st: Status): string | null {
  if (st.cls === 'unknown') return null;
  if (st.cls === 'open') { const m = /(?:sluit|tot) (\d+:\d\d)/.exec(st.txt); return m ? `tot ${m[1]}` : 'open'; }
  if (st.cls === 'later') { const m = /(\d+:\d\d)/.exec(st.txt); return m ? `opent ${m[1]}` : st.txt; }
  return st.txt;
}

export function Row({ it, d, c }: { it: Item; d: number; c: Ctx }) {
  const st = c.st(it), inPlan = c.planStops.includes(it.id), cancel = it.t === 'm' && it.status === 'cancel', short = shortStatus(st);
  // Tweede regel: status · plaats · soort. De plaats (alleen als die anders is dan waar je zoekt) gaat voor de soort: wordt de regel te lang,
  // dan valt de soort weg en niet de plaats (UX-test 30 okt). De soort niet herhalen als hij al in de naam staat ("Vlooienmarkt Baarn").
  const kind = (it.t === 'm' ? it.kind : kindLabel(it)).toLowerCase();
  const parts: [string, string][] = [];
  // Plaats al bekend (je zoekt daar, of hij staat in de naam: "Kringloop Zwolle" ×3)? Dan de straat, zodat je ze uit elkaar houdt.
  const street = it.t === 'k' && it.addr ? it.addr.split(',')[0] : null, known = !it.place || it.place === c.originLabel || it.name.includes(it.place);
  if (known ? street : it.place) parts.push(['r-plaats', (known ? street : it.place)!]);
  if (!it.name.toLowerCase().includes(kind)) parts.push(['r-kind', kind]);
  return (
    <li className="rowli" data-key={it.id}>
      <button className="row" onClick={e => c.open(it.id, e.currentTarget.querySelector<HTMLElement>('.r-name'))} aria-label={`${it.name}, ${st.txt}, ${fkm(d)} kilometer`}>
        <Tile it={it} />
        <span className="r-main">
          <span className={`r-name${cancel ? ' strike' : ''}`}>{it.name}</span>
          <span className="r-meta">{short && <span className={`st-i ${st.cls}`}>{short}</span>}{it.t === 'm' && it.status === 'unconf' && <Conf it={it} />}
            {parts.map(([cls, p], i) => <span key={cls} className={cls}>{(i > 0 || short || (it.t === 'm' && it.status === 'unconf')) && <span aria-hidden="true">· </span>}{p}</span>)}</span>
        </span>
        <span className="r-km">{fkm(d)} km</span>
      </button>
      <button className="add" onClick={e => { if (!inPlan) pop(e.currentTarget); c.toggleStop(it.id); }} aria-pressed={inPlan} disabled={cancel} aria-label={`${inPlan ? 'Haal uit' : 'Zet in'} mijn dagplan`}><span><Ic n={inPlan ? 'check' : 'plus'} /></span><small aria-hidden="true">Mijn dag</small></button>
    </li>
  );
}

/** Plaatsen en postcodes bij de zoekterm (PDOK), met een korte pauze na het typen. */
function useSpots(q: string): Spot[] {
  const [hits, setHits] = useState<Spot[]>([]);
  useEffect(() => {
    const t = q.trim(); if (t.length < 2) { setHits([]); return; }
    const ac = new AbortController(), id = setTimeout(() => searchSpots(t, ac.signal).then(setHits).catch(() => {}), 220);
    return () => { clearTimeout(id); ac.abort(); };
  }, [q]);
  return q.trim().length < 2 ? [] : hits;
}

/** FLIP: regels glijden naar hun nieuwe plek (280 ms), nieuwe regels faden in (220 ms). */
function useFlip(dep: unknown) {
  const ref = useRef<HTMLUListElement>(null), prev = useRef<Map<string, number> | null>(null);
  useLayoutEffect(() => {
    const ul = ref.current, next = new Map<string, number>(), animate = prev.current && !reduced();
    ul?.querySelectorAll<HTMLElement>('[data-key]').forEach(el => {
      const k = el.dataset.key!, top = el.offsetTop, was = prev.current?.get(k); next.set(k, top);
      if (!animate) return;
      if (was == null) el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE });
      else if (Math.abs(was - top) > 1) el.animate([{ transform: `translateY(${was - top}px)` }, { transform: 'none' }], { duration: 280, easing: EASE });
    });
    prev.current = ul ? next : null;
  }, [dep]);
  return ref;
}

const SEC: Record<Group, (live: boolean, day: string, min: number) => string> = {
  open: (live, day, min) => live ? 'Nu open' : `Open om ${hm(min)}`,
  later: (live, day) => live ? 'Gaat vandaag nog open' : `Later open op ${DAYS[dayStart(day).getDay()]}`,
  unknown: () => 'Tijden onbekend',
  other: () => 'Markten op andere dagen',
  closed: (live, day) => live ? 'Vandaag dicht' : `Dicht op ${DAYS[dayStart(day).getDay()]}`,
  cancel: () => 'Afgelast',
};

/** Bovenaan: waar en wanneer in één pil. Tikken opent het scherm "Waar en wanneer". */
function ContextPill({ c }: { c: Ctx }) {
  return (<button className="ctx-pil" onClick={c.openWaar} aria-label={`Waar en wanneer: ${c.me ? 'bij jou' : c.spot ? `rond ${c.originLabel}` : 'nog geen plek gekozen'}, ${momentLabel(c)}. Wijzigen`}>
    <Ic n={c.me ? 'loc' : 'pin'} /><span className="cp-w">{c.locating ? 'Locatie zoeken…' : c.me ? 'Bij jou in de buurt' : c.spot ? `Rond ${c.originLabel}` : 'Waar wil je snuffelen?'}</span>
    <span className="cp-m">{c.live && <i className="cdot" />}{momentLabel(c)}<Ic n="chevd" /></span></button>);
}

/** Vaste links onder de lijst: voor bezoekers een snelle ingang, voor Google de weg naar de stadspagina's (SEO, 30 okt). */
const BIG: [string, string][] = [['Amsterdam', 'amsterdam'], ['Rotterdam', 'rotterdam'], ['Den Haag', 'den-haag'], ['Utrecht', 'utrecht'], ['Eindhoven', 'eindhoven'], ['Groningen', 'groningen'],
  ['Tilburg', 'tilburg'], ['Almere', 'almere'], ['Breda', 'breda'], ['Nijmegen', 'nijmegen'], ['Apeldoorn', 'apeldoorn'], ['Arnhem', 'arnhem'], ['Haarlem', 'haarlem'], ['Enschede', 'enschede'],
  ['Amersfoort', 'amersfoort'], ['Zwolle', 'zwolle'], ['Leeuwarden', 'leeuwarden'], ['Maastricht', 'maastricht'], ['Den Bosch', 'den-bosch']];

export function ListView({ c, inView, list, total, limit, more, counts, nPlaces }: { c: Ctx; inView: { nearest: () => void } | null; list: { it: Item; d: number }[]; total: number; limit: number; more: () => void; counts: { open: number; later: number; unknown: number }; nPlaces: number }) {
  // De eerstvolgende markten in de buurt (tot 30 km, hooguit 4) staan er altijd bij, ook als er meer dan `limit` winkels dichterbij zijn: anders zie je in een stad nooit een markt.
  const { f, day } = c, shown = [...list.slice(0, limit), ...list.slice(limit).filter(r => r.it.t === 'm' && r.d < 30).sort((a, b) => (a.it as Market).date.localeCompare((b.it as Market).date)).slice(0, 4)], secs = groupRows(shown, day, c.min), flip = useFlip(shown), [cats, setCats] = useState(false), [finding, setFinding] = useState(false), [all, setAll] = useState<Group[]>([]);
  // Tijden onbekend en dicht: de dichtstbijzijnde drie, de rest achter een knop. Bij zoeken alles.
  const FOLD: Group[] = ['unknown', 'closed'], fold = (g: Group) => FOLD.includes(g) && !all.includes(g) && !f.q;
  const isToday = day === isoDay(c.now), openLbl = c.live ? 'Alleen wat nu open is' : `Alleen open om ${hm(c.min)}`;
  const P = (b: boolean) => ({ 'aria-pressed': b });
  // Alleen markten, maar geen op de gekozen dag: zeg dat, in plaats van stilletjes de eerstvolgende te tonen (UX-test 30 okt).
  const noMarket = f.type === 'm' && !list.some(r => r.it.t === 'm' && (r.it as Market).date === day), dayTxt = isToday ? 'vandaag' : `op ${dShort(day)}`;
  const extra = (f.hide.length ? 1 : 0) + (f.gratis ? 1 : 0) + (f.overdekt ? 1 : 0) + (f.open ? 1 : 0);
  return (<>
    <div className="lv-head" data-drag>
      <ContextPill c={c} />
    </div>
    {/* Alleen zoeken en filters blijven staan bij scrollen: op de stoep wil je regels zien, geen bediening (UX-review 28 okt). */}
    <div className="lv-tools" data-peek data-drag>
      {(finding || f.q) && <label className="search"><Ic n="search" /><span className="sr">Zoeken</span><input type="search" autoFocus placeholder="Zoek een winkel of markt op naam" value={f.q} onChange={e => c.setF({ q: e.target.value })} onBlur={() => !f.q && setFinding(false)} autoComplete="off" /></label>}
      <div className="chips" role="group" aria-label="Filters">
        {!finding && !f.q && <button className="chip ic-chip" onClick={() => setFinding(true)} aria-label="Zoek op naam"><Ic n="search" /></button>}
        {f.only && <button className="chip" aria-pressed onClick={() => c.setF({ only: null })} aria-label="Toon weer alles, niet alleen bewaard"><Ic n="heart" />Bewaard · {f.only.length}<Ic n="x" /></button>}
        <button className="chip" {...P(f.type === 'k')} onClick={() => c.setF({ type: f.type === 'k' ? 'all' : 'k' })}><i className="tk" />Winkels</button>
        <button className="chip" {...P(f.type === 'm')} onClick={() => c.setF({ type: f.type === 'm' ? 'all' : 'm' })}><i className="tm" />Markten</button>
        <button className="chip" aria-expanded={cats} {...P(extra > 0)} onClick={() => setCats(!cats)}><Ic n="filter" />{extra ? `Filters · ${extra}` : 'Filters'}</button>
      </div>
      {cats && <div className="morestrip" role="group" aria-label="Filters">
        <button className="chip" {...P(f.open)} onClick={() => c.setF({ open: !f.open })}><span className="gdot" />{openLbl}</button>
        {f.type !== 'k' && <><button className="chip" {...P(f.gratis)} onClick={() => c.setF({ gratis: !f.gratis })}>Markt: gratis entree</button>
          <button className="chip" {...P(f.overdekt)} onClick={() => c.setF({ overdekt: !f.overdekt })}><Ic n="umbrella" />Markt: overdekt</button></>}
        {f.type !== 'm' && <div className="catstrip" role="group" aria-label="Soort winkel">
          {/* Tik = alleen deze soort (zo verwachten mensen het; UX-test 30 okt). Daarna voeg je soorten toe; de laatste uitzetten = weer alles. */}
          {CATS.map(k => { const on = !f.hide.includes(k), all = !f.hide.length; return <button key={k} className={`catchip c-${k}`} aria-pressed={on} onClick={() => c.setF({ hide: all ? CATS.filter(x => x !== k) : on ? (f.hide.length === CATS.length - 1 ? [] : [...f.hide, k]) : f.hide.filter(x => x !== k) })}><span className="tile"><Ic n={CAT[k][2]} /></span>{CAT[k][1]}</button>; })}
          {f.hide.length > 0 && <button className="chip" onClick={() => c.setF({ hide: [] })}>Alle soorten</button>}</div>}</div>}
    </div>
    <div className="lv-notes">
      {!c.online && <Banner icon="wifi-off"><b>Je bent offline.</b> Je ziet de gegevens van {c.dataFrom ? dShort(isoDay(new Date(c.dataFrom))) : 'je laatste bezoek'}. Afgelastingen van daarna zie je pas weer met verbinding.</Banner>}
      {isHoliday(day) && <Banner kind="warn" icon="cal"><b>{isToday ? 'Het is een feestdag.' : `${cap(DAYS_LONG[dayStart(day).getDay()])} is een feestdag.`}</b> Kringlopen hebben dan vaak andere tijden. Bel even voordat je gaat.</Banner>}
      {c.locDenied && !c.me ? <Banner icon="pin"><b>Je locatie staat uit.</b> Geen probleem: <button className="link" onClick={c.openWaar}>kies een plaats</button>. Wil je hem toch aanzetten, dan kan dat in de instellingen van je browser.</Banner>
        : !c.me && !c.spot && !c.locating && !f.q && <Banner icon="pin"><b>We tonen nu Amersfoort.</b> <button className="link" onClick={() => c.locate()}>Gebruik mijn locatie</button> of <button className="link" onClick={c.openWaar}>kies een plaats</button>.</Banner>}
      {noMarket && list.length > 0 && <Banner icon="cal"><b>Geen markten {dayTxt} in de buurt.</b> Hieronder de eerstvolgende.</Banner>}
      {inView && list.length > 0 && <p className="lv-loc" aria-live="polite"><Ic n="search" />{list.length === 1 ? '1 plek' : `${list.length} plekken`} in beeld op de kaart</p>}
    </div>
    <div className="rows-wrap" ref={flip as unknown as React.Ref<HTMLDivElement>}>
      {list.length ? secs.map(s => <section key={s.g} aria-labelledby={`sec-${s.g}`}>
        <h3 className="sec" id={`sec-${s.g}`}><span>{SEC[s.g](c.live, day, c.min)}</span><span className="tnum">{s.rows.length}</span></h3>
        <ul className="rows">{(fold(s.g) ? s.rows.slice(0, 3) : s.rows).map(x => <Row key={x.it.id} it={x.it} d={x.d} c={c} />)}</ul>
        {fold(s.g) && s.rows.length > 3 && <button className="fold" onClick={() => setAll([...all, s.g])}>Nog {s.rows.length - 3} {s.g === 'unknown' ? 'zonder bekende tijden' : 'die dan dicht zijn'}<Ic n="chevd" /></button>}</section>)
        : inView ? <div className="empty"><h3>{noMarket ? `Geen markten ${dayTxt} op dit stuk van de kaart` : 'Niets op dit stuk van de kaart'}</h3><p>{!f.open && !f.hide.length && !f.gratis && !f.overdekt ? 'Verschuif de kaart of zoom uit.' : 'Verschuif de kaart, zoom uit, of zet een filter uit.'}</p>
          <div className="btns"><button className="btn sm primary" onClick={inView.nearest}>Toon de dichtstbijzijnde</button>{f.open && <button className="btn sm" onClick={() => c.setF({ open: false })}>Toon ook wat dicht is</button>}</div></div>
        : <div className="empty"><h3>{f.q ? `Niets gevonden voor “${f.q}”` : 'Geen resultaten met deze filters'}</h3><p>{f.q ? 'Zoek op de naam van een winkel of markt. Een plaats kies je bovenaan.' : 'Zet een filter uit.'}</p>
          <div className="btns">{f.q && <button className="btn sm" onClick={() => c.setF({ q: '' })}>Wis zoekopdracht</button>}{f.q && <button className="btn sm" onClick={c.openWaar}>Kies een plaats</button>}<button className="btn sm primary" onClick={() => c.setF({ open: false, gratis: false, overdekt: false, hide: [], only: null, q: '' })}>Toon alles</button></div>
          {f.q && <p className="src"><Ic n="info" /><span>Mis je een kringloop of markt? <a href="mailto:info@freekvanderhorst.com?subject=Plek%20voor%20Snuffelkaart">Mail hem door</a>, dan zetten we hem erop.</span></p>}</div>}
      {total > limit && <button className="more" onClick={more}>Toon meer, iets verder weg</button>}
      <nav className="src seo-nav" aria-label="Kringlopen per plaats"><span>Kringlopen in {BIG.map(([n, s], i) => <span key={s}>{i ? ' · ' : ''}<a href={`/${s}/`}>{n}</a></span>)} · <a href="/plaatsen/">alle plaatsen</a>. <a href="/markten/">Alle rommelmarkten en vlooienmarkten</a>.</span></nav>
      <p className="src" style={{ marginTop: 18 }}><Ic n="info" /><span>{nPlaces} winkels uit © OpenStreetMap-bijdragers en © Overture Maps Foundation, heel Nederland. De winkelgegevens zijn vrij te gebruiken onder de <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL</a> (<a href="/data/places.json">download</a>). Markten uit de eigen agenda van organisatoren; bij elke markt staat welke. <a href="/plaatsen/">Alle plaatsen</a> · <a href="/hoe-we-controleren">Hoe we controleren</a> · <a href="/privacy">Privacy</a> · <a href="/voorwaarden">Voorwaarden</a> · <a href="/colofon">Colofon</a></span></p>
    </div>
  </>);
}

/** Waar en wanneer: plek (je locatie, een plaats of postcode, recent) en moment (nu, of een dag + vertrektijd) op één scherm. */
export function WaarView({ c, count }: { c: Ctx; count: number }) {
  const [q, setQ] = useState(''), spots = useSpots(q), today = isoDay(c.now);
  const pick = (s: Spot) => { c.pickSpot(s); setQ(''); c.back(); }; // kiezen = klaar; de tijd kies je vooraf of via de pil (Freek, 30 okt)
  const setDay = (d: string | null) => c.setWhen(d == null ? null : { day: d, start: c.live ? (d === today ? Math.min(1260, Math.ceil((minutesOf(c.now) + 30) / 30) * 30) : 600) : c.min });
  const step = (n: number) => c.setWhen({ day: c.day, start: Math.max(420, Math.min(1260, c.min + n)) });
  return (<div className="waar">
    <div className="pv-head" data-peek data-drag>
      <div className="dv-top"><button className="back" onClick={c.back}><Ic n="back" />Kaart</button></div>
      <h2>Waar en wanneer?</h2>
    </div>
    <label className="search"><Ic n="search" /><span className="sr">Plaats of postcode</span><input type="search" enterKeyHint="search" placeholder="Plaats of postcode" value={q} onChange={e => setQ(e.target.value)} autoComplete="off"
      onKeyDown={e => { if (e.key === 'Enter' && spots[0]) { e.preventDefault(); pick(spots[0]); } }} /></label>
    <div className="opts">
      <button className="opt" onClick={() => { c.locate(); c.back(); }} aria-pressed={!!c.me}><Ic n="loc" /><span><b>{c.locating ? 'Locatie zoeken…' : 'Mijn locatie'}</b><small>blijft op je telefoon</small></span>{c.me && <Ic n="check" />}</button>
      {spots.map(s => <button key={s.label + s.sub} className="opt" onClick={() => pick(s)}><Ic n="pin" /><span><b>{s.label}</b><small>{s.sub}</small></span></button>)}
      {!q && c.recent.map(s => <button key={s.label + s.sub} className="opt" aria-pressed={!c.me && c.originLabel === s.label} onClick={() => pick(s)}><Ic n="clock" /><span><b>{s.label}</b><small>{s.sub || 'recent'}</small></span>{!c.me && c.originLabel === s.label && <Ic n="check" />}</button>)}
    </div>
    <h3 className="sec"><span>Wanneer</span></h3>
    <div className="daystrip" role="group" aria-label="Kies een moment">
      <button className="day" aria-pressed={c.live} onClick={() => setDay(null)}><span>nu</span><b className="tnum">{hm(minutesOf(c.now))}</b></button>
      {Array.from({ length: 14 }, (_, i) => { const iso = addDays(today, i), d = dayStart(iso); return (
        <button key={iso} className="day" aria-pressed={!c.live && c.day === iso} onClick={() => setDay(iso)} aria-label={dLong(iso) + (isHoliday(iso) ? ', feestdag' : '')}><span>{i === 0 ? 'vand.' : DAYS[d.getDay()]}</span><b className="tnum">{d.getDate()}</b><i className={`mk${isHoliday(iso) ? '' : ' none'}`} /></button>); })}
    </div>
    {!c.live && <div className="stepper"><span>Vertrek</span><button className="ibtn" onClick={() => step(-30)} aria-label="Een half uur eerder" disabled={c.min <= 420}><Ic n="minus" /></button><b className="tnum" aria-live="polite">{hm(c.min)}</b><button className="ibtn" onClick={() => step(30)} aria-label="Een half uur later" disabled={c.min >= 1260}><Ic n="plus" /></button></div>}
    <button className="btn primary block" onClick={c.back}>{count ? (c.live ? 'Toon wat er nu open is' : `Toon wat open is ${c.day === today ? 'vandaag' : `op ${dShort(c.day).toLowerCase()}`} om ${hm(c.min)}`) : 'Toon de kaart'}</button>
  </div>);
}

const webUrl = (w: string) => (w.startsWith('http') ? w : `https://${w}`);
const osmUrl = (id: string) => { const m = /^osm-([nwr])(\d+)$/.exec(id); return m ? `https://www.openstreetmap.org/${{ n: 'node', w: 'way', r: 'relation' }[m[1] as 'n' | 'w' | 'r']}/${m[2]}` : null; };
const monthsAgo = (iso: string, now: Date) => (now.getTime() - new Date(iso).getTime()) / (30.4 * 864e5);

export function DetailView({ it, c, backLabel }: { it: Item; c: Ctx; backLabel: string }) {
  const inPlan = c.planStops.includes(it.id), fav = c.favs.includes(it.id), d = km(c.origin, it);
  const top = <div className="dv-top"><button className="back" onClick={c.back}><Ic n="back" />{backLabel}</button>
    <span className="dv-icons"><button className="ibtn" aria-pressed={fav} onClick={e => { if (!fav) pop(e.currentTarget); c.toggleFav(it.id); }} aria-label={fav ? 'Niet meer bewaren' : 'Bewaar'}><Ic n="heart" /></button>
      <button className="ibtn" onClick={() => c.share(it)} aria-label={`Deel ${it.name}`}><Ic n="share" /></button></span></div>;
  // Route is wat je op de stoep het meest wilt: voorop, vanaf je gekozen plek, in de kaart-app van je telefoon (UX-review 29 okt).
  const route = routeUrl(IOS ? 'apple' : 'google', c.me ?? c.origin, [it]);
  const actions = (cancel: boolean, unconf: boolean) => (
    <div className="actions">
      <a className="btn primary" href={route} target="_blank" rel="noopener"><Ic n="route" />Route{IOS ? ' in Kaarten' : ' in Google Maps'}</a>
      <button className="btn" aria-pressed={inPlan} disabled={cancel} onClick={() => c.toggleStop(it.id)}>
        {cancel ? 'Afgelast' : <><Ic n={inPlan ? 'check' : 'plus'} />{inPlan ? 'In mijn dag' : unconf ? 'Toch in mijn dag' : 'Mijn dag'}</>}</button>
    </div>);
  if (it.t === 'k') return <PlaceDetail p={it} c={c} top={top} d={d} actions={actions(false, !it.h)} />;
  return <MarketDetail m={it} c={c} top={top} d={d} actions={actions(it.status === 'cancel', it.status === 'unconf')} />;
}

function PlaceDetail({ p, c, top, d, actions }: { p: Place; c: Ctx; top: ReactElement; d: number; actions: ReactElement }) {
  const now = c.st(p), w = week(p, c.day, true), osm = osmUrl(p.id), today = c.day;
  const stale = p.checked && monthsAgo(p.checked, c.now) > 4;
  return (<article data-item={p.id}>
    <header className="dv-head" data-peek data-drag>{top}
      <p className="eyebrow"><Tile it={p} small />{kindLabel(p)}</p>
      <h2>{p.name}</h2>
      <p className="dv-status"><St s={now} pulse={c.live} />{d >= 0.05 && <><span className="ds">·</span><span className="tnum">{fkm(d)} km</span></>}{p.place && <><span className="ds">·</span><span>{p.place}</span></>}</p>
      {actions}
    </header>
    <PhotoStrip photos={c.bij.extra.photos[p.id] ?? []} />
    {p.kind === 'tweedehands' && <Banner icon="info"><b>Geen standaard kringloop.</b> {p.sub ? `${kindLabel(p)}: ` : ''}tweedehands, maar prijzen en aanbod kunnen anders zijn dan bij een kringloop.</Banner>}
    {w ? <section className="dv-sec"><h3>Openingstijden</h3>
      <dl className="hours">{w.map(x => <div key={x.iso} style={{ display: 'contents' }}><dt className={x.iso === today ? 'today' : ''}>{x.label}</dt><dd className={`${x.iso === today ? 'today' : ''}${x.txt.startsWith('Dicht') ? ' shut' : ''}`}>{x.txt}</dd></div>)}</dl>
      <p className={`src${stale ? ' stale' : ''}`}><Ic n={stale ? 'alert' : 'clock'} /><span>{p.checked ? (stale ? `Laatst gecontroleerd op ${p.checked}, dat is al even geleden. Bel even voordat je gaat.` : `${p.hs === 'web' ? 'Gelezen op' : p.hs === 'bezoeker' ? 'Gezien op' : 'Laatst gecontroleerd op'} ${p.checked}`) : 'Controledatum onbekend'} · {p.hs === 'bezoeker' ? `doorgegeven door ${p.hb}, gecontroleerd door ons` : p.hs === 'web' ? <>van <a href={p.hu} target="_blank" rel="noopener">de website van de winkel</a></> : `bron: ${p.src === 'osm' ? 'OpenStreetMap' : 'Overture Maps'}`}<br />Rond feestdagen kunnen tijden afwijken.</span></p></section>
      : <section className="dv-sec"><h3>Openingstijden</h3><div className="unknown-box"><p><b>We weten de openingstijden nog niet.</b> {p.src === 'osm' ? 'Deze winkel staat op OpenStreetMap, maar zonder tijden.' : 'Deze winkel komt uit Overture Maps en is nog niet door ons gecontroleerd. Misschien bestaat hij niet meer.'} Bel even of kijk op de website voordat je gaat.</p>
        <div className="btns">{p.phone && <a className="btn sm" href={`tel:${p.phone.split(';')[0].replace(/\s/g, '')}`}><Ic n="phone" />{p.phone.split(';')[0].trim()}</a>}{!p.phone && p.website && <a className="btn sm" href={webUrl(p.website)} target="_blank" rel="noopener"><Ic n="globe" />Website</a>}<button className="btn sm primary" onClick={() => c.bij.go('suggest', p.id)}><Ic n="edit" />Ik weet de tijden</button></div></div>
        <p className="src"><Ic n="info" /><span>In “Nu open” tonen we deze winkel niet, omdat we dat niet kunnen beloven.</span></p></section>}
    <section className="dv-sec">
      {p.addr && <div className="inforow"><Ic n="pin" /><span>{p.addr}</span></div>}
      {p.phone && <div className="inforow"><Ic n="phone" /><span className="tnum phones">{p.phone.split(/\s*;\s*/).map(t => <a key={t} href={`tel:${t.replace(/\s/g, '')}`}>{t}</a>)}</span></div>}
      {p.website && <div className="inforow"><Ic n="globe" /><a href={webUrl(p.website)} target="_blank" rel="noopener">{p.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></div>}
    </section>
    <ReviewsSection p={p} b={c.bij} />
    <footer className="dv-foot"><Report id={p.id} what={SHOP_WHAT} suggest={() => c.bij.go('suggest', p.id)} />
      {osm ? <a className="report-btn" href={osm} target="_blank" rel="noopener"><Ic n="edit" />Zelf aanpassen op OpenStreetMap</a>
      : <><p className="src"><Ic n="info" /><span>Bron: © Overture Maps Foundation (CDLA Permissive 2.0). Nog niet gecontroleerd.</span></p>
        <a className="report-btn" href={`https://www.openstreetmap.org/edit#map=19/${p.lat}/${p.lon}`} target="_blank" rel="noopener"><Ic n="edit" />Ken je deze winkel? Zet hem op OpenStreetMap</a></>}</footer>
  </article>);
}

const SHOP_WHAT: [string, string][] = [['dicht', 'Was dicht of bestaat niet meer'], ['tijden', 'Andere openingstijden'], ['plek', 'Verkeerde plek of adres'], ['anders', 'Iets anders']];
const MARKET_WHAT: [string, string][] = [['afgelast', 'Gaat niet door'], ['tijden', 'Andere datum of tijden'], ['plek', 'Verkeerde plek'], ['anders', 'Iets anders']];

/** Eerdere meldingen, alleen op dit apparaat (de melding zelf is anoniem): { id: [datum, wat] }. */
const SENT = 'snuffel-meldingen';
const sentAll = (): Record<string, [string, string]> => { try { return JSON.parse(localStorage.getItem(SENT) ?? '{}'); } catch { return {}; } };

/** "Klopt er iets niet?": melding zonder account, komt in /beheer (rpc report; zie migratie meldingen).
 *  Al eens gemeld: dat zie je hier, zodat je niet twee keer meldt (UX-test 30 okt). suggest: winkel met de tijden-editor. */
function Report({ id, what, suggest }: { id: string; what: [string, string][]; suggest?: () => void }) {
  const [open, setOpen] = useState(false), [w, setW] = useState(''), [note, setNote] = useState(''), [state, setState] = useState<'' | 'busy' | 'done' | string>('');
  const [sent, setSent] = useState(() => sentAll()[id]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setState('busy');
    try {
      const r = await fetch(`${SB}/rest/v1/rpc/report`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: id, what: w, note: note.trim() || null }) });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? '');
      const at = isoDay(new Date()), all = sentAll(); all[id] = [at, w];
      try { localStorage.setItem(SENT, JSON.stringify(all)); } catch { /* privémodus */ }
      setSent([at, w]); setState('done');
    } catch (x) { setState(x instanceof TypeError || !(x as Error).message ? 'Versturen lukte niet: geen verbinding. Probeer het straks nog eens.' : `Versturen lukte niet: ${(x as Error).message}`); }
  };
  if (state === 'done') return <p className="src"><Ic n="check" /><span><b>Bedankt!</b> We kijken ernaar; een correctie staat meestal binnen een dag op de kaart.</span></p>;
  const tijden = suggest && <button className="report-btn" onClick={suggest}><Ic n="edit" />Openingstijden aanpassen</button>;
  if (!open) return <>{sent && <p className="src"><Ic n="check" /><span>Je meldde hier op {dShort(sent[0]).toLowerCase()}: {(what.find(x => x[0] === sent[1])?.[1] ?? 'iets anders').toLowerCase()}. We kijken ernaar.</span></p>}
    <button className="report-btn" onClick={() => setOpen(true)}><Ic n="flag" />{sent ? 'Nog iets melden' : 'Klopt er iets niet?'}</button>{tijden}</>;
  return (<form className="login-card report" onSubmit={send}>
    <b>Wat klopt er niet?</b>
    <div className="btns" role="group" aria-label="Wat klopt er niet?">{what.map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={w === k} onClick={() => setW(k)}>{l}</button>)}</div>
    {w === 'tijden' && suggest && <p className="src"><Ic n="info" /><span>Weet je de juiste tijden? <button type="button" className="link" onClick={suggest}>Vul ze zelf in</button>, dan staan ze er sneller op en met jouw naam erbij.</span></p>}
    <textarea className="textarea" maxLength={500} placeholder="Wat weet je? Bijv. de nieuwe tijden of waar je het zag (mag leeg)" value={note} onChange={e => setNote(e.target.value)} aria-label="Toelichting" />
    <p className="src"><Ic n="info" /><span>Anoniem, ook als je bent ingelogd: we bewaren alleen je melding, niet wie je bent.</span></p>
    {state && state !== 'busy' && <p role="alert" style={{ color: 'var(--bad-ink)', fontSize: '.875rem' }}>{state}</p>}
    <div className="btns"><button className="btn primary sm" disabled={!w || state === 'busy' || !SB}>Versturen</button><button type="button" className="btn sm" onClick={() => setOpen(false)}>Annuleren</button></div>
  </form>);
}

function MarketDetail({ m, c, top, d, actions }: { m: Market; c: Ctx; top: ReactElement; d: number; actions: ReactElement }) {
  const s = m.status, k = spotKey(m), more = c.markets.filter(x => x.id !== m.id && spotKey(x) === k).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const box = s === 'org' ? <div className="statusbox org"><Ic n="check" /><div><b>Bevestigd door de organisator</b><p>{m.org} heeft deze datum zelf opgegeven.</p></div></div>
    : s === 'chk' ? <div className="statusbox chk"><Ic n="check" /><div><b>Gecontroleerd op {m.checked && dDay(m.checked)}</b><p>Deze editie stond bij de laatste controle op de website van {m.org}.</p></div></div>
    : s === 'unconf' ? <div className="statusbox unconf"><Ic n="alert" /><div><b>Nog niet bevestigd</b><p>Deze datum is afgeleid uit het schema “{m.schema.toLowerCase()}”. Check het voordat je gaat; we stellen hem niet vanzelf voor in je dagplan.</p></div></div>
    : <div className="statusbox cancel"><Ic n="x" /><div><b>Afgelast</b><p>{m.cancelWhy}</p></div></div>;
  return (<article data-item={m.id}>
    <header className="dv-head" data-peek data-drag>{top}
      <p className="eyebrow"><Tile it={m} small />{m.kind}{m.indoor !== undefined && <> · {m.indoor ? 'binnen' : 'buiten'}</>}{m.sample && <span className="sample">voorbeeld</span>}</p>
      <h2 className={s === 'cancel' ? 'strike' : ''}>{m.name}</h2>
      <p className={`bigdate tnum${s === 'cancel' ? ' strike' : ''}`}>{dLong(m.date)} · {m.timeKnown === false ? 'tijden bij de organisator' : m.end ? `${hm(m.start)}–${hm(m.end)}` : `vanaf ${hm(m.start)}`}</p>
      <p className="dv-status">{d >= 0.05 && <><span className="tnum">{fkm(d)} km</span><span className="ds">·</span></>}<span>{m.venue ? `${m.venue}, ${m.place}` : m.place}</span></p>
      {box}{actions}
    </header>
    {more.length > 0 && <section className="dv-sec"><h3>Ook op deze plek</h3><ul className="more-dates">{more.map(x =>
      <li key={x.id}><button onClick={e => c.open(x.id, e.currentTarget)}><span className={`tnum${x.status === 'cancel' ? ' strike' : ''}`}>{cap(dLong(x.date))}</span><span className="sub">{x.name !== m.name ? `${x.name} · ` : ''}{x.status === 'cancel' ? 'afgelast' : x.timeKnown === false ? 'tijden bij de organisator' : x.end ? `${hm(x.start)}–${hm(x.end)}` : `vanaf ${hm(x.start)}`}</span><Ic n="chev" /></button></li>)}</ul></section>}
    {m.sample && <Banner icon="info">Dit is een <b>verzonnen voorbeeldmarkt</b> om het ontwerp te testen.</Banner>}
    <section className="dv-sec"><h3>Praktisch</h3><dl className="facts">
      <dt>Entree</dt><dd>{m.entree === 'gratis' ? 'Gratis' : m.entree === 'onbekend' ? 'Staat niet in de agenda' : m.entree}</dd>
      {!m.end && <><dt>Eindtijd</dt><dd>Onbekend; de organisator noemt er geen</dd></>}
      <dt>Overdekt</dt><dd>{m.indoor === undefined ? 'Onbekend' : m.indoor ? 'Ja, binnen' : 'Nee, buiten'}</dd>
      {m.addr !== undefined && <><dt>Adres</dt><dd>{m.addr ?? `${m.place}; de precieze plek staat bij de organisator`}</dd></>}
      {m.kraamhuur && <><dt>Kraam huren</dt><dd>{m.kraamhuur}</dd></>}
      {m.area && <><dt>Waar</dt><dd>{m.area}</dd></>}
      {m.kramen && <><dt>Kramen</dt><dd className="tnum">±{m.kramen}</dd></>}
      {m.schema && <><dt>Schema</dt><dd>{m.schema}</dd></>}</dl></section>
    <section className="dv-sec"><h3>Organisator</h3><div className="inforow"><Ic n="user" /><span>{m.org}</span></div>
      {m.url && <div className="inforow"><Ic n="globe" /><a href={m.url} target="_blank" rel="noopener">Bekijk bij {m.org}: ook kraam boeken en doorgaan bij slecht weer</a></div>}
      {m.url && <p className="src"><Ic n="info" /><span>Bron: website van {m.org}, gecontroleerd op {m.checked && dDay(m.checked)}.</span></p>}</section>
    {!m.sample && <footer className="dv-foot"><Report id={m.id} what={MARKET_WHAT} /></footer>}
  </article>);
}

/** from: vertrekpunt van dit plan (de plek waar je keek toen je de eerste stop koos), los van wat je daarna in de lijst bekijkt. */
export type From = LatLon & { label: string; me?: boolean; fallback?: boolean };
export type Plan = { day: string; start: number; stops: string[]; done?: string[]; skip?: string[]; from?: From };
/** Vertrektijd; -1 = "nu" (vandaag: nu, afgerond op 5 min; een andere dag: 10:00). */
export const nowStart = (now: Date) => Math.ceil(minutesOf(now) / 5) * 5;
/** Vandaag ligt het vertrek nooit in het verleden: een gekozen tijd die al voorbij is, wordt "nu". */
export const effStart = (p: { day: string; start: number }, now: Date) => p.day !== isoDay(now) ? (p.start >= 0 ? p.start : 600) : Math.max(p.start, nowStart(now));
const TIMES = Array.from({ length: 29 }, (_, i) => 420 + i * 30); // 7:00 t/m 21:00

/** Het vertrekblok: dag, tijd en vanaf waar. Hoort bij het plan zelf, los van wat je in de lijst bekijkt (DECISIONS 29 okt). */
function Vertrek({ c, plan, setPlan }: { c: Ctx; plan: Plan; setPlan: (p: Partial<Plan>) => void }) {
  const today = isoDay(c.now), start = effStart(plan, c.now), ask = !plan.from && c.here.fallback, [open, setOpen] = useState(false);
  const dayTxt = plan.day === today ? 'Vandaag' : plan.day === addDays(today, 1) ? 'Morgen' : dShort(plan.day);
  if (!open && !ask) return <button className="vertrek vk-kort" onClick={() => setOpen(true)} aria-label="Dag, vertrektijd en vertrekpunt wijzigen">
    <Ic n="clock" /><span><b>{dayTxt} · vertrek {plan.day === today && start === nowStart(c.now) ? `nu (${hm(start)})` : hm(start)}</b><small>vanaf {c.originLabel ?? 'je locatie'} · en terug</small></span><span className="vk-w">Wijzig</span></button>;
  return (<div className="vertrek">
    <DayPick day={plan.day} now={c.now} set={d => setPlan({ day: d, start: d === today ? plan.start : plan.start < 0 ? 600 : plan.start })} label="Welke dag?" />
    <div className="pv-opts"><label>Vertrek<select value={plan.day === today && plan.start < nowStart(c.now) ? -1 : plan.start} onChange={e => setPlan({ start: +e.target.value })}>
      {plan.day === today && <option value={-1}>nu ({hm(nowStart(c.now))})</option>}
      {[...new Set([...TIMES, ...(plan.start >= 0 ? [plan.start] : [])])].filter(m => plan.day !== today || m >= nowStart(c.now)).sort((a, b) => a - b).map(m => <option key={m} value={m}>{hm(m)}</option>)}</select></label>
      {!plan.from && c.here.fallback ? <span className="vk-waar"><b>Waar vertrek je?</b><button className="link" onClick={() => c.locate()}>{c.locating ? 'Locatie zoeken…' : 'Mijn locatie'}</button><button className="link" onClick={c.openWaar}>Kies een plaats</button></span>
        : <><span><Ic n={plan.from?.me ? 'loc' : 'home'} />vanaf {c.originLabel ?? 'je locatie'} · en terug</span>
          {!c.here.fallback && c.here.label !== c.originLabel && <button className="link" onClick={() => setPlan({ from: c.here })}>Vertrek {c.here.me ? 'vanaf je locatie' : `vanuit ${c.here.label}`}</button>}</>}</div>
    {open && <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(false)}><Ic n="check" />Klaar</button>}
  </div>);
}

export function PlanView({ c, items, plan, setPlan, optimizeSeen, onderweg, share }: { c: Ctx; items: Item[]; plan: Plan; setPlan: (p: Partial<Plan>) => void; optimizeSeen: boolean; onderweg: () => void; share: () => void }) {
  const byId = new Map(items.map(i => [i.id, i])), stops = plan.stops.map(id => byId.get(id)).filter(Boolean) as Item[], start = effStart(plan, c.now);
  const sim = simulate(stops, plan.day, start, c.origin), dayName = DAYS_LONG[dayStart(plan.day).getDay()];
  const [more, setMore] = useState(false);
  const best = useMemo(() => stops.length < 2 ? stops : bestOrder(stops, plan.day, start, c.origin), [plan.stops.join(), plan.day, start, c.origin.lat, c.origin.lon]);
  const isBest = best.map(x => x.id).join() === stops.map(x => x.id).join();
  const stt = sim.bad ? { c: 'bad', i: 'alert', t: `${sim.bad === 1 ? '1 stop klopt' : `${sim.bad} stops kloppen`} niet op ${dayName}.`, x: optimizeSeen ? 'Vervang de stop of haal hem weg.' : 'Probeer Slimste volgorde, of vervang de stop.' }
    : sim.warn ? { c: 'warn', i: 'info', t: `${sim.warn === 1 ? '1 aandachtspunt' : `${sim.warn} aandachtspunten`}.`, x: 'Staat hieronder bij de stop.' } : { c: 'ok', i: 'check', t: 'Alles open en bevestigd.', x: 'Je kunt gaan.' };
  // ponytail: alleen wachten bij de eerste stop lossen we op met de vertrektijd; wachten verderop lost Slimste volgorde op.
  const later = sim.stops[0]?.wait > 45 ? start + Math.floor((sim.stops[0].wait - 10) / 15) * 15 : 0;
  const openThen = (i: Item) => i.t === 'k' ? openOn(i, plan.day) : i.date === plan.day && (i.status === 'org' || i.status === 'chk');
  // Een stop die die dag dicht is: de dichtstbijzijnde plek die dan wel open is, als vervanger.
  const swap = (it: Item) => items.filter(i => !plan.stops.includes(i.id) && i.t === it.t && openThen(i) && km(it, i) < 10).sort((a, b) => km(it, a) - km(it, b))[0];
  const move = (i: number, d: number) => { const s = [...plan.stops], [x] = s.splice(i, 1); s.splice(i + d, 0, x); setPlan({ stops: s }); };
  const sugg = items.filter(i => !plan.stops.includes(i.id) && openThen(i))
    .map(i => ({ it: i, d: stops.length ? Math.min(...stops.map(s => km(s, i))) : km(c.origin, i) })).sort((a, b) => a.d - b.d).slice(0, 3);
  const head = (
    <div className="pv-head" data-peek data-drag>
      <div className="pv-title"><h2>Mijn {dayName}</h2>{stops.length > 0 && <button className="btn sm" onClick={share}><Ic n="share" />Deel</button>}</div>
      <Vertrek c={c} plan={plan} setPlan={setPlan} />
      {later > 0 && <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setPlan({ start: later })}><Ic n="clock" />Vertrek om {hm(later)}, dan hoef je bij de eerste stop niet {sim.stops[0].wait} min te wachten</button>}
    </div>);
  if (!stops.length) return <>{head}<div className="empty"><h3>Nog geen stops</h3><p>Tik op <b>+</b> bij een kringloop of markt. We rekenen uit wanneer je waar bent, en of het dan open is.</p>
    <div className="btns"><button className="btn sm primary" onClick={c.openDag}><Ic n="wand" />Maak een dag voor me</button><button className="btn sm" onClick={() => { c.setWhen({ day: plan.day, start }); c.back(); }}>Wat is er open op {dayName}?</button></div></div></>;
  return (<>{head}
    <div className="rc-wrap"><div className="receipt print" aria-label="Je dagplan als bon">
      <p className="rc-shop"><Ic n="tag" />SNUFFELKAART</p>
      <p className="rc-sub">{dShort(plan.day)} · vertrek {hm(start)} · {c.originLabel ?? 'je locatie'}</p>
      <p className={`rc-status ${stt.c}`}><Ic n={stt.i} /><span><b>{stt.t}</b> {stt.x}</span></p>
      <hr className="rc-rule" />
      <ol className="rc-list">{sim.stops.map((x, i) => { const it = byId.get(x.id)!, alt = x.issue?.lv === 'bad' ? swap(it) : undefined; return [
        <li key={`l${x.id}`} className="leg" aria-hidden="true">↓ ±{x.drive} min · {fkm(x.km)} km</li>,
        <li key={x.id} className={`rc-stop${x.issue?.lv === 'bad' ? ' bad' : ''}`}><span className="rc-n">{i + 1}</span><span className="rc-t">{x.issue?.lv === 'bad' ? '--:--' : hm(x.arrive)}</span>
          <div className="rc-m"><button className="st-name" onClick={() => c.open(it.id)}>{it.name}</button>{x.note && <span className="rc-note">{x.note}</span>}
            {x.issue && <p className={`issue ${x.issue.lv}`}><Ic n={x.issue.lv === 'bad' ? 'x' : 'alert'} /><span>{x.issue.txt}</span></p>}
            {x.issue?.lv === 'bad' && <span className="rc-fix">{alt && <button className="btn sm primary" onClick={() => setPlan({ stops: plan.stops.map(id => id === it.id ? alt.id : id) })}>Vervang door {alt.name}</button>}<button className="btn sm" onClick={() => c.toggleStop(it.id)}>Haal weg</button></span>}</div>
          <span className="rc-mv"><button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${it.name} eerder`}><Ic n="chevu" /></button><button onClick={() => move(i, 1)} disabled={i === stops.length - 1} aria-label={`${it.name} later`}><Ic n="chevd" /></button>
            {x.issue?.lv !== 'bad' && <button onClick={() => c.toggleStop(it.id)} aria-label={`Verwijder ${it.name}`}><Ic n="x" /></button>}</span></li>]; })}
        <li className="leg" aria-hidden="true">↓ terug ±{sim.home - sim.end} min</li></ol>
      <hr className="rc-rule" />
      <dl className="rc-tot"><dt>Stops</dt><dd>{stops.length}</dd><dt>Rijden, heen en terug</dt><dd>±{fkm(sim.km)} km</dd><dt>Weg bij de laatste</dt><dd>{hm(sim.end)}</dd><dt className="big">Terug rond</dt><dd className="big">{hm(sim.home)}</dd></dl>
      <div className="rc-bar" aria-hidden="true" /><p className="rc-foot">Fijne {dayName}!</p>
    </div></div>
    <div className="plan-actions">
      <div className="row2 start">{plan.day === isoDay(c.now) ? <button className="btn primary" onClick={onderweg}><Ic n="play" />{plan.done?.length || plan.skip?.length ? 'Verder met mijn dag' : 'Start mijn dag'}</button> : <p className="src start-later"><Ic n="cal" /><span>Op {dayName} start je hier je dag; dan lopen we met je mee.</span></p>}
        <button className="btn" aria-expanded={more} onClick={() => setMore(!more)}>Meer<Ic n={more ? 'chevu' : 'chevd'} /></button></div>
      {!isBest && !more && <button className="btn" onClick={() => setPlan({ stops: best.map(x => x.id) })}><Ic n="wand" />Slimste volgorde</button>}
      {more && <div className="more-acts">
        <button className="btn" disabled={isBest} onClick={() => setPlan({ stops: best.map(x => x.id) })}><Ic n={isBest ? 'check' : 'wand'} />{isBest ? 'Dit is al de slimste volgorde' : 'Slimste volgorde'}</button>
        <button className="btn" onClick={c.openDag}><Ic n="wand" />Ander voorstel</button>
        <a className="btn" href={routeUrl(IOS ? 'apple' : 'google', c.me ?? c.origin, stops)} target="_blank" rel="noopener"><Ic n="ext" />Hele route in {IOS ? 'Apple Kaarten' : 'Google Maps'}</a>
        <a className="btn" href={routeUrl(IOS ? 'google' : 'apple', c.me ?? c.origin, stops)} target="_blank" rel="noopener"><Ic n="ext" />In {IOS ? 'Google Maps' : 'Apple Kaarten'}</a></div>}
    </div>
    {c.install && stops.length > 0 && <div className="install"><span className="brand-mark"><Ic n="tag" /></span><div><b>Zet Snuffelkaart op je beginscherm</b><p>Dan open je dit bonnetje ook zonder bereik, bijvoorbeeld in een sporthal.</p>
      <div className="btns"><button className="btn sm primary" onClick={c.install.add}>Toevoegen</button><button className="btn sm ghost" onClick={c.install.no}>Niet nu</button></div></div></div>}
    {sugg.length > 0 && stops.length < 8 && <details className="sugg"><summary><h3>Past ook in je {dayName}</h3><span className="sub">{sugg.length} open of bevestigd, vlak bij je route</span><Ic n="chevd" /></summary><ul className="rows">{sugg.map(x => <Row key={x.it.id} it={x.it} d={km(c.origin, x.it)} c={c} />)}</ul></details>}
  </>);
}

/** Op de dag zelf: steeds de volgende stop, navigeren per stop, en na een bezoek één vraag over de tijden. */
export function OnderwegView({ c, items, plan, setPlan, done }: { c: Ctx; items: Item[]; plan: Plan; setPlan: (p: Partial<Plan>) => void; done: () => void }) {
  const byId = new Map(items.map(i => [i.id, i])), stops = plan.stops.map(id => byId.get(id)).filter(Boolean) as Item[];
  const gone = new Set([...(plan.done ?? []), ...(plan.skip ?? [])]), left = stops.filter(s => !gone.has(s.id)), next = left[0];
  const lastDone = [...stops].reverse().find(s => plan.done?.includes(s.id)), from = c.me ?? lastDone ?? c.origin;
  const today = plan.day === isoDay(c.now), t0 = today ? Math.max(effStart(plan, c.now), minutesOf(c.now)) : effStart(plan, c.now);
  const sim = simulate(left, plan.day, t0, from), s0 = sim.stops[0];
  const [asked, setAsked] = useState<string | null>(null), askIt = asked ? byId.get(asked) : null;
  const here = (it: Item) => { setPlan({ done: [...(plan.done ?? []), it.id] }); if (it.t === 'k' && it.h) setAsked(it.id); };
  return (<div className="onderweg">
    <div className="pv-head" data-peek data-drag>
      <div className="dv-top"><button className="back" onClick={c.back}><Ic n="back" />Mijn {DAYS_LONG[dayStart(plan.day).getDay()]}</button></div>
      <div className="pv-title"><h2>Onderweg</h2><span className="ow-n tnum">{stops.length - left.length} van {stops.length}{next && ` · terug rond ${hm(sim.home)}`}</span></div>
      <div className="ow-bar" aria-hidden="true">{stops.map(s => <i key={s.id} className={plan.done?.includes(s.id) ? 'ja' : plan.skip?.includes(s.id) ? 'nee' : s === next ? 'nu' : ''} />)}</div>
    </div>
    {next && s0 ? <section className="ow-next" aria-labelledby="ow-h">
      <span className="label">Volgende · ±{s0.drive} min · {fkm(s0.km)} km</span>
      <h3 id="ow-h">{next.name}</h3>
      <St s={s0.issue ? { cls: s0.issue.lv === 'bad' ? 'closed' : 'warn', txt: s0.issue.txt } : { cls: 'open', txt: `Aankomst ±${hm(s0.arrive)}${s0.note ? ` · ${s0.note}` : ''}`, open: true }} />
      <a className="btn primary block" href={routeUrl(IOS ? 'apple' : 'google', c.me, [next])} target="_blank" rel="noopener"><Ic n="route" />Navigeer erheen</a>
      <div className="row2"><button className="btn" onClick={() => here(next)}><Ic n="check" />Hier ben ik</button><button className="btn" onClick={() => setPlan({ skip: [...(plan.skip ?? []), next.id] })}>Overslaan</button></div>
    </section> : <div className="success"><span className="ok-ic"><Ic n="check" /></span><h3>Klaar!</h3><p>Je hebt al je stops gehad. Fijne vondsten.</p><button className="btn primary" onClick={done}>Afsluiten</button></div>}
    {askIt && <section className="ow-ask" aria-labelledby="ow-ask"><h3 id="ow-ask">Je was bij {askIt.name}</h3><p>Klopten de openingstijden? Zo niet, help de volgende snuffelaar en geef ze door.</p>
      <div className="btns"><button className="btn sm primary" onClick={() => c.bij.go('suggest', askIt.id)}><Ic n="edit" />Tijden doorgeven</button><button className="btn sm" onClick={() => setAsked(null)}>Ze klopten</button></div></section>}
    <ol className="ow-list">{stops.map((s, i) => { const st = plan.done?.includes(s.id) ? 'geweest' : plan.skip?.includes(s.id) ? 'overgeslagen' : null, k = left.indexOf(s); return (
      <li key={s.id} className={st ? 'gone' : ''}><span className="ow-i tnum">{i + 1}</span><button className="st-name" onClick={() => c.open(s.id)}>{s.name}</button><span className="tnum">{st ?? (sim.stops[k] ? `±${hm(sim.stops[k].arrive)}` : '')}</span></li>); })}</ol>
    {next && <p className="src"><Ic n="info" /><span>Tijden rekenen vanaf {c.me ? 'waar je nu bent' : lastDone ? `${lastDone.name}` : 'je vertrekpunt'} en het huidige tijdstip.</span></p>}
  </div>);
}

/** Een gedeeld rondje (link ?dag=&v=&s=): de stops met hun status van nu, en overnemen als je eigen dag. */
export function GedeeldView({ c, items, shared, plan, take }: { c: Ctx; items: Item[]; shared: { day: string; start: number; stops: string[] }; plan: Plan; take: () => void }) {
  const byId = new Map(items.map(i => [i.id, i])), stops = shared.stops.map(id => byId.get(id)).filter(Boolean) as Item[], [sure, setSure] = useState(false);
  const sim = simulate(stops, shared.day, shared.start, c.origin), dayName = DAYS_LONG[dayStart(shared.day).getDay()], missing = shared.stops.length - stops.length;
  return (<>
    <div className="pv-head" data-peek data-drag>
      <div className="dv-top"><button className="back" onClick={c.back}><Ic n="back" />Kaart</button></div>
      <h2>Iemand stuurde je een {dayName}</h2><p className="prose-s">{dLong(shared.day)} · vertrek {hm(shared.start)} · {stops.length} {stops.length === 1 ? 'stop' : 'stops'}</p>
    </div>
    <div className="rc-wrap"><div className="receipt" aria-label="Gedeeld rondje als bon">
      <ol className="rc-list">{sim.stops.map((x, i) => { const it = stops[i]; return (
        <li key={x.id} className={`rc-stop${x.issue?.lv === 'bad' ? ' bad' : ''}`}><span className="rc-n">{i + 1}</span><span className="rc-t">{hm(x.arrive)}</span>
          <div className="rc-m"><button className="st-name" onClick={() => c.open(it.id)}>{it.name}</button>{x.issue ? <p className={`issue ${x.issue.lv}`}><Ic n={x.issue.lv === 'bad' ? 'x' : 'alert'} /><span>{x.issue.txt}</span></p> : x.note && <span className="rc-note">{x.note}</span>}</div></li>); })}</ol>
      <hr className="rc-rule" /><dl className="rc-tot"><dt className="big">Terug rond</dt><dd className="big">{hm(sim.home)}</dd></dl>
    </div></div>
    {(sim.bad > 0 || missing > 0) && <Banner kind="warn" icon="alert">{sim.bad > 0 && <><b>{sim.bad === 1 ? '1 stop gaat' : `${sim.bad} stops gaan`} niet door</b> zoals het nu staat. </>}{missing > 0 && `${missing} ${missing === 1 ? 'plek staat' : 'plekken staan'} niet meer op de kaart.`}</Banner>}
    <div className="plan-actions">
      {sure ? <div className="unknown-box"><p><b>Je eigen dagplan vervangen?</b> Er {plan.stops.length === 1 ? 'staat 1 stop' : `staan ${plan.stops.length} stops`} in.</p><div className="btns"><button className="btn sm primary" onClick={take}>Ja, vervangen</button><button className="btn sm" onClick={() => setSure(false)}>Toch niet</button></div></div>
        : <button className="btn primary" disabled={!stops.length} onClick={() => plan.stops.length ? setSure(true) : take()}><Ic n="check" />Neem over als mijn {dayName}</button>}
    </div>
    <p className="src"><Ic n="info" /><span>Geen account nodig: het rondje zit in de link. De tijden rekenen vanaf {c.me ? 'je locatie' : c.originLabel ?? 'Amersfoort'}; de status is die van nu.</span></p>
  </>);
}

/** "Maak een dag voor me": een voorstel als bonnetje voor de gekozen dag. Je huidige dagplan blijft staan tot je bevestigt. */
export function DagView({ c, items, plan, setPlan }: { c: Ctx; items: Item[]; plan: Plan; setPlan: (p: Partial<Plan>) => void }) {
  const [k, setK] = useState(0), [sure, setSure] = useState(false), [day, setDay] = useState(plan.day), where = c.originLabel ?? 'de buurt', dayName = DAYS_LONG[dayStart(day).getDay()];
  const start = effStart({ day, start: day === plan.day ? plan.start : -1 }, c.now);
  const props = useMemo(() => dayProposals(items, day, start, c.origin, 4, 20, c.f.hide), [items, day, start, c.origin, c.f.hide]);
  const stops = props.length ? props[k % props.length] : [], sim = simulate(stops, day, start, c.origin);
  const take = () => { setPlan({ day, stops: stops.map(x => x.id), done: [], skip: [] }); c.openPlan(); };
  return (<>
    <div className="pv-head" data-peek data-drag>
      <div className="dv-top"><button className="back" onClick={c.back}><Ic n="back" />Terug</button></div>
      <h2 className="dag-h">Een dag in {where}</h2>
      <DayPick day={day} now={c.now} set={d => { setDay(d); setK(0); }} label="Welke dag?" />
    </div>
    {stops.length ? <>
      <p className="prose-s">{stops.length === 1 ? 'Eén plek' : `${cap(['', '', 'twee', 'drie', 'vier'][stops.length])} plekken`} die op {dLong(day).toLowerCase()} open {stops.length === 1 ? 'is' : 'zijn'}, dicht bij elkaar en in de slimste volgorde.</p>
      <div className="rc-wrap"><div className="receipt print" key={stops.map(x => x.id).join()} aria-label="Voorstel als bon">
        <p className="rc-shop"><Ic n="tag" />SNUFFELKAART · VOORSTEL</p>
        <p className="rc-sub">{dShort(day)} · vertrek {hm(start)} · {where}</p>
        <hr className="rc-rule" />
        <ol className="rc-list">{sim.stops.map((x, i) => { const it = stops[i]; return [
          <li key={`l${x.id}`} className="leg" aria-hidden="true">↓ ±{x.drive} min · {fkm(x.km)} km</li>,
          <li key={x.id} className="rc-stop"><span className="rc-n">{i + 1}</span><span className="rc-t">{hm(x.arrive)}</span>
            <div className="rc-m"><button className="st-name" onClick={() => c.open(it.id)}>{it.name}</button>{x.note && <span className="rc-note">{x.note}</span>}
              {x.issue && <p className={`issue ${x.issue.lv}`}><Ic n="alert" /><span>{x.issue.txt}</span></p>}</div></li>]; })}</ol>
        <hr className="rc-rule" />
        <dl className="rc-tot"><dt>Rijden, heen en terug</dt><dd>±{fkm(sim.km)} km</dd><dt className="big">Klaar rond</dt><dd className="big">{hm(sim.end)}</dd></dl>
      </div></div>
      <div className="plan-actions">
        {sure ? <div className="unknown-box"><p><b>Je dagplan vervangen?</b> Er {plan.stops.length === 1 ? 'staat 1 stop' : `staan ${plan.stops.length} stops`} in. Die gaan eruit.</p>
          <div className="btns"><button className="btn sm primary" onClick={take}>Ja, vervangen</button><button className="btn sm" onClick={() => setSure(false)}>Toch niet</button></div></div>
          : <button className="btn primary" onClick={() => plan.stops.length && plan.stops.join() !== stops.map(x => x.id).join() ? setSure(true) : take()}><Ic n="check" />Zet in mijn dagplan</button>}
        {props.length > 1 && <button className="btn" onClick={() => { setK(k + 1); setSure(false); }}><Ic n="wand" />Ander voorstel <span className="tnum" style={{ color: 'var(--fg-3)', fontWeight: 500 }}>{k % props.length + 1}/{props.length}</span></button>}
      </div>
      <p className="src"><Ic n="info" /><span>We kiezen alleen kringlopen, vintage, antiek, brocante en markten waarvan we de tijden weten of die bevestigd zijn. Sloop en opkoop stellen we niet voor. Je huidige dagplan blijft staan tot je op “Zet in mijn dagplan” tikt.</span></p>
    </> : <div className="empty"><h3>Op {dayName} is er rond {where} niets dat zeker open is</h3><p>Kies een andere dag, of kijk in de lijst: van veel winkels weten we de tijden nog niet.</p>
      <div className="btns"><button className="btn sm primary" onClick={c.back}>Terug</button></div></div>}
  </>);
}

const STAMP: Record<string, string> = { review: 'star', foto: 'cam', tijden: 'clock' };
const TILT = [-9, 6, -4, 11, -7, 3, -12, 8, -2, 5];

/** Jij als Snuffelpas: een stempelkaart in het papier van het dagplanbonnetje. Elke bijdrage die online komt is een stempel,
 *  een bijdrage in behandeling een stippellijn. Daaronder bewaard en je dagplan; account en info zakken naar een stille voet. */
export function MeView({ c, items, showFavs, login, logout, download, remove }: { c: Ctx; items: Item[]; showFavs: () => void; login: () => void; logout: () => void; download: () => void; remove: () => Promise<void> }) {
  const byId = new Map(items.map(i => [i.id, i])), favs = c.favs.map(id => byId.get(id)).filter(Boolean) as Item[], n = favs.length, [sure, setSure] = useState(false);
  const [nm, setNm] = useState<string | null>(null), [nmErr, setNmErr] = useState(''), [nmBusy, setNmBusy] = useState(false);
  const mine = c.bij.mine.filter(x => x.status !== 'afgewezen'), done = mine.filter(x => x.status === 'goed').length, wait = mine.length - done;
  // ponytail: tien vakjes; wie er meer heeft ziet de nieuwste tien en een teller
  const slots = Array.from({ length: 10 }, (_, i) => [...mine].reverse()[i] ?? null), over = Math.max(0, mine.length - 10);
  const stops = c.planStops.map(id => byId.get(id)).filter(Boolean) as Item[], dayName = DAYS_LONG[dayStart(c.planDay).getDay()];
  return (<div className="me">
    <section className="pas" aria-labelledby="pas-naam">
      <div className="pas-top"><span className="pas-brand"><Ic n="tag" />SNUFFELPAS</span><span className="pas-mail">{c.user ?? 'op dit apparaat'}</span></div>
      <h2 id="pas-naam" className="pas-name">{c.user ? (c.bij.name ?? 'Snuffelaar') : 'Gast'}</h2>
      {c.user && (nm == null ? <button className="link pas-edit" onClick={() => { setNm(c.bij.name ?? ''); setNmErr(''); }}><Ic n="edit" />{c.bij.name ? 'Schermnaam wijzigen' : 'Kies een schermnaam'}</button>
        : <form className="pas-form" onSubmit={async e => { e.preventDefault(); if (nm.trim() === c.bij.name) return setNm(null); setNmBusy(true); setNmErr(''); try { await c.bij.setName(nm.trim()); setNm(null); } catch (x) { setNmErr(errText(x)); } finally { setNmBusy(false); } }}>
          <NameField value={nm} set={setNm} />
          {c.bij.mine.some(x => x.status === 'goed') && <span className="help">Bij je reviews en foto's die al online staan, verschijnt de nieuwe naam bij de volgende verversing (meestal binnen een dag).</span>}
          {nmErr && <p role="alert" className="issue bad"><Ic n="alert" /><span>{nmErr}</span></p>}
          <div className="btns"><button className="btn sm primary" disabled={nmBusy}>{nmBusy ? 'Opslaan…' : 'Opslaan'}</button><button type="button" className="btn sm" onClick={() => setNm(null)}>Annuleren</button></div></form>)}
      <ol className="stamps" aria-label={`${done} ${done === 1 ? 'stempel' : 'stempels'}${wait ? `, ${wait} in behandeling` : ''}`}>
        {slots.map((x, i) => <li key={x?.id ?? i} className={x ? (x.status === 'goed' ? 'on' : 'wait') : ''} style={{ ['--r' as string]: `${TILT[i]}deg`, ['--d' as string]: `${i * 45}ms` }}
          title={x ? `${WHAT[x.kind]} · ${byId.get(x.item_id)?.name ?? 'winkel'}${x.status === 'nieuw' ? ' (in behandeling)' : ''}` : undefined}>{x && <Ic n={STAMP[x.kind]} />}</li>)}
      </ol>
      <p className="pas-cap">{!c.user ? 'Elke review, foto of openingstijd die je doorgeeft en die online komt, is een stempel op je pas.'
        : mine.length ? <>{done} {done === 1 ? 'stempel' : 'stempels'}{wait ? ` · ${wait} wacht${wait === 1 ? '' : 'en'} op controle` : ''}{over ? ` · en nog ${over} eerder` : ''}</>
        : 'Nog geen stempels. Je eerste: een review, foto of de openingstijden van een winkel waar je was.'}</p>
      {!c.user ? <div className="pas-cta"><button className="btn primary" onClick={login}>Inloggen of account maken</button><span>Dan staan je bewaarde plekken ook op je andere apparaten.</span></div>
        : mine.length > 0 && <button className="link pas-all" onClick={() => c.bij.go('contrib')}>Al je bijdragen bekijken<Ic n="chev" /></button>}
    </section>

    <div className="me-grid">
      <section className="me-block" aria-labelledby="me-fav">
        <div className="me-bh"><h3 id="me-fav">Bewaard{n ? <span className="tnum"> {n}</span> : null}</h3>{n > 0 && <button className="link" onClick={showFavs}><Ic n="pin" />Op de kaart</button>}</div>
        {n ? <ul className="favs">{favs.map(it => { const st = c.st(it); return (
          <li key={it.id}><button onClick={e => c.open(it.id, e.currentTarget.querySelector<HTMLElement>('.f-name'))}>
            <Tile it={it} /><span className="f-main"><span className="f-name">{it.name}</span><St s={st} /></span><span className="f-km tnum">{fkm(km(c.origin, it))} km</span></button></li>); })}</ul>
          : <p className="me-empty"><Ic n="heart" /><span>Tik op het hartje bij een winkel of markt. Bewaren werkt ook zonder account.</span></p>}
        {c.favs.length > n && <p className="src"><Ic n="info" /><span>{c.favs.length - n} bewaarde {c.favs.length - n === 1 ? 'plek staat' : 'plekken staan'} niet meer op de kaart (gesloten, of een markt die voorbij is).</span></p>}
      </section>

      <section className="me-block" aria-labelledby="me-plan">
        <div className="me-bh"><h3 id="me-plan">Mijn {dayName}</h3></div>
        {stops.length ? <button className="minibon" onClick={c.openPlan} aria-label={`Open mijn dagplan: ${stops.length} stops op ${dayName}`}>
          <span className="mb-h">{dShort(c.planDay).toUpperCase()} · {stops.length} STOP{stops.length > 1 ? 'S' : ''}</span>
          <ol>{stops.slice(0, 5).map(it => <li key={it.id}>{it.name}</li>)}{stops.length > 5 && <li className="mb-more">en nog {stops.length - 5}</li>}</ol>
          <span className="mb-go">Open dagplan<Ic n="chev" /></span></button>
          : <p className="me-empty"><Ic n="cal" /><span>Nog geen plan. Tik op <b>+</b> bij een winkel of markt, of laat er een maken onder <b>Mijn dag</b>.</span></p>}
      </section>
    </div>

    <footer className="me-foot">
      {/* Uitloggen en verwijderen niet naast elkaar (UX-test 30 okt): verwijderen staat apart, onder de rest. */}
      {c.user && <div className="me-acc"><span className="me-mail">Ingelogd als <b>{c.user}</b></span><div className="btns"><button className="btn sm" onClick={logout}>Uitloggen</button><button className="btn sm ghost" onClick={download}>Mijn gegevens downloaden</button></div>
        {!sure && <button className="link danger me-del" onClick={() => setSure(true)}>Account verwijderen</button>}</div>}
      {sure && <div className="unknown-box"><p><b>Account echt verwijderen?</b> Je e-mailadres, je favorieten in je account en je schermnaam gaan weg. Wat op dit apparaat bewaard is, blijft hier staan.</p>
        <div className="btns"><button className="btn sm" style={{ background: 'var(--bad)', borderColor: 'var(--bad)', color: 'oklch(0.99 0 0)' }} onClick={() => remove().finally(() => setSure(false))}>Verwijderen</button><button className="btn sm" onClick={() => setSure(false)}>Toch niet</button></div></div>}
      <nav aria-label="Over Snuffelkaart"><a href="mailto:info@freekvanderhorst.com?subject=Plek%20voor%20Snuffelkaart">Mis je een plek?</a><a href="/hoe-we-controleren">Hoe we controleren</a><a href="/privacy">Privacy</a><a href="/voorwaarden">Voorwaarden</a><a href="/colofon">Colofon en contact</a></nav>
    </footer>
  </div>);
}

/** Inloggen: Apple en Google (als ze aan staan) en een inloglink per e-mail. Geen wachtwoord. */
export function LoginView({ c, send, done }: { c: Ctx; send: (email: string) => Promise<void>; done: (s: Session) => void }) {
  const [code, setCode] = useState(''), [email, setEmail] = useState(''), [sent, setSent] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [prov, setProv] = useState<('apple' | 'google')[]>([]), n = c.favs.length;
  useEffect(() => { providers().then(setProv); }, []);
  const back = location.origin + '/';
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setErr(''); setBusy(true); try { await send(email.trim()); setSent(true); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } };
  const head = <div className="dv-head" data-peek data-drag><div className="dv-top"><button className="back" onClick={c.back}><Ic n="back" />Terug</button></div></div>;
  const check = async (e: React.FormEvent) => { e.preventDefault(); setErr(''); setBusy(true); try { done(await verifyCode(email.trim(), code.replace(/\D/g, ''))); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } };
  if (sent) return <>{head}<div className="success" style={{ paddingTop: 0 }}><span className="ok-ic"><Ic n="mail" /></span><h3>Check je mail</h3>
    <p>We hebben een code en een inloglink gestuurd naar <b>{email}</b>. Vul de code hieronder in, of tik op de link in de mail.</p></div>
    <form className="form" onSubmit={check}>
      <div className="field"><label htmlFor="login-code">Code uit de mail</label><input className="input tnum" id="login-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={10} placeholder="12345678" required autoFocus value={code} onChange={e => setCode(e.target.value)} style={{ letterSpacing: '.12em', fontSize: '1.25rem' }} /></div>
      {err && <p className="issue bad" role="alert"><Ic n="alert" /><span>{err}</span></p>}
      <button className="btn primary block" disabled={busy || code.replace(/\D/g, '').length < 6}>{busy ? 'Even kijken…' : 'Inloggen'}</button>
      <p className="prose-s">Vraag je een nieuwe aan, dan werkt alleen de nieuwste. Geen mail? Kijk ook bij ongewenst. <button type="button" className="link" onClick={() => { setSent(false); setCode(''); setErr(''); }}>Ander e-mailadres</button></p>
    </form></>;
  return (<>{head}
    <div className="dv-head" style={{ paddingTop: 0 }}><h2>Inloggen</h2><p className="prose-s">Geen wachtwoord nodig. Nieuw? Dan maken we meteen een account.{n ? ` Je ${n} bewaarde ${n === 1 ? 'plek gaat' : 'plekken gaan'} mee.` : ''}</p></div>
    <form className="form" onSubmit={submit}>
      {prov.length > 0 && <><div className="oauth">{prov.map(p => <a key={p} className="btn block" href={oauthUrl(p, back)}>Doorgaan met {p === 'apple' ? 'Apple' : 'Google'}</a>)}</div><div className="divider">of met e-mail</div></>}
      <div className="field"><label htmlFor="login-mail">E-mailadres</label><input className="input" id="login-mail" type="email" autoComplete="email" placeholder="naam@voorbeeld.nl" required value={email} onChange={e => setEmail(e.target.value)} /></div>
      {err && <p className="issue bad" role="alert"><Ic n="alert" /><span>{err}</span></p>}
      <button className="btn primary block" disabled={busy}>{busy ? 'Versturen…' : 'Stuur inloglink'}</button>
      <p className="prose-s" style={{ fontSize: '.8125rem', color: 'var(--fg-3)' }}>We gebruiken je e-mailadres alleen om in te loggen. Je kunt je account altijd verwijderen, met al je gegevens. <a href="/privacy">Privacy</a></p>
    </form>
  </>);
}
