// Buren zetten hun adres op de kaart van een garagesale (kaartmaker), zonder account. POST /api/garagesale met JSON
// { markt, adres, wat, website }; antwoord { ok } of { fout } (de pagina toont die zin). Tabel en regels: migratie kaartmaker.
// Controle: de garagesale is goedgekeurd en nog niet voorbij, PDOK kent het adres (met hetzelfde huisnummer), en het ligt binnen
// 2 km van de garagesale. Daarna wacht het op keuring in /beheer. Misbruik: honeypot "website" en een plafond voor alle adressen per uur.
import { sb } from './mail.js';

const ID = /^km-[0-9a-f]{10}$/, MAX_KM = 2, PER_UUR = 60;
const km = (a, b) => { const r = Math.PI / 180, h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

/** Adres → één adres van PDOK. PDOK geeft bijna altijd iets terug; alleen als het huisnummer overeenkomt met wat je typte, is het jouw adres. */
export async function zoekAdres(invoer, plaats) {
  const u = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?${new URLSearchParams({ q: `${invoer} ${plaats}`, fq: 'type:adres', rows: '1', fl: 'straatnaam,huis_nlt,huisnummer,woonplaatsnaam,centroide_ll' })}`;
  const d = (await (await fetch(u)).json()).response?.docs?.[0];
  const m = d && /POINT\(([\d.]+) ([\d.]+)\)/.exec(d.centroide_ll);
  if (!m || !new RegExp(`(^|\\D)${d.huisnummer}(\\D|$)`).test(invoer)) return null;
  return { adres: `${d.straatnaam} ${d.huis_nlt}, ${d.woonplaatsnaam}`, lon: +(+m[1]).toFixed(5), lat: +(+m[2]).toFixed(5) };
}

export async function garageAdres(req, env) {
  const f = await req.json().catch(() => ({})), v = k => String(f[k] ?? '').trim().slice(0, 120);
  const fout = (zin, status = 400) => Response.json({ fout: zin }, { status });
  if (v('website')) return Response.json({ ok: true }); // honeypot: zelfde antwoord, er gebeurt niets
  const id = v('markt'), invoer = v('adres');
  if (!ID.test(id)) return fout('Deze garagesale kennen we niet.');
  if (invoer.length < 5 || !/\d/.test(invoer)) return fout('Vul je straat en huisnummer in, bijvoorbeeld Dorpsstraat 12.');
  const [m] = await sb(env, `markets?select=date,status,data&id=eq.${id}`);
  const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
  if (!m?.data.adressen || !['org', 'chk'].includes(m.status) || m.date < vandaag) return fout('Bij deze garagesale kun je geen adres (meer) opgeven.');
  const uur = new Date(Date.now() - 36e5).toISOString();
  if ((await sb(env, `garage_adressen?select=id&created_at=gt.${uur}&limit=${PER_UUR + 1}`)).length > PER_UUR) return fout('Het is nu erg druk. Probeer het over een uur nog eens.', 429);
  const a = await zoekAdres(invoer, m.data.place);
  if (!a) return fout(`Dat adres konden we niet vinden in ${m.data.place}. Kijk de straat en het huisnummer even na.`);
  if (km(a, m.data) > MAX_KM) return fout(`Dat adres ligt meer dan ${MAX_KM} km van de garagesale. Klopt de plaats?`);
  // Zelfde adres twee keer: niets dubbel, wel hetzelfde antwoord.
  await sb(env, 'garage_adressen?on_conflict=market_id,adres', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ market_id: id, ...a, wat: v('wat').slice(0, 80) || null }) });
  return Response.json({ ok: true, adres: a.adres });
}

export const garage = (req, env) => garageAdres(req, env).catch(e => { console.error('/api/garagesale', e); return Response.json({ fout: 'Er ging bij ons iets mis. Probeer het later nog eens.' }, { status: 500 }); });
