// Beheer (M2): markten bevestigen of afgelasten, kandidaten keuren, winkels corrigeren of verbergen.
// Inloggen met een link per e-mail (Supabase Auth); wat je mag, bepaalt RLS (tabel admins). Wat je hier zet, komt in `locked`:
// een import overschrijft het niet meer. ponytail: REST met fetch, geen supabase-js; na een uur opnieuw inloggen.
import { useEffect, useState } from 'react';
import { CATS, type Cat } from '../lib/model';
import { CAT } from './ui';

declare const __SB_URL__: string, __SB_KEY__: string;
const SB = __SB_URL__, KEY = __SB_KEY__, STORE = 'snuffel-beheer';
type Session = { token: string; email: string; exp: number };
type Row = { id: string; status: string; locked: string[]; data: Record<string, any>; date?: string };

function session(): Session | null {
  const h = new URLSearchParams(location.hash.slice(1)), token = h.get('access_token');
  if (token) {
    const email = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email;
    const s = { token, email, exp: Date.now() + Number(h.get('expires_in') ?? 3600) * 1000 };
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* privémodus: alleen deze sessie */ }
    history.replaceState(null, '', location.pathname);
    return s;
  }
  try { const s = JSON.parse(localStorage.getItem(STORE) ?? 'null'); return s && s.exp > Date.now() ? s : null; } catch { return null; }
}

async function api(s: Session, path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers } });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}
const lock = (r: Row, ...ks: string[]) => [...new Set([...r.locked, ...ks])];

export default function Beheer() {
  const [s, setS] = useState<Session | null>(null), [ready, setReady] = useState(false);
  useEffect(() => { setS(session()); setReady(true); }, []);
  if (!SB || !KEY) return <main className="bh"><p>Beheer is niet ingesteld: SUPABASE_URL en SUPABASE_ANON_KEY ontbreken bij de build.</p></main>;
  if (!ready) return null;
  return <main className="bh">{s ? <Panel s={s} out={() => { try { localStorage.removeItem(STORE); } catch {} setS(null); }} /> : <Login />}</main>;
}

function Login() {
  const [email, setEmail] = useState(''), [sent, setSent] = useState(false), [err, setErr] = useState('');
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const r = await fetch(`${SB}/auth/v1/otp?redirect_to=${encodeURIComponent(location.origin + '/beheer')}`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, create_user: true }) });
    r.ok ? setSent(true) : setErr(`Versturen lukte niet (${r.status}). Probeer het over een minuut opnieuw.`);
  };
  return (<form className="bh-login" onSubmit={send}>
    <h1>Beheer</h1>
    {sent ? <p>Er is een inloglink gestuurd naar <b>{email}</b>. Open hem in deze browser.</p> : <>
      <label>E-mailadres<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
      <button className="btn primary">Stuur inloglink</button></>}
    {err && <p className="bh-err">{err}</p>}
  </form>);
}

function Panel({ s, out }: { s: Session; out: () => void }) {
  const [tab, setTab] = useState<'m' | 'k'>('m');
  return (<>
    <header className="bh-head"><h1>Beheer</h1><span>{s.email}</span><button className="btn sm" onClick={out}>Uitloggen</button></header>
    <div className="typeseg"><button aria-pressed={tab === 'm'} onClick={() => setTab('m')}>Markten</button><button aria-pressed={tab === 'k'} onClick={() => setTab('k')}>Winkels</button></div>
    <p className="bh-note">Wijzigingen staan binnen ±15 minuten op de kaart. Wat je hier zet, overschrijft een import niet meer.</p>
    {tab === 'm' ? <Markets s={s} /> : <Shops s={s} />}
  </>);
}

const STATUS: [string, string][] = [['org', 'Bevestigd'], ['chk', 'Gecontroleerd'], ['unconf', 'Nog niet bevestigd'], ['cancel', 'Afgelast'], ['kandidaat', 'Kandidaat'], ['afgewezen', 'Afgewezen']];
const label = (st: string) => STATUS.find(([k]) => k === st)?.[1] ?? st;

function Markets({ s }: { s: Session }) {
  const [rows, setRows] = useState<Row[] | null>(null), [show, setShow] = useState('kandidaat'), [err, setErr] = useState(''), [why, setWhy] = useState<Record<string, string>>({});
  const today = new Date().toLocaleDateString('sv-SE');
  useEffect(() => { api(s, `markets?select=id,date,status,locked,data&date=gte.${today}&order=date,id`).then(setRows).catch(e => setErr(e.message)); }, []);
  const set = async (r: Row, status: string) => {
    const data = status === 'cancel' ? { ...r.data, cancelWhy: why[r.id] || r.data.cancelWhy } : r.data;
    try { const [n] = await api(s, `markets?id=eq.${encodeURIComponent(r.id)}`, { method: 'PATCH', body: JSON.stringify({ status, data, locked: lock(r, 'status', ...(status === 'cancel' ? ['cancelWhy'] : [])), updated_at: new Date().toISOString() }) }); setRows(rs => rs!.map(x => x.id === r.id ? n : x)); }
    catch (e) { setErr((e as Error).message); }
  };
  if (err) return <p className="bh-err">{err}</p>;
  if (!rows) return <p>Laden…</p>;
  if (!rows.length) return <p>Geen markten zichtbaar. Is <b>{s.email}</b> als beheerder ingesteld?</p>;
  const list = rows.filter(r => show === 'alle' || r.status === show);
  return (<>
    <div className="chips">{[['alle', 'Alle'], ...STATUS].map(([k, l]) => <button key={k} className="chip" aria-pressed={show === k} onClick={() => setShow(k)}>{l} ({k === 'alle' ? rows.length : rows.filter(r => r.status === k).length})</button>)}</div>
    <ul className="bh-list">{list.map(r => (<li key={r.id}>
      <div><b>{r.data.name}</b> <span className={`bh-st ${r.status}`}>{label(r.status)}</span>{r.locked.includes('status') && <small> · met de hand</small>}{r.data.vanished && <small> · verdwenen van hun site op {r.data.vanished}</small>}
        <p>{r.date}{r.data.timeKnown ? ` ${Math.floor(r.data.start / 60)}:${String(r.data.start % 60).padStart(2, '0')}` : ''} · {r.data.place}{r.data.venue ? ` · ${r.data.venue}` : ''} · {r.data.org}{r.data.stage ? ` (${r.data.stage})` : ''} {r.data.url && <a href={r.data.url} target="_blank" rel="noopener">bron</a>}</p>
        {r.data.snippet && <details><summary>Tekst van de publicatie</summary><p>{r.data.snippet}</p></details>}</div>
      <div className="bh-acts">{STATUS.filter(([k]) => k !== r.status && (r.status === 'kandidaat' || k !== 'kandidaat')).map(([k, l]) => <button key={k} className="btn sm" onClick={() => set(r, k)}>{l}</button>)}
        <input placeholder="Reden bij afgelast" value={why[r.id] ?? r.data.cancelWhy ?? ''} onChange={e => setWhy({ ...why, [r.id]: e.target.value })} /></div>
    </li>))}</ul>
  </>);
}

const catOfData = (d: Record<string, any>): Cat => (d.kind === 'tweedehands' ? d.sub ?? 'tweedehands' : 'kringloop');

function Shops({ s }: { s: Session }) {
  const [q, setQ] = useState(''), [rows, setRows] = useState<Row[]>([]), [err, setErr] = useState('');
  useEffect(() => {
    if (q.trim().length < 2) return setRows([]);
    const t = setTimeout(() => { const w = `*${q.trim().replace(/[,()*]/g, ' ')}*`; api(s, `places?select=id,status,locked,data&or=(data->>name.ilike.${encodeURIComponent(w)},data->>place.ilike.${encodeURIComponent(w)})&order=id&limit=50`).then(setRows).catch(e => setErr(e.message)); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const save = async (r: Row, patch: Partial<Row>) => {
    try { const [n] = await api(s, `places?id=eq.${encodeURIComponent(r.id)}`, { method: 'PATCH', body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) }); setRows(rs => rs.map(x => x.id === r.id ? n : x)); }
    catch (e) { setErr((e as Error).message); }
  };
  const setCat = (r: Row, c: Cat) => { const { sub, ...d } = r.data; save(r, { data: c === 'kringloop' ? { ...d, kind: d.kind === 'goede-doelen' ? 'goede-doelen' : 'kringloop' } : { ...d, kind: 'tweedehands', ...(c === 'tweedehands' ? {} : { sub: c }) }, locked: lock(r, 'kind', 'sub') }); };
  return (<>
    <label className="search"><input type="search" placeholder="Zoek winkel op naam of plaats" value={q} onChange={e => setQ(e.target.value)} /></label>
    {err && <p className="bh-err">{err}</p>}
    <ul className="bh-list">{rows.map(r => (<li key={r.id} className={r.status === 'verborgen' ? 'off' : ''}>
      <div><b>{r.data.name}</b>{r.status === 'verborgen' && <span className="bh-st cancel">Verborgen</span>}<p>{r.data.addr ?? r.data.place} · {r.id}{r.data.website && <> · <a href={/^https?:/.test(r.data.website) ? r.data.website : `https://${r.data.website}`} target="_blank" rel="noopener">site</a></>}</p></div>
      <div className="bh-acts">
        <select value={catOfData(r.data)} onChange={e => setCat(r, e.target.value as Cat)} aria-label="Soort">{CATS.map(c => <option key={c} value={c}>{CAT[c][0]}</option>)}</select>
        <button className="btn sm" onClick={() => save(r, { status: r.status === 'verborgen' ? 'actief' : 'verborgen' })}>{r.status === 'verborgen' ? 'Weer tonen' : 'Verbergen'}</button></div>
    </li>))}</ul>
  </>);
}
