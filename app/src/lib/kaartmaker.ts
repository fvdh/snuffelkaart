// Kaartmaker (/kaartmaker/): een organisator zet zelf een markt of garagesale op de kaart. Hier de controle vooraf, zodat je de fout
// ziet voordat je verstuurt; de database (kaartmaker_maak, migratie kaartmaker) controleert hetzelfde nog eens en beslist.
export const SOORTEN = ['Vrijmarkt', 'Buurtmarkt', 'Rommelmarkt', 'Garagesale'] as const;
export type Soort = typeof SOORTEN[number];
export interface Invoer { soort: Soort | ''; naam: string; org: string; plaats: string; adres: string; datum: string; van: string; tot: string; lat: number | null; lon: number | null; entree: string; info: string; url: string }

export const minuten = (t: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t); return m ? +m[1] * 60 + +m[2] : NaN; };
const plusDagen = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Eerste fout als zin, of null. vandaag: YYYY-MM-DD in Nederland. */
export function fout(i: Invoer, vandaag: string): string | null {
  const len = (s: string, a: number, b: number) => s.trim().length >= a && s.trim().length <= b;
  if (!i.soort) return 'Kies wat voor markt het is.';
  if (!len(i.naam, 3, 80)) return 'Geef de markt een naam van 3 tot 80 tekens.';
  if (!len(i.org, 2, 80)) return 'Vul in wie het organiseert.';
  if (i.lat == null || i.lon == null || i.lat < 50.7 || i.lat > 53.7 || i.lon < 3.2 || i.lon > 7.3) return 'Zoek de plek op, zodat we weten waar de pin moet staan.';
  if (!len(i.plaats, 2, 60)) return 'Vul de plaats in.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.datum) || i.datum < vandaag || i.datum > plusDagen(vandaag, 366)) return 'Kies een datum vanaf vandaag, hooguit een jaar vooruit.';
  const van = minuten(i.van), tot = minuten(i.tot);
  if (!(van >= 0 && van <= 1380 && tot >= van + 30 && tot <= 1440)) return 'De eindtijd moet minstens een half uur na de begintijd liggen.';
  if (i.adres.trim().length > 120 || i.entree.trim().length > 40 || i.info.trim().length > 500) return 'Een van de velden is te lang.';
  if (i.url.trim() && (i.url.trim().length > 200 || !/^https?:\/\/[^\s/]+\.[^\s]+$/.test(i.url.trim()))) return 'De website moet beginnen met https://';
  return null;
}

/** Invoer → argumenten voor rpc/kaartmaker_maak (namen zoals in de migratie). */
export const rpcArgs = (i: Invoer) => ({ soort: i.soort, naam: i.naam.trim(), org: i.org.trim(), plaats: i.plaats.trim(), adres: i.adres.trim() || null, datum: i.datum,
  van: minuten(i.van), tot: minuten(i.tot), lat: i.lat, lon: i.lon, entree: i.entree.trim() || null, info: i.info.trim() || null, url: i.url.trim() || null });

/** Foutzin uit een PostgREST-antwoord ("400: {"message":"…"}"), anders een algemene. */
export const dbFout = (e: unknown) => { try { return JSON.parse(String((e as Error).message).replace(/^\d+: /, '')).message ?? 'Opslaan lukte niet.'; } catch { return (e as Error).message || 'Opslaan lukte niet.'; } };
