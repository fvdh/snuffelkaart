// Dashboard in /beheer: alles wat we anoniem tellen (klikteller + tellers, zie de migraties) in één overzicht, en per organisator
// een rapport om mee te sturen. Alleen tellers per dag; kleine aantallen in het rapport worden "<5" (anders herleidbaar in een dorp).
import { useEffect, useMemo, useState } from 'react';
import type { Session } from '../lib/auth';
import { api } from '../lib/auth';
import { slugify } from '../lib/seo';
import { km } from '../lib/model';

type T = { day: string; metric: string; key: string; n: number };
type C = { day: string; item_id: string; what: string; n: number };
type Info = { name: string; place?: string; org?: string; lat: number; lon: number; t?: string; date?: string };

const DAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], AFST = ['0-5', '5-15', '15-30', '30+'];
const iso = (d: Date) => d.toISOString().slice(0, 10), ago = (n: number) => iso(new Date(Date.now() - n * 864e5));
const nl = (n: number) => n.toLocaleString('nl-NL');
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const small = (n: number) => (n > 0 && n < 5 ? '<5' : nl(n));

/** Lijntje van dagwaarden (geen bibliotheek: een polyline). */
function Spark({ v }: { v: number[] }) {
  const max = Math.max(1, ...v), w = 120, h = 32, pts = v.map((x, i) => `${(i / Math.max(1, v.length - 1)) * w},${h - 2 - (x / max) * (h - 4)}`).join(' ');
  return <svg className="ds-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={`0,${h} ${pts} ${w},${h}`} className="area" /><polyline points={pts} className="line" /></svg>;
}
function Kpi({ label, now, prev, days, help }: { label: string; now: number; prev: number; days: number[]; help?: string }) {
  const d = prev ? Math.round(((now - prev) / prev) * 100) : null;
  return <div className="ds-kpi" title={help}><span className="ds-l">{label}</span><b className="tnum">{nl(now)}</b>
    <span className={`ds-d ${d == null ? '' : d >= 0 ? 'up' : 'down'}`}>{d == null ? (now ? 'nieuw' : '–') : `${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}%`} <small>t.o.v. periode ervoor</small></span><Spark v={days} /></div>;
}
function Bars({ rows, unit = '' }: { rows: [string, number][]; unit?: string }) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return <ul className="ds-bars">{rows.map(([k, n]) => <li key={k}><span className="k">{k}</span><span className="bar"><i style={{ width: `${(n / max) * 100}%` }} /></span><span className="n tnum">{nl(n)}{unit}</span></li>)}</ul>;
}

function compute(t: T[], c: C[], info: Map<string, Info>, days: number) {
    const from = ago(days - 1), prevFrom = ago(2 * days - 1), cur = (r: { day: string }) => r.day >= from, prv = (r: { day: string }) => r.day >= prevFrom && r.day < from;
    const list = Array.from({ length: days }, (_, i) => ago(days - 1 - i));
    const sum = <R extends { n: number }>(rs: R[]) => rs.reduce((a, r) => a + r.n, 0);
    const perDay = <R extends { day: string; n: number }>(rs: R[]) => { const m = new Map<string, number>(); for (const r of rs) m.set(r.day, (m.get(r.day) ?? 0) + r.n); return list.map(x => m.get(x) ?? 0); };
    const tm = (metric: string) => t.filter(r => r.metric === metric), cw = (...w: string[]) => c.filter(r => w.includes(r.what));
    const kpi = (rs: { day: string; n: number }[]) => ({ now: sum(rs.filter(cur)), prev: sum(rs.filter(prv)), days: perDay(rs.filter(cur)) });
    const group = (rs: T[], f: (k: string) => string) => { const m = new Map<string, number>(); for (const r of rs.filter(cur)) m.set(f(r.key), (m.get(f(r.key)) ?? 0) + r.n); return [...m].sort((a, b) => b[1] - a[1]); };
    // Heatmap: weekdag × uur
    const heat = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
    for (const r of tm('uur').filter(cur)) { const [w, h] = r.key.split('-').map(Number); if (heat[w] && h >= 0 && h < 24) heat[w][h] += r.n; }
    // Organisator van een markt: uit de huidige agenda, of (voorbije markt) via het voorvoegsel van het id ("don-…")
    const pre = new Map<string, string>(); for (const [id, x] of info) if (x.org && !x.org.startsWith('Gemeenteblad')) pre.set(id.split('-')[0], x.org);
    const orgOf = (id: string) => { const x = info.get(id); return x ? (x.org && !x.org.startsWith('Gemeenteblad') ? x.org : null) : pre.get(id.split('-')[0]) ?? null; };
    const orgSlug = new Map<string, string>(); for (const x of info.values()) if (x.org) orgSlug.set(slugify(x.org), x.org);
    const orgs = new Map<string, Record<string, number>>();
    // Alle organisatoren met een agenda, ook zonder bezoeken: dan zie je ook wie niets trekt.
    for (const x of info.values()) if (x.org && !x.org.startsWith('Gemeenteblad')) orgs.set(x.org, orgs.get(x.org) ?? {});
    const bump = (o: string | null, k: string, n: number) => { if (!o) return; const r = orgs.get(o) ?? {}; r[k] = (r[k] ?? 0) + n; orgs.set(o, r); };
    for (const r of c.filter(cur)) bump(orgOf(r.item_id), r.what, r.n);
    for (const r of tm('pagina').filter(cur)) bump(r.key.startsWith('org:') ? orgSlug.get(r.key.slice(4)) ?? null : orgOf(r.key), 'pagina', r.n);
    for (const r of tm('badge').filter(cur)) bump(orgSlug.get(r.key) ?? null, 'badge', r.n);
    // Regio's: vak van 0,1 graad → dichtstbijzijnde plaats met winkels, en wat er aan aanbod is (markten binnen 15 km)
    const cities = new Map<string, { lat: number; lon: number; n: number }>();
    for (const x of info.values()) if (x.place && x.t !== 'm') { const e = cities.get(x.place) ?? { lat: 0, lon: 0, n: 0 }; e.lat += x.lat; e.lon += x.lon; e.n++; cities.set(x.place, e); }
    const cs = [...cities].filter(([, e]) => e.n >= 3).map(([name, e]) => ({ name, lat: e.lat / e.n, lon: e.lon / e.n }));
    const mk = [...info.values()].filter(x => x.t === 'm');
    const regions = group(tm('regio'), k => k).slice(0, 12).map(([k, n]) => {
      const [lat, lon] = k.split(',').map(Number), p = { lat, lon };
      const near = cs.reduce((b, x) => (km(p, x) < km(p, b) ? x : b), cs[0] ?? { name: k, lat, lon });
      return { name: near?.name ?? k, n, markets: mk.filter(m => km(p, m) < 15).length };
    });
    const plans = tm('dagplan').filter(cur).map(r => { const [actie, st, markt, dag] = r.key.split('|'); return { actie, st: +st, markt, dag, n: r.n }; });
    const pn = sum(plans);
    return {
      list, kpi: { app: kpi(tm('uur')), pagina: kpi(tm('pagina')), view: kpi(cw('view')), plan: kpi(cw('plan')), door: kpi(cw('route', 'site', 'tel')) },
      heat, orgs: [...orgs].sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0)),
      regions, plaatsen: group(tm('plaats'), k => k).slice(0, 10), filters: group(tm('filter'), k => k.replace(/^type:m$/, 'alleen markten').replace(/^type:k$/, 'alleen winkels').replace(/^cat:/, 'soort: ')).slice(0, 10),
      afstand: AFST.map(a => [a, sum(tm('afstand').filter(cur).filter(r => r.key.endsWith(`|${a}`)))] as [string, number]),
      leeg: sum(tm('zoekleeg').filter(cur)), plans: { n: pn, start: sum(plans.filter(p => p.actie === 'start')), stops: pn ? plans.reduce((a, p) => a + p.st * p.n, 0) / pn : 0, markt: pct(sum(plans.filter(p => p.markt === 'ja')), pn),
        dagen: DAG.map(x => [x, sum(plans.filter(p => p.dag === x))] as [string, number]) },
      orgOf, cur, tm,
    };
}
type Dash = ReturnType<typeof compute>;

export function Dashboard({ s }: { s: Session }) {
  const [t, setT] = useState<T[] | null>(null), [c, setC] = useState<C[] | null>(null), [info, setInfo] = useState<Map<string, Info>>(new Map()), [err, setErr] = useState('');
  const [days, setDays] = useState(30), [org, setOrg] = useState<string | null>(null);
  useEffect(() => {
    // ponytail: 120 dagen in één keer; een samenvatting in de database als dit te groot wordt
    // Beide tabellen in één verzoek (migratie dashboard_rpc). Let op: lib/auth wil het hele pad, met rest/v1.
    api(s, 'rest/v1/rpc/beheer_tellers', { method: 'POST', body: JSON.stringify({ sinds: ago(120) }) })
      .then(j => { setT(j?.tellers ?? []); setC(j?.clicks ?? []); }).catch(e => setErr(`Tellers laden lukte niet: ${e.message}`));
    Promise.all([fetch('/data/places.json').then(r => r.json()), fetch('/data/markets.json').then(r => r.json())]).then(([p, m]) =>
      setInfo(new Map([...p.places, ...m.markets].map((x: Info & { id: string }) => [x.id, x])))).catch(() => {});
  }, []);

  const d = useMemo(() => (t && c ? compute(t, c, info, days) : null), [t, c, info, days]);

  if (err) return <section className="adm-wide"><h2>Dashboard</h2><p className="bh-err">{err}</p></section>;
  if (!d) return <section className="adm-wide"><h2>Dashboard</h2><p className="adm-sub">Laden…</p></section>;
  if (org) return <Report org={org} c={c!} t={t!} d={d} info={info} days={days} back={() => setOrg(null)} />;
  const hmax = Math.max(1, ...d.heat.flat());
  return (<section className="adm-wide dash" aria-label="Dashboard">
    <header className="ds-head"><div><h2>Dashboard</h2><p className="adm-sub">Anonieme tellers: per dag, nooit per persoon. Vergeleken met de {days} dagen ervoor.</p></div>
      <div className="adm-filters" role="group" aria-label="Periode">{[7, 30, 90].map(n => <button key={n} className="chip" aria-pressed={days === n} onClick={() => setDays(n)}>{n} dagen</button>)}</div></header>
    <div className="ds-kpis">
      <Kpi label="App geopend" {...d.kpi.app} help="Eén keer per bezoek aan de kaart" />
      <Kpi label="Pagina's bekeken" {...d.kpi.pagina} help="Winkel-, markt- en organisatorpagina's, vaak via Google" />
      <Kpi label="Plekken geopend" {...d.kpi.view} help="Detail van een winkel of markt in de app" />
      <Kpi label="In een dagplan" {...d.kpi.plan} />
      <Kpi label="Doorgeklikt" {...d.kpi.door} help="Route, website of bellen" />
    </div>
    <div className="ds-grid">
      <div className="ds-card wide"><h3>Wanneer wordt de app geopend</h3>
        <div className="ds-heat" role="img" aria-label="Gebruik per weekdag en uur">{d.heat.map((row, w) => <div key={w} className="r"><span>{DAG[w]}</span>{row.map((n, h) => <i key={h} title={`${DAG[w]} ${h}:00 · ${n}`} style={{ opacity: n ? 0.15 + 0.85 * (n / hmax) : 0.06 }} />)}</div>)}
          <div className="r ax"><span />{Array.from({ length: 24 }, (_, h) => <em key={h}>{h % 6 === 0 ? h : ''}</em>)}</div></div></div>
      <div className="ds-card"><h3>Waar wordt gekeken</h3><p className="adm-sub">Vakken van ±10 km, met het aantal markten binnen 15 km. Weinig markten bij veel kijkers: daar ontbreekt aanbod.</p>
        <table className="adm-table"><thead><tr><th>Regio</th><th className="tnum">Bezoeken</th><th className="tnum">Markten</th></tr></thead>
          <tbody>{d.regions.map(r => <tr key={r.name + r.n}><td>rond {r.name}</td><td className="tnum">{nl(r.n)}</td><td className={`tnum${r.markets < 3 ? ' ds-low' : ''}`}>{r.markets}</td></tr>)}</tbody></table>
        {!d.regions.length && <p className="adm-sub">Nog niets geteld.</p>}</div>
      <div className="ds-card"><h3>Gekozen plaatsen</h3>{d.plaatsen.length ? <Bars rows={d.plaatsen} /> : <p className="adm-sub">Nog niets geteld.</p>}</div>
      <div className="ds-card"><h3>Hoe ver weg</h3><p className="adm-sub">Afstand van de gekozen plek tot wat mensen openen.</p><Bars rows={d.afstand.map(([k, n]) => [`${k} km`, n])} /></div>
      <div className="ds-card"><h3>Filters</h3>{d.filters.length ? <Bars rows={d.filters} /> : <p className="adm-sub">Nog niets geteld.</p>}
        <p className="adm-sub">Zoeken zonder resultaat: <b className="tnum">{nl(d.leeg)}</b> keer</p></div>
      <div className="ds-card"><h3>Dagplannen</h3>
        <dl className="ds-facts"><dt>Gestart of als route geopend</dt><dd className="tnum">{nl(d.plans.n)}</dd><dt>Gemiddeld aantal stops</dt><dd className="tnum">{d.plans.stops.toFixed(1).replace('.', ',')}</dd><dt>Met een markt erin</dt><dd className="tnum">{d.plans.markt}%</dd></dl>
        <Bars rows={d.plans.dagen} /></div>
    </div>
    <div className="ds-card"><h3>Organisatoren</h3><p className="adm-sub">Hoe vaak hun markten bekeken en gebruikt zijn in de gekozen periode. Klik voor een rapport om mee te sturen.</p>
      <table className="adm-table"><thead><tr><th>Organisator</th><th className="tnum">Bekeken op de site</th><th className="tnum">Geopend in de app</th><th className="tnum">Dagplan</th><th className="tnum">Doorgeklikt</th><th className="tnum">Via badge</th></tr></thead>
        <tbody>{d.orgs.map(([o, r]) => <tr key={o}><td><button className="link" onClick={() => setOrg(o)}>{o}</button></td><td className="tnum">{nl(r.pagina ?? 0)}</td><td className="tnum">{nl(r.view ?? 0)}</td><td className="tnum">{nl(r.plan ?? 0)}</td><td className="tnum">{nl((r.route ?? 0) + (r.site ?? 0) + (r.tel ?? 0))}</td><td className="tnum">{nl(r.badge ?? 0)}</td></tr>)}</tbody></table>
      {!d.orgs.length && <p className="adm-sub">Nog niets geteld.</p>}</div>
  </section>);
}

/** Rapport voor één organisator: te printen of als pdf te bewaren. Kleine aantallen als "<5". */
function Report({ org, c, t, d, info, days, back }: { org: string; c: C[]; t: T[]; d: Dash; info: Map<string, Info>; days: number; back: () => void }) {
  const mine = (id: string) => d.orgOf(id) === org, slug = slugify(org);
  const per = new Map<string, Record<string, number>>(), add = (id: string, k: string, n: number) => { const r = per.get(id) ?? {}; r[k] = (r[k] ?? 0) + n; per.set(id, r); };
  for (const r of c.filter(d.cur)) if (mine(r.item_id)) add(r.item_id, r.what, r.n);
  for (const r of t.filter(d.cur)) if (r.metric === 'pagina' && mine(r.key)) add(r.key, 'pagina', r.n);
  const tot = (k: string) => [...per.values()].reduce((a, r) => a + (r[k] ?? 0), 0);
  const orgPage = t.filter(d.cur).filter(r => r.metric === 'pagina' && r.key === `org:${slug}`).reduce((a, r) => a + r.n, 0);
  const badge = t.filter(d.cur).filter(r => r.metric === 'badge' && r.key === slug).reduce((a, r) => a + r.n, 0);
  const afst = AFST.map(a => [`${a} km`, t.filter(d.cur).filter(r => r.metric === 'afstand' && r.key.endsWith(`|${a}`) && mine(r.key.split('|')[0])).reduce((x, r) => x + r.n, 0)] as [string, number]);
  const an = afst.reduce((a, r) => a + r[1], 0), close = afst[0][1] + afst[1][1];
  const rows = [...per].map(([id, r]) => ({ id, r, total: Object.values(r).reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total);
  const name = (id: string) => { const x = info.get(id); return x ? `${x.name}${x.date ? `, ${x.date.split('-').reverse().slice(0, 2).join('-')}` : ''}` : id; };
  const periode = `${new Date(d.list[0]).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })} t/m ${new Date(d.list.at(-1)!).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  return (<section className="adm-wide dash ds-report" aria-label={`Rapport ${org}`}>
    <div className="ds-noprint adm-btns"><button className="btn sm" onClick={back}>← Dashboard</button><button className="btn sm primary" onClick={() => print()}>Afdrukken of als pdf bewaren</button></div>
    <header className="ds-rhead"><span className="bh-mark" aria-hidden="true">S</span><div><p className="adm-sub">Snuffelkaart · bezoekersoverzicht</p><h2>{org}</h2><p className="adm-sub">{periode} ({days} dagen)</p></div></header>
    <div className="ds-kpis">
      {[['Pagina\'s van je markten bekeken', tot('pagina') + orgPage], ['Geopend in de app', tot('view')], ['In een dagplan gezet', tot('plan')], ['Route of je site geopend', tot('route') + tot('site') + tot('tel')], ['Via je badge binnengekomen', badge]].map(([l, n]) =>
        <div className="ds-kpi" key={l as string}><span className="ds-l">{l}</span><b className="tnum">{small(n as number)}</b></div>)}
    </div>
    {an >= 5 && <div className="ds-card"><h3>Hoe ver komen bezoekers</h3><p className="adm-sub">{pct(close, an)}% van wie je markten bekijkt, zoekt binnen 15 km.</p><Bars rows={afst.map(([k, n]) => [k, n])} /></div>}
    <div className="ds-card"><h3>Per markt</h3>
      <table className="adm-table"><thead><tr><th>Markt</th><th className="tnum">Pagina</th><th className="tnum">Geopend</th><th className="tnum">Dagplan</th><th className="tnum">Route/site</th></tr></thead>
        <tbody>{rows.map(({ id, r }) => <tr key={id}><td>{name(id)}</td><td className="tnum">{small(r.pagina ?? 0)}</td><td className="tnum">{small(r.view ?? 0)}</td><td className="tnum">{small(r.plan ?? 0)}</td><td className="tnum">{small((r.route ?? 0) + (r.site ?? 0) + (r.tel ?? 0))}</td></tr>)}</tbody></table>
      {!rows.length && <p className="adm-sub">In deze periode nog geen bezoeken geteld.</p>}</div>
    <p className="adm-sub">Snuffelkaart telt anoniem: alleen aantallen per dag, zonder cookies, IP-adressen of accounts. Aantallen onder de 5 staan als "&lt;5". Je markten: snuffelkaart.nl/organisator/{slug}/</p>
  </section>);
}
