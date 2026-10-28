import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import type { Item, LatLon, Place, Market } from '../lib/model';
import { dDay, dShort, dLong, fkm, hm, isoDay, addDays, dayStart, DAYS, DAYS_LONG, km, weekendOf, CATS } from '../lib/model';
import { placeNow, placeDay, placeWeekend, marketStatus, week, isHoliday, openOn, type Status } from '../lib/hours';
import { simulate, bestOrder, routeUrl } from '../lib/plan';
import type { Filters } from '../lib/filter';
import { searchSpots, type Spot } from '../lib/pdok';
import { providers, oauthUrl, verifyCode, SB, KEY, type Session } from '../lib/auth';
import { Ic, Tile, St, Conf, Banner, CAT, kindLabel, isUnsure, EASE, reduced, pop } from './ui';

export interface Ctx {
  now: Date; f: Filters; online: boolean; dataFrom: string | null; install: { add: () => void; no: () => void } | null; origin: LatLon; originLabel: string | null; locDenied: boolean; welcome: boolean; spot: boolean; me: LatLon | null;
  pickSpot: (s: Spot) => void; pickPlace: () => void; favs: string[]; planStops: string[]; planDay: string;
  setF: (p: Partial<Filters>) => void; open: (id: string, from?: HTMLElement | null) => void; toggleStop: (id: string) => void; toggleFav: (id: string) => void;
  locate: (quiet?: boolean) => void; back: () => void; openPlan: () => void; openMe: () => void; user: string | null;
}

/** Status van een item in de context van het gekozen tijdfilter. */
export function statusFor(it: Item, f: Filters, now: Date): Status {
  if (it.t === 'm') return marketStatus(it, now);
  const today = isoDay(now);
  if (f.time === 'all' || f.time === 'now' || f.time === 'today' || (f.time === 'date' && f.date === today) || (f.time === 'weekend' && weekendOf(now).includes(today))) return placeNow(it, now);
  if (f.time === 'weekend') return placeWeekend(it, weekendOf(now));
  return placeDay(it, f.date ?? today);
}

export function Row({ it, d, c }: { it: Item; d: number; c: Ctx }) {
  const st = statusFor(it, c.f, c.now), inPlan = c.planStops.includes(it.id), cancel = it.t === 'm' && it.status === 'cancel';
  return (
    <li className="rowli" data-key={it.id}>
      <button className="row" onClick={e => c.open(it.id, e.currentTarget.querySelector<HTMLElement>('.r-name'))} aria-label={`${it.name}, ${st.txt}, ${fkm(d)} kilometer`}>
        <Tile it={it} />
        <span className="r-main">
          <span className={`r-name${cancel ? ' strike' : ''}`}>{it.name}</span>
          <St s={st} />
          <span className="r-meta">{it.t === 'm' ? <><Conf it={it} />{!cancel && <span>·</span>}<span>{it.place}</span></> : <>{it.place || 'Plaats onbekend'}{it.kind !== 'kringloop' && <> · {kindLabel(it).toLowerCase()}</>}</>}</span>
        </span>
        <span className="r-km">{fkm(d)} km</span>
      </button>
      <button className="add" onClick={e => { if (!inPlan) pop(e.currentTarget); c.toggleStop(it.id); }} aria-pressed={inPlan} disabled={cancel} aria-label={`${inPlan ? 'Haal uit' : 'Zet in'} mijn dagplan`}><span><Ic n={inPlan ? 'check' : 'plus'} /></span></button>
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

function Welcome({ c }: { c: Ctx }) {
  return (
    <div className="lv-head" data-peek data-drag><div className="welcome">
      <span className="brand-mark"><Ic n="tag" /></span>
      <h2>Snuffelen, maar dan slim</h2>
      <p>Kringlopen en tweedehandswinkels in heel Nederland op één kaart, met rommelmarkten erbij. Je ziet wat er open is, en je maakt in twee minuten een plan voor je zaterdag.</p>
      <div className="btns"><button className="btn primary" onClick={() => c.locate()}><Ic n="loc" />Laat zien wat er bij mij is</button><button className="btn" onClick={c.pickPlace}>Kies een plaats</button></div>
      <p className="fine"><Ic n="shield" />Je locatie blijft op je telefoon. We slaan hem niet op.</p>
    </div></div>
  );
}

export function ListView({ c, list, total, limit, more, counts, nPlaces }: { c: Ctx; list: { it: Item; d: number }[]; total: number; limit: number; more: () => void; counts: { kNow: number; kToday: number; mWk: number }; nPlaces: number }) {
  const { f, now } = c, today = isoDay(now), weekend = weekendOf(now).includes(today), spots = useSpots(f.q), flip = useFlip(list), [cats, setCats] = useState(false);
  if (c.welcome) return <Welcome c={c} />;
  const near = c.originLabel ? `rond ${c.originLabel}` : 'bij jou in de buurt';
  const title = f.time === 'all' ? `Snuffelen ${near}` : f.time === 'now' ? `Nu ${near}` : f.time === 'weekend' ? `Dit weekend ${near}` : f.time === 'today' ? `Vandaag ${near}` : dLong(f.date ?? today);
  const P = (b: boolean) => ({ 'aria-pressed': b });
  return (<>
    <div className="lv-head" data-peek data-drag>
      <a className="brand" href="/" aria-label="Snuffelkaart, naar het begin"><span className="brand-mark"><Ic n="tag" /></span>Snuffelkaart</a>
      <div className="greet"><div><h2>{title}</h2>
        <p className="counts">{weekend
          ? <button onClick={() => c.setF({ time: 'today' })}><span className="cdot" />{counts.kToday} winkels open vandaag</button>
          : <button onClick={() => c.setF({ time: 'now' })}><span className="cdot" />{counts.kNow} winkels nu open</button>}
          <span>·</span><button onClick={() => c.setF({ time: 'weekend' })}>{counts.mWk} markten dit weekend</button></p></div>
        <button className={`me-btn${c.user ? ' in' : ''}`} onClick={c.openMe} aria-label="Jij: bewaard en account">{c.user ? c.user[0].toUpperCase() : <Ic n="user" />}</button></div>
      <label className="search"><Ic n="search" /><span className="sr">Zoeken</span><input type="search" placeholder="Zoek op naam, plaats of postcode" value={f.q} onChange={e => c.setF({ q: e.target.value })} autoComplete="off" /></label>
      <div className="chips" role="group" aria-label="Filters">
        {f.only && <button className="chip" aria-pressed onClick={() => c.setF({ only: null })} aria-label="Toon weer alles, niet alleen bewaard"><Ic n="heart" />Bewaard · {f.only.length}<Ic n="x" /></button>}
        <div className="typeseg" role="group" aria-label="Type">
          <button {...P(f.type === 'all')} onClick={() => c.setF({ type: 'all' })}>Alles</button>
          <button {...P(f.type === 'k')} onClick={() => c.setF({ type: 'k' })}><i className="tk" />Winkels</button>
          <button {...P(f.type === 'm')} onClick={() => c.setF({ type: 'm' })}><i className="tm" />Markten</button></div>
        {f.type !== 'm' && <button className="chip" aria-expanded={cats} {...P(f.hide.length > 0)} onClick={() => setCats(!cats)}><Ic n="store" />{f.hide.length ? `Soort (${CATS.length - f.hide.length})` : 'Soort'}</button>}
        <span className="sep" />
        <button className="chip" {...P(f.time === 'now')} onClick={() => c.setF({ time: f.time === 'now' ? 'all' : 'now' })}><span className="gdot" />Nu open</button>
        <button className="chip" {...P(f.time === 'today')} onClick={() => c.setF({ time: f.time === 'today' ? 'all' : 'today' })}>Vandaag</button>
        <button className="chip" {...P(f.time === 'weekend')} onClick={() => c.setF({ time: f.time === 'weekend' ? 'all' : 'weekend' })}>Dit weekend</button>
        <button className="chip" {...P(f.time === 'date')} onClick={() => c.setF(f.time === 'date' ? { time: 'all' } : { time: 'date', date: f.date ?? addDays(today, 1) })}><Ic n="cal" />{f.time === 'date' && f.date ? dShort(f.date) : 'Kies datum'}</button>
        <span className="sep" />
        <button className="chip" {...P(f.gratis)} onClick={() => c.setF({ gratis: !f.gratis })}>Gratis entree</button>
        <button className="chip" {...P(f.overdekt)} onClick={() => c.setF({ overdekt: !f.overdekt })}><Ic n="umbrella" />Overdekt</button>
      </div>
      {cats && f.type !== 'm' && <div className="catstrip" role="group" aria-label="Soort winkel">
        {CATS.map(k => { const on = !f.hide.includes(k); return <button key={k} className={`catchip c-${k}`} aria-pressed={on} onClick={() => c.setF({ hide: on ? [...f.hide, k] : f.hide.filter(x => x !== k) })}><span className="tile"><Ic n={CAT[k][2]} /></span>{CAT[k][1]}</button>; })}
        {f.hide.length > 0 && <button className="chip" onClick={() => c.setF({ hide: [] })}>Alles aan</button>}</div>}
      {f.time === 'date' && <div className="daystrip" role="group" aria-label="Kies een dag">{Array.from({ length: 10 }, (_, i) => { const iso = addDays(today, i), d = dayStart(iso); return (
        <button key={iso} className="day" aria-pressed={f.date === iso} onClick={() => c.setF({ date: iso })} aria-label={dLong(iso) + (isHoliday(iso) ? ', feestdag' : '')}><span>{i === 0 ? 'vand.' : DAYS[d.getDay()]}</span><b className="tnum">{d.getDate()}</b><i className={`mk${isHoliday(iso) ? '' : ' none'}`} /></button>); })}</div>}
      {!c.online && <Banner icon="wifi-off"><b>Je bent offline.</b> Je ziet de gegevens van {c.dataFrom ? dShort(isoDay(new Date(c.dataFrom))) : 'je laatste bezoek'}. Afgelastingen van daarna zie je pas weer met verbinding.</Banner>}
      {isHoliday(f.time === 'date' && f.date ? f.date : today) && <Banner kind="warn" icon="cal"><b>Het is een feestdag.</b> Kringlopen hebben dan vaak andere tijden. Bel even voordat je gaat.</Banner>}
      {c.locDenied && !c.me ? <Banner icon="pin"><b>Je locatie staat uit.</b> Geen probleem: zoek hierboven een plaats of postcode. Wil je hem toch aanzetten, dan kan dat in de instellingen van je browser.</Banner>
        : !c.me && !f.q && <Banner icon="pin">{!c.spot ? <><b>Waar wil je snuffelen?</b> We tonen nu Amersfoort. </> : <><b>Afstanden vanaf {c.originLabel}.</b> </>}<button className="link" onClick={() => c.locate()}>Gebruik mijn locatie</button> of zoek een plaats.</Banner>}
    </div>
    <div className="rows-wrap">
      {spots.length > 0 && <div className="sresults"><h4>Kijk rond in</h4>{spots.map(s => <button key={s.label + s.sub} className="sres" onClick={() => c.pickSpot(s)}><span className="ic"><Ic n="pin" /></span><span><b>{s.label}</b><span>{s.sub}</span></span><Ic n="chev" /></button>)}{list.length > 0 && <h4>Winkels en markten</h4>}</div>}
      {list.length ? <ul className="rows" aria-label="Resultaten" ref={flip}>{list.slice(0, limit).map(x => <Row key={x.it.id} it={x.it} d={x.d} c={c} />)}</ul>
        : spots.length ? null : <div className="empty"><h3>{f.q ? `Niets gevonden voor “${f.q}”` : 'Geen resultaten met deze filters'}</h3><p>{f.q ? 'Zoek op de naam van een winkel of een plaats.' : f.time === 'all' ? 'Zet een filter uit.' : 'Zet het tijdfilter uit om alles te zien.'}</p>
          <div className="btns">{f.q && <button className="btn sm" onClick={() => c.setF({ q: '' })}>Wis zoekopdracht</button>}<button className="btn sm primary" onClick={() => c.setF({ time: 'all', gratis: false, overdekt: false, hide: [], only: null })}>Toon alles</button></div></div>}
      {total > limit && <button className="more" onClick={more}>Toon meer ({total - limit})</button>}
      {f.time === 'now' && f.type !== 'k' && !f.q && <button className="hint" onClick={() => c.setF({ time: 'weekend' })}><span>{counts.mWk} markten dit weekend<small>Markten zijn er vooral op zaterdag en zondag</small></span><Ic n="chev" /></button>}
      <p className="src" style={{ marginTop: 18 }}><Ic n="info" /><span>{nPlaces} winkels uit © OpenStreetMap-bijdragers en © Overture Maps Foundation, heel Nederland. De winkelgegevens zijn vrij te gebruiken onder de <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL</a> (<a href="/data/places.json">download</a>). Markten uit de eigen agenda van organisatoren; bij elke markt staat welke. <a href="/plaatsen/">Alle plaatsen</a> · <a href="/hoe-we-controleren">Hoe we controleren</a> · <a href="/privacy">Privacy</a></span></p>
    </div>
  </>);
}

const webUrl = (w: string) => (w.startsWith('http') ? w : `https://${w}`);
const osmUrl = (id: string) => { const m = /^osm-([nwr])(\d+)$/.exec(id); return m ? `https://www.openstreetmap.org/${{ n: 'node', w: 'way', r: 'relation' }[m[1] as 'n' | 'w' | 'r']}/${m[2]}` : null; };
const monthsAgo = (iso: string, now: Date) => (now.getTime() - new Date(iso).getTime()) / (30.4 * 864e5);

export function DetailView({ it, c, backLabel }: { it: Item; c: Ctx; backLabel: string }) {
  const inPlan = c.planStops.includes(it.id), fav = c.favs.includes(it.id), d = km(c.origin, it);
  const top = <div className="dv-top"><button className="back" onClick={c.back}><Ic n="back" />{backLabel}</button></div>;
  const route = routeUrl('google', c.me, [it]);
  const actions = (cancel: boolean, unconf: boolean) => (
    <div className="actions">
      <button className={`btn${unconf && !inPlan ? '' : ' primary'}`} aria-pressed={inPlan} disabled={cancel} onClick={() => c.toggleStop(it.id)}>
        {cancel ? 'Afgelast' : <><Ic n={inPlan ? 'check' : 'plus'} />{inPlan ? 'In mijn dagplan' : unconf ? 'Toch toevoegen' : 'In mijn dagplan'}</>}</button>
      <a className="heart" href={route} target="_blank" rel="noopener" aria-label="Route in Google Maps"><Ic n="route" /></a>
      <button className="heart" aria-pressed={fav} onClick={e => { if (!fav) pop(e.currentTarget); c.toggleFav(it.id); }} aria-label="Bewaar in favorieten"><Ic n="heart" /></button>
    </div>);
  if (it.t === 'k') return <PlaceDetail p={it} c={c} top={top} d={d} actions={actions(false, !it.h)} />;
  return <MarketDetail m={it} c={c} top={top} d={d} actions={actions(it.status === 'cancel', it.status === 'unconf')} />;
}

function PlaceDetail({ p, c, top, d, actions }: { p: Place; c: Ctx; top: ReactElement; d: number; actions: ReactElement }) {
  const now = placeNow(p, c.now), w = week(p, isoDay(c.now)), osm = osmUrl(p.id), today = isoDay(c.now);
  const stale = p.checked && monthsAgo(p.checked, c.now) > 4;
  return (<article>
    <header className="dv-head" data-peek data-drag>{top}
      <p className="eyebrow"><Tile it={p} small />{kindLabel(p)}</p>
      <h2>{p.name}</h2>
      <p className="dv-status"><St s={now} pulse /><span className="ds">·</span><span className="tnum">{fkm(d)} km</span>{p.place && <><span className="ds">·</span><span>{p.place}</span></>}</p>
      {actions}
    </header>
    {p.kind === 'tweedehands' && <Banner icon="info"><b>Geen standaard kringloop.</b> {p.sub ? `${kindLabel(p)}: ` : ''}tweedehands, maar prijzen en aanbod kunnen anders zijn dan bij een kringloop.</Banner>}
    {w ? <section className="dv-sec"><h3>Openingstijden</h3>
      <dl className="hours">{w.map(x => <div key={x.iso} style={{ display: 'contents' }}><dt className={x.iso === today ? 'today' : ''}>{x.label}</dt><dd className={`${x.iso === today ? 'today' : ''}${x.txt.startsWith('Dicht') ? ' shut' : ''}`}>{x.txt}</dd></div>)}</dl>
      <p className={`src${stale ? ' stale' : ''}`}><Ic n={stale ? 'alert' : 'clock'} /><span>{p.checked ? (stale ? `Laatst gecontroleerd op ${p.checked}, dat is al even geleden. Bel even voordat je gaat.` : `${p.hs === 'web' ? 'Gelezen op' : 'Laatst gecontroleerd op'} ${p.checked}`) : 'Controledatum onbekend'} · {p.hs === 'web' ? <>van <a href={p.hu} target="_blank" rel="noopener">de website van de winkel</a></> : `bron: ${p.src === 'osm' ? 'OpenStreetMap' : 'Overture Maps'}`}<br />Rond feestdagen kunnen tijden afwijken.</span></p></section>
      : <section className="dv-sec"><h3>Openingstijden</h3><div className="unknown-box"><p><b>We weten de openingstijden nog niet.</b> {p.src === 'osm' ? 'Deze winkel staat op OpenStreetMap, maar zonder tijden.' : 'Deze winkel komt uit Overture Maps en is nog niet door ons gecontroleerd. Misschien bestaat hij niet meer.'} Bel even of kijk op de website voordat je gaat.</p>
        <div className="btns">{p.phone && <a className="btn sm" href={`tel:${p.phone.replace(/\s/g, '')}`}><Ic n="phone" />{p.phone}</a>}{!p.phone && p.website && <a className="btn sm" href={webUrl(p.website)} target="_blank" rel="noopener"><Ic n="globe" />Website</a>}{osm && <a className="btn sm primary" href={osm} target="_blank" rel="noopener"><Ic n="edit" />Tijden aanvullen op OSM</a>}</div></div>
        <p className="src"><Ic n="info" /><span>In “Nu open” tonen we deze winkel niet, omdat we dat niet kunnen beloven.</span></p></section>}
    <section className="dv-sec">
      {p.addr && <div className="inforow"><Ic n="pin" /><span>{p.addr}</span></div>}
      {p.phone && <div className="inforow"><Ic n="phone" /><span className="tnum">{p.phone}</span></div>}
      {p.website && <div className="inforow"><Ic n="globe" /><a href={webUrl(p.website)} target="_blank" rel="noopener">{p.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></div>}
    </section>
    <footer className="dv-foot"><Report id={p.id} what={SHOP_WHAT} />
      {osm ? <a className="report-btn" href={osm} target="_blank" rel="noopener"><Ic n="edit" />Zelf aanpassen op OpenStreetMap</a>
      : <><p className="src"><Ic n="info" /><span>Bron: © Overture Maps Foundation (CDLA Permissive 2.0). Nog niet gecontroleerd.</span></p>
        <a className="report-btn" href={`https://www.openstreetmap.org/edit#map=19/${p.lat}/${p.lon}`} target="_blank" rel="noopener"><Ic n="edit" />Ken je deze winkel? Zet hem op OpenStreetMap</a></>}</footer>
  </article>);
}

const SHOP_WHAT: [string, string][] = [['dicht', 'Gesloten of bestaat niet meer'], ['tijden', 'Andere openingstijden'], ['plek', 'Verkeerde plek of adres'], ['anders', 'Iets anders']];
const MARKET_WHAT: [string, string][] = [['afgelast', 'Gaat niet door'], ['tijden', 'Andere datum of tijden'], ['plek', 'Verkeerde plek'], ['anders', 'Iets anders']];

/** "Klopt er iets niet?": melding zonder account, komt in /beheer (rpc report; zie migratie meldingen). */
function Report({ id, what }: { id: string; what: [string, string][] }) {
  const [open, setOpen] = useState(false), [w, setW] = useState(''), [note, setNote] = useState(''), [state, setState] = useState<'' | 'busy' | 'done' | string>('');
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setState('busy');
    try {
      const r = await fetch(`${SB}/rest/v1/rpc/report`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: id, what: w, note: note.trim() || null }) });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? '');
      setState('done');
    } catch (x) { setState(`Versturen lukte niet${(x as Error).message ? `: ${(x as Error).message}` : '. Ben je online?'}`); }
  };
  if (state === 'done') return <p className="src"><Ic n="check" /><span><b>Bedankt!</b> We kijken ernaar; een correctie staat meestal binnen een dag op de kaart.</span></p>;
  if (!open) return <button className="report-btn" onClick={() => setOpen(true)}><Ic n="flag" />Klopt er iets niet?</button>;
  return (<form className="login-card report" onSubmit={send}>
    <b>Wat klopt er niet?</b>
    <div className="btns" role="radiogroup">{what.map(([k, l]) => <button key={k} type="button" role="radio" className="chip" aria-checked={w === k} aria-pressed={w === k} onClick={() => setW(k)}>{l}</button>)}</div>
    <textarea className="textarea" maxLength={500} placeholder="Wat weet je? Bijv. de nieuwe tijden of waar je het zag (mag leeg)" value={note} onChange={e => setNote(e.target.value)} aria-label="Toelichting" />
    <p className="src"><Ic n="info" /><span>Anoniem: we bewaren alleen je melding, niet wie je bent.</span></p>
    {state && state !== 'busy' && <p role="alert" style={{ color: 'var(--bad-ink)', fontSize: '.875rem' }}>{state}</p>}
    <div className="btns"><button className="btn primary sm" disabled={!w || state === 'busy' || !SB}>Versturen</button><button type="button" className="btn sm" onClick={() => setOpen(false)}>Annuleren</button></div>
  </form>);
}

function MarketDetail({ m, c, top, d, actions }: { m: Market; c: Ctx; top: ReactElement; d: number; actions: ReactElement }) {
  const s = m.status;
  const box = s === 'org' ? <div className="statusbox org"><Ic n="check" /><div><b>Bevestigd door de organisator</b><p>{m.org} heeft deze datum zelf opgegeven.</p></div></div>
    : s === 'chk' ? <div className="statusbox chk"><Ic n="check" /><div><b>Gecontroleerd op {m.checked && dDay(m.checked)}</b><p>Deze editie stond bij de laatste controle op de website van {m.org}.</p></div></div>
    : s === 'unconf' ? <div className="statusbox unconf"><Ic n="alert" /><div><b>Nog niet bevestigd</b><p>Deze datum is afgeleid uit het schema “{m.schema.toLowerCase()}”. Check het voordat je gaat; we stellen hem niet vanzelf voor in je dagplan.</p></div></div>
    : <div className="statusbox cancel"><Ic n="x" /><div><b>Afgelast</b><p>{m.cancelWhy}</p></div></div>;
  return (<article>
    <header className="dv-head" data-peek data-drag>{top}
      <p className="eyebrow"><Tile it={m} small />{m.kind}{m.indoor !== undefined && <> · {m.indoor ? 'binnen' : 'buiten'}</>}{m.sample && <span className="sample">voorbeeld</span>}</p>
      <h2 className={s === 'cancel' ? 'strike' : ''}>{m.name}</h2>
      <p className={`bigdate tnum${s === 'cancel' ? ' strike' : ''}`}>{dLong(m.date)} · {m.timeKnown === false ? 'tijden bij de organisator' : m.end ? `${hm(m.start)}–${hm(m.end)}` : `vanaf ${hm(m.start)}`}</p>
      <p className="dv-status"><span className="tnum">{fkm(d)} km</span><span className="ds">·</span><span>{m.venue ? `${m.venue}, ${m.place}` : m.place}</span></p>
      {box}{actions}
    </header>
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

export function PlanView({ c, items, plan, setPlan, optimizeSeen }: { c: Ctx; items: Item[]; plan: { day: string; start: number; stops: string[] }; setPlan: (p: Partial<{ day: string; start: number; stops: string[] }>) => void; optimizeSeen: boolean }) {
  const byId = new Map(items.map(i => [i.id, i])), stops = plan.stops.map(id => byId.get(id)).filter(Boolean) as Item[];
  const sim = simulate(stops, plan.day, plan.start, c.origin), [sat, sun] = weekendOf(c.now), dayName = DAYS_LONG[dayStart(plan.day).getDay()];
  const isBest = stops.length < 2 || bestOrder(stops, plan.day, plan.start, c.origin).map(x => x.id).join() === stops.map(x => x.id).join();
  const stt = sim.bad ? { c: 'bad', i: 'alert', t: `${sim.bad === 1 ? '1 stop klopt' : `${sim.bad} stops kloppen`} niet op ${dayName}.`, x: optimizeSeen ? 'Haal de stop weg of kies een andere dag.' : 'Probeer Slimste volgorde, of haal de stop weg.' }
    : sim.warn ? { c: 'warn', i: 'info', t: `${sim.warn === 1 ? '1 aandachtspunt' : `${sim.warn} aandachtspunten`}.`, x: 'Staat hieronder bij de stop.' } : { c: 'ok', i: 'check', t: 'Alles open en bevestigd.', x: 'Je kunt gaan.' };
  const sugg = items.filter(i => !plan.stops.includes(i.id) && (i.t === 'k' ? openOn(i, plan.day) : i.date === plan.day && (i.status === 'org' || i.status === 'chk')))
    .map(i => ({ it: i, d: stops.length ? Math.min(...stops.map(s => km(s, i))) : km(c.origin, i) })).sort((a, b) => a.d - b.d).slice(0, 3);
  const head = (
    <div className="pv-head" data-peek data-drag>
      <div className="dv-top"><button className="back" onClick={c.back}><Ic n="back" />Terug</button></div>
      <div className="pv-title"><h2>Mijn {dayName}</h2>
        <div className="typeseg" role="group" aria-label="Dag"><button aria-pressed={plan.day === sat} onClick={() => setPlan({ day: sat })}>{dShort(sat)}</button><button aria-pressed={plan.day === sun} onClick={() => setPlan({ day: sun })}>{dShort(sun)}</button></div></div>
      <div className="pv-opts"><label>Vertrek<select value={plan.start} onChange={e => setPlan({ start: +e.target.value })}>{[480, 510, 540, 570, 600, 630, 660, 720, 780].map(m => <option key={m} value={m}>{hm(m)}</option>)}</select></label>
        <span>vanaf {c.me ? 'je locatie' : 'Amersfoort'}</span></div>
    </div>);
  if (!stops.length) return <>{head}<div className="empty"><h3>Nog geen stops</h3><p>Tik op <b>+</b> bij een kringloop of markt. We rekenen uit wanneer je waar bent, en of het dan open is.</p><div className="btns"><button className="btn sm primary" onClick={() => { c.setF({ time: 'weekend' }); c.back(); }}>Wat is er dit weekend?</button></div></div></>;
  return (<>{head}
    <div className="rc-wrap"><div className="receipt print" aria-label="Je dagplan als bon">
      <p className="rc-shop"><Ic n="tag" />SNUFFELKAART</p>
      <p className="rc-sub">{dShort(plan.day)} · vertrek {hm(plan.start)} · {c.me ? 'je locatie' : 'Amersfoort'}</p>
      <p className={`rc-status ${stt.c}`}><Ic n={stt.i} /><span><b>{stt.t}</b> {stt.x}</span></p>
      <hr className="rc-rule" />
      <ol className="rc-list">{sim.stops.map((x, i) => { const it = byId.get(x.id)!; return [
        <li key={`l${x.id}`} className="leg" aria-hidden="true">↓ ±{x.drive} min · {fkm(x.km)} km</li>,
        <li key={x.id} className={`rc-stop${x.issue?.lv === 'bad' ? ' bad' : ''}`}><span className="rc-n">{i + 1}</span><span className="rc-t">{hm(x.arrive)}</span>
          <div className="rc-m"><button className="st-name" onClick={() => c.open(it.id)}>{it.name}</button>{x.note && <span className="rc-note">{x.note}</span>}
            {x.issue && <p className={`issue ${x.issue.lv}`}><Ic n={x.issue.lv === 'bad' ? 'x' : 'alert'} /><span>{x.issue.txt}</span></p>}</div>
          <button className="rm" onClick={() => c.toggleStop(it.id)} aria-label={`Verwijder ${it.name}`}><Ic n="x" /></button></li>]; })}</ol>
      <hr className="rc-rule" />
      <dl className="rc-tot"><dt>Stops</dt><dd>{stops.length}</dd><dt>Rijden</dt><dd>±{fkm(sim.km)} km</dd><dt className="big">Klaar rond</dt><dd className="big">{hm(sim.end)}</dd></dl>
      <div className="rc-bar" aria-hidden="true" /><p className="rc-foot">Fijne {dayName}!</p>
    </div></div>
    <div className="plan-actions">
      <button className="btn" disabled={isBest} onClick={() => setPlan({ stops: bestOrder(stops, plan.day, plan.start, c.origin).map(x => x.id) })}><Ic n={isBest ? 'check' : 'wand'} />{isBest ? 'Dit is al de slimste volgorde' : 'Slimste volgorde'}</button>
      <div className="row2"><a className="btn primary" href={routeUrl('google', c.me ?? c.origin, stops)} target="_blank" rel="noopener"><Ic n="ext" />Google Maps</a><a className="btn primary" href={routeUrl('apple', c.me ?? c.origin, stops)} target="_blank" rel="noopener"><Ic n="ext" />Apple Maps</a></div>
    </div>
    {c.install && stops.length > 0 && <div className="install"><span className="brand-mark"><Ic n="tag" /></span><div><b>Zet Snuffelkaart op je beginscherm</b><p>Dan open je dit bonnetje ook zonder bereik, bijvoorbeeld in een sporthal.</p>
      <div className="btns"><button className="btn sm primary" onClick={c.install.add}>Toevoegen</button><button className="btn sm ghost" onClick={c.install.no}>Niet nu</button></div></div></div>}
    {sugg.length > 0 && stops.length < 8 && <div className="sugg"><h3>Past ook in je {dayName}</h3><p className="sub">Open of bevestigd, vlak bij je route</p><ul className="rows">{sugg.map(x => <Row key={x.it.id} it={x.it} d={km(c.origin, x.it)} c={c} />)}</ul></div>}
  </>);
}

/** Jij: bewaarde plekken (werkt zonder account) en, pas hier, de uitnodiging om in te loggen (ontwerp §05). */
export function MeView({ c, items, showFavs, login, logout, download, remove }: { c: Ctx; items: Item[]; showFavs: () => void; login: () => void; logout: () => void; download: () => void; remove: () => Promise<void> }) {
  const byId = new Map(items.map(i => [i.id, i])), favs = c.favs.map(id => byId.get(id)).filter(Boolean) as Item[], n = favs.length, [sure, setSure] = useState(false);
  return (<>
    <div className="dv-head" data-peek data-drag><div className="dv-top"><button className="back" onClick={c.back}><Ic n="back" />Kaart</button></div>
      <h2>Jij</h2>{c.user && <p className="prose-s">Ingelogd als <b>{c.user}</b>. Je favorieten staan op al je apparaten.</p>}</div>
    <section className="me-sec" style={{ borderTop: 0, paddingTop: 0 }}><h3>Bewaard{n ? ` · ${n}` : ''}</h3>
      {n ? <><ul className="rows">{favs.map(it => <Row key={it.id} it={it} d={km(c.origin, it)} c={c} />)}</ul>
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={showFavs}><Ic n="pin" />Toon op de kaart</button></>
        : <p className="prose-s">Tik op het hartje bij een winkel of markt om hem hier te bewaren. Dat werkt ook zonder account, op dit apparaat.</p>}
      {c.favs.length > n && <p className="src"><Ic n="info" /><span>{c.favs.length - n} bewaarde {c.favs.length - n === 1 ? 'plek staat' : 'plekken staan'} niet meer op de kaart (gesloten, of een markt die voorbij is).</span></p>}</section>
    {!c.user && <div className="login-card"><b>Bewaar je favorieten overal</b><p>Log in, dan staan ze ook op je laptop of je andere telefoon.{n ? ` Je ${n} bewaarde ${n === 1 ? 'plek gaat' : 'plekken gaan'} automatisch mee.` : ''}</p>
      <button className="btn primary" onClick={login}>Inloggen of account maken</button></div>}
    <section className="me-sec" style={{ borderTop: 0 }}>
      <a className="navrow" href="/hoe-we-controleren">Hoe we controleren <span>en onze bronnen<Ic n="chev" /></span></a>
      <a className="navrow" href="/privacy">Privacy <span><Ic n="chev" /></span></a>
    </section>
    {c.user && <section className="me-sec">
      <button className="navrow" onClick={logout}>Uitloggen <span /></button>
      <button className="navrow" onClick={download}>Mijn gegevens downloaden <span>e-mailadres en favorieten<Ic n="chev" /></span></button>
      {!sure ? <button className="navrow" style={{ color: 'var(--bad-ink)' }} onClick={() => setSure(true)}>Account verwijderen <span><Ic n="chev" /></span></button>
        : <div className="unknown-box"><p><b>Account echt verwijderen?</b> Je e-mailadres en je favorieten in je account gaan weg. Wat op dit apparaat bewaard is, blijft hier staan.</p>
          <div className="btns"><button className="btn sm" style={{ background: 'var(--bad)', borderColor: 'var(--bad)', color: 'oklch(0.99 0 0)' }} onClick={() => remove().finally(() => setSure(false))}>Verwijderen</button><button className="btn sm" onClick={() => setSure(false)}>Toch niet</button></div></div>}
    </section>}
  </>);
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
