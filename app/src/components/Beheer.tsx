// Beheer: wachtrij (kandidaten uit het Gemeenteblad, markten die van de site van hun organisator verdwenen), markten van deze week,
// winkels, bronnen en het moderatielog. Opbouw volgens het ontwerp (§07): zijbalk, lijst, detail; J/K bladeren, A/U/E/R handelen.
// Inloggen met een link per e-mail (Supabase Auth); wat je mag, bepaalt RLS (tabel admins). Wat je hier zet, komt in `locked`:
// een import overschrijft het niet meer. Sessie en REST: lib/auth.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATS, type Cat } from '../lib/model';
import { queue, alerts, parseLatLon, type MRow, type Judged, type Run } from '../lib/beheer';
import { CAT, Ic } from './ui';
import { SB, KEY, readSession, sendLink, logout, fresh, api as authApi, type Session } from '../lib/auth';
import { watchErrors } from '../lib/errors';

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

type View = 'wachtrij' | 'bijdragen' | 'meldingen' | 'kandidaten' | 'week' | 'winkels' | 'bronnen' | 'klikken' | 'log';
const NAV: [View, string][] = [['wachtrij', 'Wachtrij'], ['bijdragen', 'Bijdragen'], ['meldingen', 'Meldingen'], ['kandidaten', 'Kandidaten'], ['week', 'Markten deze week'], ['winkels', 'Winkels'], ['bronnen', 'Bronnen'], ['klikken', 'Klikken'], ['log', 'Moderatielog']];
const STATUS: Record<string, string> = { org: 'Bevestigd door organisator', chk: 'Gecontroleerd', unconf: 'Nog niet bevestigd', cancel: 'Afgelast', kandidaat: 'Kandidaat', afgewezen: 'Afgewezen' };

function Panel({ s, out }: { s: Session; out: () => void }) {
  const [view, setView] = useState<View>('wachtrij'), [rows, setRows] = useState<MRow[] | null>(null), [err, setErr] = useState('');
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
    const k = (e: KeyboardEvent) => { if (e.key === 'z' && undo && !typing(e) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); revert(); } };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });
  const [runs, setRuns] = useState<Run[]>([]), [reps, setReps] = useState<Rep[]>([]);
  useEffect(() => { api(s, 'reports?select=*&done_at=is.null&order=created_at').then(setReps).catch(() => {}); }, []);
  const [nBij, setNBij] = useState(0);
  useEffect(() => { api(s, 'contributions?select=id&status=eq.nieuw').then(r => setNBij(r.length)).catch(() => {}); }, [view]);
  useEffect(() => { api(s, 'import_runs?select=*&order=at.desc&limit=30').then(setRuns).catch(() => {}); }, []);
  const warn = alerts(runs, new Date());
  const q = useMemo(() => rows ? queue(rows, today()) : [], [rows]);
  const week = useMemo(() => (rows ?? []).filter(r => r.date <= plusDays(7) && STATUS[r.status] && !['kandidaat', 'afgewezen'].includes(r.status)), [rows]);
  const cands = useMemo(() => (rows ?? []).filter(r => r.status === 'kandidaat' || r.status === 'afgewezen'), [rows]);
  const count: Partial<Record<View, number>> = { wachtrij: q.length, kandidaten: cands.filter(r => r.status === 'kandidaat').length, week: week.length, meldingen: reps.length, bijdragen: nBij };

  return (<div className="admin">
    <nav className="adm-nav" aria-label="Beheer">
      <h1 className="bh-brand"><span className="bh-mark"><Ic n="tag" /></span>Beheer</h1>
      {NAV.map(([k, l]) => <button key={k} className={view === k ? 'on' : ''} aria-current={view === k ? 'page' : undefined} onClick={() => setView(k)}>{l}{k === 'bronnen' && warn.length ? <span className="adm-bad">{warn.length} fout</span> : <span>{count[k] ?? ''}</span>}</button>)}
      <div className="adm-me"><span>{s.email}</span><button className="link" onClick={out}>Uitloggen</button></div>
    </nav>
    <main style={{ display: 'contents' }}>
    {err && <p className="bh-err adm-err" role="alert">{err}</p>}
    {!rows && !err ? <p className="adm-loading">Laden…</p>
      : view === 'wachtrij' ? <Markets key="q" title="Wachtrij" items={q.map(j => ({ row: j.row, j }))} save={save}
        filters={[['Alles', () => true], ['Kritiek', i => !!i.j?.urgent], ['Gemeenteblad', i => i.j?.kind === 'kandidaat'], ['Verdwenen', i => i.j?.kind === 'verdwenen']]}
        empty="De wachtrij is leeg. Nieuwe kandidaten komen elke nacht binnen." />
      : view === 'kandidaten' ? <Markets key="k" title="Kandidaten" items={cands.map(row => ({ row, j: q.find(j => j.row.id === row.id) }))} save={save}
        filters={[['Te keuren', i => i.row.status === 'kandidaat'], ['Afgewezen', i => i.row.status === 'afgewezen']]} empty="Geen kandidaten." />
      : view === 'week' ? <Markets key="w" title="Markten deze week" items={week.map(row => ({ row }))} save={save}
        filters={[['Alles', () => true], ...(['org', 'chk', 'unconf', 'cancel'] as const).map(k => [STATUS[k].replace(' door organisator', ''), (i: Item) => i.row.status === k] as Filter)]} empty="Geen markten de komende 7 dagen." />
      : view === 'bijdragen' ? <Contribs s={s} setUndo={setUndo} />
      : view === 'meldingen' ? <Reports s={s} reps={reps} setReps={setReps} rows={rows ?? []} />
      : view === 'winkels' ? <Shops s={s} />
      : view === 'bronnen' ? <Sources s={s} runs={runs} warn={warn} rows={rows ?? []} />
      : view === 'klikken' ? <Clicks s={s} />
      : <Log s={s} />}
    </main>
    {undo && <div className="adm-undo" role="status"><span>{undo.what}</span><button className="btn sm" onClick={revert}>Ongedaan maken <span className="kbd">Z</span></button></div>}
  </div>);
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
          <span><b>{i.j?.kind === 'verdwenen' ? `Mogelijk afgelast: ${i.row.data.name}` : i.row.data.name}</b>
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
      const a = ({ a: approve, u: unsure, e: () => setMode('edit'), r: () => setMode('reject') } as Record<string, () => void>)[e.key];
      if (a) { e.preventDefault(); a(); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });
  const kind = j?.kind === 'verdwenen' ? 'Mogelijk afgelast' : d.snippet ? `Tip uit ${d.org ?? 'het Gemeenteblad'}` : d.org;
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
        <a className="btn" href={`/?open=${encodeURIComponent(r.item_id)}`} target="_blank" rel="noopener">Bekijk op de kaart <Ic n="ext" /></a>
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
      {c.kind === 'tijden' && <dl className="facts"><dt>Nu</dt><dd>{pl?.oh ?? <span className="muted">onbekend</span>}{pl?.hs === 'web' ? <small> · van de website</small> : null}</dd><dt>Voorstel</dt><dd><b>{d.oh}</b></dd><dt>Bron</dt><dd>{d.how ?? '—'}, gezien op {d.seen}</dd></dl>}
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
        <a className="btn" href={`/?open=${encodeURIComponent(c.item_id)}`} target="_blank" rel="noopener">Bekijk winkel <Ic n="ext" /></a></div>}
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

const catOfData = (d: Record<string, any>): Cat => (d.kind === 'tweedehands' ? d.sub ?? 'tweedehands' : 'kringloop');

function Shops({ s }: { s: Session }) {
  const [q, setQ] = useState(''), [rows, setRows] = useState<Row[]>([]), [err, setErr] = useState(''), [sel, setSel] = useState(0);
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
  const r = rows[sel], site = r?.data.website && (/^https?:/.test(r.data.website) ? r.data.website : `https://${r.data.website}`);
  return (<>
    <section className="adm-q" aria-label="Winkels">
      <header><h2>Winkels</h2><label className="search"><Ic n="search" /><input type="search" placeholder="Zoek op naam of plaats" value={q} onChange={e => setQ(e.target.value)} autoFocus /></label></header>
      {err && <p className="bh-err">{err}</p>}
      {rows.length ? <ul className="adm-list">{rows.map((x, i) => <li key={x.id}><button className={`adm-item${i === sel ? ' on' : ''}${x.status === 'verborgen' ? ' off' : ''}`} onClick={() => { setSel(i); setPin(''); }}>
        <span className={`tile c-${catOfData(x.data)}`}><Ic n={CAT[catOfData(x.data)][2]} /></span>
        <span><b>{x.data.name}</b><span>{x.data.addr ?? x.data.place}</span>{x.status === 'verborgen' && <span className="bh-st cancel">{x.data.gone ? 'Niet meer in de bron' : 'Verborgen'}</span>}</span><time>{x.data.place}</time></button></li>)}</ul>
        : <p className="adm-empty">{q.trim().length < 2 ? 'Typ minstens twee letters.' : 'Niets gevonden.'}</p>}
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
      <form className="adm-edit" onSubmit={e => { e.preventDefault(); if (spot) save(r, { data: { ...r.data, ...spot }, locked: lock(r, 'lat', 'lon') }).then(() => setPin('')); }}>
        <label>Pin verplaatsen<input className="input" value={pin} onChange={e => setPin(e.target.value)} placeholder={PIN_HINT} /></label>
        {pin.trim() && !spot && <p className="bh-err">Geen plek in Nederland herkend.</p>}
        {spot && <button className="btn sm">Verplaats naar {spot.lat}, {spot.lon}</button>}
      </form>
      <p className="src"><Ic n="info" /><span>Wat je hier zet, overschrijft een import niet meer. Zichtbaar binnen ±15 minuten.</span></p>
      {r.data.gone && <p className="src"><Ic n="alert" /><span>Verborgen door de import van {r.data.gone}: staat niet meer in OpenStreetMap of Overture. Bestaat hij nog? Dan kun je hem weer tonen (en het liefst op OSM zetten).</span></p>}
      <div className="adm-btns"><button className="btn" onClick={() => { const { gone, ...data } = r.data; save(r, { status: r.status === 'verborgen' ? 'actief' : 'verborgen', data, locked: lock(r, 'status') }); }}>{r.status === 'verborgen' ? 'Weer tonen' : 'Verbergen'}</button></div>
    </aside> : <aside className="adm-detail" />}
  </>);
}

type Fout = { msg: string; src: string | null; ua: string | null; at: string };

function Sources({ s, runs, warn, rows }: { s: Session; runs: Run[]; warn: string[]; rows: MRow[] }) {
  const [errs, setErrs] = useState<Fout[]>([]);
  useEffect(() => { api(s, `client_errors?select=msg,src,ua,at&at=gte.${new Date(Date.now() - 7 * 864e5).toISOString()}&order=at.desc&limit=500`).then(setErrs).catch(() => {}); }, []);
  const byMsg = Object.values(errs.reduce<Record<string, { e: Fout; n: number }>>((a, e) => { (a[e.msg] ??= { e, n: 0 }).n++; return a; }, {})).sort((a, b) => b.n - a.n);
  const per = Object.entries(rows.reduce<Record<string, Record<string, number>>>((a, r) => { const k = r.data.org ?? '?'; (a[k] ??= {})[r.status] = (a[k][r.status] ?? 0) + 1; return a; }, {}))
    .sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y) - Object.values(a[1]).reduce((x, y) => x + y));
  return (<section className="adm-wide" aria-label="Bronnen">
    <h2>Bronnen</h2>
    {warn.length > 0 && <div className="aibox adm-warn"><span className="ai rej"><Ic n="alert" />Aandacht nodig</span><ul>{warn.map(w => <li key={w}>{w}</li>)}</ul>
      <p className="src"><Ic n="info" /><span>Een uitlezer met een probleem houdt zijn vorige stand; de rest is gewoon bijgewerkt. Meestal is de site van de organisator veranderd en moet de uitlezer worden aangepast.</span></p></div>}
    <h3>Laatste imports</h3>
    <table className="adm-table"><thead><tr><th>Wanneer</th><th>Bron</th><th>Aantallen</th></tr></thead>
      <tbody>{runs.map(r => <tr key={r.id}><td>{new Date(r.at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</td><td>{r.source}</td><td>{Object.entries(r.counts).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : v}`).join(' · ')}</td></tr>)}</tbody></table>
    <h3>Fouten bij bezoekers (7 dagen)</h3>
    {byMsg.length ? <table className="adm-table"><thead><tr><th>Laatst</th><th>Fout</th><th>Waar</th><th>Aantal</th></tr></thead>
      <tbody>{byMsg.map(({ e, n }) => <tr key={e.msg}><td>{new Date(e.at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</td><td>{e.msg}</td><td><span className="muted">{e.src}</span></td><td className="tnum">{n}</td></tr>)}</tbody></table>
      : <p className="adm-sub">Geen fouten. Gaat er bij een bezoeker iets stuk in de app, dan staat het hier (zonder wie het was).</p>}
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
    <h2>Moderatielog</h2>
    <p className="adm-sub">Alles wat met de hand is gezet, nieuwste eerst. Afwijzingen en afgelastingen hebben een reden (DSA).</p>
    {!rows ? <p>Laden…</p> : <table className="adm-table"><thead><tr><th>Wanneer</th><th>Wat</th><th>Status</th><th>Vastgezet</th><th>Reden</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.t + r.id}><td>{new Date(r.updated_at!).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</td><td>{r.data.name}{r.date && <span className="muted"> · {day(r.date)}</span>}</td><td><span className={`bh-st ${r.status}`}>{STATUS[r.status] ?? r.status}</span></td><td>{r.locked.join(', ')}</td><td>{r.data.rejectWhy ?? r.data.cancelWhy ?? ''}</td></tr>)}</tbody></table>}
  </section>);
}

const KLIK: [string, string][] = [['view', 'Bekeken'], ['plan', 'In dagplan'], ['route', 'Route'], ['site', 'Website'], ['tel', 'Gebeld'], ['share', 'Gedeeld']];
type Tel = Record<string, number>;

/** Klikteller (migratie klikken): per plek en per organisator, laatste 30 dagen. Onderbouwing voor gesprekken met organisatoren. */
function Clicks({ s }: { s: Session }) {
  const [rows, setRows] = useState<{ item_id: string; what: string; n: number }[] | null>(null), [names, setNames] = useState<Record<string, { name: string; org?: string }>>({}), [err, setErr] = useState('');
  useEffect(() => {
    api(s, `clicks?select=item_id,what,n&day=gte.${new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)}&limit=10000`).then(setRows).catch(e => setErr(e.message));
    // ponytail: namen uit de openbare bestanden (±2 MB, staat meestal al in de cache); een view in Supabase als dit traag wordt
    Promise.all([fetch('/data/places.json').then(r => r.json()), fetch('/data/markets.json').then(r => r.json())]).then(([p, m]) =>
      setNames(Object.fromEntries([...(p.places ?? p), ...m.markets].map((x: { id: string; name: string; place?: string; org?: string }) => [x.id, { name: x.place ? `${x.name}, ${x.place}` : x.name, org: x.org }])))).catch(() => {});
  }, []);
  if (err) return <section className="adm-wide"><h2>Klikken</h2><p className="bh-err">{err}</p></section>;
  if (!rows) return <section className="adm-wide"><h2>Klikken</h2><p className="adm-sub">Laden…</p></section>;
  const add = (a: Record<string, Tel>, k: string, w: string, n: number) => { (a[k] ??= {})[w] = ((a[k] ??= {})[w] ?? 0) + n; };
  const per: Record<string, Tel> = {}, org: Record<string, Tel> = {}, tot: Tel = {};
  for (const r of rows) { add(per, r.item_id, r.what, r.n); tot[r.what] = (tot[r.what] ?? 0) + r.n; const o = names[r.item_id]?.org; if (o) add(org, o, r.what, r.n); }
  const sum = (t: Tel) => Object.values(t).reduce((a, b) => a + b, 0);
  const table = (title: string, data: Record<string, Tel>, label: (k: string) => string) => <>
    <h3>{title}</h3>
    <table className="adm-table"><thead><tr><th>{title === 'Per organisator' ? 'Organisator' : 'Plek'}</th>{KLIK.map(([k, l]) => <th key={k} className="tnum">{l}</th>)}</tr></thead>
      <tbody>{Object.entries(data).sort((a, b) => sum(b[1]) - sum(a[1])).slice(0, 50).map(([k, t]) =>
        <tr key={k}><td>{label(k)}</td>{KLIK.map(([w]) => <td key={w} className="tnum">{t[w] ?? ''}</td>)}</tr>)}</tbody></table></>;
  return (<section className="adm-wide" aria-label="Klikken">
    <h2>Klikken</h2>
    <p className="adm-sub">Laatste 30 dagen, zonder wie het was. {KLIK.map(([k, l]) => `${l}: ${tot[k] ?? 0}`).join(' · ')}</p>
    {rows.length ? <>{Object.keys(org).length > 0 && table('Per organisator', org, k => k)}{table('Meest bekeken plekken', per, k => names[k]?.name ?? k)}</>
      : <p className="adm-sub">Nog geen klikken. Ze komen binnen zodra bezoekers winkels en markten openen.</p>}
  </section>);
}
