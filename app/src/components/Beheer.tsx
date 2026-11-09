// Beheer: wachtrij (kandidaten uit het Gemeenteblad, markten die van de site van hun organisator verdwenen), markten van deze week,
// winkels, bronnen en het moderatielog. Opbouw volgens het ontwerp (§07): zijbalk, lijst, detail; J/K bladeren, A/U/E/R handelen.
// Inloggen met een link per e-mail (Supabase Auth); wat je mag, bepaalt RLS (tabel admins). Wat je hier zet, komt in `locked`:
// een import overschrijft het niet meer. Sessie en REST: lib/auth.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATS, dLong, type Cat } from '../lib/model';
import { queue, alerts, parseLatLon, type MRow, type Judged, type Run } from '../lib/beheer';
import { CAT, Ic } from './ui';
import { SB, KEY, readSession, sendLink, logout, fresh, api as authApi, type Session } from '../lib/auth';
import { useData, usePeriod, Overzicht, Live, Verkeer, Gedrag, Inhoud, Regios, Dekking, Lezer, Fouten, type Info } from './Inzicht';
import { watchErrors } from '../lib/errors';
import { parseHoursNL } from '../../scripts/hours-from-web.mjs';
import { ohText } from '../lib/bijdragen';

type Row = { id: string; status: string; locked: string[]; data: Record<string, any>; date?: string; updated_at?: string };
const api = (s: Session, path: string, init: RequestInit = {}) => authApi(s, `rest/v1/${path}`, init);
const lock = (r: Row, ...ks: string[]) => [...new Set([...r.locked, ...ks])];
const today = () => new Date().toLocaleDateString('sv-SE');
const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString('sv-SE');
const day = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
// Sneltoets alleen als losse toetsaanslag: letters die snel na elkaar komen zijn typen (bijv. buiten een zoekveld), geen besluit.
let lastKey = 0;
const bursts = new WeakMap<KeyboardEvent, boolean>(); // per toetsaanslag één keer bepalen; meerdere luisteraars vragen het
const typing = (e: KeyboardEvent) => {
  if (!bursts.has(e)) { bursts.set(e, e.timeStamp - lastKey < 350); lastKey = e.timeStamp; }
  return bursts.get(e) || (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
};

watchErrors(); // één keer bij het laden van de module

export default function Beheer() {
  const [s, setS] = useState<Session | null>(null), [ready, setReady] = useState(false);
  useEffect(() => { setS(readSession()); setReady(true); }, []);
  if (!SB || !KEY) return <main className="bh-login"><h1 className="bh-brand">Beheer</h1><p>Beheer is niet ingesteld: SUPABASE_URL en SUPABASE_ANON_KEY ontbreken bij de build.</p></main>;
  if (!ready) return null;
  return s ? <Panel s={s} out={() => { logout(s); setS(null); }} /> : <Login />;
}

function Login() {
  const [email, setEmail] = useState(''), [sent, setSent] = useState(false), [err, setErr] = useState('');
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    try { await sendLink(email, location.origin + '/beheer'); setSent(true); } catch (x) { setErr((x as Error).message); }
  };
  return (<main className="bh-login"><form onSubmit={send}>
    <h1 className="bh-brand"><span className="bh-mark"><Ic n="tag" /></span>Beheer</h1>
    {sent ? <p>Er is een inloglink gestuurd naar <b>{email}</b>. Open hem in deze browser.</p> : <>
      <label>E-mailadres<input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
      <button className="btn primary">Stuur inloglink</button></>}
    {err && <p className="bh-err">{err}</p>}
  </form></main>);
}

type View = 'overzicht' | 'live' | 'verkeer' | 'gedrag' | 'inhoud' | 'regios' | 'wachtrij' | 'kandidaten' | 'week' | 'bijdragen' | 'meldingen' | 'dekking' | 'lezer' | 'winkels' | 'bronnen' | 'fouten' | 'log';
// Indeling volgens het ontwerp (ontwerp/beheer/index.html): groepen in de zijbalk, bovenbalk met periode, ⌘K en licht/donker.
const NAV: [string, [View, string, string][]][] = [
  ['Overzicht', [['overzicht', 'Overzicht', 'home'], ['live', 'Live', 'live']]],
  ['Inzicht', [['verkeer', 'Verkeer', 'chart'], ['gedrag', 'Gedrag', 'route'], ['inhoud', 'Inhoud', 'box'], ['regios', "Regio's", 'pin']]],
  ['Werk', [['wachtrij', 'Wachtrij', 'inbox'], ['kandidaten', 'Kandidaten', 'check'], ['week', 'Markten deze week', 'cal'], ['bijdragen', 'Bijdragen', 'gift'], ['meldingen', 'Meldingen', 'flag']]],
  ['Data', [['dekking', 'Dekking', 'shop'], ['lezer', 'Websitelezer', 'read'], ['winkels', 'Winkels', 'search'], ['bronnen', 'Bronnen', 'db']]],
  ['Systeem', [['fouten', 'Fouten', 'bug'], ['log', 'Log', 'log']]],
];
const VIEWS = NAV.flatMap(([g, it]) => it.map(([k, l]) => [k, g, l] as const));
const PERIOD = new Set<View>(['overzicht', 'verkeer', 'gedrag', 'inhoud', 'regios', 'dekking']), WORK = new Set<View>(['wachtrij', 'kandidaten', 'week', 'bijdragen', 'meldingen', 'winkels']);
const STATUS: Record<string, string> = { org: 'Bevestigd door organisator', chk: 'Gecontroleerd', unconf: 'Nog niet bevestigd', cancel: 'Afgelast', kandidaat: 'Kandidaat', afgewezen: 'Afgewezen' };
const Bi = ({ n }: { n: string }) => <svg className="bi" aria-hidden="true"><use href={`#b-${n}`} /></svg>;
const fromHash = (): View => { const h = location.hash.slice(1) as View; return VIEWS.some(v => v[0] === h) ? h : 'overzicht'; };

function Panel({ s, out }: { s: Session; out: () => void }) {
  const [view, setView] = useState<View>(fromHash), [rows, setRows] = useState<MRow[] | null>(null), [err, setErr] = useState('');
  const [days, setDays] = useState(30), [q, setQ] = useState(''), [pal, setPal] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches));
  const go = (v: View) => { setView(v); history.replaceState(null, '', `#${v}`); scrollTo(0, 0); };
  useEffect(() => { const h = () => setView(fromHash()); addEventListener('hashchange', h); return () => removeEventListener('hashchange', h); }, []);
  const theme = () => { const t = dark ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.setItem('sk-beheer-thema', t); setDark(!dark); };
  const data = useData(s), p = usePeriod(data, days);
  // ponytail: alle markten vanaf vandaag in één keer (±300; PostgREST geeft er max. 1000). Pagineren als het er meer worden.
  useEffect(() => { api(s, `markets?select=id,date,status,locked,data,updated_at&date=gte.${today()}&order=date,id`).then(setRows).catch(e => setErr(e.message)); }, []);
  const [undo, setUndo] = useState<{ before?: Row; what: string; revert?: () => Promise<unknown> } | null>(null);
  const patch = async (r: Row, body: Partial<Row>) => {
    const [n] = await api(s, `markets?id=eq.${encodeURIComponent(r.id)}`, { method: 'PATCH', body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }) });
    setRows(rs => rs!.map(x => x.id === r.id ? n : x)); setErr('');
  };
  // Elk besluit kan 10 seconden terug (knop of Z): de vorige status, gegevens en vastgezette velden komen terug.
  const save = async (r: Row, body: Partial<Row>) => {
    try { await patch(r, body); setUndo({ before: r, what: body.status && body.status !== r.status ? `${r.data.name}: ${STATUS[body.status] ?? body.status}` : `${r.data.name} aangepast` }); }
    catch (e) { setErr((e as Error).message); }
  };
  const revert = () => { if (!undo) return; const { before: b, revert: r } = undo; setUndo(null); (r ? r() : patch(b!, { status: b!.status, data: b!.data, locked: b!.locked })).catch(e => setErr(e.message)); };
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 10000); return () => clearTimeout(t); }, [undo]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPal(true); return; }
      if (e.key === 'z' && undo && !typing(e) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); revert(); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });
  const [runs, setRuns] = useState<Run[]>([]), [reps, setReps] = useState<Rep[]>([]);
  useEffect(() => { api(s, 'reports?select=*&done_at=is.null&order=created_at').then(setReps).catch(() => {}); }, []);
  const [nBij, setNBij] = useState(0);
  useEffect(() => { api(s, 'contributions?select=id&status=eq.nieuw').then(r => setNBij(r.length)).catch(() => {}); }, [view]);
  useEffect(() => { api(s, 'import_runs?select=*&order=at.desc&limit=30').then(setRuns).catch(() => {}); }, []);
  const warn = alerts(runs, new Date());
  const qu = useMemo(() => rows ? queue(rows, today()) : [], [rows]);
  const week = useMemo(() => (rows ?? []).filter(r => r.date <= plusDays(7) && STATUS[r.status] && !['kandidaat', 'afgewezen'].includes(r.status)), [rows]);
  const cands = useMemo(() => (rows ?? []).filter(r => r.status === 'kandidaat' || r.status === 'afgewezen'), [rows]);
  const fout24 = data.fouten.filter(f => Date.now() - Date.parse(f.at) < 864e5).length;
  const count: Partial<Record<View, number>> = { wachtrij: qu.length, kandidaten: cands.filter(r => r.status === 'kandidaat').length, week: week.length, meldingen: reps.length, bijdragen: nBij, fouten: fout24 };
  const hot = new Set<View>(['wachtrij', 'meldingen', 'bijdragen']);
  const crit = qu.filter(j => j.urgent).length;

  const att = <ul className="att">
    {warn.map(w => <li key={w} onClick={() => go('bronnen')}><span className="dot bad" /><span>{w}</span><span className="m">→</span></li>)}
    {qu.length > 0 && <li onClick={() => go('wachtrij')}><span className="dot hot" /><span><b>{qu.length}</b> in de wachtrij{crit ? `, ${crit} kritiek` : ''}</span><span className="m">→</span></li>}
    {reps.length > 0 && <li onClick={() => go('meldingen')}><span className="dot hot" /><span><b>{reps.length}</b> {reps.length === 1 ? 'melding' : 'meldingen'} van bezoekers</span><span className="m">→</span></li>}
    {nBij > 0 && <li onClick={() => go('bijdragen')}><span className="dot k" /><span><b>{nBij}</b> {nBij === 1 ? 'bijdrage' : 'bijdragen'} te keuren</span><span className="m">→</span></li>}
    {fout24 > 0 && <li onClick={() => go('fouten')}><span className="dot warn" /><span><b>{fout24}</b> JavaScript-{fout24 === 1 ? 'fout' : 'fouten'} in de laatste 24 uur</span><span className="m">→</span></li>}
    {!warn.length && !qu.length && !reps.length && !nBij && !fout24 && <li className="calm"><span className="dot ok" /><span>Niets dat op je wacht. Alle bronnen draaiden goed.</span></li>}
  </ul>;

  const [, group, title] = VIEWS.find(v => v[0] === view)!;
  const content = view === 'overzicht' ? <Overzicht d={data} p={p} att={att} />
    : view === 'live' ? <Live d={data} />
    : view === 'verkeer' ? <Verkeer p={p} s={s} />
    : view === 'gedrag' ? <Gedrag p={p} />
    : view === 'inhoud' ? <Inhoud d={data} p={p} q={q} setQ={setQ} />
    : view === 'regios' ? <Regios d={data} p={p} />
    : view === 'dekking' ? <Dekking d={data} p={p} />
    : view === 'lezer' ? <Lezer s={s} />
    : view === 'fouten' ? <Fouten d={data} />
    : !rows && !err ? <p className="adm-loading">Laden…</p>
    : view === 'wachtrij' ? <Markets key="q" title="Wachtrij" items={qu.map(j => ({ row: j.row, j }))} save={save}
        filters={[['Alles', () => true], ['Kritiek', i => !!i.j?.urgent], ['Gemeenteblad', i => i.j?.kind === 'kandidaat'], ['Verdwenen', i => i.j?.kind === 'verdwenen']]}
        empty="De wachtrij is leeg. Nieuwe kandidaten komen elke nacht binnen." />
    : view === 'kandidaten' ? <Markets key="k" title="Kandidaten" items={cands.map(row => ({ row, j: qu.find(j => j.row.id === row.id) }))} save={save}
        filters={[['Te keuren', i => i.row.status === 'kandidaat'], ['Afgewezen', i => i.row.status === 'afgewezen']]} empty="Geen kandidaten." />
    : view === 'week' ? <Markets key="w" title="Markten deze week" items={week.map(row => ({ row }))} save={save}
        filters={[['Alles', () => true], ...(['org', 'chk', 'unconf', 'cancel'] as const).map(k => [STATUS[k].replace(' door organisator', ''), (i: Item) => i.row.status === k] as Filter)]} empty="Geen markten de komende 7 dagen." />
    : view === 'bijdragen' ? <Contribs s={s} setUndo={setUndo} />
    : view === 'meldingen' ? <Reports s={s} reps={reps} setReps={setReps} rows={rows ?? []} />
    : view === 'winkels' ? <Shops s={s} />
    : view === 'bronnen' ? <Sources runs={runs} warn={warn} rows={rows ?? []} />
    : <Log s={s} />;

  return (<div className="admin">
    <aside className="side">
      <div className="brand"><span className="mk"><Ic n="tag" /></span><div><b>Snuffelkaart</b><small>Beheer</small></div></div>
      <nav className="nav" aria-label="Beheer">{NAV.map(([g, items]) => <div key={g}><div className="grp">{g}</div>
        {items.map(([k, l, ic]) => <button key={k} className={view === k ? 'on' : ''} aria-current={view === k ? 'page' : undefined} onClick={() => go(k)}><Bi n={ic} />{l}
          {k === 'live' ? <span className="pulse" /> : k === 'bronnen' && warn.length ? <span className="ct bad">{warn.length}</span> : count[k] ? <span className={`ct${hot.has(k) ? ' hot' : k === 'fouten' ? ' bad' : ''}`}>{count[k]}</span> : null}</button>)}</div>)}</nav>
      <div className="bme"><span className="av">{s.email?.[0]?.toUpperCase()}</span><span className="em">{s.email}</span><button onClick={out} title="Uitloggen" aria-label="Uitloggen">⏻</button></div>
    </aside>
    <div className="main">
      <header className="top">
        <div><div className="crumb">{group}</div><h1>{title}</h1></div><span className="sp" />
        {PERIOD.has(view) && <div className="seg" role="group" aria-label="Periode">{([[1, 'Vandaag'], [7, '7d'], [30, '30d'], [90, '90d']] as const).map(([n, l]) => <button key={n} className={days === n ? 'on' : ''} aria-pressed={days === n} onClick={() => setDays(n)}>{l}</button>)}</div>}
        <button className="kbtn" onClick={() => setPal(true)}><Bi n="search" /><span className="kt">Zoek winkel, markt, pagina…</span><span className="sp" /><span className="kbd">⌘K</span></button>
        <button className="ib" onClick={theme} title={dark ? 'Licht' : 'Donker'} aria-label="Licht of donker"><Bi n="moon" /></button>
      </header>
      {(err || data.err) && <p className="bh-err adm-err" role="alert">{err || data.err}</p>}
      <main className={WORK.has(view) ? 'page work' : 'page'} key={view}>{content}</main>
    </div>
    {undo && <div className="adm-undo" role="status"><span>{undo.what}</span><button className="btn sm" onClick={revert}>Ongedaan maken <span className="kbd">Z</span></button></div>}
    {pal && <Palette close={() => setPal(false)} info={data.info} pick={(v, name) => { if (name !== undefined) setQ(name); go(v); setPal(false); }} />}
  </div>);
}

/** ⌘K: spring naar een pagina, of naar een winkel/markt/organisator (opent Inhoud, gefilterd op de naam). */
function Palette({ close, info, pick }: { close: () => void; info: Map<string, Info>; pick: (v: View, name?: string) => void }) {
  const [q, setQ] = useState(''), [i, setI] = useState(0);
  const items = useMemo(() => {
    const t = q.trim().toLowerCase(), pages = VIEWS.filter(v => v[2].toLowerCase().includes(t)).map(v => ({ l: v[2], s: 'pagina', go: () => pick(v[0]) }));
    if (t.length < 2) return pages.slice(0, 9);
    const orgs = [...new Set([...info.values()].map(x => x.org).filter((o): o is string => !!o && o.toLowerCase().includes(t)))].slice(0, 4).map(o => ({ l: o, s: 'organisator', go: () => pick('inhoud', o) }));
    const its = [...info.values()].filter(x => x.name.toLowerCase().includes(t) || (x.place ?? '').toLowerCase().includes(t)).slice(0, 8).map(x => ({ l: x.name, s: `${x.t === 'm' ? 'markt' : 'winkel'} · ${x.place ?? ''}`, go: () => pick('inhoud', x.name) }));
    return [...pages, ...orgs, ...its].slice(0, 12);
  }, [q, info]);
  const sel = Math.min(i, items.length - 1);
  return <div className="pal-bg" onClick={e => { if (e.target === e.currentTarget) close(); }}><div className="pal" role="dialog" aria-label="Zoeken">
    <input autoFocus value={q} placeholder="Spring naar… (pagina, winkel, markt of organisator)" onChange={e => { setQ(e.target.value); setI(0); }}
      onKeyDown={e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(sel + 1, items.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(sel - 1, 0)); } else if (e.key === 'Enter') items[sel]?.go(); }} />
    <ul>{items.map((x, n) => <li key={x.l + x.s + n} className={n === sel ? 'on' : ''} onMouseEnter={() => setI(n)} onClick={x.go}>{x.l}<small>{x.s}</small></li>)}</ul>
    {!items.length && <p className="b-empty">Niets gevonden.</p>}
  </div></div>;
}

type Item = { row: MRow; j?: Judged };
type Filter = [string, (i: Item) => boolean];

/** Lijst + detail. Na een besluit verdwijnt het item uit een wachtrij en staat het volgende al klaar. */
function Markets({ title, items, filters, save, empty }: { title: string; items: Item[]; filters: Filter[]; save: (r: Row, b: Partial<Row>) => Promise<void>; empty: string }) {
  const [f, setF] = useState(0), [selId, setSelId] = useState<string | null>(null), lastIdx = useRef(0);
  const list = items.filter(filters[f][1]);
  let idx = list.findIndex(i => i.row.id === selId);
  if (idx < 0) idx = Math.min(lastIdx.current, list.length - 1);
  lastIdx.current = Math.max(idx, 0);
  const cur = list[idx];
  const go = (d: number) => { const n = list[Math.max(0, Math.min(list.length - 1, idx + d))]; if (n) { setSelId(n.row.id); document.getElementById(`it-${n.row.id}`)?.scrollIntoView({ block: 'nearest' }); } };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return; if (e.key === 'j') go(1); else if (e.key === 'k') go(-1); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });
  return (<>
    <section className="adm-q" aria-label={title}>
      <header><h2>{title}</h2><div className="adm-filters">{filters.map(([l, fn], i) => <button key={l} className="chip" aria-pressed={f === i} onClick={() => { setF(i); setSelId(null); lastIdx.current = 0; }}>{l} · {items.filter(fn).length}</button>)}</div></header>
      {list.length ? <ul className="adm-list">{list.map(i => <li key={i.row.id} id={`it-${i.row.id}`}>
        <button className={`adm-item${i === cur ? ' on' : ''}`} aria-current={i === cur} onClick={() => setSelId(i.row.id)}>
          <span className={`tile${i.j?.urgent ? ' crit' : ''}`}><Ic n={i.j?.kind === 'verdwenen' ? 'alert' : i.j ? 'cal' : 'kraam'} /></span>
          <span><b>{i.j?.kind === 'verdwenen' ? `${i.j.label}: ${i.row.data.name}` : i.row.data.name}</b>
            <span>{i.row.data.place}{i.row.data.stage ? ` · ${i.row.data.stage}` : ''}{i.row.data.timeKnown ? ` · ${hm(i.row.data.start)}` : ''}</span>
            {i.j ? <span className={`ai ${i.j.verdict}`}><Ic n="sparkle" />{i.j.label}</span> : <span className={`bh-st ${i.row.status}`}>{STATUS[i.row.status]}</span>}</span>
          <time dateTime={i.row.date}>{day(i.row.date)}</time></button></li>)}</ul>
        : <p className="adm-empty">{empty}</p>}
    </section>
    {cur ? <MarketDetail key={cur.row.id} item={cur} save={save} /> : <aside className="adm-detail" />}
  </>);
}

const EDIT = ['name', 'place', 'addr', 'start', 'end', 'timeKnown'];
const PIN_HINT = 'Plak coördinaten (52.09, 5.12) of een link van Google Maps of OpenStreetMap';
const osmAt = (d: Record<string, any>) => `https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lon}#map=18/${d.lat}/${d.lon}`;

function MarketDetail({ item: { row: r, j }, save }: { item: Item; save: (r: Row, b: Partial<Row>) => Promise<void> }) {
  const d = r.data, [mode, setMode] = useState<'' | 'edit' | 'reject'>(''), [why, setWhy] = useState(''), [form, setForm] = useState({ name: d.name ?? '', place: d.place ?? '', addr: d.addr ?? '', start: d.timeKnown ? hm(d.start) : '', end: d.timeKnown ? hm(d.end) : '', pin: '' });
  const open = r.status === 'kandidaat' || (r.status === 'unconf' && d.vanished && !r.locked.includes('status'));
  const rejectTo = r.status === 'kandidaat' ? 'afgewezen' : 'cancel', whyKey = rejectTo === 'afgewezen' ? 'rejectWhy' : 'cancelWhy';
  const setStatus = (status: string, extra: Record<string, any> = {}) => save(r, { status, data: { ...d, ...extra, ...(status === 'chk' ? { checked: today() } : {}) }, locked: lock(r, 'status', ...Object.keys(extra)) });
  const approve = () => setStatus('chk'), unsure = () => setStatus('unconf');
  // Verplaatst: deze datum is afgelast met de nieuwe datum als reden (die zien bezoekers); de nieuwe staat er al via de import.
  const moved = () => j?.moved && setStatus('cancel', { cancelWhy: `Verplaatst naar ${dLong(j.moved).toLowerCase()}` });
  const reject = () => why.trim() && setStatus(rejectTo, { [whyKey]: why.trim() });
  const saveEdit = () => {
    const t = form.start && form.end ? { start: toMin(form.start), end: toMin(form.end), timeKnown: true } : { timeKnown: false };
    const pin = form.pin.trim() ? parseLatLon(form.pin) : null;
    if (form.pin.trim() && !pin) return;
    save(r, { data: { ...d, name: form.name.trim(), place: form.place.trim(), addr: form.addr.trim() || null, ...t, ...(pin ? { ...pin, exact: true } : {}) }, locked: lock(r, ...EDIT, ...(pin ? ['lat', 'lon', 'exact'] : [])) }).then(() => setMode(''));
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setMode('');
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey || mode) return;
      const a = ({ a: approve, u: unsure, e: () => setMode('edit'), r: () => setMode('reject'), ...(j?.moved ? { v: moved } : {}) } as Record<string, () => void>)[e.key];
      if (a) { e.preventDefault(); a(); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });
  const kind = j?.kind === 'verdwenen' ? j.label : d.snippet ? `Tip uit ${d.org ?? 'het Gemeenteblad'}` : d.org;
  return (<aside className="adm-detail" aria-label="Details">
    <div><p className="eyebrow"><span className="tile"><Ic n={j?.kind === 'verdwenen' ? 'alert' : 'cal'} /></span>{kind}</p>
      <h3>{d.name}</h3>
      <p className="adm-sub">{day(r.date)}{d.timeKnown ? ` · ${hm(d.start)}–${hm(d.end)}` : ' · tijden onbekend'} · {d.place}{d.stage ? ` · ${d.stage}` : ''}</p></div>

    {mode === 'edit' ? <form className="adm-edit" onSubmit={e => { e.preventDefault(); saveEdit(); }}>
      <label>Naam<input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus /></label>
      <div className="pair"><label>Van<input className="input" type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} /></label>
        <label>Tot<input className="input" type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} /></label></div>
      <label>Plaats<input className="input" value={form.place} onChange={e => setForm({ ...form, place: e.target.value })} /></label>
      <label>Adres of locatie<input className="input" value={form.addr} onChange={e => setForm({ ...form, addr: e.target.value })} /></label>
      <label>Pin verplaatsen <span className="muted">(leeg = blijft staan; <a href={osmAt(d)} target="_blank" rel="noopener">huidige plek</a>)</span><input className="input" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} placeholder={PIN_HINT} /></label>
      {form.pin.trim() && !parseLatLon(form.pin) && <p className="bh-err">Geen plek in Nederland herkend.</p>}
      <p className="src"><Ic n="info" /><span>Velden die je hier opslaat, overschrijft een import niet meer.</span></p>
      <div className="adm-btns"><button className="btn primary">Opslaan</button><button type="button" className="btn" onClick={() => setMode('')}>Annuleren <span className="kbd">Esc</span></button></div>
    </form> : <dl className="facts">
      <dt>Status</dt><dd><span className={`bh-st ${r.status}`}>{STATUS[r.status] ?? r.status}</span>{r.locked.includes('status') && <small> · met de hand</small>}</dd>
      <dt>Adres</dt><dd>{d.addr ?? d.venue ?? <span className="muted">{d.exact ? '—' : 'geen; pin midden in de gemeente'}</span>}</dd>
      <dt>Entree</dt><dd>{d.entree ?? '—'}</dd>
      <dt>Bron</dt><dd>{d.url ? <a href={d.url} target="_blank" rel="noopener">{d.org ?? 'bron'} <Ic n="ext" /></a> : d.org}</dd>
      {(d.cancelWhy || d.rejectWhy) && <><dt>Reden</dt><dd>{d.cancelWhy ?? d.rejectWhy}</dd></>}
    </dl>}

    {d.snippet && <blockquote className="adm-quote" tabIndex={0}>{d.snippet}</blockquote>}
    {j && <div className="aibox"><span className={`ai ${j.verdict}`}><Ic n="sparkle" />{j.label}</span><ul>{j.why.map(w => <li key={w}>{w}</li>)}</ul></div>}

    {mode === 'reject' ? <form className="adm-edit" onSubmit={e => { e.preventDefault(); reject(); }}>
      <label>{rejectTo === 'afgewezen' ? 'Waarom afwijzen?' : 'Waarom afgelast?'} <span className="muted">(verplicht, voor het moderatielog)</span>
        <input className="input" required autoFocus value={why} onChange={e => setWhy(e.target.value)} placeholder={rejectTo === 'afgewezen' ? 'Bijv. dubbel, geen markt, verzamellijst' : 'Bijv. weersvoorspelling, organisator meldt het'} /></label>
      <div className="adm-btns"><button className="btn primary bad" disabled={!why.trim()}>{rejectTo === 'afgewezen' ? 'Afwijzen' : 'Afgelasten'}</button><button type="button" className="btn" onClick={() => setMode('')}>Annuleren <span className="kbd">Esc</span></button></div>
    </form> : mode === '' && <>
      <p className="src"><Ic n="info" /><span>{open || r.status !== 'chk' ? 'Goedkeuren: “gecontroleerd op vandaag”, binnen ±15 minuten op de kaart.' : `Gecontroleerd op ${d.checked ?? '?'}. Wijzigingen staan binnen ±15 minuten op de kaart.`}</span></p>
      <div className="adm-btns">
        <button className="btn primary" onClick={approve}><Ic n="check" />{r.status === 'chk' ? 'Opnieuw gecontroleerd' : 'Goedkeuren'} <span className="kbd">A</span></button>
        {j?.moved && <button className="btn" onClick={moved}><Ic n="cal" />Verplaatst naar {day(j.moved)} <span className="kbd">V</span></button>}
        {r.status !== 'unconf' && <button className="btn" onClick={unsure}>Nog niet bevestigd <span className="kbd">U</span></button>}
        <button className="btn" onClick={() => setMode('edit')}>Aanpassen <span className="kbd">E</span></button>
        {r.status !== rejectTo && <button className="btn" onClick={() => setMode('reject')}>{rejectTo === 'afgewezen' ? 'Afwijzen' : 'Afgelast'} <span className="kbd">R</span></button>}
        {r.status === 'afgewezen' && <button className="btn" onClick={() => setStatus('kandidaat')}>Terug naar kandidaten</button>}
      </div></>}
  </aside>);
}

type Rep = { id: number; item_id: string; name: string; what: string; note: string | null; created_at: string };
const WHAT: Record<string, string> = { dicht: 'Gesloten of bestaat niet meer', tijden: 'Andere tijden', plek: 'Verkeerde plek of adres', afgelast: 'Markt gaat niet door', anders: 'Iets anders' };

/** Meldingen van bezoekers ("Klopt er iets niet?"). Afhandelen = uit de lijst; de correctie zelf doe je bij Winkels of Markten. */
function Reports({ s, reps, setReps, rows }: { s: Session; reps: Rep[]; setReps: (r: Rep[]) => void; rows: MRow[] }) {
  const [sel, setSel] = useState(0), [err, setErr] = useState('');
  const r = reps[Math.min(sel, reps.length - 1)], market = r && rows.find(x => x.id === r.item_id);
  const done = async (also?: Promise<unknown>) => {
    try { await also; await api(s, `reports?id=eq.${r.id}`, { method: 'PATCH', body: JSON.stringify({ done_at: new Date().toISOString() }) }); setReps(reps.filter(x => x !== r)); setErr(''); }
    catch (e) { setErr((e as Error).message); }
  };
  const hide = () => done(api(s, `places?id=eq.${encodeURIComponent(r.item_id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'verborgen', updated_at: new Date().toISOString() }) }));
  return (<>
    <section className="adm-q" aria-label="Meldingen">
      <header><h2>Meldingen</h2></header>
      {reps.length ? <ul className="adm-list">{reps.map((x, i) => <li key={x.id}><button className={`adm-item${x === r ? ' on' : ''}`} aria-current={x === r} onClick={() => setSel(i)}>
        <span className="tile"><Ic n="flag" /></span>
        <span><b>{x.name}</b><span>{WHAT[x.what]}{x.note ? ` · ${x.note.slice(0, 60)}` : ''}</span></span>
        <time dateTime={x.created_at}>{new Date(x.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</time></button></li>)}</ul>
        : <p className="adm-empty">Geen open meldingen. Bezoekers melden fouten via “Klopt er iets niet?” bij een winkel of markt.</p>}
    </section>
    {r ? <aside className="adm-detail" aria-label="Details">
      <div><p className="eyebrow"><span className="tile"><Ic n="flag" /></span>{market ? 'Markt' : 'Winkel'}</p><h3>{r.name}</h3>
        <p className="adm-sub">{WHAT[r.what]} · gemeld op {new Date(r.created_at).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })}</p></div>
      {r.note ? <blockquote className="adm-quote" tabIndex={0}>{r.note}</blockquote> : <p className="muted">Geen toelichting.</p>}
      {err && <p className="bh-err">{err}</p>}
      <p className="src"><Ic n="info" /><span>{market ? `Corrigeer de markt onder “Markten deze week” of de wachtrij (status nu: ${STATUS[market.status] ?? market.status}).` : 'Corrigeer de winkel onder “Winkels” (zoek op naam), of verberg hem hier als hij echt dicht is.'}</span></p>
      <div className="adm-btns">
        <a className="btn" href={`/kaart/?open=${encodeURIComponent(r.item_id)}`} target="_blank" rel="noopener">Bekijk op de kaart <Ic n="ext" /></a>
        {!market && r.what === 'dicht' && <button className="btn" onClick={hide}>Winkel verbergen en afhandelen</button>}
        <button className="btn primary" onClick={() => done()}><Ic n="check" />Afgehandeld</button>
      </div>
    </aside> : <aside className="adm-detail" />}
  </>);
}

type Bijdrage = { id: number; user_id: string; item_id: string; kind: 'tijden' | 'review' | 'foto'; data: Record<string, any>; created_at: string };
const KIND: Record<Bijdrage['kind'], [string, string]> = { tijden: ['Openingstijden', 'clock'], review: ['Review', 'star'], foto: ['Foto', 'cam'] };
type Undo = { what: string; revert: () => Promise<unknown> } | null;

/** Bijdragen van bezoekers (M5): goedkeuren of afwijzen met reden (de inzender ziet die, DSA art. 17).
 *  Foto goedkeuren = kopiëren naar de openbare bucket; het origineel in fotos-nieuw ruimt de nachtelijke export op. */
function Contribs({ s, setUndo }: { s: Session; setUndo: (u: Undo) => void }) {
  const [rows, setRows] = useState<Bijdrage[] | null>(null), [names, setNames] = useState<Record<string, string>>({}), [places, setPlaces] = useState<Record<string, Record<string, any>>>({});
  const [sel, setSel] = useState(0), [why, setWhy] = useState(''), [rejecting, setRejecting] = useState(false), [err, setErr] = useState(''), [img, setImg] = useState<string | null>(null);
  useEffect(() => {
    api(s, 'contributions?select=id,user_id,item_id,kind,data,created_at&status=eq.nieuw&order=created_at').then(async (r: Bijdrage[]) => {
      setRows(r); if (!r.length) return;
      const u = [...new Set(r.map(x => x.user_id))], p = [...new Set(r.map(x => x.item_id))];
      const [ns, ps] = await Promise.all([api(s, `profiles?select=user_id,name&user_id=in.(${u.join(',')})`), api(s, `places?select=id,data&id=in.(${p.map(encodeURIComponent).join(',')})`)]);
      setNames(Object.fromEntries(ns.map((x: { user_id: string; name: string }) => [x.user_id, x.name]))); setPlaces(Object.fromEntries(ps.map((x: { id: string; data: any }) => [x.id, x.data])));
    }).catch(e => setErr(e.message));
  }, []);
  const c = rows?.[Math.min(sel, (rows?.length ?? 1) - 1)], pl = c && places[c.item_id];
  // Foto in "nog te keuren" is privé: ophalen met de sessie en als blob tonen.
  useEffect(() => {
    setImg(null); setRejecting(false); setWhy('');
    if (c?.kind !== 'foto') return;
    let url = ''; authApiBlob(s, `storage/v1/object/authenticated/fotos-nieuw/${c.data.path}`).then(b => { url = URL.createObjectURL(b); setImg(url); }).catch(() => setErr('Foto laden lukte niet.'));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [c?.id]);
  const decide = async (status: 'goed' | 'afgewezen', reason?: string) => {
    if (!c) return;
    try {
      if (status === 'goed' && c.kind === 'foto') await authApi(s, 'storage/v1/object/copy', { method: 'POST', body: JSON.stringify({ bucketId: 'fotos-nieuw', sourceKey: c.data.path, destinationBucket: 'fotos', destinationKey: c.data.path }) });
      await api(s, `contributions?id=eq.${c.id}`, { method: 'PATCH', body: JSON.stringify({ status, reason: reason ?? null, decided_at: new Date().toISOString() }) });
      setRows(rs => rs!.filter(x => x !== c)); setErr('');
      setUndo({ what: `${KIND[c.kind][0]} · ${pl?.name ?? c.item_id}: ${status === 'goed' ? 'goedgekeurd' : 'afgewezen'}`, revert: async () => {
        await api(s, `contributions?id=eq.${c.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'nieuw', reason: null, decided_at: null }) });
        if (status === 'goed' && c.kind === 'foto') await authApi(s, `storage/v1/object/fotos/${c.data.path}`, { method: 'DELETE' });
        setRows(rs => [c, ...(rs ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      } });
    } catch (e) { setErr((e as Error).message); }
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setRejecting(false);
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey || rejecting || !rows) return;
      if (e.key === 'j') setSel(i => Math.min(rows.length - 1, i + 1)); else if (e.key === 'k') setSel(i => Math.max(0, i - 1));
      else if (e.key === 'a') { e.preventDefault(); decide('goed'); } else if (e.key === 'r') { e.preventDefault(); setRejecting(true); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });
  const d = c?.data ?? {};
  return (<>
    <section className="adm-q" aria-label="Bijdragen">
      <header><h2>Bijdragen</h2></header>
      {!rows ? <p className="adm-empty">Laden…</p> : rows.length ? <ul className="adm-list">{rows.map((x, i) => <li key={x.id}><button className={`adm-item${x === c ? ' on' : ''}`} aria-current={x === c} onClick={() => setSel(i)}>
        <span className="tile"><Ic n={KIND[x.kind][1]} /></span>
        <span><b>{places[x.item_id]?.name ?? x.item_id}</b><span>{KIND[x.kind][0]}{x.kind === 'review' ? ` · ${'★'.repeat(x.data.stars)}` : ''} · {names[x.user_id] ?? '…'}</span></span>
        <time dateTime={x.created_at}>{new Date(x.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</time></button></li>)}</ul>
        : <p className="adm-empty">Geen bijdragen te keuren. Bezoekers sturen reviews, foto's en openingstijden in vanuit het winkeldetail.</p>}
    </section>
    {c ? <aside className="adm-detail" aria-label="Details">
      <div><p className="eyebrow"><span className="tile"><Ic n={KIND[c.kind][1]} /></span>{KIND[c.kind][0]} van {names[c.user_id] ?? '…'}</p><h3>{pl?.name ?? c.item_id}</h3><p className="adm-sub">{pl?.addr ?? pl?.place ?? ''}</p></div>
      {c.kind === 'review' && <dl className="facts"><dt>Sterren</dt><dd>{'★'.repeat(d.stars)}{'☆'.repeat(5 - d.stars)}</dd><dt>Bezocht</dt><dd>{d.month}</dd></dl>}
      {c.kind === 'review' && (d.text ? <blockquote className="adm-quote" tabIndex={0}>{d.text}</blockquote> : <p className="muted">Geen tekst.</p>)}
      {c.kind === 'tijden' && <dl className="facts"><dt>Nu</dt><dd>{pl?.oh ?? <span className="muted">onbekend</span>}{pl?.hs === 'web' ? <small> · van de website</small> : null}</dd><dt>Voorstel</dt><dd><b>{d.klopt ? 'Klopt, bevestigd bij een bezoek' : d.oh}</b></dd><dt>Bron</dt><dd>{d.how ?? '—'}, gezien op {d.seen}</dd></dl>}
      {c.kind === 'foto' && (img ? <img src={img} alt="Ingestuurde foto" style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 12, objectFit: 'contain', background: 'var(--surface-2)' }} /> : <p className="muted">Foto laden…</p>)}
      <div className="aibox"><span className="ai doubt"><Ic n="info" />Let op</span><ul>{c.kind === 'foto' ? <><li>Herkenbare mensen of kentekens? Afwijzen met die reden.</li><li>Past de foto bij deze winkel?</li></> : c.kind === 'review' ? <><li>Geen namen van medewerkers, geen scheldwoorden of reclame.</li><li>Negatief is prima; alleen nep of beledigend wijs je af.</li></> : <><li>Klopt het met de website van de winkel?</li><li>Goedgekeurd wint van OSM en de website.</li></>}</ul></div>
      {err && <p className="bh-err">{err}</p>}
      {rejecting ? <form className="adm-edit" onSubmit={e => { e.preventDefault(); if (why.trim()) decide('afgewezen', why.trim()); }}>
        <label>Waarom niet plaatsen? <span className="muted">(de inzender ziet dit; schrijf het als uitleg aan hem of haar)</span>
          <input className="input" required autoFocus value={why} onChange={e => setWhy(e.target.value)} maxLength={300} placeholder={c.kind === 'foto' ? 'Bijv. Er staan herkenbare mensen op. Stuur hem gerust opnieuw in zonder hen.' : 'Bijv. Er staat een naam van een medewerker in.'} /></label>
        <div className="adm-btns"><button className="btn primary bad" disabled={!why.trim()}>Afwijzen</button><button type="button" className="btn" onClick={() => setRejecting(false)}>Annuleren <span className="kbd">Esc</span></button></div>
      </form> : <div className="adm-btns">
        <button className="btn primary" onClick={() => decide('goed')}><Ic n="check" />Goedkeuren <span className="kbd">A</span></button>
        <button className="btn" onClick={() => setRejecting(true)}>Afwijzen <span className="kbd">R</span></button>
        <a className="btn" href={`/kaart/?open=${encodeURIComponent(c.item_id)}`} target="_blank" rel="noopener">Bekijk winkel <Ic n="ext" /></a></div>}
      <p className="src"><Ic n="info" /><span>Goedgekeurd staat na de volgende publicatie op de kaart (±15 minuten).</span></p>
    </aside> : <aside className="adm-detail" />}
  </>);
}

/** Zelfde sessie als api(), maar het antwoord als blob (privéfoto's). */
async function authApiBlob(s: Session, path: string) {
  const f = await fresh(s); if (!f) throw new Error('sessie verlopen');
  const r = await fetch(`${SB}/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${f.token}` } });
  if (!r.ok) throw new Error(String(r.status)); return r.blob();
}

/** Wat de eigen website meldt (zie scripts/hours-ai.mjs): label en uitleg in Winkels → Nakijken. */
const MELD: Record<string, [string, string]> = {
  gestopt: ['Site: gestopt', 'Volgens de eigen website is de winkel gestopt. Klopt dat, verberg hem dan.'],
  verhuisd: ['Site: verhuisd', 'Volgens de eigen website is de winkel verhuisd. Zet de pin op de nieuwe plek (en het adres op OpenStreetMap).'],
  online: ['Site: alleen online', 'Volgens de eigen website is er geen winkel om te bezoeken. Hoort hij dan op de kaart?'],
  adres: ['Ander adres op site', 'Op de eigen website staat een ander adres dan bij ons. Misschien verhuisd: kijk welk adres klopt.'],
};
const catOfData = (d: Record<string, any>): Cat => (d.kind === 'tweedehands' ? d.sub ?? 'tweedehands' : 'kringloop');

/** Tijden van Facebook overnemen: plak wat er op hun pagina staat ("Maandag Gesloten / Dinsdag 10:00 - 17:00" of "di t/m za 10-17"),
 *  de websitelezer zet het om en je ziet wat er op de kaart komt. ponytail: geen eigen invoer per dag; de lezer kent de notaties al. */
function FbHours({ r, onSave }: { r: Row; onSave: (oh: string, today: string) => Promise<unknown> }) {
  const [txt, setTxt] = useState(''), today = new Date().toISOString().slice(0, 10);
  useEffect(() => setTxt(''), [r.id]);
  const oh: string | undefined = txt.trim() ? parseHoursNL(`Openingstijden\n${txt}`)?.oh : undefined;
  return (<div className="adm-edit">
    <p className="src"><Ic n="globe" /><span>Open <a href={`https://www.facebook.com/${r.data.fb}`} target="_blank" rel="noopener">hun Facebookpagina <Ic n="ext" /></a>, kijk bij Info of in een recent bericht, en plak de tijden hieronder. Staan er geen tijden, sla hem dan over.</span></p>
    <label>Tijden zoals ze op Facebook staan<textarea className="input" rows={4} value={txt} onChange={e => setTxt(e.target.value)} placeholder={'Maandag Gesloten\nDinsdag 10:00 - 17:00\n… of: di t/m za 10-17'} /></label>
    {txt.trim() && (oh ? <p className="src"><Ic n="check" /><span>Op de kaart: <b>{ohText(oh)}</b>. Gecontroleerd op vandaag, bron: hun Facebookpagina.</span></p> : <p className="bh-err">Nog niet te lezen. Schrijf het als "di t/m za 10:00-17:00" of zet elke dag op een eigen regel.</p>)}
    {oh && <button className="btn sm primary" type="button" onClick={() => { onSave(oh, today); setTxt(''); }}>Opslaan</button>}
  </div>);
}

function Shops({ s }: { s: Session }) {
  const [q, setQ] = useState(''), [rows, setRows] = useState<Row[]>([]), [err, setErr] = useState(''), [sel, setSel] = useState(0), [dead, setDead] = useState<Row[] | null>(null), [fbs, setFbs] = useState<Row[] | null>(null), [which, setWhich] = useState<'' | 'dead' | 'fb'>(''), onlyDead = which !== '', setOnlyDead = (on: boolean) => setWhich(on ? 'dead' : '');
  // Winkels waarvan de website al een week echt weg is (domein bestaat niet meer, 404): misschien gestopt.
  // En winkels waarvan de eigen site iets meldt dat een mens moet nakijken (fetch-web-hours + AI-lezer): gestopt, verhuisd, alleen online, ander adres.
  const loadDead = () => api(s, 'places?select=id,status,locked,data&status=eq.actief&or=(data->>siteDead.not.is.null,data->meld->>k.in.(gestopt,verhuisd,online,adres),and(data->siteGuess->>url.not.is.null,data->siteGuess->>nee.is.null))&order=id&limit=1000').then(r => setDead(r)).catch(e => setErr(e.message));
  // Alleen een Facebookpagina en geen tijden (±270, 9 nov): jij kijkt op Facebook en plakt de tijden; Facebook zelf lezen we niet uit.
  const loadFb = () => api(s, 'places?select=id,status,locked,data&status=eq.actief&data->>fb=not.is.null&data->>website=is.null&data->>oh=is.null&order=data->>kind,id&limit=1000').then(r => setFbs(r)).catch(e => setErr(e.message));
  useEffect(() => { loadDead(); loadFb(); }, []);
  useEffect(() => {
    if (q.trim().length < 2) return setRows([]);
    const t = setTimeout(() => { const w = `*${q.trim().replace(/[,()*]/g, ' ')}*`; api(s, `places?select=id,status,locked,data&or=(data->>name.ilike.${encodeURIComponent(w)},data->>place.ilike.${encodeURIComponent(w)})&order=id&limit=50`).then(r => { setRows(r); setSel(0); }).catch(e => setErr(e.message)); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const save = async (r: Row, patch: Partial<Row>) => {
    try { const [n] = await api(s, `places?id=eq.${encodeURIComponent(r.id)}`, { method: 'PATCH', body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) }); setRows(rs => rs.map(x => x.id === r.id ? n : x)); }
    catch (e) { setErr((e as Error).message); }
  };
  const setCat = (r: Row, c: Cat) => { const { sub, ...d } = r.data; save(r, { data: c === 'kringloop' ? { ...d, kind: 'kringloop' } : { ...d, kind: 'tweedehands', ...(c === 'tweedehands' ? {} : { sub: c }) }, locked: lock(r, 'kind', 'sub') }); };
  const [pin, setPin] = useState(''), spot = parseLatLon(pin);
  const list = which === 'fb' ? fbs ?? [] : which ? dead ?? [] : rows, r = list[sel], site = r?.data.website && (/^https?:/.test(r.data.website) ? r.data.website : `https://${r.data.website}`);
  return (<>
    <section className="adm-q" aria-label="Winkels">
      <header><h2>Winkels</h2><label className="search"><Ic n="search" /><input type="search" placeholder="Zoek op naam of plaats" value={q} onChange={e => { setQ(e.target.value); setOnlyDead(false); }} autoFocus /></label>
        {!!dead?.length && <button className={`btn sm${which === 'dead' ? ' primary' : ''}`} onClick={() => { setQ(''); setWhich('dead'); setSel(0); }}>Nakijken ({dead.length})</button>}
        {!!fbs?.length && <button className={`btn sm${which === 'fb' ? ' primary' : ''}`} onClick={() => { setQ(''); setWhich('fb'); setSel(0); }} title="Winkels met alleen Facebook en zonder tijden">Facebook ({fbs.length})</button>}</header>
      {err && <p className="bh-err">{err}</p>}
      {list.length ? <ul className="adm-list">{list.map((x, i) => <li key={x.id}><button className={`adm-item${i === sel ? ' on' : ''}${x.status === 'verborgen' ? ' off' : ''}`} onClick={() => { setSel(i); setPin(''); }}>
        <span className={`tile c-${catOfData(x.data)}`}><Ic n={CAT[catOfData(x.data)][2]} /></span>
        <span><b>{x.data.name}</b><span>{x.data.addr ?? x.data.place}</span>{x.status === 'verborgen' ? <span className="bh-st cancel">{x.data.gone ? 'Niet meer in de bron' : 'Verborgen'}</span> : x.data.siteGuess && !x.data.siteGuess.nee ? <span className="bh-st org">Website gevonden?</span> : x.data.siteDead ? <span className="bh-st unconf">Website weg</span> : MELD[x.data.meld?.k] && <span className="bh-st unconf">{MELD[x.data.meld.k][0]}</span>}</span><time>{x.data.place}</time></button></li>)}</ul>
        : <p className="adm-empty">{onlyDead ? 'Alles bekeken.' : q.trim().length < 2 ? 'Typ minstens twee letters.' : 'Niets gevonden.'}</p>}
    </section>
    {r ? <aside className="adm-detail" aria-label="Details">
      <div><p className="eyebrow"><span className={`tile c-${catOfData(r.data)}`}><Ic n={CAT[catOfData(r.data)][2]} /></span>{CAT[catOfData(r.data)][0]}</p><h3>{r.data.name}</h3><p className="adm-sub">{r.data.addr ?? r.data.place}</p></div>
      <dl className="facts">
        <dt>Soort</dt><dd><select className="input" value={catOfData(r.data)} onChange={e => setCat(r, e.target.value as Cat)} aria-label="Soort">{CATS.filter(c => c !== 'vlooienmarkt').map(c => <option key={c} value={c}>{CAT[c][0]}</option>)}</select></dd>
        <dt>Website</dt><dd>{site ? <a href={site} target="_blank" rel="noopener">{r.data.website} <Ic n="ext" /></a> : '—'}</dd>
        <dt>Plek</dt><dd><a href={osmAt(r.data)} target="_blank" rel="noopener">{r.data.lat}, {r.data.lon} <Ic n="ext" /></a></dd>
        <dt>Bron</dt><dd><code>{r.id}</code></dd>
        {r.locked.length > 0 && <><dt>Met de hand</dt><dd>{r.locked.join(', ')}</dd></>}
      </dl>
      {which === 'fb' && !r.data.oh && <FbHours r={r} onSave={(oh, today) => save(r, { data: { ...r.data, oh, checked: today, hs: 'fb' }, locked: lock(r, 'oh', 'checked', 'hs') }).then(loadFb)} />}
      <form className="adm-edit" onSubmit={e => { e.preventDefault(); if (spot) save(r, { data: { ...r.data, ...spot }, locked: lock(r, 'lat', 'lon') }).then(() => setPin('')); }}>
        <label>Pin verplaatsen<input className="input" value={pin} onChange={e => setPin(e.target.value)} placeholder={PIN_HINT} /></label>
        {pin.trim() && !spot && <p className="bh-err">Geen plek in Nederland herkend.</p>}
        {spot && <button className="btn sm">Verplaats naar {spot.lat}, {spot.lon}</button>}
      </form>
      <p className="src"><Ic n="info" /><span>Wat je hier zet, overschrijft een import niet meer. Zichtbaar binnen ±15 minuten.</span></p>
      {r.data.gone && <p className="src"><Ic n="alert" /><span>Verborgen door de import van {r.data.gone}: staat niet meer in OpenStreetMap of Overture. Bestaat hij nog? Dan kun je hem weer tonen (en het liefst op OSM zetten).</span></p>}
      {r.data.siteDead && r.status !== 'verborgen' && <p className="src"><Ic n="alert" /><span>De website bestaat sinds {r.data.siteDead} niet meer (domein weg of pagina verdwenen). Misschien is de winkel gestopt. Zoek hem even op: bestaat hij nog, kies dan "Klopt nog".</span></p>}
      {r.data.siteGuess && !r.data.siteGuess.nee && <p className="src"><Ic n="globe" /><span>Gevonden website: <a href={r.data.siteGuess.url} target="_blank" rel="noopener">{r.data.siteGuess.url} <Ic n="ext" /></a>. Geraden uit de naam; {r.data.siteGuess.bewijs === 'telefoon' ? 'ons telefoonnummer' : 'onze postcode'} van de winkel staat erop. Is het deze winkel?</span></p>}
      {MELD[r.data.meld?.k] && r.status !== 'verborgen' && <p className="src"><Ic n="alert" /><span>{MELD[r.data.meld.k][1]} Op <a href={r.data.meld.u} target="_blank" rel="noopener">de website</a> stond op {r.data.meld.d}: <q>{r.data.meld.q}</q></span></p>}
      <div className="adm-btns"><button className="btn" onClick={() => { const { gone, ...data } = r.data; save(r, { status: r.status === 'verborgen' ? 'actief' : 'verborgen', data, locked: lock(r, 'status') }).then(loadDead); }}>{r.status === 'verborgen' ? 'Weer tonen' : 'Verbergen'}</button>
        {/* ponytail: vastgezet, dus een volgende keer dat de site wegvalt zie je het niet meer; ontgrendelen als dat gaat schuren */}
        {r.data.siteDead && r.status !== 'verborgen' && <button className="btn" onClick={() => { const { siteDead, ...data } = r.data; save(r, { data, locked: lock(r, 'siteDead') }).then(loadDead); }}>Klopt nog</button>}
        {r.data.siteGuess && !r.data.siteGuess.nee && <><button className="btn primary" onClick={() => { const { siteGuess, ...data } = r.data; save(r, { data: { ...data, website: siteGuess.url }, locked: lock(r, 'website') }).then(loadDead); }}>Goed, website toevoegen</button>
          <button className="btn" onClick={() => save(r, { data: { ...r.data, siteGuess: { ...r.data.siteGuess, nee: new Date().toISOString().slice(0, 10) } } }).then(loadDead)}>Niet deze winkel</button></>}
        {MELD[r.data.meld?.k] && r.status !== 'verborgen' && <button className="btn" onClick={() => { const { meld, ...data } = r.data; save(r, { data, locked: lock(r, 'meld') }).then(loadDead); }}>Bekeken, klopt nog</button>}</div>
    </aside> : <aside className="adm-detail" />}
  </>);
}

function Sources({ runs, warn, rows }: { runs: Run[]; warn: string[]; rows: MRow[] }) {
  const per = Object.entries(rows.reduce<Record<string, Record<string, number>>>((a, r) => { const k = r.data.org ?? '?'; (a[k] ??= {})[r.status] = (a[k][r.status] ?? 0) + 1; return a; }, {}))
    .sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y) - Object.values(a[1]).reduce((x, y) => x + y));
  return (<section className="adm-wide" aria-label="Bronnen">
    {warn.length > 0 && <div className="aibox adm-warn"><span className="ai rej"><Ic n="alert" />Aandacht nodig</span><ul>{warn.map(w => <li key={w}>{w}</li>)}</ul>
      <p className="src"><Ic n="info" /><span>Een uitlezer met een probleem houdt zijn vorige stand; de rest is gewoon bijgewerkt. Meestal is de site van de organisator veranderd en moet de uitlezer worden aangepast.</span></p></div>}
    <h3>Laatste imports</h3>
    <table className="adm-table"><thead><tr><th>Wanneer</th><th>Bron</th><th>Aantallen</th></tr></thead>
      <tbody>{runs.map(r => <tr key={r.id}><td>{new Date(r.at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</td><td>{r.source}</td><td>{Object.entries(r.counts).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : v}`).join(' · ')}</td></tr>)}</tbody></table>
    <h3>Markten vanaf vandaag, per bron</h3>
    <table className="adm-table"><thead><tr><th>Bron</th>{Object.keys(STATUS).map(k => <th key={k}>{STATUS[k].replace(' door organisator', '')}</th>)}</tr></thead>
      <tbody>{per.map(([org, c]) => <tr key={org}><td>{org}</td>{Object.keys(STATUS).map(k => <td key={k} className="tnum">{c[k] ?? ''}</td>)}</tr>)}</tbody></table>
    <p className="src"><Ic n="info" /><span>Markten en het Gemeenteblad elke nacht; winkels (OSM, Overture, websites) elke maandagnacht. Een winkel die uit de bronnen verdwijnt, wordt verborgen (zoek hem bij Winkels om hem weer te tonen).</span></p>
  </section>);
}

function Log({ s }: { s: Session }) {
  const [rows, setRows] = useState<(Row & { t: string })[] | null>(null);
  useEffect(() => {
    Promise.all([api(s, 'markets?select=id,date,status,locked,data,updated_at&locked=neq.{}&order=updated_at.desc&limit=100'), api(s, 'places?select=id,status,locked,data,updated_at&locked=neq.{}&order=updated_at.desc&limit=100')])
      .then(([m, p]) => setRows([...m.map((r: Row) => ({ ...r, t: 'markt' })), ...p.map((r: Row) => ({ ...r, t: 'winkel' }))].sort((a, b) => b.updated_at!.localeCompare(a.updated_at!)))).catch(() => setRows([]));
  }, []);
  return (<section className="adm-wide" aria-label="Moderatielog">
    <p className="adm-sub">Alles wat met de hand is gezet, nieuwste eerst. Afwijzingen en afgelastingen hebben een reden (DSA).</p>
    {!rows ? <p>Laden…</p> : <table className="adm-table"><thead><tr><th>Wanneer</th><th>Wat</th><th>Status</th><th>Vastgezet</th><th>Reden</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.t + r.id}><td>{new Date(r.updated_at!).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</td><td>{r.data.name}{r.date && <span className="muted"> · {day(r.date)}</span>}</td><td><span className={`bh-st ${r.status}`}>{STATUS[r.status] ?? r.status}</span></td><td>{r.locked.join(', ')}</td><td>{r.data.rejectWhy ?? r.data.cancelWhy ?? ''}</td></tr>)}</tbody></table>}
  </section>);
}
