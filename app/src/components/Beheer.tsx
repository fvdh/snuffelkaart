// Beheer: wachtrij (kandidaten uit het Gemeenteblad, markten die van de site van hun organisator verdwenen), markten van deze week,
// winkels, bronnen en het moderatielog. Opbouw volgens het ontwerp (§07): zijbalk, lijst, detail; J/K bladeren, A/U/E/R handelen.
// Inloggen met een link per e-mail (Supabase Auth); wat je mag, bepaalt RLS (tabel admins). Wat je hier zet, komt in `locked`:
// een import overschrijft het niet meer. Sessie en REST: lib/auth.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATS, type Cat } from '../lib/model';
import { queue, alerts, type MRow, type Judged, type Run } from '../lib/beheer';
import { CAT, Ic } from './ui';
import { SB, KEY, readSession, sendLink, logout, api as authApi, type Session } from '../lib/auth';

type Row = { id: string; status: string; locked: string[]; data: Record<string, any>; date?: string; updated_at?: string };
const api = (s: Session, path: string, init: RequestInit = {}) => authApi(s, `rest/v1/${path}`, init);
const lock = (r: Row, ...ks: string[]) => [...new Set([...r.locked, ...ks])];
const today = () => new Date().toLocaleDateString('sv-SE');
const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toLocaleDateString('sv-SE');
const day = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

export default function Beheer() {
  const [s, setS] = useState<Session | null>(null), [ready, setReady] = useState(false);
  useEffect(() => { setS(readSession()); setReady(true); }, []);
  if (!SB || !KEY) return <main className="bh-login"><p>Beheer is niet ingesteld: SUPABASE_URL en SUPABASE_ANON_KEY ontbreken bij de build.</p></main>;
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
    <div className="bh-brand"><span className="bh-mark"><Ic n="tag" /></span>Beheer</div>
    {sent ? <p>Er is een inloglink gestuurd naar <b>{email}</b>. Open hem in deze browser.</p> : <>
      <label>E-mailadres<input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
      <button className="btn primary">Stuur inloglink</button></>}
    {err && <p className="bh-err">{err}</p>}
  </form></main>);
}

type View = 'wachtrij' | 'kandidaten' | 'week' | 'winkels' | 'bronnen' | 'log';
const NAV: [View, string][] = [['wachtrij', 'Wachtrij'], ['kandidaten', 'Kandidaten'], ['week', 'Markten deze week'], ['winkels', 'Winkels'], ['bronnen', 'Bronnen'], ['log', 'Moderatielog']];
const STATUS: Record<string, string> = { org: 'Bevestigd door organisator', chk: 'Gecontroleerd', unconf: 'Nog niet bevestigd', cancel: 'Afgelast', kandidaat: 'Kandidaat', afgewezen: 'Afgewezen' };

function Panel({ s, out }: { s: Session; out: () => void }) {
  const [view, setView] = useState<View>('wachtrij'), [rows, setRows] = useState<MRow[] | null>(null), [err, setErr] = useState('');
  // ponytail: alle markten vanaf vandaag in één keer (±300; PostgREST geeft er max. 1000). Pagineren als het er meer worden.
  useEffect(() => { api(s, `markets?select=id,date,status,locked,data,updated_at&date=gte.${today()}&order=date,id`).then(setRows).catch(e => setErr(e.message)); }, []);
  const save = async (r: Row, body: Partial<Row>) => {
    try {
      const [n] = await api(s, `markets?id=eq.${encodeURIComponent(r.id)}`, { method: 'PATCH', body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }) });
      setRows(rs => rs!.map(x => x.id === r.id ? n : x)); setErr('');
    } catch (e) { setErr((e as Error).message); }
  };
  const [runs, setRuns] = useState<Run[]>([]);
  useEffect(() => { api(s, 'import_runs?select=*&order=at.desc&limit=30').then(setRuns).catch(() => {}); }, []);
  const warn = alerts(runs, new Date());
  const q = useMemo(() => rows ? queue(rows, today()) : [], [rows]);
  const week = useMemo(() => (rows ?? []).filter(r => r.date <= plusDays(7) && STATUS[r.status] && !['kandidaat', 'afgewezen'].includes(r.status)), [rows]);
  const cands = useMemo(() => (rows ?? []).filter(r => r.status === 'kandidaat' || r.status === 'afgewezen'), [rows]);
  const count: Partial<Record<View, number>> = { wachtrij: q.length, kandidaten: cands.filter(r => r.status === 'kandidaat').length, week: week.length };

  return (<div className="admin">
    <nav className="adm-nav" aria-label="Beheer">
      <div className="bh-brand"><span className="bh-mark"><Ic n="tag" /></span>Beheer</div>
      {NAV.map(([k, l]) => <button key={k} className={view === k ? 'on' : ''} aria-current={view === k ? 'page' : undefined} onClick={() => setView(k)}>{l}{k === 'bronnen' && warn.length ? <span className="adm-bad">{warn.length} fout</span> : <span>{count[k] ?? ''}</span>}</button>)}
      <div className="adm-me"><span>{s.email}</span><button className="link" onClick={out}>Uitloggen</button></div>
    </nav>
    {err && <p className="bh-err adm-err" role="alert">{err}</p>}
    {!rows && !err ? <p className="adm-loading">Laden…</p>
      : view === 'wachtrij' ? <Markets key="q" title="Wachtrij" items={q.map(j => ({ row: j.row, j }))} save={save}
        filters={[['Alles', () => true], ['Kritiek', i => !!i.j?.urgent], ['Gemeenteblad', i => i.j?.kind === 'kandidaat'], ['Verdwenen', i => i.j?.kind === 'verdwenen']]}
        empty="De wachtrij is leeg. Nieuwe kandidaten komen elke nacht binnen." />
      : view === 'kandidaten' ? <Markets key="k" title="Kandidaten" items={cands.map(row => ({ row, j: q.find(j => j.row.id === row.id) }))} save={save}
        filters={[['Te keuren', i => i.row.status === 'kandidaat'], ['Afgewezen', i => i.row.status === 'afgewezen']]} empty="Geen kandidaten." />
      : view === 'week' ? <Markets key="w" title="Markten deze week" items={week.map(row => ({ row }))} save={save}
        filters={[['Alles', () => true], ...(['org', 'chk', 'unconf', 'cancel'] as const).map(k => [STATUS[k].replace(' door organisator', ''), (i: Item) => i.row.status === k] as Filter)]} empty="Geen markten de komende 7 dagen." />
      : view === 'winkels' ? <Shops s={s} />
      : view === 'bronnen' ? <Sources runs={runs} warn={warn} rows={rows ?? []} />
      : <Log s={s} />}
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

function MarketDetail({ item: { row: r, j }, save }: { item: Item; save: (r: Row, b: Partial<Row>) => Promise<void> }) {
  const d = r.data, [mode, setMode] = useState<'' | 'edit' | 'reject'>(''), [why, setWhy] = useState(''), [form, setForm] = useState({ name: d.name ?? '', place: d.place ?? '', addr: d.addr ?? '', start: d.timeKnown ? hm(d.start) : '', end: d.timeKnown ? hm(d.end) : '' });
  const open = r.status === 'kandidaat' || (r.status === 'unconf' && d.vanished && !r.locked.includes('status'));
  const rejectTo = r.status === 'kandidaat' ? 'afgewezen' : 'cancel', whyKey = rejectTo === 'afgewezen' ? 'rejectWhy' : 'cancelWhy';
  const setStatus = (status: string, extra: Record<string, any> = {}) => save(r, { status, data: { ...d, ...extra, ...(status === 'chk' ? { checked: today() } : {}) }, locked: lock(r, 'status', ...Object.keys(extra)) });
  const approve = () => setStatus('chk'), unsure = () => setStatus('unconf');
  const reject = () => why.trim() && setStatus(rejectTo, { [whyKey]: why.trim() });
  const saveEdit = () => {
    const t = form.start && form.end ? { start: toMin(form.start), end: toMin(form.end), timeKnown: true } : { timeKnown: false };
    save(r, { data: { ...d, name: form.name.trim(), place: form.place.trim(), addr: form.addr.trim() || null, ...t }, locked: lock(r, ...EDIT) }).then(() => setMode(''));
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
      <p className="src"><Ic n="info" /><span>Velden die je hier opslaat, overschrijft een import niet meer. De pin verplaatst niet mee.</span></p>
      <div className="adm-btns"><button className="btn primary">Opslaan</button><button type="button" className="btn" onClick={() => setMode('')}>Annuleren <span className="kbd">Esc</span></button></div>
    </form> : <dl className="facts">
      <dt>Status</dt><dd><span className={`bh-st ${r.status}`}>{STATUS[r.status] ?? r.status}</span>{r.locked.includes('status') && <small> · met de hand</small>}</dd>
      <dt>Adres</dt><dd>{d.addr ?? d.venue ?? <span className="muted">{d.exact ? '—' : 'geen; pin midden in de gemeente'}</span>}</dd>
      <dt>Entree</dt><dd>{d.entree ?? '—'}</dd>
      <dt>Bron</dt><dd>{d.url ? <a href={d.url} target="_blank" rel="noopener">{d.org ?? 'bron'} <Ic n="ext" /></a> : d.org}</dd>
      {(d.cancelWhy || d.rejectWhy) && <><dt>Reden</dt><dd>{d.cancelWhy ?? d.rejectWhy}</dd></>}
    </dl>}

    {d.snippet && <blockquote className="adm-quote">{d.snippet}</blockquote>}
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
  const r = rows[sel], site = r?.data.website && (/^https?:/.test(r.data.website) ? r.data.website : `https://${r.data.website}`);
  return (<>
    <section className="adm-q" aria-label="Winkels">
      <header><h2>Winkels</h2><label className="search"><Ic n="search" /><input type="search" placeholder="Zoek op naam of plaats" value={q} onChange={e => setQ(e.target.value)} autoFocus /></label></header>
      {err && <p className="bh-err">{err}</p>}
      {rows.length ? <ul className="adm-list">{rows.map((x, i) => <li key={x.id}><button className={`adm-item${i === sel ? ' on' : ''}${x.status === 'verborgen' ? ' off' : ''}`} onClick={() => setSel(i)}>
        <span className={`tile c-${catOfData(x.data)}`}><Ic n={CAT[catOfData(x.data)][2]} /></span>
        <span><b>{x.data.name}</b><span>{x.data.addr ?? x.data.place}</span>{x.status === 'verborgen' && <span className="bh-st cancel">Verborgen</span>}</span><time>{x.data.place}</time></button></li>)}</ul>
        : <p className="adm-empty">{q.trim().length < 2 ? 'Typ minstens twee letters.' : 'Niets gevonden.'}</p>}
    </section>
    {r ? <aside className="adm-detail" aria-label="Details">
      <div><p className="eyebrow"><span className={`tile c-${catOfData(r.data)}`}><Ic n={CAT[catOfData(r.data)][2]} /></span>{CAT[catOfData(r.data)][0]}</p><h3>{r.data.name}</h3><p className="adm-sub">{r.data.addr ?? r.data.place}</p></div>
      <dl className="facts">
        <dt>Soort</dt><dd><select className="input" value={catOfData(r.data)} onChange={e => setCat(r, e.target.value as Cat)} aria-label="Soort">{CATS.filter(c => c !== 'vlooienmarkt').map(c => <option key={c} value={c}>{CAT[c][0]}</option>)}</select></dd>
        <dt>Website</dt><dd>{site ? <a href={site} target="_blank" rel="noopener">{r.data.website} <Ic n="ext" /></a> : '—'}</dd>
        <dt>Bron</dt><dd><code>{r.id}</code></dd>
        {r.locked.length > 0 && <><dt>Met de hand</dt><dd>{r.locked.join(', ')}</dd></>}
      </dl>
      <p className="src"><Ic n="info" /><span>Wat je hier zet, overschrijft een import niet meer. Zichtbaar binnen ±15 minuten.</span></p>
      <div className="adm-btns"><button className="btn" onClick={() => save(r, { status: r.status === 'verborgen' ? 'actief' : 'verborgen' })}>{r.status === 'verborgen' ? 'Weer tonen' : 'Verbergen'}</button></div>
    </aside> : <aside className="adm-detail" />}
  </>);
}

function Sources({ runs, warn, rows }: { runs: Run[]; warn: string[]; rows: MRow[] }) {
  const per = Object.entries(rows.reduce<Record<string, Record<string, number>>>((a, r) => { const k = r.data.org ?? '?'; (a[k] ??= {})[r.status] = (a[k][r.status] ?? 0) + 1; return a; }, {}))
    .sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y) - Object.values(a[1]).reduce((x, y) => x + y));
  return (<section className="adm-wide" aria-label="Bronnen">
    <h2>Bronnen</h2>
    {warn.length > 0 && <div className="aibox adm-warn"><span className="ai rej"><Ic n="alert" />Aandacht nodig</span><ul>{warn.map(w => <li key={w}>{w}</li>)}</ul>
      <p className="src"><Ic n="info" /><span>Een uitlezer met een probleem houdt zijn vorige stand; de rest is gewoon bijgewerkt. Meestal is de site van de organisator veranderd en moet de uitlezer worden aangepast.</span></p></div>}
    <h3>Laatste imports</h3>
    <table className="adm-table"><thead><tr><th>Wanneer</th><th>Bron</th><th>Aantallen</th></tr></thead>
      <tbody>{runs.map(r => <tr key={r.id}><td>{new Date(r.at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</td><td>{r.source}</td><td>{Object.entries(r.counts).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : v}`).join(' · ')}</td></tr>)}</tbody></table>
    <h3>Markten vanaf vandaag, per bron</h3>
    <table className="adm-table"><thead><tr><th>Bron</th>{Object.keys(STATUS).map(k => <th key={k}>{STATUS[k].replace(' door organisator', '')}</th>)}</tr></thead>
      <tbody>{per.map(([org, c]) => <tr key={org}><td>{org}</td>{Object.keys(STATUS).map(k => <td key={k} className="tnum">{c[k] ?? ''}</td>)}</tr>)}</tbody></table>
    <p className="src"><Ic n="info" /><span>Winkels (OSM, Overture, websites) worden nog met de hand geïmporteerd; markten en het Gemeenteblad elke nacht.</span></p>
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
