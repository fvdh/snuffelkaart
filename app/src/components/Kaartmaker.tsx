// Kaartmaker (/kaartmaker/): inloggen met een code in je mail, dan een markt of garagesale op de kaart zetten en je eigen markten zien.
// Schrijven gaat via rpc/kaartmaker_maak (de database controleert alles nog eens); lezen via rpc/mijn_markten. Zie migratie kaartmaker.
// ponytail: geen bewerken; een fout = afgelasten en opnieuw maken. Plek: adres opzoeken bij PDOK of coördinaten plakken.
import { useEffect, useState } from 'react';
import { SB, KEY, readSession, sendLink, verifyCode, logout, api, type Session } from '../lib/auth';
import { SOORTEN, fout, rpcArgs, dbFout, type Invoer } from '../lib/kaartmaker';
import { parseLatLon } from '../lib/beheer';
import { Ic } from './ui';

type Mijn = { id: string; date: string; status: string; name: string; kind: string; place: string; adressen: boolean | null; nieuw: number; goed: number; why: string | null };
const STATUS: Record<string, string> = { wacht: 'Wacht op keuring', org: 'Op de kaart', chk: 'Op de kaart', unconf: 'Op de kaart', cancel: 'Afgelast', afgewezen: 'Niet geplaatst' };
const UITLEG: Record<string, string> = {
  Vrijmarkt: 'Iedereen verkoopt op straat of op een plein, zoals op Koningsdag.',
  Buurtmarkt: 'Een markt in je wijk, op één plek.',
  Rommelmarkt: 'Kramen met tweedehands spullen, op één plek.',
  Garagesale: 'Buren verkopen elk bij hun eigen voordeur. Ze zetten zelf hun adres op de kaart, zonder account.',
};
const vandaag = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const dag = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
const LEEG: Invoer = { soort: '', naam: '', org: '', plaats: '', adres: '', datum: '', van: '10:00', tot: '15:00', lat: null, lon: null, entree: '', info: '', url: '' };

export default function Kaartmaker() {
  const [s, setS] = useState<Session | null>(null), [ready, setReady] = useState(false);
  useEffect(() => { setS(readSession()); setReady(true); }, []);
  if (!SB || !KEY) return <p>De kaartmaker is niet ingesteld (SUPABASE_URL ontbreekt bij de build).</p>;
  if (!ready) return null;
  return s ? <Maker s={s} setS={setS} /> : <Login done={setS} />;
}

function Login({ done }: { done: (s: Session) => void }) {
  const [email, setEmail] = useState(''), [code, setCode] = useState(''), [sent, setSent] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const run = (f: () => Promise<void>) => async (e: React.FormEvent) => { e.preventDefault(); setErr(''); setBusy(true); try { await f(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); } };
  return sent
    ? <form className="form km-box" onSubmit={run(async () => done(await verifyCode(email.trim(), code.replace(/\D/g, ''))))}>
      <p>We hebben een code gestuurd naar <b>{email}</b>. Vul hem hier in.</p>
      <div className="field"><label htmlFor="km-code">Code uit de mail</label><input className="input tnum" id="km-code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} required autoFocus value={code} onChange={e => setCode(e.target.value)} /></div>
      {err && <p className="issue bad" role="alert"><Ic n="alert" /><span>{err}</span></p>}
      <button className="btn primary" disabled={busy || code.replace(/\D/g, '').length < 6}>{busy ? 'Even kijken…' : 'Inloggen'}</button>
      <p className="help">Geen mail? Kijk ook bij ongewenst. <button type="button" className="link" onClick={() => { setSent(false); setCode(''); }}>Ander e-mailadres</button></p>
    </form>
    : <form className="form km-box" onSubmit={run(async () => { await sendLink(email.trim(), `${location.origin}/kaartmaker/`); setSent(true); })}>
      <h2>Log in om te beginnen</h2>
      <p>Met een code in je mail, zonder wachtwoord. Je e-mailadres is niet zichtbaar voor bezoekers; wij gebruiken het alleen als we je iets moeten vragen over je markt.</p>
      <div className="field"><label htmlFor="km-mail">E-mailadres</label><input className="input" id="km-mail" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
      {err && <p className="issue bad" role="alert"><Ic n="alert" /><span>{err}</span></p>}
      <button className="btn primary" disabled={busy}>{busy ? 'Versturen…' : 'Stuur me een code'}</button>
    </form>;
}

function Maker({ s, setS }: { s: Session; setS: (s: Session | null) => void }) {
  const [mijn, setMijn] = useState<Mijn[] | null>(null), [links, setLinks] = useState<Record<string, string>>({}), [err, setErr] = useState(''), [klaar, setKlaar] = useState<string | null>(null);
  const call = (fn: string, body: object) => api(s, `rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) }, setS);
  const laad = () => call('mijn_markten', {}).then(setMijn).catch(e => setErr(dbFout(e)));
  useEffect(() => { laad(); fetch('/kaartmaker/links.json').then(r => (r.ok ? r.json() : {})).then(setLinks).catch(() => {}); }, []);
  const stop = async (m: Mijn) => {
    if (!confirm(m.status === 'wacht' || m.status === 'afgewezen' ? `${m.name} verwijderen?` : `${m.name} afgelasten? Bezoekers zien dan dat hij niet doorgaat.`)) return;
    try { await call('kaartmaker_stop', { markt: m.id }); laad(); } catch (e) { setErr(dbFout(e)); }
  };
  return (<>
    {mijn && mijn.length > 0 && <section aria-labelledby="km-mijn">
      <h2 id="km-mijn">Jouw markten</h2>
      <ul className="km-mijn">{mijn.map(m => {
        const url = links[m.id];
        return <li key={m.id}>
          <div><b>{m.name}</b><span>{m.kind} · {dag(m.date)} · {m.place}</span>
            <span className={`km-st ${m.status}`}>{STATUS[m.status] ?? m.status}{m.adressen && ['org', 'chk'].includes(m.status) ? ` · ${m.goed} ${m.goed === 1 ? 'adres' : 'adressen'} op de kaart${m.nieuw ? `, ${m.nieuw} wacht op keuring` : ''}` : ''}</span>
            {url ? <span>Pagina: <a href={url}>snuffelkaart.nl{url}</a>{m.adressen ? '. Stuur deze link naar je buren: daar zetten ze hun adres erop.' : ''}</span>
              : ['org', 'chk'].includes(m.status) && <span className="muted">De pagina staat er binnen een kwartier.</span>}
            {m.why && <span>Waarom niet: {m.why}</span>}</div>
          {m.status !== 'cancel' && <button className="btn sm" onClick={() => stop(m)}>{m.status === 'wacht' || m.status === 'afgewezen' ? 'Verwijderen' : 'Afgelasten'}</button>}
        </li>;
      })}</ul>
    </section>}
    {err && <p className="issue bad" role="alert"><Ic n="alert" /><span>{err}</span></p>}
    {klaar ? <section className="km-box" aria-live="polite">
      <h2>{klaar === 'Garagesale' ? 'Bedankt! We kijken je garagesale na' : 'Je markt staat erop'}</h2>
      <p>{klaar === 'Garagesale' ? 'Meestal binnen een dag. Daarna krijgt hij een eigen pagina met een kaart; die link stuur je naar je buren, zodat ze hun adres erop zetten. Elk adres kijken we ook even na.' : 'Binnen een kwartier staat hij op de kaart en krijgt hij een eigen pagina. Klopt er iets niet? Afgelasten en opnieuw maken kan altijd.'}</p>
      <button className="btn" onClick={() => setKlaar(null)}>Nog een markt maken</button>
    </section> : <Formulier call={call} klaar={soort => { setKlaar(soort); laad(); }} />}
    <p className="help">Ingelogd als {s.email}. <button className="link" onClick={() => { logout(s); setS(null); }}>Uitloggen</button></p>
  </>);
}

function Formulier({ call, klaar }: { call: (fn: string, body: object) => Promise<unknown>; klaar: (soort: string) => void }) {
  const [i, setI] = useState<Invoer>(LEEG), [waar, setWaar] = useState(''), [gevonden, setGevonden] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const set = (k: keyof Invoer) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setI({ ...i, [k]: e.target.value });
  // Plek: geplakte coördinaten of een kaartlink, anders PDOK (adres, straat, postcode of plaats). Een kaartlink kent geen plaatsnaam: die vul je zelf in.
  const zoek = async () => {
    setErr(''); setGevonden('');
    const ll = parseLatLon(waar);
    if (ll) { setI({ ...i, ...ll }); setGevonden(`Pin op ${ll.lat}, ${ll.lon}`); return; }
    try {
      const u = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?${new URLSearchParams({ q: waar, fq: 'type:(adres OR weg OR postcode OR woonplaats)', rows: '1', fl: 'type,weergavenaam,woonplaatsnaam,straatnaam,centroide_ll' })}`;
      const d = (await (await fetch(u)).json()).response?.docs?.[0], m = d && /POINT\(([\d.]+) ([\d.]+)\)/.exec(d.centroide_ll);
      if (!m) return setErr('Die plek konden we niet vinden. Probeer een straat met plaats, of plak coördinaten.');
      setI({ ...i, lat: +(+m[2]).toFixed(5), lon: +(+m[1]).toFixed(5), plaats: d.woonplaatsnaam ?? i.plaats, adres: i.adres || (d.type === 'woonplaats' ? '' : d.straatnaam ?? '') });
      setGevonden(d.weergavenaam);
    } catch { setErr('Zoeken lukt nu niet. Plak coördinaten, of probeer het straks opnieuw.'); }
  };
  const verstuur = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = fout(i, vandaag()); if (f) return setErr(f);
    setErr(''); setBusy(true);
    try { await call('kaartmaker_maak', rpcArgs(i)); klaar(i.soort); setI(LEEG); setWaar(''); setGevonden(''); } catch (x) { setErr(dbFout(x)); } finally { setBusy(false); }
  };
  const garage = i.soort === 'Garagesale';
  return (<form className="form km-form" onSubmit={verstuur} noValidate>
    <h2>Nieuwe markt</h2>
    <fieldset className="field"><legend className="lbl">Wat voor markt?</legend>
      <div className="radios">{SOORTEN.map(k => <label key={k}><input type="radio" name="soort" value={k} checked={i.soort === k} onChange={() => setI({ ...i, soort: k })} /><span><b>{k}</b><small>{UITLEG[k]}</small></span></label>)}</div>
      {garage && <p className="help">Een garagesale kijken we eerst na voordat hij openbaar is. Adressen van buren staan alleen op de kaart van de garagesale, en we wissen ze de dag erna.</p>}
    </fieldset>
    <div className="field"><label htmlFor="km-naam">Naam</label><input className="input" id="km-naam" maxLength={80} value={i.naam} onChange={set('naam')} placeholder={garage ? 'Garagesale Bloemenbuurt' : 'Vrijmarkt Koningsdag Oud-Zuid'} /></div>
    <div className="field"><label htmlFor="km-org">Wie organiseert het?</label><input className="input" id="km-org" maxLength={80} value={i.org} onChange={set('org')} placeholder="Buurtvereniging De Linde" /><p className="help">Dit staat op de pagina, bij de markt.</p></div>
    <div className="field"><label htmlFor="km-waar">Waar? {garage ? '(het midden van de buurt)' : ''}</label>
      <div className="km-zoek"><input className="input" id="km-waar" value={waar} onChange={e => setWaar(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); zoek(); } }} placeholder="Straat en plaats, of coördinaten (52.09, 5.12)" />
        <button type="button" className="btn" onClick={zoek} disabled={!waar.trim()}><Ic n="search" />Zoek</button></div>
      {gevonden && i.lat != null && <p className="help"><Ic n="check" />{gevonden}. <a href={`https://www.openstreetmap.org/?mlat=${i.lat}&mlon=${i.lon}#map=17/${i.lat}/${i.lon}`} target="_blank" rel="noopener">Bekijk de pin</a></p>}
    </div>
    <div className="pair">
      <div className="field"><label htmlFor="km-plaats">Plaats</label><input className="input" id="km-plaats" maxLength={60} value={i.plaats} onChange={set('plaats')} /></div>
      <div className="field"><label htmlFor="km-adres">Adres of plek <small>(mag leeg)</small></label><input className="input" id="km-adres" maxLength={120} value={i.adres} onChange={set('adres')} placeholder="Marktplein" /></div>
    </div>
    <div className="field"><label htmlFor="km-datum">Datum</label><input className="input" id="km-datum" type="date" min={vandaag()} value={i.datum} onChange={set('datum')} /></div>
    <div className="pair">
      <div className="field"><label htmlFor="km-van">Van</label><input className="input" id="km-van" type="time" value={i.van} onChange={set('van')} /></div>
      <div className="field"><label htmlFor="km-tot">Tot</label><input className="input" id="km-tot" type="time" value={i.tot} onChange={set('tot')} /></div>
    </div>
    <div className="field"><label htmlFor="km-entree">Entree <small>(mag leeg)</small></label><input className="input" id="km-entree" maxLength={40} value={i.entree} onChange={set('entree')} placeholder="gratis" /></div>
    <div className="field"><label htmlFor="km-info">Iets meer vertellen? <small>(mag leeg)</small></label><textarea className="textarea" id="km-info" maxLength={500} value={i.info} onChange={set('info')} placeholder="Bijvoorbeeld: kleedjes vanaf 7 uur, geen kramen nodig." /></div>
    <div className="field"><label htmlFor="km-url">Website <small>(mag leeg)</small></label><input className="input" id="km-url" type="url" maxLength={200} value={i.url} onChange={set('url')} placeholder="https://" /></div>
    {err && <p className="issue bad" role="alert"><Ic n="alert" /><span>{err}</span></p>}
    <button className="btn primary" disabled={busy}>{busy ? 'Bezig…' : garage ? 'Stuur ter keuring' : 'Zet op de kaart'}</button>
    <p className="help">Wat je hier invult (behalve je e-mailadres) is openbaar en staat ook in Google. <a href="/privacy/#kaartmaker">Privacy</a></p>
  </form>);
}
