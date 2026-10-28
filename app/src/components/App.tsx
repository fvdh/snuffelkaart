import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Item, LatLon, Market, Place } from '../lib/model';
import { km, DEFAULT_CENTER, isoDay, addDays, DAYS_LONG, dayStart, hm, dShort } from '../lib/model';
import { placeNow, openOn, setWindow } from '../lib/hours';
import { visible, matches, type Filters } from '../lib/filter';
import { simulate } from '../lib/plan';
import type { Spot } from '../lib/pdok';
import MapView, { type Bounds } from './MapView';
import { ListView, DetailView, PlanView, MeView, LoginView, DagView, type Ctx } from './Views';
import { ReviewView, PhotoView, SuggestView, ContribView, type Bij, type BijView } from './Bijdragen';
import { applyExtra, NO_EXTRA, type Extra, type Contribution, type Kind } from '../lib/bijdragen';
import { readSession, returnError, api, sendLink, userId, logout as authLogout, mergeFavs, LoggedOut, SB, KEY, type Session } from '../lib/auth';
import { applyStatus, type Live } from '../lib/markets';
import { Ic, reduced } from './ui';
import { watchErrors } from '../lib/errors';

/** "Nu", met ?nu=2026-10-31T09:10 om tijdsbewust gedrag te testen. */
function useNow(): [Date, boolean] {
  const fixed = useMemo(() => { const v = new URLSearchParams(location.search).get('nu'); const d = v ? new Date(v) : null; return d && !isNaN(+d) ? d : null; }, []);
  const [now, setNow] = useState(() => fixed ?? new Date());
  useEffect(() => { if (fixed) return; const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, [fixed]);
  return [now, !!fixed];
}
/** Per-apparaat-opslag (favorieten, dagplan). Mag stil falen. */
function useLocal<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; } });
  return [v, (n: T) => { setV(n); try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* privémodus */ } }];
}
const useDesktop = () => { const q = '(min-width: 980px)'; const [d, setD] = useState(() => matchMedia(q).matches); useEffect(() => { const m = matchMedia(q), f = () => setD(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []); return d; };

type View = 'list' | 'detail' | 'plan' | 'me' | 'login' | 'dag' | BijView;
type Snap = 'collapsed' | 'half' | 'full';

watchErrors(); // één keer bij het laden van de module

export default function App() {
  const [now, testClock] = useNow(), desktop = useDesktop(), today = isoDay(now);
  const [places, setPlaces] = useState<Place[] | null>(null), [err, setErr] = useState(false);
  const [dataFrom, setDataFrom] = useState<string | null>(null);
  const [extra, setExtra] = useState<Extra>(NO_EXTRA);
  // Bijdragen van bezoekers (extra.json) liggen over de winkels heen: hun tijden tellen ook voor "Nu open". Ontbreekt het bestand, dan gewoon zonder.
  useEffect(() => {
    Promise.all([fetch('/data/places.json').then(r => r.json()), fetch('/data/extra.json').then(r => (r.ok ? r.json() : NO_EXTRA)).catch(() => NO_EXTRA)])
      .then(([j, x]) => { setWindow(j.from, j.holidays); setExtra(x); setPlaces(applyExtra(j.places, x)); setDataFrom(j.generated); }).catch(() => setErr(true));
  }, []);
  // Offline (sw.js geeft de laatst geladen gegevens) en "zet op beginscherm".
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); addEventListener('online', on); addEventListener('offline', off); return () => { removeEventListener('online', on); removeEventListener('offline', off); }; }, []);
  const [installEvt, setInstallEvt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null), [installNo, setInstallNo] = useLocal('snuffel-install-nee', false);
  useEffect(() => { const f = (e: Event) => { e.preventDefault(); setInstallEvt(e as Event & { prompt: () => Promise<void> }); }; addEventListener('beforeinstallprompt', f); return () => removeEventListener('beforeinstallprompt', f); }, []);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const install = standalone || installNo || !(installEvt || ios) ? null : {
    add: () => { if (installEvt) { installEvt.prompt().catch(() => {}); setInstallEvt(null); } else setToast('Tik op Deel (het vierkantje met de pijl) en kies “Zet op beginscherm”.'); },
    no: () => setInstallNo(true),
  };
  // Echte markten uit de agenda's van organisatoren (scripts/fetch-markets.mjs). Lukt dat niet: geen markten, nooit verzonnen.
  const [allMarkets, setAllMarkets] = useState<Market[]>([]);
  useEffect(() => { fetch('/data/markets.json').then(r => r.json()).then(j => setAllMarkets(j.markets)).catch(() => {}); }, []);
  // Statusbestand (M4): afgelastingen en verborgen winkels binnen minuten, zonder te wachten op een nieuwe build.
  const [live, setLive] = useState<Live | null>(null);
  useEffect(() => {
    if (!SB || !online) return;
    const get = () => fetch(`${SB}/rest/v1/rpc/market_status`, { headers: { apikey: KEY } }).then(r => r.ok ? r.json() : null).then(j => j && setLive(j)).catch(() => {});
    get(); const t = setInterval(get, 5 * 60_000), vis = () => document.visibilityState === 'visible' && get();
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [online]);
  const shown = useMemo(() => applyStatus(allMarkets, places ?? [], live), [allMarkets, places, live]);
  const markets = useMemo(() => shown.markets.filter(m => m.date >= today), [shown, today]);
  const items: Item[] = useMemo(() => [...(places ? shown.places : []), ...markets], [places, shown, markets]);
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const [f, setFState] = useState<Filters>(() => ({ type: 'all', open: true, gratis: false, overdekt: false, q: '', hide: [] }));
  const [view, setView] = useState<View>('list'), [prev, setPrev] = useState<View>('list'), [sel, setSel] = useState<string | null>(null);
  const [dir, setDir] = useState<'fwd' | 'back' | null>(null), [snap, setSnap] = useState<Snap>('half'), [limit, setLimit] = useState(40);
  // Locatie pas na een tik (A10) en nooit opgeslagen; een gekozen plaats wel.
  const [me, setMe] = useState<LatLon | null>(null), [spot, setSpot] = useLocal<Spot | null>('snuffel-plek', null);
  const [locDenied, setLocDenied] = useState(false), [welcomed, setWelcomed] = useLocal('snuffel-welkom', false);
  const origin = me ?? spot ?? DEFAULT_CENTER, originLabel = me ? null : spot?.label ?? 'Amersfoort';
  const [favs, setFavs] = useLocal<string[]>('snuffel-favs', []);
  const [planRaw, setPlanRaw] = useLocal('snuffel-plan', { day: today, start: 570, stops: [] as string[] });
  // "Wanneer ga je?": één dag voor de hele app (lijst, kaart, dagvoorstel en dagplan). De app opent op vandaag (je bent meestal in de buurt),
  // tenzij je een dagplan hebt: dan op die dag. Binnen twee weken: verder vooruit zijn de tijden niet uitgerekend.
  const [dayRaw, setDay] = useState<string | null>(() => planRaw.stops.length ? planRaw.day : null);
  const day = dayRaw && dayRaw >= today && dayRaw <= addDays(today, 13) ? dayRaw : today;
  const plan = { ...planRaw, day };
  // Altijd vanaf de laatste stand rekenen: snelle tikken achter elkaar mogen elkaar niet overschrijven.
  const planRef = useRef(plan); planRef.current = plan;
  const setPlan = (p: Partial<typeof plan>) => { const n = { ...planRef.current, ...p }; planRef.current = n; setPlanRaw(n); if (p.day) setDay(p.day); if (p.stops) setOptimized(false); };
  const [optimized, setOptimized] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Breedte van de lijst op desktop/iPad: versleepbaar, onthouden per apparaat. Kaart houdt minstens 320 px.
  const [side, setSideRaw] = useLocal('snuffel-breedte', 400), [resizing, setResizing] = useState(false), dragging = useRef(false);
  const setSide = (w: number) => setSideRaw(Math.round(Math.max(300, Math.min(w, 680, innerWidth - 320))));
  const [focus, setFocus] = useState<{ lat: number; lon: number; key: number } | null>(null), [fit, setFit] = useState<{ pts: LatLon[]; key: number } | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);

  const all = useMemo(() => visible(items, f, now, origin, day), [items, f, now, origin, day]);
  // Desktop/iPad: de lijst toont wat er op de kaart in beeld is (lijst en kaart staan naast elkaar). Zoeken op naam blijft landelijk.
  // Telefoon: niet, daar bedekt het paneel de kaart grotendeels. ponytail: rechthoek van de kaart, geen rekening met de dagplanbalk.
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const inView = desktop && !!bounds && !f.q && !f.only;
  const list = useMemo(() => inView ? all.filter(({ it }) => it.lon >= bounds!.w && it.lon <= bounds!.e && it.lat >= bounds!.s && it.lat <= bounds!.n) : all, [all, inView, bounds]);
  const counts = useMemo(() => {
    // Tellers horen bij de kop "rond <plaats>": alleen binnen 25 km, niet heel Nederland (UX-review 28 okt).
    const near = (x: LatLon) => km(origin, x) < 25, ps = places ? shown.places.filter(near) : [];
    return { kOpen: ps.filter(p => matches(p, { ...f, open: true, q: '', only: null }, now, day)).length, mDay: markets.filter(m => near(m) && m.date === day && m.status !== 'cancel').length };
  }, [places, shown, markets, now, origin, day, f]);

  const setF = useCallback((p: Partial<Filters>) => { setFState(o => ({ ...o, ...p })); setLimit(40); if (view !== 'list') { setView('list'); setSel(null); } }, [view]);
  const go = (id: string) => { const it = byId.get(id); if (!it) return; setDir('fwd'); if (view !== 'detail') setPrev(view); setSel(id); setView('detail'); if (snap === 'collapsed') setSnap('half'); setFocus({ lat: it.lat, lon: it.lon, key: Date.now() }); scrollTop(); };
  // Lijst → detail: de naam vliegt naar de titel (View Transition, 300 ms). Zonder ondersteuning: gewoon openen.
  const open = (id: string, from?: HTMLElement | null) => {
    if (!from || !document.startViewTransition || reduced()) return go(id);
    const title = () => sheet.current?.querySelector<HTMLElement>('.view h2');
    from.style.viewTransitionName = 'vt-title';
    const t = document.startViewTransition(() => { from.style.viewTransitionName = ''; flushSync(() => go(id)); const h = title(); if (h) h.style.viewTransitionName = 'vt-title'; });
    t.ready.catch(() => {}); // afgebroken (tab op de achtergrond): de wissel zelf gaat gewoon door
    t.finished.catch(() => {}).finally(() => { const h = title(); if (h) h.style.viewTransitionName = ''; });
  };
  const FORMS: View[] = ['review', 'photo', 'suggest'];
  const back = () => {
    setDir('back'); scrollTop();
    if (FORMS.includes(view)) return setView('detail'); // terug naar de winkel; prev blijft staan
    setView(view === 'detail' ? prev : view === 'login' || view === 'contrib' ? 'me' : 'list'); if (view === 'detail') setSel(null); setPrev('list');
  };
  // ---------- account (M3) ----------
  // Na inloggen: favorieten van dit apparaat gaan mee (samenvoegen). Bij een latere start wint je account: zo komt een favoriet
  // die je op een ander apparaat weghaalde niet terug. ponytail: offline weghalen terwijl ingelogd gaat daardoor verloren.
  const [sess, setSess] = useState<Session | null>(null), favsRef = useRef(favs); favsRef.current = favs;
  const rest = (path: string, init?: RequestInit) => sess ? api(sess, `rest/v1/${path}`, init, setSess).catch(e => { if (e instanceof LoggedOut) { setSess(null); setToast(e.message); } throw e; }) : Promise.reject(new Error('niet ingelogd'));
  useEffect(() => {
    const back = location.hash.includes('access_token'), e = returnError(), s = readSession();
    if (e) { setToast(/invalid|expired/i.test(e) ? 'Deze inloglink is al gebruikt of verlopen. Alleen de nieuwste link werkt; vraag er hier een nieuwe aan.' : `Inloggen lukte niet (${e}). Vraag een nieuwe link aan.`); setWelcomed(true); setView('login'); setSnap('full'); }
    setSess(s);
    if (s && back) { setWelcomed(true); setView('me'); setSnap('full'); sessionStorage.setItem('snuffel-samenvoegen', '1'); }
  }, []);
  useEffect(() => {
    if (!sess) return;
    rest('favorites?select=item_id&order=created_at').then(async (rows: { item_id: string }[]) => {
      const remote = rows.map(r => r.item_id);
      if (sessionStorage.getItem('snuffel-samenvoegen')) {
        sessionStorage.removeItem('snuffel-samenvoegen');
        const { all, upload } = mergeFavs(favsRef.current, remote);
        if (upload.length) await rest('favorites?on_conflict=user_id,item_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(upload.map(item_id => ({ item_id }))) });
        setFavs(all); setToast(`Ingelogd.${upload.length ? ` Je ${upload.length === 1 ? 'bewaarde plek is' : `${upload.length} bewaarde plekken zijn`} meegenomen.` : ''}`);
      } else setFavs(remote);
    }).catch(() => {});
  }, [sess?.email]);
  // ---------- bijdragen (M5) ----------
  const [mine, setMine] = useState<Contribution[]>([]), [name, setName] = useState<string | null>(null);
  const loadMine = () => rest('contributions?select=id,item_id,kind,data,status,reason,created_at&order=created_at.desc').then(setMine).catch(() => {});
  useEffect(() => {
    if (!sess) { setMine([]); setName(null); return; }
    loadMine(); rest('profiles?select=name').then((r: { name: string }[]) => setName(r[0]?.name ?? null)).catch(() => {});
  }, [sess?.email]);
  const bij: Bij = {
    extra, mine, name, user: sess?.email ?? null,
    go: (v, id) => {
      if (!sess && v !== 'contrib') { setToast('Log in om bij te dragen. Daarna kun je meteen verder.'); setDir('fwd'); setPrev(view); setView('login'); setSnap('full'); return; }
      setDir('fwd'); if (id) setSel(id); setView(v); setSnap('full'); scrollTop();
    },
    send: async (kind: Kind, itemId: string, data: Record<string, unknown>, file?: Blob) => {
      if (!sess) throw new Error('Log eerst in.');
      if (file) { // eerst de foto in de eigen map van "nog te keuren"; de bijdrage wijst ernaar
        const path = `${userId(sess)}/${crypto.randomUUID()}.webp`;
        await api(sess, `storage/v1/object/fotos-nieuw/${path}`, { method: 'POST', body: file, headers: { 'Content-Type': 'image/webp' } }, setSess);
        data = { ...data, path };
      }
      const old = kind === 'review' ? mine.find(c => c.kind === 'review' && c.item_id === itemId) : undefined;
      await (old ? rest(`contributions?id=eq.${old.id}`, { method: 'PATCH', body: JSON.stringify({ data }) }) : rest('contributions', { method: 'POST', body: JSON.stringify({ item_id: itemId, kind, data }) }));
      await loadMine();
    },
    setName: async n => { await (name ? rest(`profiles?user_id=eq.${userId(sess!)}`, { method: 'PATCH', body: JSON.stringify({ name: n }) }) : rest('profiles', { method: 'POST', body: JSON.stringify({ name: n }) })); setName(n); },
    withdraw: async id => { await rest(`contributions?id=eq.${id}`, { method: 'DELETE' }); await loadMine(); },
  };
  const toggleFav = (id: string) => {
    const on = !favs.includes(id); setFavs(on ? [...favs, id] : favs.filter(x => x !== id));
    if (!sess) return setToast(on ? 'Bewaard op dit apparaat.' : 'Niet meer bewaard.');
    setToast(on ? 'Bewaard in je account.' : 'Niet meer bewaard.');
    (on ? rest('favorites', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ item_id: id }) }) : rest(`favorites?item_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }))
      .catch(() => setToast('Opslaan in je account lukte niet. Op dit apparaat staat het wel.'));
  };
  const openMe = () => { setDir('fwd'); setPrev(view); setView('me'); setSnap('full'); scrollTop(); }; // groot paneel: op mobiel het hele scherm
  const showFavs = () => { const pts = favs.map(id => byId.get(id)).filter(Boolean) as Item[]; setFState(o => ({ ...o, only: favs, open: false, q: '' })); setDir('back'); setView('list'); setSel(null); if (pts.length) setFit({ pts, key: Date.now() }); if (!desktop) setSnap('collapsed'); };
  const logout = () => { authLogout(sess); setSess(null); setToast('Uitgelogd. Je favorieten blijven op dit apparaat.'); };
  const download = () => {
    const blob = new Blob([JSON.stringify({ email: sess?.email, favorieten: favs.map(id => ({ id, naam: byId.get(id)?.name ?? null })), schermnaam: name, bijdragen: mine.map(({ id, ...c }) => ({ ...c, winkel: byId.get(c.item_id)?.name ?? null })), gedownload: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'snuffelkaart-mijn-gegevens.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  const removeAccount = () => rest('rpc/delete_me', { method: 'POST', body: '{}' }).then(() => { authLogout(null); setSess(null); setToast('Je account is verwijderd, met je e-mailadres en je favorieten in je account.'); })
    .catch(() => setToast('Verwijderen lukte niet. Probeer het later opnieuw.'));
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
  const locate = (quiet = false) => {
    if (!quiet) setWelcomed(true);
    if (!navigator.geolocation) return setLocDenied(true);
    navigator.geolocation.getCurrentPosition(
      p => { const ll = { lat: p.coords.latitude, lon: p.coords.longitude }; setMe(ll); setLocDenied(false); setFocus({ ...ll, key: Date.now() }); },
      e => { if (quiet) return; if (e.code === e.PERMISSION_DENIED) setLocDenied(true); else setToast('Je locatie lukte nu niet. Probeer het nog eens, of zoek een plaats.'); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 });
  };
  // Vanaf een statische pagina: ?open=<id> opent die winkel of markt, ?plek=…&lat=…&lon=… zet de kaart op een plaats.
  const deep = useRef(new URLSearchParams(location.search));
  useEffect(() => {
    const q = deep.current, id = q.get('open'), plek = q.get('plek'), lat = Number(q.get('lat')), lon = Number(q.get('lon'));
    if (plek && Number.isFinite(lat) && Number.isFinite(lon) && lat) { q.delete('plek'); pickSpot({ label: plek, sub: '', lat, lon }); }
    if (id && byId.has(id)) { q.delete('open'); setWelcomed(true); go(id); }
    if (!q.has('open') && !q.has('plek') && /[?&](open|plek)=/.test(location.search)) history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : ''));
  }, [byId]);
  // Al eerder toestemming gegeven? Dan zonder vragen opnieuw ophalen.
  useEffect(() => { navigator.permissions?.query({ name: 'geolocation' }).then(s => s.state === 'granted' && locate(true)).catch(() => {}); }, []);
  const pickSpot = (s: Spot) => { setSpot(s); setMe(null); setWelcomed(true); setFState(o => ({ ...o, q: '' })); setFocus({ lat: s.lat, lon: s.lon, key: Date.now() }); scrollTop(); };
  const pickPlace = () => { setWelcomed(true); setSnap('full'); requestAnimationFrame(() => sheet.current?.querySelector<HTMLInputElement>('input[type=search]')?.focus()); };
  const openDag = () => { setDir('fwd'); setPrev(view); setView('dag'); setSnap('full'); scrollTop(); };
  const openPlan = () => { setDir('fwd'); setPrev(view); setView('plan'); setSnap(desktop ? 'half' : 'half'); scrollTop(); };
  useEffect(() => { if (view === 'plan') setFit({ pts: [origin, ...plan.stops.map(id => byId.get(id)).filter(Boolean) as Item[]], key: Date.now() }); }, [view, plan.stops.join(), plan.day]);

  const c: Ctx = { now, f, online, dataFrom, install, origin, originLabel, locDenied, welcome: !welcomed && !spot && !me, spot: !!spot, pickSpot, pickPlace, me, favs, bij, planStops: plan.stops, day, setDay: (d: string) => setDay(d === today ? null : d), setF, open, toggleStop, toggleFav, locate, back, openPlan, openMe, openDag, user: sess?.email ?? null };

  // ---------- bottom sheet (mobiel) ----------
  const shell = useRef<HTMLDivElement>(null), sheet = useRef<HTMLElement>(null), scroller = useRef<HTMLDivElement>(null);
  const [tops, setTops] = useState({ full: 12, half: 400, collapsed: 600 }), [dragTop, setDragTop] = useState<number | null>(null);
  const scrollTop = () => requestAnimationFrame(() => scroller.current && (scroller.current.scrollTop = 0));
  const barOn = plan.stops.length > 0 && view !== 'plan' && (welcomed || !!spot || !!me);
  useLayoutEffect(() => {
    const H = shell.current!.clientHeight, peek = sheet.current!.querySelector<HTMLElement>('[data-peek]');
    const ph = (peek ? peek.offsetTop + peek.offsetHeight : 180) + (barOn ? 78 : 0), half = Math.round(H * 0.5);
    setTops({ full: 12, half, collapsed: Math.max(half + 40, H - ph) });
  }, [view, sel, f.open, day, barOn, places, desktop, welcomed, locDenied, me, spot]);
  // Toegankelijkheid: na een wissel van scherm (door de gebruiker) gaat de focus naar de titel, zodat een schermlezer het nieuwe scherm voorleest.
  useEffect(() => {
    if (!dir) return;
    const h = sheet.current?.querySelector<HTMLElement>('.view h1, .view h2');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }, [view, sel]);
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
  const mapItems = useMemo(() => (view === 'plan' ? items : all.map(x => x.it)), [view, items, all]);
  const pinClass = useCallback((it: Item) => {
    if (it.t === 'm') return it.status === 'unconf' ? 'unconf' : it.status === 'cancel' ? 'cancel' : '';
    if (!it.h) return '';
    const open = day === today ? placeNow(it, now).open : openOn(it, day);
    return open ? 'open-now' : f.open ? 'closed' : '';
  }, [now, f.open, day]);
  const selItem = sel ? byId.get(sel) : null;

  return (
    <div className="shell" ref={shell} style={{ ['--side' as string]: `${view === 'me' ? Math.max(side, Math.min(720, innerWidth - 320)) : Math.max(300, Math.min(side, 680))}px` }}>
      <MapView home={spot ?? undefined} onBounds={setBounds} items={mapItems} sel={view === 'detail' ? sel : null} planIds={view === 'plan' ? plan.stops : []} me={me} bottomPad={bottomPad}
        focus={focus} fit={fit} route={view === 'plan' && planItems.length ? [origin, ...planItems] : []} pinClass={pinClass} onSelect={open} onLocate={() => locate()} />
      <main className={`sheet${dragTop == null ? ' snapping' : ''}`} ref={sheet} style={desktop ? undefined : { transform: `translateY(${top - 12}px)` }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <button className="handle" aria-label="Paneel groter of kleiner" onClick={e => { if (e.detail === 0) setSnap(snap === 'collapsed' ? 'half' : snap === 'half' ? 'full' : 'collapsed'); }} />
        <div className="sheet-scroll" ref={scroller} style={{ ['--hid' as string]: desktop ? '0px' : `${top - 12}px`, ['--barpad' as string]: barOn ? '74px' : '0px' }}>
          <div className={`view${dir === 'fwd' ? ' enter' : dir === 'back' ? ' enter-back' : ''}`} key={view + (sel ?? '')}>
            {err ? <div className="empty"><h3>De gegevens laden niet</h3><p>Controleer je verbinding en probeer het opnieuw.</p><div className="btns"><button className="btn sm primary" onClick={() => location.reload()}>Opnieuw laden</button></div></div>
              : !places ? <div aria-busy="true" aria-label="Laden" style={{ paddingTop: 16 }}>{Array.from({ length: 6 }, (_, i) => <div key={i} className="skrow"><div className="sk" style={{ width: 40, height: 40, borderRadius: 11 }} /><div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><div className="sk" style={{ height: 13, width: '70%' }} /><div className="sk" style={{ height: 11, width: '45%' }} /></div><div className="sk" style={{ width: 32, height: 32, borderRadius: '50%' }} /></div>)}</div>
              : view === 'detail' && selItem ? <DetailView it={selItem} c={c} backLabel={prev === 'plan' ? `Mijn ${DAYS_LONG[dayStart(plan.day).getDay()]}` : prev === 'me' ? 'Jij' : 'Lijst'} />
              : view === 'me' ? <MeView c={c} items={items} showFavs={showFavs} login={() => { setDir('fwd'); setView('login'); setSnap('full'); scrollTop(); }} logout={logout} download={download} remove={removeAccount} />
              : view === 'login' ? <LoginView c={c} send={email => sendLink(email, location.origin + '/')} done={s => { sessionStorage.setItem('snuffel-samenvoegen', '1'); setSess(s); setDir('back'); setView('me'); scrollTop(); }} />
              : (view === 'review' || view === 'photo' || view === 'suggest') && selItem?.t === 'k' ? (view === 'review' ? <ReviewView p={selItem} b={bij} back={back} /> : view === 'photo' ? <PhotoView p={selItem} b={bij} back={back} /> : <SuggestView p={selItem} b={bij} back={back} />)
              : view === 'contrib' ? <ContribView b={bij} items={items} back={back} open={id => { setPrev('contrib'); go(id); }} />
              : view === 'dag' ? <DagView c={c} items={items} plan={plan} setPlan={setPlan} />
              : view === 'plan' ? <PlanView c={c} items={items} plan={plan} setPlan={p => { setPlan(p); if (p.stops && !p.day && p.stops.length === plan.stops.length) setOptimized(true); }} optimizeSeen={optimized} />
              : <ListView c={c} inView={inView ? { nearest: () => setFit({ pts: [origin, ...all.slice(0, 5).map(x => x.it)], key: Date.now() }) } : null} list={list} total={list.length} limit={limit} more={() => setLimit(limit + 40)} counts={counts} nPlaces={places.length} />}
          </div>
        </div>
      </main>
      {desktop && view !== 'me' && <div className={`resizer${resizing ? ' on' : ''}`} role="separator" aria-orientation="vertical" aria-label="Breedte van de lijst" tabIndex={0}
        aria-valuemin={300} aria-valuemax={680} aria-valuenow={side} title="Sleep om de lijst breder of smaller te maken; dubbelklik voor de standaardbreedte"
        onPointerDown={e => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* zonder capture werkt slepen ook */ } dragging.current = true; setResizing(true); }}
        onPointerMove={e => { if (dragging.current) setSide(e.clientX); }}
        onPointerUp={() => { dragging.current = false; setResizing(false); }} onPointerCancel={() => { dragging.current = false; setResizing(false); }}
        onDoubleClick={() => setSide(400)}
        onKeyDown={e => { const d = e.key === 'ArrowLeft' ? -24 : e.key === 'ArrowRight' ? 24 : 0; if (d) { e.preventDefault(); setSide(side + d); } }} />}
      <aside aria-label="Mijn dagplan"><button className={`planbar${barOn ? '' : ' off'}`} onClick={openPlan} aria-label={`Open mijn dagplan: ${plan.stops.length} stops`}>
        <span className="pb-n tnum" key={plan.stops.length}>{plan.stops.length}</span>
        <span className="pb-t"><b>Mijn {DAYS_LONG[dayStart(plan.day).getDay()]}</b><span>{sim.bad ? <><i className="pb-warn" style={{ background: 'var(--bad)' }} />{sim.bad} klopt niet · </> : sim.warn ? <><i className="pb-warn" />{sim.warn} aandachtspunt{sim.warn > 1 ? 'en' : ''} · </> : null}{plan.stops.length} stop{plan.stops.length > 1 ? 's' : ''} · klaar ±{hm(sim.end)}</span></span>
        <Ic n="chev" />
      </button></aside>
      {testClock && <a className="testclock" href={location.pathname} title="Terug naar de echte tijd"><Ic n="clock" />Testtijd: {dShort(isoDay(now))} {hm(now.getHours() * 60 + now.getMinutes())} · <u>naar nu</u></a>}
      <div className={`toast${toast ? ' on' : ''}`} role="status" aria-live="polite">{toast && <><Ic n="info" /><span>{toast}</span></>}</div>
    </div>
  );
}
