// Inloggen via Supabase Auth, zonder supabase-js: magic link of Apple/Google sturen terug met #access_token=…&refresh_token=…
// in de URL. De sessie staat op het apparaat (localStorage) en wordt ververst met de refresh token, dus je blijft ingelogd.
// Gedeeld door de kaart en /beheer (zelfde gebruiker). ponytail: geen verversing op de achtergrond; dat gebeurt bij het eerstvolgende verzoek.
declare const __SB_URL__: string, __SB_KEY__: string;
export const SB = typeof __SB_URL__ === 'string' ? __SB_URL__ : '', KEY = typeof __SB_KEY__ === 'string' ? __SB_KEY__ : ''; // leeg in tests
const STORE = 'snuffel-sessie';
export type Session = { token: string; refresh: string; email: string; exp: number };

const claims = (jwt: string) => JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
const save = (s: Session | null) => { try { s ? localStorage.setItem(STORE, JSON.stringify(s)) : localStorage.removeItem(STORE); } catch { /* privémodus: alleen deze sessie */ } return s; };

/** Sessie uit de terugkeer-URL (en die URL opschonen), anders de bewaarde. */
export function readSession(): Session | null {
  const h = new URLSearchParams(location.hash.slice(1)), token = h.get('access_token');
  if (token) {
    history.replaceState(null, '', location.pathname + location.search);
    return save({ token, refresh: h.get('refresh_token') ?? '', email: claims(token).email ?? '', exp: Date.now() + Number(h.get('expires_in') ?? 3600) * 1000 });
  }
  try { return JSON.parse(localStorage.getItem(STORE) ?? 'null'); } catch { return null; }
}
/** Foutmelding uit de terugkeer-URL (verlopen link e.d.), anders null. */
export function returnError(): string | null {
  const h = new URLSearchParams(location.hash.slice(1)), e = h.get('error_description');
  if (e) history.replaceState(null, '', location.pathname + location.search);
  return e;
}

async function fresh(s: Session): Promise<Session | null> {
  if (s.exp - Date.now() > 60_000) return s;
  if (!s.refresh) return save(null);
  const r = await fetch(`${SB}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh }) });
  if (!r.ok) return save(null);
  const j = await r.json();
  return save({ ...s, token: j.access_token, refresh: j.refresh_token, exp: Date.now() + j.expires_in * 1000 });
}

export class LoggedOut extends Error {}
/** REST-verzoek als deze gebruiker. Verlopen en niet te verversen: LoggedOut. */
export async function api(s: Session, path: string, init: RequestInit = {}, onSession?: (s: Session) => void) {
  const f = await fresh(s);
  if (!f) throw new LoggedOut('Je sessie is verlopen. Log opnieuw in.');
  if (f !== s) onSession?.(f);
  const r = await fetch(`${SB}/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${f.token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers } });
  if (r.status === 401) { save(null); throw new LoggedOut('Je sessie is verlopen. Log opnieuw in.'); }
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

export async function sendLink(email: string, back: string) {
  const r = await fetch(`${SB}/auth/v1/otp?redirect_to=${encodeURIComponent(back)}`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, create_user: true }) });
  if (!r.ok) throw new Error(r.status === 429 ? 'Er zijn net te veel inloglinks gestuurd. Probeer het over een minuut opnieuw.' : `Versturen lukte niet (${r.status}).`);
}
/** De code uit de mail (8 cijfers) in plaats van de link: werkt ook als de link in een andere browser opent. */
export async function verifyCode(email: string, code: string): Promise<Session> {
  const r = await fetch(`${SB}/auth/v1/verify`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'email', email, token: code }) });
  if (!r.ok) throw new Error(r.status === 429 ? 'Te veel pogingen. Wacht een minuut.' : 'Deze code klopt niet of is verlopen. Alleen de code uit de nieuwste mail werkt.');
  const j = await r.json();
  return save({ token: j.access_token, refresh: j.refresh_token, email: j.user?.email ?? email, exp: Date.now() + j.expires_in * 1000 })!;
}
/** Welke van Apple/Google aan staan in Supabase (zonder sleutels erin tonen we de knop niet). */
export async function providers(): Promise<('apple' | 'google')[]> {
  try { const j = await (await fetch(`${SB}/auth/v1/settings`, { headers: { apikey: KEY } })).json(); return (['apple', 'google'] as const).filter(p => j.external?.[p]); } catch { return []; }
}
export const oauthUrl = (p: 'apple' | 'google', back: string) => `${SB}/auth/v1/authorize?provider=${p}&redirect_to=${encodeURIComponent(back)}`;
export function logout(s: Session | null) {
  if (s) fetch(`${SB}/auth/v1/logout`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${s.token}` } }).catch(() => {});
  save(null);
}

/** Favorieten na inloggen: alles van beide kanten, en wat alleen op dit apparaat stond gaat naar de server. */
export function mergeFavs(local: string[], remote: string[]): { all: string[]; upload: string[] } {
  const r = new Set(remote), upload = local.filter(id => !r.has(id));
  return { all: [...remote, ...upload], upload };
}
