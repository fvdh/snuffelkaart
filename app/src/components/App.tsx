import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Item, LatLon, Market, Place } from '../lib/model';
import { km, DEFAULT_CENTER, isoDay, addDays, DAYS_LONG, dayStart, hm, dShort, minutesOf } from '../lib/model';
import { placeNow, openOn, setWindow } from '../lib/hours';
import { visible, matches, groupOf, type Filters } from '../lib/filter';
import { siteIndex } from '../lib/seo';
import type { Spot } from '../lib/pdok';
import MapView, { type Bounds } from './MapView';
import { ListView, DetailView, PlanView, MeView, LoginView, DagView, WaarView, OnderwegView, GedeeldView, statusFor, effStart, type Ctx, type Plan } from './Views';
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
const useMQ = (q: string) => { const [d, setD] = useState(() => matchMedia(q).matches); useEffect(() => { const m = matchMedia(q), f = () => setD(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []); return d; };
/** Vanaf 700 px: paneel naast de kaart (iPad staand zwevend); vanaf 980 px: menu bovenin; vanaf 1200 px: Mijn dag als derde kolom. */
const PLANISH = ['plan', 'dag', 'onderweg'] as const;

type View = 'list' | 'detail' | 'plan' | 'me' | 'login' | 'dag' | 'waar' | 'onderweg' | 'gedeeld' | BijView;
type Aside = null | (typeof PLANISH)[number];
type Snap = 'collapsed' | 'half' | 'full';

watchErrors(); // één keer bij het laden van de module

export default function App() {
  const [now, testClock] = useNow(), desktop = useMQ('(min-width: 700px)'), topNav = useMQ('(min-width: 980px)'), wide = useMQ('(min-width: 1200px)'), today = isoDay(now);
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

  const [f, setFState] = useState<Filters>(() => ({ type: 'all', open: false, gratis: false, overdekt: false, q: '', hide: [] }));
  const [view, setView] = useState<View>('list'), [prev, setPrev] = useState<View>('list'), [sel, setSel] = useState<string | null>(null), [aside, setAside] = useState<Aside>(null);
  const [dir, setDir] = useState<'fwd' | 'back' | null>(null), [snap, setSnap] = useState<Snap>('half'), [limit, setLimit] = useState(40);
  // Locatie pas na een tik (A10) en nooit opgeslagen; een gekozen plaats wel.
  const [me, setMe] = useState<LatLon | null>(null), [spot, setSpot] = useLocal<Spot | null>('snuffel-plek', null);
  const [locDenied, setLocDenied] = useState(false), [locating, setLocating] = useState(false), [recent, setRecent] = useLocal<Spot[]>('snuffel-recent', []);
  const origin = me ?? spot ?? DEFAULT_CENTER, originLabel = me ? null : spot?.label ?? 'Amersfoort';
  const [favs, setFavs] = useLocal<string[]>('snuffel-favs', []);
  // Het moment voor lijst, kaart en detail: nu (null) of een dag + vertrektijd binnen twee weken. Niet bewaard: de app opent op nu.
  const [whenRaw, setWhen] = useState<{ day: string; start: number } | null>(null);
  const when = whenRaw && whenRaw.day >= today && whenRaw.day <= addDays(today, 13) ? whenRaw : null;
  const day = when?.day ?? today, min = when ? when.start : minutesOf(now), nowMode = !when;
  // Het dagplan heeft een eigen dag en vertrektijd (-1 = nu), los van wat je in de lijst bekijkt (Freek, 29 okt: ontwerp "de snuffellus").
  const [planRaw, setPlanRaw] = useLocal<Plan>('snuffel-plan', { day: today, start: -1, stops: [] });
  const plan: Plan = { ...planRaw, day: planRaw.day >= today && planRaw.day <= addDays(today, 13) ? planRaw.day : today };
  // Altijd vanaf de laatste stand rekenen: snelle tikken achter elkaar mogen elkaar niet overschrijven.
  const planRef = useRef(plan); planRef.current = plan;
  const setPlan = (p: Partial<Plan>) => { const n = { ...planRef.current, ...p }; planRef.current = n; setPlanRaw(n); if (p.stops) setOptimized(false); };
  const [optimized, setOptimized] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Breedte van de lijst op desktop/iPad: versleepbaar, onthouden per apparaat. Kaart houdt minstens 320 px.
  const [side, setSideRaw] = useLocal('snuffel-breedte', 400), [resizing, setResizing] = useState(false), dragging = useRef(false);
  const setSide = (w: number) => setSideRaw(Math.round(Math.max(300, Math.min(w, 680, innerWidth - 320))));
  const [focus, setFocus] = useState<{ lat: number; lon: number; key: number } | null>(null), [fit, setFit] = useState<{ pts: LatLon[]; key: number } | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);

  const all = useMemo(() => visible(items, f, now, origin, day, min), [items, f, now, origin, day, min]);
  // Desktop/iPad: de lijst toont wat er op de kaart in beeld is (lijst en kaart staan naast elkaar). Zoeken op naam blijft landelijk.
  // Telefoon: niet, daar bedekt het paneel de kaart grotendeels. ponytail: rechthoek van de kaart, geen rekening met de dagplanbalk.
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const inView = desktop && !!bounds && !f.q && !f.only;
  const list = useMemo(() => inView ? all.filter(({ it }) => it.lon >= bounds!.w && it.lon <= bounds!.e && it.lat >= bounds!.s && it.lat <= bounds!.n) : all, [all, inView, bounds]);
  const counts = useMemo(() => {
    // Tellers horen bij de kop "rond <plaats>": alleen binnen 25 km, niet heel Nederland (UX-review 28 okt).
    const near = (x: LatLon) => km(origin, x) < 25, g = items.filter(it => near(it) && matches(it, { ...f, open: false, q: '', only: null }, now, day, min)).map(it => groupOf(it, day, min));
    return { open: g.filter(x => x === 'open').length, later: g.filter(x => x === 'later').length, unknown: g.filter(x => x === 'unknown').length };
  }, [items, now, origin, day, min, f]);

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
    setView(view === 'detail' ? prev : view === 'login' || view === 'contrib' ? 'me' : view === 'onderweg' || view === 'dag' ? 'plan' : 'list'); if (view === 'detail') setSel(null); setPrev('list');
  };
  // ---------- account (M3) ----------
  // Na inloggen: favorieten van dit apparaat gaan mee (samenvoegen). Bij een latere start wint je account: zo komt een favoriet
  // die je op een ander apparaat weghaalde niet terug. ponytail: offline weghalen terwijl ingelogd gaat daardoor verloren.
  const [sess, setSess] = useState<Session | null>(null), favsRef = useRef(favs); favsRef.current = favs;
  const rest = (path: string, init?: RequestInit) => sess ? api(sess, `rest/v1/${path}`, init, setSess).catch(e => { if (e instanceof LoggedOut) { setSess(null); setToast(e.message); } throw e; }) : Promise.reject(new Error('niet ingelogd'));
  useEffect(() => {
    const back = location.hash.includes('access_token'), e = returnError(), s = readSession();
    if (e) { setToast(/invalid|expired/i.test(e) ? 'Deze inloglink is al gebruikt of verlopen. Alleen de nieuwste link werkt; vraag er hier een nieuwe aan.' : `Inloggen lukte niet (${e}). Vraag een nieuwe link aan.`); setView('login'); setSnap('full'); }
    setSess(s);
    if (s && back) { setSnap('full'); sessionStorage.setItem('snuffel-samenvoegen', '1'); if (!resume()) setView('me'); }
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
      // Na inloggen terug naar wat je wilde doen, ook als de inloglink de app opnieuw opent (UX-review 29 okt).
      if (!sess && v !== 'contrib') { try { sessionStorage.setItem('snuffel-terug', JSON.stringify({ v, id: id ?? sel })); } catch { /* privémodus */ } setToast('Log in om bij te dragen. Daarna ga je meteen verder.'); setDir('fwd'); setPrev(view); setView('login'); setSnap('full'); return; }
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
  const resume = () => { try { const t = JSON.parse(sessionStorage.getItem('snuffel-terug') ?? 'null'); sessionStorage.removeItem('snuffel-terug'); if (!t?.v) return false; if (t.id) setSel(t.id); setView(t.v); return true; } catch { return false; } };
  const toggleFav = (id: string) => {
    const on = !favs.includes(id); setFavs(on ? [...favs, id] : favs.filter(x => x !== id));
    if (!sess) return setToast(on ? 'Bewaard op dit apparaat.' : 'Niet meer bewaard.');
    setToast(on ? 'Bewaard in je account.' : 'Niet meer bewaard.');
    (on ? rest('favorites', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ item_id: id }) }) : rest(`favorites?item_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }))
      .catch(() => setToast('Opslaan in je account lukte niet. Op dit apparaat staat het wel.'));
  };
  const openMe = () => { setDir('fwd'); setPrev(view); setView('me'); setSnap('full'); scrollTop(); }; // groot paneel: op mobiel het hele scherm
  const showFavs = () => { const pts = favs.map(id => byId.get(id)).filter(Boolean) as Item[]; setFState(o => ({ ...o, only: favs, open: false, q: '' })); setDir('back'); setView('list'); setSel(null); if (pts.length) setFit({ pts, key: Date.now() }); if (!desktop) setSnap('collapsed'); };
  // Delen: een winkel via zijn eigen pagina (vast adres, ook vindbaar), een markt via de app; het systeemmenu, anders kopiëren.
  const shareIdx = useMemo(() => places ? siteIndex(places, []) : null, [places]);
  const shareLink = (title: string, text: string, url: string) => {
    if (navigator.share) return navigator.share({ title, text, url }).catch(() => {});
    navigator.clipboard?.writeText(`${text} ${url}`).then(() => setToast('Link gekopieerd. Plak hem in een bericht.'), () => setToast(url));
  };
  const shareItem = (it: Item) => { const st = statusFor(it, now, day, nowMode ? undefined : min); shareLink(it.name, `${it.name}${it.place ? `, ${it.place}` : ''} · ${st.txt}`, location.origin + (it.t === 'k' && shareIdx ? shareIdx.url(it.id) : `/?open=${encodeURIComponent(it.id)}`)); };
  const sharePlan = () => { const q = new URLSearchParams({ dag: plan.day, v: String(effStart(plan, now)), s: plan.stops.join(',') }); shareLink(`Mijn ${DAYS_LONG[dayStart(plan.day).getDay()]}`, `Mijn ${DAYS_LONG[dayStart(plan.day).getDay()]} op Snuffelkaart: ${plan.stops.length} ${plan.stops.length === 1 ? 'stop' : 'stops'}.`, `${location.origin}/?${q}`); };
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
    const next: Partial<Plan> = { stops: [...plan.stops, id] };
    // Eerste stop: het plan neemt het moment over dat je bekijkt (of de dag van de markt).
    if (!plan.stops.length) { next.from = here; next.day = it.t === 'm' ? it.date : day; next.start = next.day === today && nowMode ? -1 : when && next.day === when.day ? when.start : 600; next.done = []; next.skip = []; }
    if (it.t === 'm' && it.date !== (next.day ?? plan.day)) setToast(`Let op: deze markt is op ${DAYS_LONG[dayStart(it.date).getDay()]}.`);
    else if (it.t === 'm' && !plan.stops.length && it.date !== day) setToast(`Je dag staat nu op ${DAYS_LONG[dayStart(it.date).getDay()]}, de dag van deze markt.`);
    else if (it.t === 'm' && it.status === 'unconf') setToast('Toegevoegd. Deze datum is nog niet bevestigd.');
    else if (it.t === 'k' && !it.h) setToast('Toegevoegd. De openingstijden zijn onbekend; bel even.');
    else if (it.t === 'k' && !openOn(it, next.day ?? plan.day)) setToast(`Let op: deze winkel is op ${DAYS_LONG[dayStart(next.day ?? plan.day).getDay()]} dicht.`);
    setPlan(next);
  };
  const locate = (quiet = false) => {
    if (!navigator.geolocation) return setLocDenied(true);
    if (!quiet) setLocating(true);
    navigator.geolocation.getCurrentPosition(
      p => { const ll = { lat: p.coords.latitude, lon: p.coords.longitude }; setMe(ll); setLocating(false); setLocDenied(false); setFocus({ ...ll, key: Date.now() }); },
      e => { setLocating(false); if (quiet) return; if (e.code === e.PERMISSION_DENIED) setLocDenied(true); else setToast('Je locatie lukte nu niet. Probeer het nog eens, of kies een plaats.'); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 });
  };
  // Vanaf een statische pagina: ?open=<id> opent die winkel of markt, ?plek=…&lat=…&lon=… zet de kaart op een plaats.
  const deep = useRef(new URLSearchParams(location.search));
  useEffect(() => {
    const q = deep.current, id = q.get('open'), plek = q.get('plek'), lat = Number(q.get('lat')), lon = Number(q.get('lon'));
    if (plek && Number.isFinite(lat) && Number.isFinite(lon) && lat) { q.delete('plek'); pickSpot({ label: plek, sub: '', lat, lon }); }
    if (id && byId.has(id)) { q.delete('open'); go(id); }
    const sd = q.get('dag'), ss = q.get('s');
    if (sd && ss && byId.size) { setShared({ day: sd >= today ? sd : today, start: Math.max(0, Math.min(1439, Number(q.get('v')) || 600)), stops: ss.split(',').slice(0, 8) }); ['dag', 'v', 's'].forEach(k => q.delete(k)); setView('gedeeld'); setSnap('full'); }
    if (!q.has('open') && !q.has('plek') && /[?&](open|plek|dag|s)=/.test(location.search)) history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : ''));
  }, [byId]);
  // Al eerder toestemming gegeven? Dan zonder vragen opnieuw ophalen.
  useEffect(() => { navigator.permissions?.query({ name: 'geolocation' }).then(s => s.state === 'granted' && locate(true)).catch(() => {}); }, []);
  const here = me ? { ...me, label: 'je locatie', me: true } : { ...origin, label: originLabel ?? 'Amersfoort' };
  const [shared, setShared] = useState<{ day: string; start: number; stops: string[] } | null>(null);
  const pickSpot = (s: Spot) => { setSpot(s); setMe(null); setRecent([s, ...recent.filter(r => r.label !== s.label)].slice(0, 3)); setFState(o => ({ ...o, q: '' })); setFocus({ lat: s.lat, lon: s.lon, key: Date.now() }); scrollTop(); };
  const openWaar = () => { setDir('fwd'); setPrev(view); setView('waar'); setSnap('full'); scrollTop(); };
  // Mijn dag, het dagvoorstel en onderweg: op een breed scherm als derde kolom naast lijst en kaart, anders als scherm.
  const openPlanish = (v: (typeof PLANISH)[number]) => { if (wide) return setAside(v); setDir('fwd'); if (!PLANISH.includes(view as never)) setPrev(view); setView(v); setSnap(v === 'plan' ? 'half' : 'full'); scrollTop(); };
  const openDag = () => openPlanish('dag'), openPlan = () => openPlanish('plan');
  const planOn = view === 'plan' || view === 'onderweg' || (wide && !!aside);
  useEffect(() => { if (planOn) setFit({ pts: [pFrom, ...plan.stops.map(id => byId.get(id)).filter(Boolean) as Item[]], key: Date.now() }); }, [planOn, plan.stops.join(), plan.day]);
  // Van breed naar smal (raam kleiner): de derde kolom wordt weer een scherm.
  useEffect(() => { if (!wide && aside) { setView(aside); setAside(null); } else if (wide && PLANISH.includes(view as never)) { setAside(view as Aside); setView('list'); } }, [wide]);
  const st = useCallback((it: Item) => statusFor(it, now, day, nowMode ? undefined : min), [now, day, min, nowMode]);

  const c: Ctx = { now, f, online, dataFrom, install, origin, originLabel, locDenied, locating, spot: !!spot, pickSpot, recent: spot ? [spot, ...recent.filter(r => r.label !== spot.label)].slice(0, 3) : recent, me, favs, bij, planStops: plan.stops, planDay: plan.day,
    day, min, live: nowMode, setWhen: w => setWhen(w), st, setF, open, toggleStop, toggleFav, here, locate, back, openPlan, openMe, openDag, openWaar, share: shareItem, user: sess?.email ?? null };
  const planProps = { items, plan, setPlan };
  const closeAside = () => setAside(null);
  const asideCtx: Ctx = { ...c, back: () => aside === 'plan' ? closeAside() : setAside('plan'), openPlan: () => setAside('plan'), openDag: () => setAside('dag') };
  // Mijn dag rekent vanaf het eigen vertrekpunt van het plan; "je locatie" blijft live meebewegen.
  const pFrom = plan.from && !plan.from.me ? plan.from : here;
  const planScreen = (v: (typeof PLANISH)[number], cx0: Ctx) => { const cx: Ctx = { ...cx0, origin: pFrom, originLabel: pFrom.label, me: plan.from?.me ? me : null }; return v === 'dag' ? <DagView c={cx} {...planProps} />
    : v === 'onderweg' ? <OnderwegView c={cx} {...planProps} done={() => { setPlan({ done: [], skip: [] }); cx.openPlan(); }} />
    : <PlanView c={cx} {...planProps} setPlan={p => { setPlan(p); if (p.stops && !p.day && p.stops.length === plan.stops.length) setOptimized(true); }} optimizeSeen={optimized} onderweg={() => wide ? setAside('onderweg') : openPlanish('onderweg')} share={sharePlan} />; };
  const tab = PLANISH.includes(view as never) ? 'dag' : ['me', 'login', 'contrib'].includes(view) ? 'jij' : 'kaart';
  const goTab = (t: string) => { if (t === 'kaart') { setDir('back'); setView('list'); setSel(null); scrollTop(); if (!desktop && snap === 'full') setSnap('half'); } else if (t === 'dag') { if (wide) setAside(aside ? null : 'plan'); else openPlanish('plan'); } else openMe(); };
  const nav = <nav className="tabs" aria-label="Hoofdmenu">
    {topNav && <a className="brand" href="/" aria-label="Snuffelkaart, naar het begin"><span className="brand-mark"><Ic n="tag" /></span>Snuffelkaart</a>}
    {([['kaart', 'map', 'Kaart'], ['dag', 'bon', 'Mijn dag'], ['jij', 'user', 'Jij']] as const).map(([k, icon, label]) => {
      const on = k === 'dag' && wide ? !!aside : tab === k;
      return <button key={k} className="tab" aria-current={on ? 'page' : undefined} aria-pressed={k === 'dag' && wide ? on : undefined} onClick={() => goTab(k)}>
        <span className="tab-ic">{k === 'jij' && sess ? <span className="me-av in">{(name ?? sess.email)[0].toUpperCase()}</span> : <Ic n={icon} />}{k === 'dag' && plan.stops.length > 0 && <i className="tab-n tnum">{plan.stops.length}</i>}</span>{label}</button>; })}
  </nav>;

  // ---------- bottom sheet (mobiel) ----------
  const shell = useRef<HTMLDivElement>(null), sheet = useRef<HTMLElement>(null), scroller = useRef<HTMLDivElement>(null);
  const [tops, setTops] = useState({ full: 12, half: 400, collapsed: 600 }), [dragTop, setDragTop] = useState<number | null>(null);
  const scrollTop = () => requestAnimationFrame(() => scroller.current && (scroller.current.scrollTop = 0));
  const barOn = false;
  useLayoutEffect(() => {
    const H = shell.current!.clientHeight, peek = sheet.current!.querySelector<HTMLElement>('[data-peek]');
    const ph = (peek ? peek.offsetTop + peek.offsetHeight : 180) + (barOn ? 78 : 0), half = Math.round(H * 0.5);
    setTops({ full: 12, half, collapsed: Math.max(half + 40, H - ph) });
  }, [view, sel, f.open, day, barOn, places, desktop, locDenied, me, spot]);
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
  const mapItems = useMemo(() => (planOn ? items : all.map(x => x.it)), [planOn, items, all]);
  const pinClass = useCallback((it: Item) => {
    if (it.t === 'm') return it.status === 'unconf' ? 'unconf' : it.status === 'cancel' ? 'cancel' : '';
    if (!it.h) return '';
    const g = groupOf(it, day, min);
    return g === 'open' ? 'open-now' : f.open && g !== 'later' ? 'closed' : '';
  }, [day, min, f.open]);
  const selItem = sel ? byId.get(sel) : null;

  return (
    <>
    <div className={`shell${aside ? ' has-aside' : ''}`} ref={shell} style={{ ['--side' as string]: `${view === 'me' && topNav ? Math.max(side, Math.min(720, innerWidth - 320 - (aside ? 380 : 0))) : Math.max(300, Math.min(side, 680))}px` }}>
      <MapView home={spot ?? undefined} onBounds={setBounds} items={mapItems} sel={view === 'detail' ? sel : null} planIds={planOn ? plan.stops : []} me={me} bottomPad={bottomPad}
        focus={focus} fit={fit} route={planOn && planItems.length ? [pFrom, ...planItems] : []} pinClass={pinClass} onSelect={open} onLocate={() => locate()} />
      <main className={`sheet${dragTop == null ? ' snapping' : ''}`} ref={sheet} style={desktop ? undefined : { transform: `translateY(${top - 12}px)` }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <button className="handle" aria-label="Paneel groter of kleiner" onClick={e => { if (e.detail === 0) setSnap(snap === 'collapsed' ? 'half' : snap === 'half' ? 'full' : 'collapsed'); }} />
        {topNav && nav}
        <div className="sheet-scroll" ref={scroller} style={{ ['--hid' as string]: desktop ? '0px' : `${top - 12}px`, ['--barpad' as string]: barOn ? '74px' : '0px' }}>
          <div className={`view${dir === 'fwd' ? ' enter' : dir === 'back' ? ' enter-back' : ''}`} key={view + (sel ?? '')}>
            {err ? <div className="empty"><h3>De gegevens laden niet</h3><p>Controleer je verbinding en probeer het opnieuw.</p><div className="btns"><button className="btn sm primary" onClick={() => location.reload()}>Opnieuw laden</button></div></div>
              : !places ? <div aria-busy="true" aria-label="Laden" style={{ paddingTop: 16 }}>{Array.from({ length: 6 }, (_, i) => <div key={i} className="skrow"><div className="sk" style={{ width: 40, height: 40, borderRadius: 11 }} /><div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><div className="sk" style={{ height: 13, width: '70%' }} /><div className="sk" style={{ height: 11, width: '45%' }} /></div><div className="sk" style={{ width: 32, height: 32, borderRadius: '50%' }} /></div>)}</div>
              : view === 'detail' && selItem ? <DetailView it={selItem} c={c} backLabel={PLANISH.includes(prev as never) ? `Mijn ${DAYS_LONG[dayStart(plan.day).getDay()]}` : prev === 'me' ? 'Jij' : prev === 'gedeeld' ? 'Gedeeld rondje' : 'Kaart'} />
              : view === 'me' ? <MeView c={c} items={items} showFavs={showFavs} login={() => { setDir('fwd'); setView('login'); setSnap('full'); scrollTop(); }} logout={logout} download={download} remove={removeAccount} />
              : view === 'login' ? <LoginView c={c} send={email => sendLink(email, location.origin + '/')} done={s => { sessionStorage.setItem('snuffel-samenvoegen', '1'); setSess(s); setDir('back'); if (!resume()) setView('me'); scrollTop(); }} />
              : (view === 'review' || view === 'photo' || view === 'suggest') && selItem?.t === 'k' ? (view === 'review' ? <ReviewView p={selItem} b={bij} back={back} /> : view === 'photo' ? <PhotoView p={selItem} b={bij} back={back} /> : <SuggestView p={selItem} b={bij} back={back} />)
              : view === 'contrib' ? <ContribView b={bij} items={items} back={back} open={id => { setPrev('contrib'); go(id); }} />
              : view === 'waar' ? <WaarView c={c} count={counts.open + counts.later} />
              : view === 'gedeeld' && shared ? <GedeeldView c={c} items={items} shared={shared} plan={plan} take={() => { setPlan({ ...shared, done: [], skip: [] }); setShared(null); openPlan(); }} />
              : PLANISH.includes(view as never) ? planScreen(view as (typeof PLANISH)[number], c)
              : <ListView c={c} inView={inView ? { nearest: () => setFit({ pts: [origin, ...all.slice(0, 5).map(x => x.it)], key: Date.now() }) } : null} list={list} total={list.length} limit={limit} more={() => setLimit(limit + 40)} counts={counts} nPlaces={places.length} />}
          </div>
        </div>
      </main>
      {topNav && view !== 'me' && <div className={`resizer${resizing ? ' on' : ''}`} role="separator" aria-orientation="vertical" aria-label="Breedte van de lijst" tabIndex={0}
        aria-valuemin={300} aria-valuemax={680} aria-valuenow={side} title="Sleep om de lijst breder of smaller te maken; dubbelklik voor de standaardbreedte"
        onPointerDown={e => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* zonder capture werkt slepen ook */ } dragging.current = true; setResizing(true); }}
        onPointerMove={e => { if (dragging.current) setSide(e.clientX); }}
        onPointerUp={() => { dragging.current = false; setResizing(false); }} onPointerCancel={() => { dragging.current = false; setResizing(false); }}
        onDoubleClick={() => setSide(400)}
        onKeyDown={e => { const d = e.key === 'ArrowLeft' ? -24 : e.key === 'ArrowRight' ? 24 : 0; if (d) { e.preventDefault(); setSide(side + d); } }} />}
      {wide && aside && <aside className="dagpanel" aria-label="Mijn dag"><div className="dp-bar"><button className="ibtn" onClick={closeAside} aria-label="Sluit Mijn dag"><Ic n="x" /></button></div>
        <div className="sheet-scroll"><div className="view" key={aside}>{planScreen(aside, asideCtx)}</div></div></aside>}
      {testClock && <a className="testclock" href={location.pathname} title="Terug naar de echte tijd"><Ic n="clock" />Testtijd: {dShort(isoDay(now))} {hm(now.getHours() * 60 + now.getMinutes())} · <u>naar nu</u></a>}
      <div className={`toast${toast ? ' on' : ''}`} role="status" aria-live="polite">{toast && <><Ic n="info" /><span>{toast}</span></>}</div>
    </div>
    {!topNav && <div className="tabbar">{nav}</div>}
    </>
  );
}
