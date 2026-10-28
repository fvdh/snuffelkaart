// M5: bijdragen van bezoekers (ontwerp §M5: review schrijven, foto's toevoegen, wijziging voorstellen, mijn bijdragen).
// Alles gaat langs beheer; goedgekeurd staat in /data/extra.json (zie lib/bijdragen.ts). Logica en controles: lib/bijdragen.ts + de database.
import { useState, type ReactNode } from 'react';
import type { Item, Place } from '../lib/model';
import { isoDay } from '../lib/model';
import { prefill, toOh, avg, shrink, errText, monthNow, DAYS_NL, type Contribution, type Day, type Kind, type Review, type Photo, type Extra } from '../lib/bijdragen';
import { Ic } from './ui';

export type BijView = 'review' | 'photo' | 'suggest' | 'contrib';
export interface Bij {
  extra: Extra; mine: Contribution[]; name: string | null; user: string | null;
  go: (v: BijView, id?: string) => void;
  send: (kind: Kind, itemId: string, data: Record<string, unknown>, file?: Blob) => Promise<void>;
  setName: (n: string) => Promise<void>;
  withdraw: (id: number) => Promise<void>;
}

export const Stars = ({ n }: { n: number }) => <span className="stars" role="img" aria-label={`${String(n).replace('.', ',')} van 5 sterren`}>{[1, 2, 3, 4, 5].map(i => <svg key={i} className="i" aria-hidden="true" style={{ opacity: i <= Math.round(n) ? 1 : 0.25 }}><use href="#i-star" /></svg>)}</span>;
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const monthLabel = (m: string) => `${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}`;

function Head({ back, title, sub, onBack }: { back: string; title: string; sub?: string; onBack: () => void }) {
  return <div className="dv-head" data-peek data-drag><div className="dv-top"><button className="back" onClick={onBack}><Ic n="back" />{back}</button></div><h2>{title}</h2>{sub && <p style={{ color: 'var(--fg-2)' }}>{sub}</p>}</div>;
}
function Done({ title, text, onBack, label }: { title: string; text: string; onBack: () => void; label: string }) {
  return <div className="dv-head" data-peek><div className="success"><span className="ok-ic"><Ic n="check" /></span><h3>{title}</h3><p>{text}</p><button className="btn" onClick={onBack}>{label}</button></div></div>;
}

/** Schermnaam bij de eerste bijdrage: wat anderen bij je review of foto zien. */
export function NameField({ value, set }: { value: string; set: (v: string) => void }) {
  return <div className="field"><label htmlFor="bij-naam">Je schermnaam</label>
    <input className="input" id="bij-naam" required minLength={3} maxLength={30} pattern="[A-Za-z0-9À-ž][A-Za-z0-9À-ž ._\-]{1,28}[A-Za-z0-9À-ž]" value={value} onChange={e => set(e.target.value)} placeholder="Bijv. Marieke of snuffelaar_utrecht" autoComplete="nickname" />
    <span className="help">Deze naam staat bij je reviews en foto's. Gebruik liever niet je volledige naam.</span></div>;
}

/** Gemeenschappelijk: verzenden met schermnaam (als die er nog niet is), fout tonen, daarna het bedankscherm. */
function useSend(b: Bij) {
  const [name, setName] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState(false);
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { if (!b.name) await b.setName(name.trim()); await work(); setDone(true); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const nameField = b.name ? null : <NameField value={name} set={setName} />;
  const error = err ? <p role="alert" style={{ color: 'var(--bad-ink)', fontSize: '.875rem' }}>{err}</p> : null;
  return { run, busy, done, nameField, error };
}

// ---------- in het winkeldetail ----------

/** Foto's bovenaan het detail (ontwerp: één grote, twee kleine). Zonder foto's: niets, geen leeg blok. */
export function PhotoStrip({ photos }: { photos: Photo[] }) {
  if (!photos.length) return null;
  const show = photos.slice(0, 3);
  return <div className="photos" style={show.length === 1 ? { gridTemplateColumns: '1fr' } : undefined}>
    {show.map((p, i) => <div key={p.url} style={show.length === 2 && i === 1 ? { gridRow: 'span 2' } : undefined}>
      <a href={p.url} target="_blank" rel="noopener" style={{ display: 'block', height: '100%' }}><img src={p.url} alt={p.caption ?? `Foto van ${p.name}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></a>
      {i === 2 && photos.length > 3 && <span>+{photos.length - 3}</span>}</div>)}
  </div>;
}

export function ReviewsSection({ p, b }: { p: Place; b: Bij }) {
  const rs: Review[] = b.extra.reviews[p.id] ?? [], mine = b.mine.find(c => c.kind === 'review' && c.item_id === p.id);
  return (<section className="dv-sec">
    {rs.length ? <><div className="sec-head"><h3>Reviews</h3><span className="tnum" style={{ fontSize: '.875rem', color: 'var(--fg-2)' }}><Stars n={avg(rs)} /> {String(avg(rs)).replace('.', ',')} · {rs.length}</span></div>
      {rs.map((r, i) => <div className="rev" key={i}><Stars n={r.stars} />{r.text && <p>{r.text}</p>}<small>{r.name} · bezocht in {monthLabel(r.month)}</small></div>)}</>
      : <><h3>Reviews en foto's</h3><p style={{ color: 'var(--fg-2)', fontSize: '.9375rem' }}>Nog niemand ging je voor. Was je er? Dan help je de volgende snuffelaar met een review of een foto.</p></>}
    {mine?.status === 'nieuw' && <p className="src"><Ic n="clock" /><span>Je review wacht op controle.</span></p>}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
      <button className="btn sm" onClick={() => b.go('review', p.id)}><Ic n="star" />{mine ? 'Pas je review aan' : 'Schrijf een review'}</button>
      <button className="btn sm ghost" onClick={() => b.go('photo', p.id)}><Ic n="cam" />Foto toevoegen</button></div>
    <p className="src"><Ic n="shield" /><span>Reviews en foto's komen online na controle op spam, nepreviews en persoonsgegevens. We verbergen geen negatieve reviews en belonen niemand voor een review. <a href="/hoe-we-controleren#reviews" style={{ color: 'inherit', fontWeight: 500 }}>Hoe we controleren</a></span></p>
  </section>);
}

// ---------- schermen ----------

export function ReviewView({ p, b, back }: { p: Place; b: Bij; back: () => void }) {
  const old = b.mine.find(c => c.kind === 'review' && c.item_id === p.id)?.data;
  const now = monthNow(new Date()), months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return isoDay(d).slice(0, 7); });
  const [stars, setStars] = useState<number>(old?.stars ?? 0), [month, setMonth] = useState<string>(old?.month ?? now), [text, setText] = useState<string>(old?.text ?? '');
  const s = useSend(b);
  if (s.done) return <Done title="Je review is ingestuurd" text="We controleren hem eerst, meestal binnen een dag. Je ziet de status bij Mijn bijdragen." onBack={back} label={`Terug naar ${p.name}`} />;
  return (<>
    <Head back={p.name} title={old ? 'Review aanpassen' : 'Review schrijven'} sub={old ? 'Na het aanpassen controleren we hem opnieuw.' : undefined} onBack={back} />
    <form className="form" onSubmit={e => { e.preventDefault(); s.run(() => b.send('review', p.id, { stars, month, text: text.trim() })); }}>
      <fieldset className="field"><legend className="lbl" style={{ marginBottom: 6 }}>Hoeveel sterren?</legend>
        <div className="starpick">{[1, 2, 3, 4, 5].map(n => <label key={n} className={n <= stars ? 'on' : ''}><input type="radio" name="stars" value={n} checked={n === stars} onChange={() => setStars(n)} required /><svg className="i" aria-hidden="true"><use href="#i-star" /></svg><span className="sr">{n} ster{n > 1 ? 'ren' : ''}</span></label>)}</div></fieldset>
      <div className="field"><label htmlFor="rv-maand">Wanneer was je er?</label>
        <select className="select" id="rv-maand" value={month} onChange={e => setMonth(e.target.value)}>{months.map(m => <option key={m} value={m}>{monthLabel(m).replace(/^./, c => c.toUpperCase())}</option>)}</select>
        <span className="help">Verplicht, zodat lezers weten hoe actueel je review is.</span></div>
      <div className="field"><label htmlFor="rv-tekst">Wat viel je op?</label>
        <textarea className="textarea" id="rv-tekst" maxLength={500} value={text} onChange={e => setText(e.target.value)} placeholder="Wat vond je, waar moet je op letten?" />
        <span className="help">Noem geen medewerkers of andere mensen bij naam.</span></div>
      {s.nameField}{s.error}
      <button className="btn primary block" type="submit" disabled={!stars || s.busy}>{s.busy ? 'Versturen…' : old ? 'Stuur aangepaste review' : 'Plaats review'}</button>
      <p className="src"><Ic n="shield" /><span>Reviews komen online na controle. We verbergen geen negatieve reviews en belonen niemand voor een review. Heb je met deze winkel te maken (eigenaar, medewerker, familie)? Schrijf dan geen review.</span></p>
    </form></>);
}

type Pick = { file: File; url: string; state: 'klaar' | 'bezig' | 'fout' | 'verstuurd' };

export function PhotoView({ p, b, back }: { p: Place; b: Bij; back: () => void }) {
  const [picks, setPicks] = useState<Pick[]>([]), [own, setOwn] = useState(false);
  const s = useSend(b);
  const add = (fs: FileList | null) => setPicks(ps => [...ps, ...[...(fs ?? [])].filter(f => f.type.startsWith('image/')).map(f => ({ file: f, url: URL.createObjectURL(f), state: 'klaar' as const }))].slice(0, 10));
  const send = () => s.run(async () => {
    for (let i = 0; i < picks.length; i++) {
      if (picks[i].state === 'verstuurd') continue;
      setPicks(ps => ps.map((x, j) => (j === i ? { ...x, state: 'bezig' } : x)));
      try { await b.send('foto', p.id, {}, await shrink(picks[i].file)); setPicks(ps => ps.map((x, j) => (j === i ? { ...x, state: 'verstuurd' } : x))); }
      catch (e) { setPicks(ps => ps.map((x, j) => (j === i ? { ...x, state: 'fout' } : x))); throw e; }
    }
  });
  if (s.done) return <Done title={picks.length === 1 ? 'Je foto is ingestuurd' : `Je ${picks.length} foto's zijn ingestuurd`} text="Ze komen online na controle, meestal binnen een dag." onBack={back} label={`Terug naar ${p.name}`} />;
  const n = picks.filter(x => x.state !== 'verstuurd').length;
  return (<>
    <Head back={p.name} title="Foto's toevoegen" onBack={back} />
    <div className="form">
      <label className="drop"><Ic n="cam" /><b>Kies foto's</b><span style={{ fontSize: '.8125rem' }}>of maak er een met je camera</span><input type="file" accept="image/*" multiple className="sr" onChange={e => { add(e.target.files); e.target.value = ''; }} /></label>
      {picks.length > 0 && <div className="thumbs">{picks.map((x, i) => <div key={x.url} style={{ backgroundImage: `url(${x.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}><small>{x.state === 'bezig' ? 'verkleinen…' : x.state}</small>
        {x.state !== 'verstuurd' && <button type="button" className="heart" style={{ position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 8 }} aria-label="Foto weghalen" onClick={() => setPicks(ps => ps.filter((_, j) => j !== i))}><Ic n="x" /></button>}</div>)}</div>}
      <div className="banner"><Ic n="shield" /><span>We verkleinen je foto's en <b>halen de locatiegegevens eruit</b> voordat ze worden verstuurd. Zet liever geen herkenbare mensen op de foto.</span></div>
      <label className="checkline"><input type="checkbox" checked={own} onChange={e => setOwn(e.target.checked)} /><span>Ik heb deze foto's zelf gemaakt, en Snuffelkaart mag ze tonen (zie de <a href="/voorwaarden#bijdragen" target="_blank">voorwaarden</a>).</span></label>
      {s.nameField}{s.error}
      <button className="btn primary block" disabled={!n || !own || s.busy} onClick={() => { const f = document.getElementById('bij-naam') as HTMLInputElement | null; if (f && !f.reportValidity()) return; send(); }}>{s.busy ? 'Versturen…' : n ? `Stuur ${n === 1 ? 'de foto' : `${n} foto's`} in` : "Kies eerst een foto"}</button>
      <p style={{ fontSize: '.8125rem', color: 'var(--fg-3)' }}>Foto's zijn zichtbaar na goedkeuring. Maximaal 10 per dag.</p>
    </div></>);
}

export function SuggestView({ p, b, back }: { p: Place; b: Bij; back: () => void }) {
  const today = isoDay(new Date()), base = prefill(p, today);
  const [days, setDays] = useState<Day[]>(base), [how, setHow] = useState('Ik was er en zag het bord'), [seen, setSeen] = useState(today);
  const s = useSend(b), set = (i: number, d: Partial<Day>) => setDays(ds => ds.map((x, j) => (j === i ? { ...x, ...d } : x)));
  const same = (a: Day, c: Day) => a.open === c.open && (!a.open || (a.from === c.from && a.to === c.to));
  const bad = days.some(d => d.open && d.from >= d.to), none = !days.some(d => d.open);
  if (s.done) return <Done title="Voorstel ingestuurd. Dank je!" text="We controleren het, meestal binnen een dag. Daarna staan de nieuwe tijden op de kaart, met jouw naam als bron." onBack={back} label={`Terug naar ${p.name}`} />;
  return (<>
    <Head back={p.name} title={p.h ? 'Openingstijden aanpassen' : 'Openingstijden doorgeven'} onBack={back}
      sub={p.h ? 'Pas aan wat niet klopt. Wat je wijzigt, wordt gemarkeerd.' : 'We weten ze nog niet. Zet de dagen aan waarop de winkel open is en vul de tijden in.'} />
    <form className="form" onSubmit={e => { e.preventDefault(); s.run(() => b.send('tijden', p.id, { oh: toOh(days), seen, how })); }}>
      <div className="hours-edit">{days.map((d, i) => <div key={i} className={`he${p.h && !same(d, base[i]) ? ' changed' : ''}`}>
        <b>{DAYS_NL[i].slice(0, 2)}</b>
        {d.open ? <span className="times"><input type="time" value={d.from} onChange={e => set(i, { from: e.target.value })} aria-label={`${DAYS_NL[i]} open vanaf`} required /><span>–</span><input type="time" value={d.to} onChange={e => set(i, { to: e.target.value })} aria-label={`${DAYS_NL[i]} open tot`} required /></span> : <span className="closedlbl">Dicht</span>}
        <span className="switch"><input type="checkbox" checked={d.open} onChange={e => set(i, { open: e.target.checked })} aria-label={`Open op ${DAYS_NL[i].toLowerCase()}`} /><span /></span></div>)}</div>
      {bad && <p role="alert" style={{ color: 'var(--bad-ink)', fontSize: '.875rem' }}>Een sluitingstijd ligt vóór de openingstijd. Open tot na middernacht? Mail ons even.</p>}
      {none && <p className="src"><Ic n="info" /><span>Is de winkel helemaal dicht of verhuisd? Gebruik dan <b>Klopt er iets niet?</b> onderaan bij de winkel.</span></p>}
      <div className="field"><label htmlFor="sg-hoe">Hoe weet je dit?</label><select className="select" id="sg-hoe" value={how} onChange={e => setHow(e.target.value)}>{['Ik was er en zag het bord', 'Website van de winkel', 'Ik werk er'].map(o => <option key={o}>{o}</option>)}</select></div>
      <div className="field"><label htmlFor="sg-wanneer">Wanneer zag je dit?</label><input className="input" type="date" id="sg-wanneer" value={seen} max={today} min={isoDay(new Date(Date.now() - 90 * 864e5))} onChange={e => setSeen(e.target.value)} required /></div>
      {s.nameField}{s.error}
      <button className="btn primary block" disabled={bad || none || s.busy}>{s.busy ? 'Versturen…' : 'Stuur voorstel'}</button>
      <p className="src"><Ic n="info" /><span>Rond feestdagen kunnen winkels anders open zijn; die vragen we niet. Afwijkende tijden geef je door met <b>Klopt er iets niet?</b>.</span></p>
    </form></>);
}

export const PILL: Record<Contribution['status'], [string, string]> = { nieuw: ['wait', 'In behandeling'], goed: ['ok', 'Online'], afgewezen: ['no', 'Niet geplaatst'] };
export const WHAT: Record<Kind, string> = { tijden: 'Openingstijden', review: 'Review', foto: 'Foto' };

export function ContribView({ b, items, back, open }: { b: Bij; items: Item[]; back: () => void; open: (id: string) => void }) {
  const byId = new Map(items.map(i => [i.id, i.name])), [err, setErr] = useState('');
  const detail = (c: Contribution): ReactNode => c.status === 'afgewezen' ? c.reason
    : c.kind === 'review' ? `${c.data.stars} ster${c.data.stars > 1 ? 'ren' : ''} · ingestuurd ${new Date(c.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`
    : c.kind === 'tijden' ? c.data.oh : `Ingestuurd ${new Date(c.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`;
  return (<>
    <Head back="Jij" title="Mijn bijdragen" sub={`Alles wordt gecontroleerd voordat het online komt.${b.name ? ` Je schermnaam: ${b.name}.` : ''}`} onBack={back} />
    {err && <p role="alert" style={{ color: 'var(--bad-ink)', fontSize: '.875rem' }}>{err}</p>}
    {b.mine.length ? <ul className="contrib">{b.mine.map(c => <li key={c.id}>
      <div className="c-top"><b><button className="link" style={{ font: 'inherit', textAlign: 'left' }} onClick={() => open(c.item_id)}>{WHAT[c.kind]} · {byId.get(c.item_id) ?? 'winkel'}</button></b><span className={`pill ${PILL[c.status][0]}`}>{PILL[c.status][1]}</span></div>
      <span>{detail(c)}</span>
      {c.status === 'afgewezen' && <span className="help">Je kunt hem aangepast opnieuw insturen.</span>}
      {c.status !== 'goed' && <button className="link" style={{ alignSelf: 'flex-start', fontSize: '.8125rem', color: 'var(--fg-3)' }} onClick={() => b.withdraw(c.id).catch(e => setErr(errText(e)))}>{c.status === 'nieuw' ? 'Intrekken' : 'Weghalen'}</button>}
    </li>)}</ul>
      : <p className="prose-s">Nog niets. Bij elke winkel kun je een review schrijven, foto's toevoegen of de openingstijden doorgeven.</p>}
  </>);
}
