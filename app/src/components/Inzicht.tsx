// Inzicht in /beheer: wat er op de site gebeurt. Drie bronnen, alle drie anoniem:
//  - dagtellers (tellers, clicks): per dag een getal, sinds okt 2026;
//  - gebeurtenissenlog (events, lib/ev.ts): per bezoek (tab-code die elke dag wisselt) wat er gebeurde, sinds 9 nov 2026, 90 dagen;
//  - openbare bestanden (places.json, markets.json, beheer/lezer.json) voor namen, tijden en de websitelezer.
// Ontwerp: ontwerp/beheer/index.html ("sorteerloods"). Grafieken zonder bibliotheek: svg en css.
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '../lib/auth';
import { api, fresh } from '../lib/auth';
import { slugify } from '../lib/seo';
import { km } from '../lib/model';
import { NIET_METEN } from '../lib/ev';

type T = { day: string; metric: string; key: string; n: number };
type C = { day: string; item_id: string; what: string; n: number };
/** Gebeurtenis: [unix-tijd, bezoek, soort, sleutel, pad, apparaat] (rpc beheer_events). */
export type E = [number, string, string, string, string, string | null];
export type Info = { id: string; name: string; place?: string; org?: string; lat: number; lon: number; t?: string; date?: string; h?: unknown; hs?: string; dicht?: string; website?: string; addr?: string; kind?: string };
export type Fout = { msg: string; src: string | null; ua: string | null; at: string };
type Visit = { s: string; first: number; last: number; src: string; land: string; dev: string | null; ev: E[] };

const DAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], AFST = ['0-5', '5-15', '15-30', '30+'];
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const ago = (n: number) => iso(new Date(Date.now() - n * 864e5));
export const nl = (n: number) => Math.round(n).toLocaleString('nl-NL');
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const small = (n: number) => (n > 0 && n < 5 ? '<5' : nl(n));
const dayOf = (e: E) => iso(new Date(e[0] * 1000));
const hhmm = (ts: number) => new Date(ts * 1000).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const EV_START = '2026-11-09'; // vanaf hier is er een gebeurtenissenlog

/* ---------------- data ---------------- */

export type Data = ReturnType<typeof useData>;
/** Alles wat Inzicht nodig heeft, één keer per sessie geladen. Live ververst de laatste 24 uur elke 20 seconden. */
export function useData(s: Session) {
  const [t, setT] = useState<T[] | null>(null), [c, setC] = useState<C[] | null>(null), [e, setE] = useState<E[] | null>(null);
  const [info, setInfo] = useState<Map<string, Info>>(new Map()), [err, setErr] = useState(''), [fouten, setFouten] = useState<Fout[]>([]);
  const [live, setLive] = useState<E[]>([]);
  useEffect(() => {
    // ponytail: 120 dagen tellers en 90 dagen gebeurtenissen in één keer; samenvatten in de database als dit te groot wordt.
    api(s, 'rest/v1/rpc/beheer_tellers', { method: 'POST', body: JSON.stringify({ sinds: ago(120) }) })
      .then(j => { setT(j?.tellers ?? []); setC(j?.clicks ?? []); }).catch(x => setErr(`Tellers laden lukte niet: ${x.message}`));
    api(s, 'rest/v1/rpc/beheer_events', { method: 'POST', body: JSON.stringify({ sinds: new Date(Date.now() - 90 * 864e5).toISOString() }) })
      .then(j => setE(j ?? [])).catch(() => setE([]));
    api(s, `rest/v1/client_errors?select=msg,src,ua,at&at=gte.${new Date(Date.now() - 30 * 864e5).toISOString()}&order=at.desc&limit=1000`).then(setFouten).catch(() => {});
    Promise.all([fetch('/data/places.json').then(r => r.json()), fetch('/data/markets.json').then(r => r.json())]).then(([p, m]) =>
      setInfo(new Map([...p.places.map((x: Info) => ({ ...x, t: 'k' })), ...m.markets.map((x: Info) => ({ ...x, t: 'm' }))].map((x: Info) => [x.id, x])))).catch(() => {});
  }, []);
  const refreshLive = () => api(s, 'rest/v1/rpc/beheer_events', { method: 'POST', body: JSON.stringify({ sinds: new Date(Date.now() - 864e5).toISOString() }) }).then(j => setLive(j ?? [])).catch(() => {});
  return { t, c, e, info, err, fouten, live, refreshLive };
}

/** Bezoeken uit gebeurtenissen: per tab-code, met bron en eerste pagina. */
function visits(ev: E[]): Visit[] {
  const m = new Map<string, Visit>();
  for (const x of ev) {
    let v = m.get(x[1]);
    if (!v) m.set(x[1], v = { s: x[1], first: x[0], last: x[0], src: '', land: '', dev: x[5], ev: [] });
    v.last = x[0]; v.ev.push(x);
    if (x[2] === 'binnen') { v.src = x[3]; v.land ||= x[4]; }
    if (x[2] === 'pv' && !v.land) v.land = x[4];
  }
  return [...m.values()].map(v => ({ ...v, src: v.src || 'onbekend' }));
}
const landKind = (p: string) => p === '/' ? 'home' : p.startsWith('/kaart') ? 'kaart' : p.startsWith('/winkel/') ? 'winkelpagina' : p.startsWith('/markt/') ? 'marktpagina'
  : p.startsWith('/organisator/') ? 'organisator' : p.startsWith('/provincie/') ? 'provinciepagina' : /^\/(rommel|vlooien|kofferbak|overdekte|markten)/.test(p) ? 'marktlijst' : p === '/aanmelden' ? 'aanmelden' : /^\/[a-z-]+\/?$/.test(p) ? 'stadspagina' : p;
const STEP: Record<string, string> = { view: 'geopend', plan: 'Mijn dag', dagplan: 'dagplan', route: 'route', site: 'website', tel: 'bellen', share: 'gedeeld', filter: 'filter', zoek0: 'zoeken zonder resultaat', bijdrage: 'bijdrage', plaats: 'plaats gekozen' };
const GOAL = new Set(['route', 'website', 'bellen', 'Mijn dag', 'dagplan', 'bijdrage']);
function steps(v: Visit): string[] {
  const out = [v.src, landKind(v.land)];
  for (const x of v.ev) {
    const st = x[2] === 'pv' ? (x[4].startsWith('/kaart') ? 'kaart' : x[4] === v.land ? null : landKind(x[4])) : STEP[x[2]];
    if (st && out.at(-1) !== st) out.push(st);
  }
  return out.slice(0, 7);
}
const isGoal = (v: Visit) => v.ev.some(x => ['route', 'site', 'tel'].includes(x[2]));

/** Periode: tellers en gebeurtenissen van de laatste `days` dagen, en van de periode ervoor. */
function period(d: Data, days: number) {
  const from = ago(days - 1), prevFrom = ago(2 * days - 1), list = Array.from({ length: days }, (_, i) => ago(days - 1 - i));
  const cur = (r: { day: string }) => r.day >= from, prv = (r: { day: string }) => r.day >= prevFrom && r.day < from;
  const t = d.t ?? [], c = d.c ?? [], e = d.e ?? [];
  const ec = e.filter(x => dayOf(x) >= from), ep = e.filter(x => dayOf(x) >= prevFrom && dayOf(x) < from);
  const vs = visits(ec), vp = visits(ep);
  const perDay = (rs: { day: string; n: number }[]) => { const m = new Map<string, number>(); for (const r of rs) m.set(r.day, (m.get(r.day) ?? 0) + r.n); return list.map(x => m.get(x) ?? 0); };
  const kpi = (rs: { day: string; n: number }[]) => ({ now: sum(rs.filter(cur).map(r => r.n)), prev: sum(rs.filter(prv).map(r => r.n)), days: perDay(rs.filter(cur)) });
  const tm = (m: string) => t.filter(r => r.metric === m), cw = (...w: string[]) => c.filter(r => w.includes(r.what));
  const visitDays = (v: Visit[]) => v.map(x => ({ day: iso(new Date(x.first * 1000)), n: 1 }));
  return { days, from, list, cur, prv, t, c, ec, vs, vp, tm, cw, kpi, perDay,
    k: { bezoek: { now: vs.length, prev: vp.length, days: perDay(visitDays(vs)) }, pagina: kpi(tm('pagina')), view: kpi(cw('view')), door: kpi(cw('route', 'site', 'tel')), app: kpi(tm('uur')), naarkaart: kpi(tm('naarkaart')), plan: kpi(cw('plan')) } };
}
export type P = ReturnType<typeof period>;
export const usePeriod = (d: Data, days: number) => useMemo(() => period(d, days), [d.t, d.c, d.e, days]);

/* ---------------- bouwstenen ---------------- */

export function Card({ title, sub, extra, span = 12, children, flush }: { title: string; sub?: ReactNode; extra?: ReactNode; span?: number; children: ReactNode; flush?: boolean }) {
  return <section className={`bc s${span}`}><header><h3>{title}</h3>{sub && <span className="bc-sub">{sub}</span>}<span className="sp" />{extra}</header><div className={flush ? '' : 'bc-b'}>{children}</div></section>;
}
function Spark({ v }: { v: number[] }) {
  const max = Math.max(1, ...v), w = 300, h = 44, pts = v.map((x, i) => `${(i / Math.max(1, v.length - 1)) * w},${h - 3 - (x / max) * (h - 8)}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true"><polyline className="area" points={`0,${h} ${pts} ${w},${h}`} /><polyline className="line" points={pts} /></svg>;
}
export function Kpi({ label, now, prev, days, tone = '', help, unit = '', since }: { label: string; now: number; prev: number; days?: number[]; tone?: string; help?: string; unit?: string; since?: string }) {
  const d = prev ? Math.round(((now - prev) / prev) * 100) : null;
  return <div className={`bc s3 kpi ${tone}`} title={help}><span className="lbl">{label}</span><b className="v">{nl(now)}{unit}</b>
    <span className={`d ${d == null ? '' : d >= 0 ? 'up' : 'down'}`}>{d == null ? (since ? `meten sinds ${since}` : now ? 'nieuw' : '–') : `${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}%`} {d != null && <small>t.o.v. periode ervoor</small>}</span>
    {days && days.length > 1 && <Spark v={days} />}</div>;
}
export function Bars({ rows, tone = '', unit = '', empty = 'Nog niets geteld.' }: { rows: [string, number][]; tone?: string; unit?: string; empty?: string }) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  if (!rows.length) return <p className="b-empty">{empty}</p>;
  return <ul className={`bars ${tone}`}>{rows.map(([k, n]) => <li key={k}><span className="k" title={k}>{k}</span><span className="b"><i style={{ width: `${(n / max) * 100}%` }} /></span><span className="n">{nl(n)}{unit}</span></li>)}</ul>;
}
const group = (rows: { key: string; n: number }[], f: (k: string) => string = k => k): [string, number][] => {
  const m = new Map<string, number>(); for (const r of rows) m.set(f(r.key), (m.get(f(r.key)) ?? 0) + r.n); return [...m].sort((a, b) => b[1] - a[1]);
};
const count = <X,>(xs: X[], f: (x: X) => string): [string, number][] => group(xs.map(x => ({ key: f(x), n: 1 })));
function Empty({ children }: { children: ReactNode }) { return <p className="b-empty">{children}</p>; }
function Funnel({ p }: { p: P }) {
  const v = p.vs, has = (f: (x: E) => boolean) => v.filter(x => x.ev.some(f)).length;
  const rows: [string, number][] = [['Binnengekomen', v.length], ['Kaart bekeken', has(x => x[4].startsWith('/kaart'))], ['Winkel of markt geopend', has(x => x[2] === 'view' || (x[2] === 'pv' && /^\/(winkel|markt)\//.test(x[4])))],
    ['Mijn dag of dagplan', has(x => x[2] === 'plan' || x[2] === 'dagplan')], ['Route · bellen · website', v.filter(isGoal).length]];
  if (!v.length) return <Empty>Nog geen bezoeken in deze periode. Het gebeurtenissenlog loopt sinds {EV_START.split('-').reverse().join('-')}.</Empty>;
  return <div className="fun">{rows.map(([l, n], i) => <div className="row" key={l}><span>{l}</span><span className="bar"><i style={{ width: `${pct(n, v.length)}%`, animationDelay: `${i * 0.07}s` }} /></span><span className="n">{nl(n)}</span><span className="p">{pct(n, v.length)}%</span></div>)}</div>;
}
const SRC_TONE: Record<string, string> = { google: 'var(--kring)', direct: 'var(--markt)', bing: 'var(--cat-schroot)', badge: 'var(--tweede)', facebook: 'var(--tweede)', instagram: 'var(--tweede)' };
function PerDaySources({ p }: { p: P }) {
  const srcs = ['google', 'direct', 'overig'], key = (s: string) => (s === 'google' || s === 'direct' ? s : 'overig');
  const per = p.list.map(day => { const vs = p.vs.filter(v => iso(new Date(v.first * 1000)) === day); return srcs.map(s => vs.filter(v => key(v.src) === s).length); });
  const max = Math.max(1, ...per.map(sum)), w = 640, h = 220, bw = w / per.length, col = ['var(--kring)', 'var(--markt)', 'var(--tweede)'];
  if (!p.vs.length) return <Empty>Nog geen bezoeken in deze periode.</Empty>;
  return <><svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="stack-chart" role="img" aria-label="Bezoeken per dag per bron">
    {[0.25, 0.5, 0.75, 1].map(f => <line key={f} x1="0" x2={w} y1={h - f * (h - 10)} y2={h - f * (h - 10)} className="grid" />)}
    {per.map((parts, i) => { let y0 = h; return parts.map((n, j) => { const hh = (n / max) * (h - 10); y0 -= hh; return <rect key={`${i}-${j}`} x={i * bw + 1.5} y={y0} width={Math.max(1, bw - 3)} height={hh} fill={col[j]} rx="1.5"><title>{`${p.list[i]} · ${srcs[j]}: ${n}`}</title></rect>; }); })}
  </svg><div className="legend">{srcs.map((s, i) => <span key={s} style={{ ['--c' as string]: col[i] }}>{s}</span>)}</div></>;
}

/* ---------------- kassabon (live) ---------------- */

function describe(v: Visit, info: Map<string, Info>) {
  const last = [...v.ev].reverse().find(x => x[2] !== 'pv' && x[2] !== 'binnen'), name = last && info.get(last[3])?.name;
  return { path: steps(v), what: last ? `${STEP[last[2]] ?? last[2]}${name ? ` ${name}` : last[2] === 'zoek0' || last[2] === 'filter' ? ` “${last[3]}”` : ''}` : '' };
}
export function Receipt({ d, rows = 14, height = 300 }: { d: Data; rows?: number; height?: number }) {
  useEffect(() => { d.refreshLive(); const i = setInterval(d.refreshLive, 20000); return () => clearInterval(i); }, []);
  const vs = useMemo(() => visits(d.live).sort((a, b) => b.last - a.last), [d.live]);
  const today = iso(new Date()), vt = vs.filter(v => iso(new Date(v.first * 1000)) === today), act = vs.filter(v => Date.now() / 1000 - v.last < 300).length;
  return <div className="receipt" style={{ ['--fh' as string]: `${height}px` }}>
    <h4>Snuffelkaart · live</h4><div className="meta">{new Date().toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {act} {act === 1 ? 'bezoek' : 'bezoeken'} nu actief</div><hr />
    {vs.length ? <ul className="feed">{vs.slice(0, rows).map(v => { const x = describe(v, d.info); return <li key={v.s + v.last} className={Date.now() / 1000 - v.last < 30 ? 'new' : ''}>
      <span className="t">{hhmm(v.last)}</span><span className="w">{x.path.map((s, i) => <span key={i}>{i ? <span className="ar"> → </span> : null}{i === 1 ? <em>{s}</em> : s}</span>)}</span><span className={`s${isGoal(v) ? ' g' : ''}`}>{v.dev === 'm' ? 'mobiel' : 'desktop'}</span></li>; })}</ul>
      : <p className="feed-empty">Nog niets vandaag. Zodra iemand de site opent, rolt hier de bon.</p>}
    <hr /><div className="tot"><span>BEZOEKEN VANDAAG</span><span>{vt.length}</span></div><div className="tot ghost"><span>WAARVAN ROUTE/BEL/SITE</span><span>{vt.filter(isGoal).length}</span></div></div>;
}

/* ---------------- pagina's ---------------- */

export function Overzicht({ d, p, att }: { d: Data; p: P; att: ReactNode }) {
  return <>
    <Kpi label="Bezoeken" {...p.k.bezoek} since={p.vp.length || p.days > 1 ? undefined : '9 nov'} help="Bezoeken (anonieme tab-code per dag), uit het gebeurtenissenlog" />
    <Kpi label="Pagina's bekeken" {...p.k.pagina} tone="t" help="Winkel-, markt- en organisatorpagina's" />
    <Kpi label="Plekken geopend" {...p.k.view} tone="m" help="Detail van een winkel of markt in de app" />
    <Kpi label="Route · bel · site" {...p.k.door} tone="o" help="Iemand ging echt op pad" />
    <Card title="Aandacht nodig" span={5} flush>{att}</Card>
    <Card title="Trechter" sub={`laatste ${p.days === 1 ? 'dag' : `${p.days} dagen`}`} span={7}><Funnel p={p} /></Card>
    <Card title="Bezoeken per dag" sub="naar bron" span={7}><PerDaySources p={p} /></Card>
    <section className="s5 rc-wrap"><Receipt d={d} rows={12} height={286} /></section>
  </>;
}

export function Live({ d }: { d: Data }) {
  const [skip, setSkip] = useState(() => !!localStorage.getItem(NIET_METEN));
  const vs = useMemo(() => visits(d.live).filter(v => Date.now() / 1000 - v.last < 1800).sort((a, b) => b.last - a.last), [d.live]);
  const toggle = () => { if (skip) localStorage.removeItem(NIET_METEN); else localStorage.setItem(NIET_METEN, '1'); setSkip(!skip); };
  return <>
    <section className="s5"><Receipt d={d} rows={40} height={640} /></section>
    <Card title="Nu actief" sub={`${vs.length} ${vs.length === 1 ? 'bezoek' : 'bezoeken'} in het laatste halfuur`} span={7} flush>
      <div className="bc-b now">{vs.length ? vs.slice(0, 12).map(v => <div key={v.s}><div className="now-h"><b>{v.src} · {v.dev === 'm' ? 'mobiel' : 'desktop'}</b><span className="mono ghost">{Math.max(1, Math.round((Date.now() / 1000 - v.last) / 60))} min</span></div>
        <div className="path">{steps(v).map((s, i) => <span key={i}>{i ? <span className="ar">→</span> : null}<span className={`step${i === 0 ? ' k' : GOAL.has(s) ? ' g' : ''}`}>{s}</span></span>)}</div></div>)
        : <Empty>Op dit moment niemand. De lijst ververst elke 20 seconden.</Empty>}</div>
      <label className="toggle"><button type="button" role="switch" aria-checked={skip} className={`sw${skip ? ' on' : ''}`} onClick={toggle} /><span>Dit apparaat niet meetellen <span className="ghost">(je eigen bezoeken; geldt voor deze browser)</span></span></label>
    </Card>
    <p className="note s12">Een bezoek is een willekeurige code die alleen in die tab bestaat en elke dag wisselt. Geen cookie, geen IP-adres, geen account.</p>
  </>;
}

type Gsc = { queries: [string, number, number, number][]; pages: [string, number, number, number][]; days: [string, number, number][] };
/** Zoekwoorden uit Search Console (scripts/fetch-gsc.mjs, elke nacht), opgeteld over de gekozen periode. */
function useGsc(s: Session, days: number) {
  const [g, setG] = useState<Gsc | null>(null);
  useEffect(() => { setG(null); api(s, 'rest/v1/rpc/beheer_zoekwoorden', { method: 'POST', body: JSON.stringify({ sinds: ago(Math.max(days, 3) - 1) }) }).then(j => setG(j ?? { queries: [], pages: [], days: [] })).catch(() => setG({ queries: [], pages: [], days: [] })); }, [days]);
  return g;
}
function GscTable({ rows, label }: { rows: [string, number, number, number][]; label: string }) {
  return <div className="tscroll"><table className="tbl"><thead><tr><th>{label}</th><th className="r">Vertoningen</th><th className="r">Klikken</th><th className="r">CTR</th><th className="r">Positie</th></tr></thead>
    <tbody>{rows.slice(0, 50).map(([k, c, i, pos]) => <tr key={k}><td>{label === 'Pagina' ? <a href={k} target="_blank" rel="noopener">{k}</a> : k}</td><td className="r">{nl(i)}</td><td className="r">{nl(c)}</td><td className="r">{i ? ((c / i) * 100).toFixed(1).replace('.', ',') : '0'}%</td><td className="r">{pos?.toFixed?.(1).replace('.', ',') ?? '–'}</td></tr>)}</tbody></table></div>;
}

export function Verkeer({ p, s }: { p: P; s: Session }) {
  const gsc = useGsc(s, p.days), gi = sum((gsc?.days ?? []).map(d => d[2])), gc = sum((gsc?.days ?? []).map(d => d[1]));
  const pv = p.ec.filter(x => x[2] === 'pv').length, mob = p.vs.filter(v => v.dev === 'm').length;
  return <>
    <Kpi label="Bezoeken" {...p.k.bezoek} />
    <Kpi label="Paginaweergaven" now={pv} prev={p.vp.reduce((a, v) => a + v.ev.filter(x => x[2] === 'pv').length, 0)} tone="t" />
    <Kpi label="Mobiel" now={pct(mob, p.vs.length)} prev={0} unit="%" tone="m" help="Aanraakscherm" />
    <Kpi label="Pagina's per bezoek" now={p.vs.length ? Math.round((pv / p.vs.length) * 10) / 10 : 0} prev={0} tone="o" />
    <Card title="Waar komen ze vandaan" sub="bron van het bezoek" span={6}><Bars rows={count(p.vs, v => v.src)} empty="Nog geen bezoeken." /></Card>
    <Card title="Landingspagina's" sub="eerste pagina van een bezoek" span={6}><Bars rows={count(p.vs, v => v.land || '?').slice(0, 10)} tone="m" empty="Nog geen bezoeken." /></Card>
    <Card title="Soort eerste pagina" span={6}><Bars rows={count(p.vs, v => landKind(v.land))} /></Card>
    <Card title="Google" sub="Search Console · loopt ±2 dagen achter" span={6}>{!gsc ? <Empty>Laden…</Empty> : gsc.days.length
      ? <div className="facts3"><div><span className="lbl">vertoningen</span><b>{nl(gi)}</b></div><div><span className="lbl">klikken</span><b>{nl(gc)}</b></div><div><span className="lbl">CTR</span><b>{gi ? ((gc / gi) * 100).toFixed(1).replace('.', ',') : 0}%</b></div></div>
      : <Empty>Nog geen gegevens uit Search Console. Die komen elke nacht binnen zodra de sleutel GSC_KEY in GitHub staat (zie de stappen in HANDOFF.md). Tot dan: <a href="https://search.google.com/search-console?resource_id=sc-domain%3Asnuffelkaart.nl" target="_blank" rel="noopener">Search Console</a>.</Empty>}</Card>
    {!!gsc?.queries.length && <Card title="Zoekwoorden in Google" sub="meeste vertoningen bovenaan" span={7} flush><GscTable rows={gsc.queries} label="Zoekwoord" /></Card>}
    {!!gsc?.pages.length && <Card title="Pagina's in Google" span={5} flush><GscTable rows={gsc.pages} label="Pagina" /></Card>}
  </>;
}

export function Gedrag({ p }: { p: P }) {
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const r of p.tm('uur').filter(p.cur)) { const [w, h] = r.key.split('-').map(Number); if (heat[w] && h >= 0 && h < 24) heat[w][h] += r.n; }
  const hmax = Math.max(1, ...heat.flat()), order = [1, 2, 3, 4, 5, 6, 0];
  const routes = count(p.vs.filter(v => v.ev.length > 1), v => steps(v).join(' → ')).slice(0, 8);
  const zoek = count(p.ec.filter(x => x[2] === 'zoek0' && x[3]), x => x[3]).slice(0, 12);
  const plans = p.tm('dagplan').filter(p.cur).map(r => { const [actie, st, markt, dag] = r.key.split('|'); return { actie, st: +st, markt, dag, n: r.n }; }), pn = sum(plans.map(x => x.n));
  return <>
    <Card title="Trechter" sub="van binnenkomst tot op pad" span={7}><Funnel p={p} /></Card>
    <Card title="Wanneer wordt de app geopend" sub="weekdag × uur" span={5}>
      <div className="heat"><span />{Array.from({ length: 24 }, (_, h) => <span key={h} className="hx">{h % 6 ? '' : h}</span>)}
        {order.map(w => <Fragment key={w}><span>{DAG[w]}</span>{heat[w].map((n, h) => <i key={h} title={`${DAG[w]} ${h}:00 · ${n}`} style={{ opacity: n ? 0.12 + 0.88 * (n / hmax) : 0.05 }} />)}</Fragment>)}</div></Card>
    <Card title="Veelgelopen routes" sub="per bezoek" span={7}>{routes.length ? <div className="routes">{routes.map(([r, n]) => <div key={r}><div className="path">{r.split(' → ').map((s, i) => <span key={i}>{i ? <span className="ar">→</span> : null}<span className={`step${i === 0 ? ' k' : GOAL.has(s) ? ' g' : ''}`}>{s}</span></span>)}</div><span className="mono">{n}</span></div>)}</div> : <Empty>Nog geen bezoeken met meer dan één stap.</Empty>}</Card>
    <Card title="Zoeken zonder resultaat" sub="wat ontbreekt op de kaart" span={5} flush>{zoek.length ? <table className="tbl"><tbody>{zoek.map(([q, n]) => <tr key={q}><td>“{q}”</td><td className="r">{n}</td></tr>)}</tbody></table>
      : <div className="bc-b"><Empty>Nog geen zoekopdrachten zonder resultaat (sinds 9 nov met de woorden erbij; daarvoor {nl(sum(p.tm('zoekleeg').filter(p.cur).map(r => r.n)))} keer zonder woorden).</Empty></div>}</Card>
    <Card title="Filters" sub="welke worden aangezet" span={4}><Bars rows={group(p.tm('filter').filter(p.cur), k => k.replace(/^type:m$/, 'alleen markten').replace(/^type:k$/, 'alleen winkels').replace(/^cat:/, 'soort: ')).slice(0, 8)} /></Card>
    <Card title="Gekozen plaatsen" span={4}><Bars rows={group(p.tm('plaats').filter(p.cur)).slice(0, 8)} tone="m" /></Card>
    <Card title="Dagplannen" span={4}>
      <div className="facts3"><div><span className="lbl">gestart of route</span><b>{nl(pn)}</b></div><div><span className="lbl">gem. stops</span><b>{pn ? (plans.reduce((a, x) => a + x.st * x.n, 0) / pn).toFixed(1).replace('.', ',') : '–'}</b></div><div><span className="lbl">met markt</span><b>{pct(sum(plans.filter(x => x.markt === 'ja').map(x => x.n)), pn)}%</b></div></div>
      <Bars rows={DAG.map(x => [x, sum(plans.filter(y => y.dag === x).map(y => y.n))] as [string, number]).filter(r => r[1])} tone="m" /></Card>
    <Card title="Hoe ver weg" sub="afstand van de gekozen plek tot wat geopend wordt" span={6}><Bars rows={AFST.map(a => [`${a} km`, sum(p.tm('afstand').filter(p.cur).filter(r => r.key.endsWith(`|${a}`)).map(r => r.n))] as [string, number])} /></Card>
    <Card title="Van pagina naar kaart" sub="welke pagina's brengen mensen naar de app" span={6}><Bars rows={group(p.tm('naarkaart').filter(p.cur)).slice(0, 8)} tone="m" /></Card>
  </>;
}

/* Inhoud: per winkel, markt en organisator. Klik op een organisator voor het rapport om mee te sturen. */
type Row = { id: string; name: string; sub: string; type: 'winkel' | 'markt' | 'organisator'; tijden?: string; pagina: number; view: number; plan: number; door: number };
export function Inhoud({ d, p, q, setQ }: { d: Data; p: P; q: string; setQ: (q: string) => void }) {
  const [type, setType] = useState<Row['type']>('winkel'), [sort, setSort] = useState<[keyof Row, number]>(['pagina', -1]), [org, setOrg] = useState<string | null>(null);
  const rows = useMemo(() => inhoud(d, p), [d.info, p]);
  if (org) return <Report org={org} d={d} p={p} back={() => setOrg(null)} />;
  const list = rows.filter(r => r.type === type && (r.name + ' ' + r.sub).toLowerCase().includes(q.toLowerCase())).sort((a, b) => ((a[sort[0]] ?? 0) > (b[sort[0]] ?? 0) ? 1 : -1) * sort[1]);
  const max = Math.max(1, ...list.map(r => r.pagina + r.view));
  const th = (k: keyof Row, l: string, r = true) => <th className={r ? 'r' : ''} onClick={() => setSort([k, sort[0] === k ? -sort[1] : -1])} aria-sort={sort[0] === k ? (sort[1] < 0 ? 'descending' : 'ascending') : undefined}>{l}{sort[0] === k ? (sort[1] < 0 ? ' ▾' : ' ▴') : ''}</th>;
  const csv = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([['naam;plaats;soort;tijden;pagina;geopend;dagplan;op pad', ...list.map(r => [r.name, r.sub, r.type, r.tijden ?? '', r.pagina, r.view, r.plan, r.door].join(';'))].join('\n')], { type: 'text/csv' })); a.download = `snuffelkaart-${type}-${p.days}d.csv`; a.click(); };
  return <Card title="Per winkel, markt en organisator" sub={`${nl(list.length)} met bezoek · laatste ${p.days} dagen`} flush extra={<>
    <div className="seg">{(['winkel', 'markt', 'organisator'] as const).map(x => <button key={x} className={type === x ? 'on' : ''} onClick={() => setType(x)}>{x === 'winkel' ? 'Winkels' : x === 'markt' ? 'Markten' : 'Organisatoren'}</button>)}</div>
    <label className="kbtn"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter…" aria-label="Filter op naam" /></label><button className="btn" onClick={csv}>CSV</button></>}>
    <div className="tscroll"><table className="tbl"><thead><tr>{th('name', 'Naam', false)}{type === 'winkel' && th('tijden', 'Tijden', false)}{th('pagina', 'Pagina')}{th('view', 'Geopend')}{th('plan', 'Dagplan')}{th('door', 'Op pad')}<th className="r">Conversie</th></tr></thead>
      <tbody>{list.slice(0, 300).map(r => <tr key={r.id}><td className="nm">{r.type === 'organisator' ? <button className="link" onClick={() => setOrg(r.name)}><b>{r.name}</b></button> : <a href={`/kaart/?open=${encodeURIComponent(r.id)}`} target="_blank" rel="noopener"><b>{r.name}</b></a>}<small>{r.sub}</small></td>
        {type === 'winkel' && <td><span className={`tag ${r.tijden === 'geen' ? 'bad' : r.tijden === 'tijdelijk dicht' ? 'warn' : 'ok'}`}>{r.tijden}</span></td>}
        <td className="r">{nl(r.pagina)}<span className="mini"><i style={{ width: `${((r.pagina + r.view) / max) * 100}%` }} /></span></td><td className="r">{nl(r.view)}</td><td className="r">{nl(r.plan)}</td><td className="r">{nl(r.door)}</td><td className="r">{pct(r.door, r.view + r.pagina)}%</td></tr>)}</tbody></table>
      {!list.length && <Empty>Niets {q ? `voor “${q}”` : 'bekeken in deze periode'}.</Empty>}</div></Card>;
}
function inhoud(d: Data, p: P): Row[] {
  const m = new Map<string, Row>(), info = d.info;
  const pre = new Map<string, string>(); for (const [id, x] of info) if (x.org && !x.org.startsWith('Gemeenteblad')) pre.set(id.split('-')[0], x.org);
  const orgOf = (id: string) => { const x = info.get(id); return x ? (x.org && !x.org.startsWith('Gemeenteblad') ? x.org : null) : pre.get(id.split('-')[0]) ?? null; };
  const orgSlug = new Map<string, string>(); for (const x of info.values()) if (x.org) orgSlug.set(slugify(x.org), x.org);
  const row = (id: string, type: Row['type']) => {
    let r = m.get(type + id); if (r) return r;
    const x = info.get(id);
    r = { id, type, name: type === 'organisator' ? id : x?.name ?? id, sub: type === 'organisator' ? 'organisator' : `${x?.place ?? ''}${x?.date ? ` · ${x.date.split('-').reverse().slice(0, 2).join('-')}` : ''}`,
      tijden: type === 'winkel' ? (x?.h ? (x.hs === 'web' ? 'website' : x.hs === 'bezoeker' ? 'bezoeker' : 'OSM') : x?.dicht ? 'tijdelijk dicht' : 'geen') : undefined, pagina: 0, view: 0, plan: 0, door: 0 };
    m.set(type + id, r); return r;
  };
  const add = (id: string, k: 'pagina' | 'view' | 'plan' | 'door', n: number) => {
    const x = info.get(id), type = x?.t === 'k' ? 'winkel' : 'markt';
    if (x || id.includes('-')) row(id, type)[k] += n;
    const o = orgOf(id); if (o && type === 'markt') row(o, 'organisator')[k] += n;
  };
  for (const r of p.c.filter(p.cur)) add(r.item_id, r.what === 'view' ? 'view' : r.what === 'plan' ? 'plan' : ['route', 'site', 'tel'].includes(r.what) ? 'door' : 'view', r.what === 'share' ? 0 : r.n);
  for (const r of p.tm('pagina').filter(p.cur)) { if (r.key.startsWith('org:')) { const o = orgSlug.get(r.key.slice(4)); if (o) row(o, 'organisator').pagina += r.n; } else add(r.key, 'pagina', r.n); }
  return [...m.values()];
}

/** Rapport voor één organisator: te printen of als pdf te bewaren. Kleine aantallen als "<5". */
function Report({ org, d, p, back }: { org: string; d: Data; p: P; back: () => void }) {
  const rows = inhoud(d, p).filter(r => r.type === 'markt' && d.info.get(r.id)?.org === org).sort((a, b) => b.pagina + b.view - a.pagina - a.view), me = inhoud(d, p).find(r => r.type === 'organisator' && r.id === org);
  const slug = slugify(org), badge = sum(p.tm('badge').filter(p.cur).filter(r => r.key === slug).map(r => r.n));
  const afst = AFST.map(a => [`${a} km`, sum(p.tm('afstand').filter(p.cur).filter(r => r.key.endsWith(`|${a}`) && d.info.get(r.key.split('|')[0])?.org === org).map(r => r.n))] as [string, number]);
  const an = sum(afst.map(r => r[1])), close = afst[0][1] + afst[1][1];
  const periode = `${new Date(p.list[0]).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })} t/m ${new Date(p.list.at(-1)!).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  return <section className="s12 report">
    <div className="noprint adm-btns"><button className="btn" onClick={back}>← Inhoud</button><button className="btn pri" onClick={() => print()}>Afdrukken of als pdf bewaren</button></div>
    <header className="r-head"><span className="r-mark" aria-hidden="true">S</span><div><p className="ghost">Snuffelkaart · bezoekersoverzicht</p><h2>{org}</h2><p className="ghost">{periode} ({p.days} dagen)</p></div></header>
    <div className="r-kpis">{[["Pagina's van je markten bekeken", me?.pagina ?? 0], ['Geopend in de app', me?.view ?? 0], ['In een dagplan gezet', me?.plan ?? 0], ['Route of je site geopend', me?.door ?? 0], ['Via je badge binnengekomen', badge]].map(([l, n]) =>
      <div className="bc kpi" key={l as string}><span className="lbl">{l}</span><b className="v">{small(n as number)}</b></div>)}</div>
    {an >= 5 && <Card title="Hoe ver komen bezoekers" sub={`${pct(close, an)}% zoekt binnen 15 km`}><Bars rows={afst} /></Card>}
    <Card title="Per markt" flush><table className="tbl"><thead><tr><th>Markt</th><th className="r">Pagina</th><th className="r">Geopend</th><th className="r">Dagplan</th><th className="r">Route/site</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id}><td>{r.name}<small className="ghost"> {r.sub}</small></td><td className="r">{small(r.pagina)}</td><td className="r">{small(r.view)}</td><td className="r">{small(r.plan)}</td><td className="r">{small(r.door)}</td></tr>)}</tbody></table>
      {!rows.length && <Empty>In deze periode nog geen bezoeken geteld.</Empty>}</Card>
    <p className="ghost">Snuffelkaart telt anoniem, zonder cookies, IP-adressen of accounts. Aantallen onder de 5 staan als "&lt;5". Je markten: snuffelkaart.nl/organisator/{slug}/</p>
  </section>;
}

/* Regio's: waar gekeken wordt (vakken van ±10 km) tegenover het aanbod. Kaart = alle winkels en markten als stipjes, zonder kaartdienst. */
export function Regios({ d, p }: { d: Data; p: P }) {
  const pts = useMemo(() => [...d.info.values()].filter(x => Number.isFinite(x.lat)), [d.info]);
  const regs = useMemo(() => group(p.tm('regio').filter(p.cur)).map(([k, n]) => { const [lat, lon] = k.split(',').map(Number), c = { lat, lon };
    const near = pts.filter(x => km(c, x) < 15), plc = near.find(x => x.place && x.t === 'k')?.place ?? k;
    return { k, lat, lon, n, aanbod: near.length, markt: near.filter(x => x.t === 'm').length, name: plc }; }), [p, pts]);
  const X = (lon: number) => ((lon - 3.3) / 4.0) * 400 + 20, Y = (lat: number) => ((53.6 - lat) / 2.9) * 470 + 15, nmax = Math.max(1, ...regs.map(r => r.n));
  const kans = [...regs].filter(r => r.n >= 2).sort((a, b) => b.n / (b.aanbod + 1) - a.n / (a.aanbod + 1)).slice(0, 10);
  return <>
    <Card title="Waar wordt gekeken" sub="vakken van ±10 km · grootte = bezoeken, kleur = aanbod binnen 15 km" span={8} flush>
      <div className="map"><svg viewBox="0 0 440 500" role="img" aria-label="Kaart van Nederland met regio's">
        {pts.map(x => <circle key={x.id} cx={X(x.lon)} cy={Y(x.lat)} r={x.t === 'm' ? 1.1 : 0.8} className={x.t === 'm' ? 'dot m' : 'dot'} />)}
        {regs.slice(0, 60).map(r => { const rr = 4 + Math.sqrt(r.n / nmax) * 22, c = r.aanbod < 8 ? 'var(--markt)' : r.aanbod < 25 ? 'var(--kring)' : 'var(--open)';
          return <g key={r.k}><circle cx={X(r.lon)} cy={Y(r.lat)} r={rr} fill={c} fillOpacity=".22" stroke={c} strokeWidth="1.4"><title>{`${r.name}: ${r.n} bezoeken, ${r.aanbod} plekken in de buurt`}</title></circle>{r.n >= nmax * 0.25 && <text x={X(r.lon) + rr + 3} y={Y(r.lat) + 4} className="lab">{r.name}</text>}</g>; })}
      </svg><div className="legend map-l"><span style={{ ['--c' as string]: 'var(--markt)' }}>weinig aanbod</span><span style={{ ['--c' as string]: 'var(--kring)' }}>gemiddeld</span><span style={{ ['--c' as string]: 'var(--open)' }}>veel aanbod</span></div></div></Card>
    <Card title="Veel vraag, weinig aanbod" sub="kansen om aan te vullen" span={4} flush>{kans.length ? <table className="tbl"><thead><tr><th>Regio</th><th className="r">Bezoeken</th><th className="r">Plekken</th><th className="r">Markten</th></tr></thead>
      <tbody>{kans.map(r => <tr key={r.k}><td>rond {r.name}</td><td className="r">{nl(r.n)}</td><td className="r"><span className={`tag ${r.aanbod < 8 ? 'warn' : 'ok'}`}>{r.aanbod}</span></td><td className="r">{r.markt}</td></tr>)}</tbody></table> : <div className="bc-b"><Empty>Nog te weinig regio's geteld.</Empty></div>}
      <div className="bc-b ghost small">Jouw eigen omgeving telt mee, tenzij je bij Live “dit apparaat niet meetellen” aanzet.</div></Card>
  </>;
}

/* ---------------- data ---------------- */

type Site = [string, string | null, string | null, string | null, string, boolean, boolean, boolean];
// Zelfde sleutel als scripts/hours-from-web.mjs (siteKey).
const siteKey = (u: string) => { try { const x = new URL(/^https?:/i.test(u) ? u : 'https://' + u); return x.host.replace(/^www\./, '').toLowerCase() + x.pathname.replace(/\/$/, ''); } catch { return ''; } };
const reason = (s?: Site) => !s ? 'nog niet gelezen' : s[6] ? 'tijdelijk gesloten' : s[1] ? 'tijden gevonden' : /403/.test(s[2] ?? '') ? 'geblokkeerd (403)' : /^fout/.test(s[2] ?? '') ? 'onbereikbaar' : s[2] === 'robots.txt' ? 'robots.txt' : 'geen tijden op site';
export function useLezer() {
  const [sites, setSites] = useState<Site[] | null>(null);
  useEffect(() => { fetch('/beheer/lezer.json').then(r => r.json()).then(j => setSites(j.sites)).catch(() => setSites([])); }, []);
  return sites;
}

export function Dekking({ d, p }: { d: Data; p: P }) {
  const sites = useLezer(), byKey = useMemo(() => new Map((sites ?? []).map(s => [s[0], s])), [sites]);
  const shops = [...d.info.values()].filter(x => x.t === 'k'), n = shops.length || 1;
  const web = shops.filter(x => x.h && x.hs === 'web').length, bez = shops.filter(x => x.h && x.hs === 'bezoeker').length, osm = shops.filter(x => x.h && !x.hs).length, dicht = shops.filter(x => !x.h && x.dicht).length, met = web + bez + osm;
  const seen = new Map<string, number>(); for (const r of p.c.filter(p.cur)) seen.set(r.item_id, (seen.get(r.item_id) ?? 0) + r.n); for (const r of p.tm('pagina').filter(p.cur)) seen.set(r.key, (seen.get(r.key) ?? 0) + r.n);
  const zonder = shops.filter(x => !x.h).map(x => ({ x, n: seen.get(x.id) ?? 0, why: x.dicht ? 'tijdelijk gesloten' : !x.website ? 'geen website' : reason(byKey.get(siteKey(x.website))) })).sort((a, b) => b.n - a.n).slice(0, 25);
  const plaatsen = Object.entries(shops.reduce<Record<string, [number, number]>>((a, x) => { const k = x.place ?? '?'; (a[k] ??= [0, 0])[0]++; if (x.h) a[k][1]++; return a; }, {})).filter(([, [t]]) => t >= 12).sort((a, b) => b[1][0] - a[1][0]).slice(0, 12);
  return <>
    <Card title="Dekking openingstijden" sub={`${nl(shops.length)} winkels`} span={5}>
      <div className="cov"><div className="ring" style={{ ['--p' as string]: pct(met, n) }}><div><b>{pct(met, n)}%</b><small>met tijden</small></div></div>
        <div style={{ flex: 1 }}><div className="stackbar">{[[osm, 'var(--kring)'], [web, 'var(--open)'], [bez, 'var(--tweede)'], [dicht, 'var(--warn)']].map(([v, c], i) => <i key={i} style={{ width: `${((v as number) / n) * 100}%`, background: c as string }} />)}</div>
          <div className="legend"><span style={{ ['--c' as string]: 'var(--kring)' }}>OSM {nl(osm)}</span><span style={{ ['--c' as string]: 'var(--open)' }}>website {nl(web)}</span><span style={{ ['--c' as string]: 'var(--tweede)' }}>bezoeker {nl(bez)}</span><span style={{ ['--c' as string]: 'var(--warn)' }}>tijdelijk dicht {nl(dicht)}</span><span style={{ ['--c' as string]: 'var(--surface-2)' }}>onbekend {nl(n - met - dicht)}</span></div></div></div></Card>
    <Card title="Grootste plaatsen" sub="met tijden / totaal" span={7}><Bars rows={plaatsen.map(([k, [t, h]]) => [`${k} · ${h}/${t}`, pct(h, t)] as [string, number])} unit="%" /></Card>
    <Card title="Zonder tijden, meest bekeken" sub={`laatste ${p.days} dagen · pak deze eerst op`} flush>
      <table className="tbl"><thead><tr><th>Winkel</th><th>Waarom geen tijden</th><th className="r">Bekeken</th><th /></tr></thead>
        <tbody>{zonder.map(({ x, n, why }) => <tr key={x.id}><td className="nm"><b>{x.name}</b><small>{x.addr ?? x.place}</small></td><td><span className={`tag ${/geblokkeerd|onbereikbaar/.test(why) ? 'bad' : why === 'geen website' || why === 'nog niet gelezen' ? '' : 'warn'}`}>{why}</span></td><td className="r">{nl(n)}</td>
          <td className="r"><a className="btn" href={`/kaart/?open=${encodeURIComponent(x.id)}&tijden=1`} target="_blank" rel="noopener">Tijden invullen</a></td></tr>)}</tbody></table></Card>
  </>;
}

export function Lezer({ s }: { s: Session }) {
  const sites = useLezer(), [f, setF] = useState('alles'), [q, setQ] = useState(''), [run, setRun] = useState<Record<string, string>>({});
  // Opnieuw lezen via de worker (/api/herlees): die controleert of je beheerder bent en start workflow herlees.yml.
  const reread = async (site: string) => {
    setRun(r => ({ ...r, [site]: 'bezig' }));
    try {
      const ses = await fresh(s); if (!ses) throw new Error('Log opnieuw in.');
      const r = await fetch('/api/herlees', { method: 'POST', headers: { Authorization: `Bearer ${ses.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ site }) });
      const j = await r.json().catch(() => ({}));
      setRun(x => ({ ...x, [site]: r.ok ? 'gestart' : j.fout ?? `fout ${r.status}` }));
    } catch (e) { setRun(x => ({ ...x, [site]: (e as Error).message })); }
  };
  if (!sites) return <p className="b-empty s12">Laden…</p>;
  const read = sites.map(s => s[4]).sort().at(-1) ?? '', withH = sites.filter(s => s[1]).length, ai = sites.filter(s => s[1] && s[5]).length, bad = sites.filter(s => /^fout/.test(s[2] ?? '')).length;
  const F: Record<string, (s: Site) => boolean> = { alles: () => true, 'met tijden': s => !!s[1], 'geen tijden': s => !s[1] && !/^fout/.test(s[2] ?? ''), 'AI-lezer': s => s[5], fout: s => /^fout/.test(s[2] ?? ''), 'tijdelijk dicht': s => s[6] };
  const list = sites.filter(F[f]).filter(s => s[0].includes(q.toLowerCase())).sort((a, b) => b[4].localeCompare(a[4]));
  const when = (x: string) => new Date(x).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return <>
    <Kpi label="Sites met tijden" now={withH} prev={0} tone="o" />
    <Kpi label="Gelezen" now={sites.length} prev={0} help={`laatst ${when(read)}`} />
    <Kpi label="Via de AI-lezer" now={ai} prev={0} tone="m" />
    <Kpi label="Onbereikbaar" now={bad} prev={0} tone="t" />
    <Card title="Waarom geen tijden" sub={`stand van ${when(read)}`} span={5}><Bars rows={count(sites.filter(s => !s[1]), s => reason(s))} tone="m" /></Card>
    <Card title="Hoe het werkt" span={7}><ul className="howto"><li>Elke maandag 00:30 (UTC) leest de winkelrun alle websites van winkels zonder tijden in OSM.</li><li>Eerst de parser (tabellen, “di t/m za 10–17”, Engels, vestigingen), dan de AI-lezer (Cloudflare, max. 250 vragen per run).</li><li>Een site met tijden voor meer winkels (keten) telt alleen voor de winkel met de postcode of plaats op die pagina.</li><li>Eén site opnieuw lezen: de knop “Opnieuw lezen” hieronder (±3 minuten, daarna binnen een kwartier op de kaart), of <code>node scripts/fetch-web-hours.mjs --site=voorbeeld.nl</code></li></ul></Card>
    <Card title="Sites" sub={`${nl(list.length)} van ${nl(sites.length)}`} flush extra={<><div className="seg">{Object.keys(F).map(k => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{k}</button>)}</div><label className="kbtn"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Zoek site…" aria-label="Zoek site" /></label></>}>
      <div className="tscroll"><table className="tbl"><thead><tr><th>Site</th><th>Resultaat</th><th>Gevonden op</th><th className="r">Gelezen</th><th /></tr></thead>
        <tbody>{list.slice(0, 300).map(s => <tr key={s[0]}><td className="mono">{s[0]}</td><td><span className={`tag ${s[1] ? 'ok' : s[6] ? 'warn' : /^fout/.test(s[2] ?? '') ? 'bad' : ''}`}>{s[1] ?? (s[6] ? 'tijdelijk gesloten' : s[2]?.replace(/^fout: /, '') ?? '—')}</span>{s[5] && s[1] ? <span className="tag m">AI</span> : null}{s[7] ? <span className="tag k">per vestiging</span> : null}</td>
          <td className="ghost mono small">{s[3] ? <a href={s[3]} target="_blank" rel="noopener">{s[3].replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}</a> : '—'}</td><td className="r">{when(s[4])}</td>
          <td className="r">{run[s[0]] === 'gestart' ? <span className="tag ok" title="Klaar over ±3 minuten; daarna binnen een kwartier op de kaart">gestart · ±3 min</span> : run[s[0]] && run[s[0]] !== 'bezig' ? <span className="tag bad">{run[s[0]]}</span>
            : <button className="btn" disabled={run[s[0]] === 'bezig'} onClick={() => reread(s[0])}>{run[s[0]] === 'bezig' ? 'Starten…' : 'Opnieuw lezen'}</button>}</td></tr>)}</tbody></table></div></Card>
  </>;
}

export function Fouten({ d }: { d: Data }) {
  const g = Object.values(d.fouten.reduce<Record<string, { e: Fout; n: number; first: string }>>((a, e) => { const x = (a[e.msg] ??= { e, n: 0, first: e.at }); x.n++; if (e.at < x.first) x.first = e.at; return a; }, {})).sort((a, b) => b.e.at.localeCompare(a.e.at));
  const ua = (u: string | null) => !u ? '' : /iPhone|iPad/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Firefox/.test(u) ? 'Firefox' : /Edg\//.test(u) ? 'Edge' : /Chrome/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'anders';
  const fresh = (x: string) => Date.now() - Date.parse(x) < 864e5;
  return <Card title="Fouten bij bezoekers" sub={`${g.length} soorten · ${d.fouten.length} keer · 30 dagen`} flush>
    {g.length ? <table className="tbl"><thead><tr><th>Fout</th><th>Waar</th><th className="r">Aantal</th><th className="r">Laatst</th><th /></tr></thead>
      <tbody>{g.map(({ e, n, first }) => <tr key={e.msg}><td><div className="err">{e.msg}</div></td><td className="ghost small">{e.src}<br />{ua(e.ua)}</td><td className="r">{n}</td><td className="r">{new Date(e.at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
        <td>{fresh(first) ? <span className="tag bad">nieuw</span> : fresh(e.at) ? <span className="tag warn">vandaag</span> : null}</td></tr>)}</tbody></table>
      : <div className="bc-b"><Empty>Geen fouten. Gaat er bij een bezoeker iets stuk, dan staat het hier (zonder wie het was).</Empty></div>}</Card>;
}
