import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Item, LatLon, Place } from '../lib/model';
import { DEFAULT_CENTER, isoDay, weekendOf, DAYS_LONG, dayStart, hm } from '../lib/model';
import { placeNow, openOn, setWindow } from '../lib/hours';
import { visible, defaultTime, type Filters } from '../lib/filter';
import { simulate } from '../lib/plan';
import { sampleMarkets } from '../lib/markets';
import MapView from './MapView';
import { ListView, DetailView, PlanView, type Ctx } from './Views';
import { Ic } from './ui';

/** "Nu", met ?nu=2026-10-31T09:10 om tijdsbewust gedrag te testen. */
function useNow(): Date {
  const fixed = useMemo(() => { const v = new URLSearchParams(location.search).get('nu'); const d = v ? new Date(v) : null; return d && !isNaN(+d) ? d : null; }, []);
  const [now, setNow] = useState(() => fixed ?? new Date());
  useEffect(() => { if (fixed) return; const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, [fixed]);
  return now;
}
/** Per-apparaat-opslag (favorieten, dagplan). Mag stil falen. */
function useLocal<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; } });
  return [v, (n: T) => { setV(n); try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* privémodus */ } }];
}
const useDesktop = () => { const q = '(min-width: 980px)'; const [d, setD] = useState(() => matchMedia(q).matches); useEffect(() => { const m = matchMedia(q), f = () => setD(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []); return d; };

type View = 'list' | 'detail' | 'plan';
type Snap = 'collapsed' | 'half' | 'full';

export default function App() {
  const now = useNow(), desktop = useDesktop(), today = isoDay(now);
  const [places, setPlaces] = useState<Place[] | null>(null), [err, setErr] = useState(false);
  useEffect(() => { fetch('/data/places.json').then(r => r.json()).then(j => { setWindow(j.from, j.holidays); setPlaces(j.places); }).catch(() => setErr(true)); }, []);
  const markets = useMemo(() => sampleMarkets(now), [today]);
  const items: Item[] = useMemo(() => [...(places ?? []), ...markets], [places, markets]);
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const [f, setFState] = useState<Filters>(() => ({ type: 'all', time: defaultTime(now), date: null, gratis: false, overdekt: false, q: '' }));
  const [view, setView] = useState<View>('list'), [prev, setPrev] = useState<View>('list'), [sel, setSel] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap>('half'), [limit, setLimit] = useState(40);
  const [me, setMe] = useState<LatLon | null>(null), origin = me ?? DEFAULT_CENTER;
  const [favs, setFavs] = useLocal<string[]>('snuffel-favs', []);
  const [sat] = weekendOf(now);
  const [planRaw, setPlanRaw] = useLocal('snuffel-plan', { day: sat, start: 570, stops: [] as string[] });
  const plan = { ...planRaw, day: weekendOf(now).includes(planRaw.day) ? planRaw.day : sat }; // een plan van vorige week schuift door naar dit weekend
  // Altijd vanaf de laatste stand rekenen: snelle tikken achter elkaar mogen elkaar niet overschrijven.
  const planRef = useRef(plan); planRef.current = plan;
  const setPlan = (p: Partial<typeof plan>) => { const n = { ...planRef.current, ...p }; planRef.current = n; setPlanRaw(n); if (p.stops) setOptimized(false); };
  const [optimized, setOptimized] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lon: number; key: number } | null>(null), [fit, setFit] = useState<{ pts: LatLon[]; key: number } | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);

  const list = useMemo(() => visible(items, f, now, origin), [items, f, now, origin]);
  const counts = useMemo(() => {
    const [a, b] = weekendOf(now), ps = places ?? [];
    return { kNow: ps.filter(p => placeNow(p, now).open).length, kToday: ps.filter(p => openOn(p, today)).length, mWk: markets.filter(m => (m.date === a || m.date === b) && m.status !== 'cancel').length };
  }, [places, markets, now]);

  const setF = useCallback((p: Partial<Filters>) => { setFState(o => ({ ...o, ...p })); setLimit(40); if (view !== 'list') { setView('list'); setSel(null); } }, [view]);
  const open = (id: string) => { const it = byId.get(id); if (!it) return; if (view !== 'detail') setPrev(view); setSel(id); setView('detail'); if (snap === 'collapsed') setSnap('half'); setFocus({ lat: it.lat, lon: it.lon, key: Date.now() }); scrollTop(); };
  const back = () => { setView(view === 'detail' ? prev : 'list'); if (view === 'detail') setSel(null); setPrev('list'); scrollTop(); };
  const toggleFav = (id: string) => { const on = !favs.includes(id); setFavs(on ? [...favs, id] : favs.filter(x => x !== id)); setToast(on ? 'Bewaard op dit apparaat.' : 'Niet meer bewaard.'); };
  const toggleStop = (id: string) => {
    const plan = planRef.current, it = byId.get(id)!, has = plan.stops.includes(id);
    if (has) return setPlan({ stops: plan.stops.filter(x => x !== id) });
    if (plan.stops.length >= 8) return setToast('Maximaal 8 stops per dag. Haal er eerst een weg.');
    const next = { stops: [...plan.stops, id] } as Partial<typeof plan>;
    if (it.t === 'm' && it.date !== plan.day) { if (!plan.stops.length) { next.day = it.date; setToast(`Je dagplan staat nu op ${DAYS_LONG[dayStart(it.date).getDay()]}, de dag van deze markt.`); } else setToast(`Let op: deze markt is op ${DAYS_LONG[dayStart(it.date).getDay()]}.`); }
    else if (it.t === 'm' && it.status === 'unconf') setToast('Toegevoegd. Deze datum is nog niet bevestigd.');
    else if (it.t === 'k' && !it.h) setToast('Toegevoegd. De openingstijden zijn onbekend; bel even.');
    else if (it.t === 'k' && !openOn(it, plan.day)) setToast(`Let op: deze winkel is op ${DAYS_LONG[dayStart(plan.day).getDay()]} dicht.`);
    setPlan(next);
  };
  const locate = () => {
    if (!navigator.geolocation) return setToast('Je browser kan je locatie niet delen. Zoek een plaats.');
    navigator.geolocation.getCurrentPosition(
      p => { const ll = { lat: p.coords.latitude, lon: p.coords.longitude }; setMe(ll); setFocus({ ...ll, key: Date.now() }); },
      () => setToast('Je locatie staat uit. Zoek een plaats, of zet hem aan in je browser.'), { enableHighAccuracy: false, timeout: 8000 });
  };
  const openPlan = () => { setPrev(view); setView('plan'); setSnap(desktop ? 'half' : 'half'); scrollTop(); };
  useEffect(() => { if (view === 'plan') setFit({ pts: [origin, ...plan.stops.map(id => byId.get(id)).filter(Boolean) as Item[]], key: Date.now() }); }, [view, plan.stops.join(), plan.day]);

  const c: Ctx = { now, f, origin, me, favs, planStops: plan.stops, planDay: plan.day, setF, open, toggleStop, toggleFav, locate, back, openPlan };

  // ---------- bottom sheet (mobiel) ----------
  const shell = useRef<HTMLDivElement>(null), sheet = useRef<HTMLDivElement>(null), scroller = useRef<HTMLDivElement>(null);
  const [tops, setTops] = useState({ full: 12, half: 400, collapsed: 600 }), [dragTop, setDragTop] = useState<number | null>(null);
  const scrollTop = () => requestAnimationFrame(() => scroller.current && (scroller.current.scrollTop = 0));
  const barOn = plan.stops.length > 0 && view !== 'plan';
  useLayoutEffect(() => {
    const H = shell.current!.clientHeight, peek = sheet.current!.querySelector<HTMLElement>('[data-peek]');
    const ph = (peek ? peek.offsetTop + peek.offsetHeight : 180) + (barOn ? 78 : 0), half = Math.round(H * 0.5);
    setTops({ full: 12, half, collapsed: Math.max(half + 40, H - ph) });
  }, [view, sel, f.time, barOn, places, desktop]);
  const top = dragTop ?? tops[snap];
  const bottomPad = desktop || !shell.current ? 0 : Math.max(0, shell.current.clientHeight - Math.min(top, tops.half));
  const drag = useRef<{ y: number; top: number; last: number; t: number; v: number; moved: boolean; id: number; handle: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (desktop) return; const t = e.target as HTMLElement, h = t.closest('.handle,[data-drag]');
    if (!h || t.closest('button:not(.handle),input,select,textarea,a,label,.chips')) return;
    drag.current = { y: e.clientY, top, last: e.clientY, t: performance.now(), v: 0, moved: false, id: e.pointerId, handle: !!t.closest('.handle') };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || e.pointerId !== d.id) return; const dy = e.clientY - d.y;
    if (!d.moved) { if (Math.abs(dy) < 5) return; d.moved = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
    let nt = d.top + dy; if (nt < tops.full) nt = tops.full - (tops.full - nt) * 0.25; if (nt > tops.collapsed) nt = tops.collapsed + (nt - tops.collapsed) * 0.25;
    const ts = performance.now(); d.v = (e.clientY - d.last) / Math.max(1, ts - d.t); d.last = e.clientY; d.t = ts; setDragTop(nt);
  };
  const onUp = () => {
    const d = drag.current; drag.current = null; if (!d) return;
    if (!d.moved) { if (d.handle) setSnap(snap === 'collapsed' ? 'half' : snap === 'half' ? 'full' : 'collapsed'); return; }
    const cur = dragTop ?? top, order: Snap[] = ['full', 'half', 'collapsed'];
    const target = d.v < -0.4 ? ([...order].reverse().find(k => tops[k] < cur - 1) ?? 'full') : d.v > 0.4 ? (order.find(k => tops[k] > cur + 1) ?? 'collapsed') : order.reduce((b, k) => Math.abs(tops[k] - cur) < Math.abs(tops[b] - cur) ? k : b, 'half' as Snap);
    setSnap(target); setDragTop(null);
  };

  const planItems = plan.stops.map(id => byId.get(id)).filter(Boolean) as Item[];
  const sim = simulate(planItems, plan.day, plan.start, origin);
  const mapItems = useMemo(() => (view === 'plan' ? items : list.map(x => x.it)), [view, items, list]);
  const pinClass = useCallback((it: Item) => {
    if (it.t === 'm') return it.status === 'unconf' ? 'unconf' : it.status === 'cancel' ? 'cancel' : '';
    if (!it.h) return '';
    const s = placeNow(it, now); return s.open ? 'open-now' : (f.time === 'now' || f.time === 'today') ? 'closed' : '';
  }, [now, f.time]);
  const selItem = sel ? byId.get(sel) : null;

  return (
    <div className="shell" ref={shell}>
      <MapView items={mapItems} sel={view === 'detail' ? sel : null} planIds={view === 'plan' ? plan.stops : []} me={me} bottomPad={bottomPad}
        focus={focus} fit={fit} route={view === 'plan' && planItems.length ? [origin, ...planItems] : []} pinClass={pinClass} onSelect={open} />
      <div className={`sheet${dragTop == null ? ' snapping' : ''}`} ref={sheet} style={desktop ? undefined : { transform: `translateY(${top - 12}px)` }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <button className="handle" aria-label="Paneel groter of kleiner" onClick={e => { if (e.detail === 0) setSnap(snap === 'collapsed' ? 'half' : snap === 'half' ? 'full' : 'collapsed'); }} />
        <div className="sheet-scroll" ref={scroller} style={{ ['--hid' as string]: desktop ? '0px' : `${top - 12}px`, ['--barpad' as string]: barOn ? '74px' : '0px' }}>
          <div className="view" key={view + (sel ?? '')}>
            {err ? <div className="empty"><h3>De gegevens laden niet</h3><p>Controleer je verbinding en probeer het opnieuw.</p><div className="btns"><button className="btn sm primary" onClick={() => location.reload()}>Opnieuw laden</button></div></div>
              : !places ? <div aria-busy="true" aria-label="Laden" style={{ paddingTop: 16 }}>{Array.from({ length: 6 }, (_, i) => <div key={i} className="skrow"><div className="sk" style={{ width: 40, height: 40, borderRadius: 11 }} /><div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><div className="sk" style={{ height: 13, width: '70%' }} /><div className="sk" style={{ height: 11, width: '45%' }} /></div><div className="sk" style={{ width: 32, height: 32, borderRadius: '50%' }} /></div>)}</div>
              : view === 'detail' && selItem ? <DetailView it={selItem} c={c} backLabel={prev === 'plan' ? `Mijn ${DAYS_LONG[dayStart(plan.day).getDay()]}` : 'Lijst'} />
              : view === 'plan' ? <PlanView c={c} items={items} plan={plan} setPlan={p => { setPlan(p); if (p.stops && !p.day && p.stops.length === plan.stops.length) setOptimized(true); }} optimizeSeen={optimized} />
              : <ListView c={c} list={list} total={list.length} limit={limit} more={() => setLimit(limit + 40)} counts={counts} nPlaces={places.length} />}
          </div>
        </div>
      </div>
      <button className={`planbar${barOn ? '' : ' off'}`} onClick={openPlan} aria-label={`Open mijn dagplan: ${plan.stops.length} stops`}>
        <span className="pb-n tnum">{plan.stops.length}</span>
        <span className="pb-t"><b>Mijn {DAYS_LONG[dayStart(plan.day).getDay()]}</b><span>{sim.bad ? <><i className="pb-warn" style={{ background: 'var(--bad)' }} />{sim.bad} klopt niet · </> : sim.warn ? <><i className="pb-warn" />{sim.warn} aandachtspunt{sim.warn > 1 ? 'en' : ''} · </> : null}{plan.stops.length} stop{plan.stops.length > 1 ? 's' : ''} · klaar ±{hm(sim.end)}</span></span>
        <Ic n="chev" />
      </button>
      <div className={`toast${toast ? ' on' : ''}`} role="status" aria-live="polite">{toast && <><Ic n="info" /><span>{toast}</span></>}</div>
    </div>
  );
}
