// Mail-aanmeldingen met dubbele opt-in (tabel aanmeldingen, zie de migratie). Formulieren posten hierheen, ook zonder JavaScript;
// elk antwoord is een 303 naar /aanmelden/?stap=… (statische pagina). Secrets in de worker: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY.
// Misbruik: een honeypot-veld, hooguit één bevestigingsmail per adres per uur, en een plafond voor alle nieuwe aanmeldingen per uur
// (Resend gratis = 100 mails per dag). Wat er misgaat, verraadt niet of een adres al bekend is.
export const FROM = 'Snuffelkaart <markten@snuffelkaart.nl>', REPLY = 'info@freekvanderhorst.com';
const LIJSTEN = ['kaartmaker', 'weekend'], KM = [10, 25, 50], PER_UUR = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const geldigAdres = e => e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s.]{2,}$/.test(e);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const naar = (origin, q) => Response.redirect(`${origin}/aanmelden/?${new URLSearchParams(q)}`, 303);

const sb = async (env, path, init = {}) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers } });
  if (!r.ok) throw new Error(`supabase ${r.status} ${await r.text()}`);
  return r.status === 204 ? [] : r.json();
};

export async function stuur(env, mail) {
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM, reply_to: REPLY, ...mail }) });
  if (!r.ok) throw new Error(`resend ${r.status} ${await r.text()}`);
}

/** Plaats of postcode → midden ervan (PDOK). Alleen woonplaatsen en postcodes: we willen geen straat of huisnummer. */
export async function zoekPlek(q) {
  const u = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?${new URLSearchParams({ q, fq: 'type:(woonplaats OR postcode)', rows: '1', fl: 'type,weergavenaam,woonplaatsnaam,centroide_ll' })}`;
  const d = (await (await fetch(u)).json()).response?.docs?.[0];
  const m = d && /POINT\(([\d.]+) ([\d.]+)\)/.exec(d.centroide_ll);
  return m ? { plek: d.woonplaatsnaam ?? d.weergavenaam.split(',')[0], lon: +m[1], lat: +m[2] } : null;
}

export function bevestigMail(origin, lijst, token, plek) {
  const link = `${origin}/api/bevestig?t=${token}`;
  const wat = lijst === 'weekend' ? `elke donderdag de rommelmarkten van het weekend rond ${esc(plek)}` : 'één mail als de kaartmaker voor buurtmarkten klaar is';
  return {
    subject: 'Bevestig je aanmelding bij Snuffelkaart',
    html: `<p>Hoi,</p><p>Je hebt je aangemeld voor ${wat}. Klopt dat? Bevestig het dan met deze link:</p><p><a href="${link}">Ja, aanmelden</a></p><p>Was jij dit niet? Dan hoef je niets te doen; zonder bevestiging wissen we je adres binnen een week.</p><p>Groet,<br>Freek van Snuffelkaart</p>`,
    text: `Je hebt je aangemeld voor ${wat.replace(/&amp;/g, '&')}. Bevestig met deze link: ${link}\n\nWas jij dit niet? Dan hoef je niets te doen; zonder bevestiging wissen we je adres binnen een week.`,
  };
}

export async function aanmelden(req, env) {
  const o = new URL(req.url).origin, f = await req.formData(), v = k => String(f.get(k) ?? '').trim();
  const lijst = v('lijst'), email = v('email').toLowerCase();
  if (v('website')) return naar(o, { stap: 'mail' }); // honeypot: bots krijgen hetzelfde antwoord, maar er gebeurt niets
  if (!LIJSTEN.includes(lijst)) return naar(o, { stap: 'fout' });
  if (!geldigAdres(email)) return naar(o, { stap: 'fout', waarom: 'adres', lijst });
  const rij = { email, lijst, notitie: v('notitie').slice(0, 200) || null, via: /^\/[\w\/-]{0,119}$/.test(v('via')) ? v('via') : null }; // via: pagina van het formulier
  if (lijst === 'weekend') {
    const p = v('plek') && await zoekPlek(v('plek').slice(0, 80));
    if (!p) return naar(o, { stap: 'fout', waarom: 'plek', lijst });
    Object.assign(rij, p, { km: KM.includes(+v('km')) ? +v('km') : 25 });
  }
  const uurGeleden = new Date(Date.now() - 36e5).toISOString();
  if ((await sb(env, `aanmeldingen?select=id&bevestigd=is.null&aangemaakt=gt.${uurGeleden}&limit=${PER_UUR + 1}`)).length > PER_UUR) return naar(o, { stap: 'fout', waarom: 'druk', lijst });
  const [oud] = await sb(env, `aanmeldingen?select=token,bevestigd,aangemaakt&email=eq.${encodeURIComponent(email)}&lijst=eq.${lijst}`);
  // ponytail: al bevestigd → niets wijzigen (anders kan iedereen jouw plaats veranderen); voor een andere plaats: afmelden en opnieuw.
  if (oud?.bevestigd || (oud && Date.parse(oud.aangemaakt) > Date.now() - 36e5)) return naar(o, { stap: 'mail', lijst });
  const [nu] = oud
    ? await sb(env, `aanmeldingen?token=eq.${oud.token}`, { method: 'PATCH', body: JSON.stringify({ ...rij, aangemaakt: new Date().toISOString() }) })
    : await sb(env, 'aanmeldingen', { method: 'POST', body: JSON.stringify(rij) });
  await stuur(env, { to: email, ...bevestigMail(o, lijst, nu.token, rij.plek) });
  return naar(o, { stap: 'mail', lijst });
}

export async function bevestig(req, env) {
  const o = new URL(req.url).origin, t = new URL(req.url).searchParams.get('t') ?? '';
  if (!UUID.test(t)) return naar(o, { stap: 'fout', waarom: 'link' });
  const [r] = await sb(env, `aanmeldingen?select=lijst,bevestigd&token=eq.${t}`);
  if (!r) return naar(o, { stap: 'fout', waarom: 'link' });
  if (!r.bevestigd) await sb(env, `aanmeldingen?token=eq.${t}`, { method: 'PATCH', body: JSON.stringify({ bevestigd: new Date().toISOString() }) });
  return naar(o, { stap: 'ok', lijst: r.lijst });
}

/** GET (link in de mail) vraagt eerst om een klik: virusscanners openen links in mails ook. POST (die klik, of één-klik-afmelden van Gmail) wist de rij. */
export async function afmelden(req, env) {
  const u = new URL(req.url), t = u.searchParams.get('t') ?? '';
  if (!UUID.test(t)) return naar(u.origin, { stap: 'fout', waarom: 'link' });
  if (req.method !== 'POST') return naar(u.origin, { stap: 'afmelden', t });
  await sb(env, `aanmeldingen?token=eq.${t}`, { method: 'DELETE' });
  return naar(u.origin, { stap: 'uit' });
}

export function api(req, env) {
  const p = new URL(req.url).pathname;
  const h = p === '/api/aanmelden' && req.method === 'POST' ? aanmelden : p === '/api/bevestig' ? bevestig : p === '/api/afmelden' ? afmelden : null;
  if (!h) return new Response('Niet gevonden', { status: 404 });
  return h(req, env).catch(e => { console.error(p, e); return naar(new URL(req.url).origin, { stap: 'fout', waarom: 'storing' }); });
}
