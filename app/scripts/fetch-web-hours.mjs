// Leest openingstijden van de eigen website van winkels zonder tijden (§5.1) → data-raw/web-hours.json.
// Daarna neemt `npm run data:osm -- --cached` ze over, met bronlabel. Netjes: robots.txt, eigen User-Agent,
// per site na elkaar met pauze, hooguit 3 pagina's per winkel, cache van 7 dagen.
// Gebruik: npm run data:web            (alleen nieuwe of verlopen sites)
//          npm run data:web -- --fresh (alles opnieuw)
//          npm run data:web -- --limit=50 (proef)
import fs from 'node:fs';
import https from 'node:https';
import { hoursFromHtml, parseHoursNL, toText, siteKey, keep, tempClosed, byAppointment } from './hours-from-web.mjs';
import { snippet, hashOf, askAI, statusSnippet, askStatus } from './hours-ai.mjs';

const PLACES = new URL('../public/data/places.json', import.meta.url), OUT = new URL('../data-raw/web-hours.json', import.meta.url);
// Gewone bot-notatie: 31 sites weigerden "Snuffelkaart-PoC/0.1 (…)" maar laten deze door (9 nov). robots.txt "Snuffelkaart" geldt nog steeds.
const UA = 'Mozilla/5.0 (compatible; Snuffelkaart/1.0; +https://snuffelkaart.nl/colofon/)';
// Sociale media en gidssites van anderen: niet uitlezen (voorwaarden, databankenrecht §5).
const SKIP = /facebook|instagram|marktplaats|g\.page|google\.|linktr\.ee|tiktok|twitter|x\.com|youtube|wa\.me|allekringloopwinkels|kringloopwinkels?\.(nl|info|com)|kringlopen\.nl|tweedehandswinkels|openingstijden\.|openingstijdenwinkels|telefoonboek|telefoongids|cylex|opendi|hotfrog|yelp|tripadvisor|goudengids|bedrijvenpagina|drimble|infobel|kompass|oozo|plaatsengids|nederlandsewinkels/i;
// MAX_AGE 6 dagen: de wekelijkse run (elke 7 dagen, zelfde tijd) leest dan echt alles opnieuw; bij 7 was het net te vers (6 nov).
// VERSION ophogen als de parser of de AI-lezer beter wordt: dan wordt alles meteen opnieuw gelezen, niet pas na de cache.
const WORKERS = 8, PAUSE = 800, MAX_AGE = 6 * 864e5, VERSION = 13; // 3: AI-antwoorden met een dag in twee regels samengevoegd; 4: dagen en tijden in twee kolommen; 5: postcodes ook van de tijdenpagina; 6: vestigingsblok op eigen straat; 7: tijdelijk gesloten; 8: Engelse dagen; 9: vestiging op postcode, "openingstijden en inname"; 10: links "Onze winkel", niet de homepage zelf; 12: op afspraak; 13: tijden zonder streepje, microdata, archief bij blokkade, certificaat, andere UA


const cache = fs.existsSync(OUT) && !process.argv.includes('--fresh') ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const places = JSON.parse(fs.readFileSync(PLACES, 'utf8')).places;
const SITE = process.argv.find(a => a.startsWith('--site='))?.slice(7); // één site opnieuw lezen (ook als hij net gelezen is): --site=kringloopdeliemers.nl; de rest van de cache blijft staan
const todo = new Map(), who = new Map(), sharing = new Map(); // key → url, key → winkel (naam en adres voor de AI-lezer), key → alle winkels met die site
// AI-lezer alleen met CF_ACCOUNT_ID en CF_AI_TOKEN (GitHub-secrets). Gratis tegoed is per dag beperkt: hooguit AI_MAX vragen per run.
const AI = !!(process.env.CF_ACCOUNT_ID && process.env.CF_AI_TOKEN) && !process.argv.includes('--no-ai'), AI_MAX = +(process.env.AI_MAX ?? 120); let aiAsked = 0, aiFound = 0, aiErr = 0, aiOff = !AI;
for (const p of places) {
  if ((p.h && (p.hs !== 'web' || process.argv.includes('--alleen-zonder'))) || !p.website || SKIP.test(p.website)) continue; // --alleen-zonder: proef van de AI-lezer // OSM-tijden gaan voor; websitetijden lezen we opnieuw
  const k = siteKey(p.website); if (!k || (SITE && k !== SITE)) continue;
  sharing.set(k, [...(sharing.get(k) ?? []), p]); if (todo.has(k) || who.has(k)) continue;
  who.set(k, p);
  if (!SITE && cache[k] && cache[k].v === VERSION && Date.now() - Date.parse(cache[k].read) < MAX_AGE) continue; // --site: altijd opnieuw
  todo.set(k, /^https?:/i.test(p.website) ? p.website : 'https://' + p.website);
}
// Winkels per domein (ook met verschillende paden): een keten toont vaak het adres van het hoofdkantoor, geen verhuizing.
const perHost = new Map(); for (const p of places) { const k = p.website && siteKey(p.website); if (k) perHost.set(k.split('/')[0], (perHost.get(k.split('/')[0]) ?? 0) + 1); }
const LIMIT = +(process.argv.find(a => a.startsWith('--limit='))?.slice(8) ?? Infinity); // proefrun
for (const k of [...todo.keys()].slice(LIMIT)) todo.delete(k);
const byHost = new Map(); for (const [k, u] of todo) { const h = k.split('/')[0]; byHost.set(h, [...(byHost.get(h) ?? []), [k, u]]); }
console.log(`${todo.size} websites op ${byHost.size} domeinen te lezen (${Object.keys(cache).length} in cache)`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  let r;
  try { r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(12000) }); }
  catch (e) { if (/CERT|SIGNATURE|SELF_SIGNED|ISSUER/.test(e.cause?.code ?? '')) return laxGet(url).catch(() => archived(url, e)); if (/TIMEOUT/.test(e.cause?.code ?? '')) return archived(url, e); throw e; }
  if ([403, 429, 503].includes(r.status)) return archived(url, new Error(`status ${r.status}`)); // blokkade (Cloudflare-controle e.d.), geen "weg"
  if (!r.ok || !/html/i.test(r.headers.get('content-type') ?? 'html')) throw new Error(`status ${r.status}`);
  return { html: (await r.text()).slice(0, 2_000_000), url: r.url };
}
/** Verlopen of verkeerd certificaat (±40 kleine sites, 9 nov): de pagina is openbaar en we sturen niets mee, dus toch lezen. */
function laxGet(url, hops = 0) {
  return new Promise((ok, no) => {
    const u = new URL(url.replace(/^http:/, 'https:'));
    const q = https.get(u, { rejectUnauthorized: false, headers: { 'User-Agent': UA, Accept: 'text/html' }, timeout: 12000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 4) { res.resume(); return laxGet(new URL(res.headers.location, u).href, hops + 1).then(ok, no); }
      if (res.statusCode !== 200) { res.resume(); return no(new Error(`status ${res.statusCode}`)); }
      let d = ''; res.setEncoding('utf8'); res.on('data', c => { if (d.length < 2_000_000) d += c; }); res.on('end', () => ok({ html: d, url: u.href }));
    });
    q.on('error', no); q.on('timeout', () => q.destroy(new Error('timeout')));
  });
}
/** Site weigert ons (403/503, certificaat, time-out): de laatste kopie in het Internet Archive, als die hooguit een jaar oud is.
 *  De controledatum wordt dan de datum van de kopie (zie read), zodat oude tijden nooit vers ogen. */
const ARCHIEF = new Map(); // url → datum van de kopie
async function archived(url, err) {
  try {
    const r = await fetch(`https://web.archive.org/web/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}id_/${url}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    const ts = /\/web\/(\d{8})/.exec(r.url)?.[1], d = ts && `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
    if (!r.ok || !d || Date.now() - Date.parse(d) > 365 * 864e5) throw err;
    ARCHIEF.set(url, d);
    return { html: (await r.text()).slice(0, 2_000_000), url };
  } catch { throw err; }
}
/** Probeer de url zoals hij is, en anders via https en met/zonder www (oude http-adressen falen vaak). Een diepe link die weg is
 *  (terredeshommes.nl/winkels/arnhem, dorcas.nl/…/hoogeveen: de site is verbouwd) valt terug op de homepage. */
async function getAny(url) {
  const u = new URL(url), alt = [url, `https://${u.host}${u.pathname}${u.search}`, `https://${u.host.startsWith('www.') ? u.host.slice(4) : 'www.' + u.host}${u.pathname}`];
  let err; for (const a of [...new Set(alt)]) { try { return await get(a); } catch (e) { err = e; } }
  if (u.pathname.length > 1 && /status 40[34]|status 410/.test(err?.message)) return get(`https://${u.host}/`);
  throw err;
}
const robots = new Map();
/** Minimale robots.txt: Disallow-regels voor * of voor ons. */
async function allowed(url) {
  const { origin, pathname } = new URL(url);
  if (!robots.has(origin)) {
    let rules = [];
    try {
      const t = await (await fetch(origin + '/robots.txt', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) })).text();
      let mine = false;
      for (const line of t.split('\n')) {
        const [k, ...v] = line.split(':'), val = v.join(':').split('#')[0].trim(), key = k.trim().toLowerCase();
        if (key === 'user-agent') mine = val === '*' || /snuffelkaart/i.test(val);
        else if (mine && key === 'disallow' && val) rules.push(val);
      }
    } catch { /* geen robots.txt = alles mag */ }
    robots.set(origin, rules);
  }
  return !robots.get(origin).some(r => pathname.startsWith(r));
}
const pageOfSeen = (seen, u) => seen.find(([x]) => x === u)?.[1];
/** Ketensite met een pagina per vestiging (Aktief: /kringloopwinkels/winterswijk): de link met de plaatsnaam van de winkel. */
function cityLink(html, base, place) {
  const slug = (place ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (slug.length < 3) return null;
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try { const u = new URL(m[1], base); if (u.host === new URL(base).host && new RegExp(`(^|[/-])${slug}(/|$|-|\\.)`).test(u.pathname.toLowerCase())) return u.href; } catch { /* ongeldige link */ }
  }
  return null;
}
/** Geen link naar de vestiging (Terre des Hommes laadt de lijst met JavaScript): raad <lijstpagina>/<plaats>, voor de lijstpagina
 *  waar we op staan en de "winkels/vestigingen"-links op de pagina. Wat niet bestaat, geeft gewoon een 404. */
function cityGuesses(html, base, place) {
  const slug = (place ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (slug.length < 3) return [];
  const b = new URL(base), lists = new Set(b.pathname.length > 1 ? [b.pathname.replace(/\/$/, '')] : []);
  for (const m of html.matchAll(/href=["']([^"'#?]+)["']/gi)) {
    try { const u = new URL(m[1], base); if (u.host === b.host && /^\/(?:[a-z]{2}\/)?(?:onze-)?(?:winkels|vestigingen|locaties|filialen)\/?$/i.test(u.pathname)) lists.add(u.pathname.replace(/\/$/, '')); } catch { /* ongeldig */ }
  }
  return [...lists].slice(0, 2).map(p => `${b.origin}${p}/${slug}`);
}
/** Links op dezelfde site die waarschijnlijk de tijden hebben. */
function candidates(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = (m[2].replace(/<[^>]+>/g, ' ') + ' ' + m[1]).toLowerCase();
    const score = /openingstijd|openingsuren|tijden/.test(label) ? 3 : /contact|bezoek|route|adres|onze winkel|vestiging|locatie/.test(label) ? 2 : /winkel/.test(label) ? 1 : 0; // "Onze Winkel" (The Musketeer)
    if (!score || /klantcontact/.test(label)) continue; // tijden van het loket, niet van de winkel (KDC Kaatsheuvel)
    try { const u = new URL(m[1], base); if (u.host === new URL(base).host && /^https?:$/.test(u.protocol) && u.href.split('#')[0] !== base.split('#')[0] && u.pathname !== '/') out.push([score, u.href.split('#')[0]]); } catch { /* ongeldige link */ }
  }
  return [...new Map(out.sort((a, b) => b[0] - a[0]).map(([, u]) => [u, u])).keys()].slice(0, 2);
}

const PCK0 = a => /\b([1-9]\d{3})\s?([A-Z]{2})\b/i.exec(a ?? '')?.slice(1).join('').toUpperCase();
async function read(key, url) {
  const res = { url, read: new Date().toISOString(), oh: null, page: null, note: null, v: VERSION };
  try {
    if (!(await allowed(url))) { res.note = 'robots.txt'; return res; }
    const first = await getAny(url);
    // Oude site met frames (De Vries Antiek): de tekst staat in de frames, de startpagina zelf is leeg. Plak ze achter elkaar.
    if (/<frameset/i.test(first.html)) for (const m of [...first.html.matchAll(/<i?frame\b[^>]*\bsrc=["']([^"'#]+)["']/gi)].slice(0, 6)) {
      try { const u = new URL(m[1], first.url); if (u.host !== new URL(first.url).host || !(await allowed(u.href))) continue; await sleep(PAUSE); first.html += `\n<hr>\n${(await get(u.href)).html}`; } catch { /* frame weg */ }
    }
    let html = first.html, at = first.url;
    const addr = who.get(key)?.addr ?? '';
    let hit = hoursFromHtml(html, addr);
    const seen = [[at, html]];
    for (const next of hit ? [] : candidates(html, at)) {
      await sleep(PAUSE); if (!(await allowed(next))) continue;
      try { const r = await get(next); seen.push([r.url, r.html]); hit = hoursFromHtml(r.html, addr); if (hit) { at = r.url; break; } } catch { /* volgende */ }
    }
    // Ketensite met een pagina per plaats (Aktief: /kringloopwinkels/winterswijk): voor elke winkel met deze site de eigen plaatspagina.
    const shops = sharing.get(key)?.length > 1 ? sharing.get(key) : [who.get(key)], city = new Map(), html0 = first.html;
    // Tijden gevonden, maar alleen bij de postcode van een ander adres (hoofdkantoor in de footer)? Dan toch de eigen vestigingspagina zoeken.
    const pc4 = PCK0(addr)?.slice(0, 4), other = hit && pc4 && !toText(pageOfSeen(seen, at) ?? '').includes(pc4) && /\b[1-9]\d{3}\s?[A-Z]{2}\b/.test(toText(pageOfSeen(seen, at) ?? ''));
    for (const q of shops) {
      if (!(q === who.get(key) ? !hit || other : PCK0(q.addr))) continue;
      const link = cityLink(html0, first.url, q?.place);
      for (const c of link ? [link] : cityGuesses(html0, first.url, q?.place)) {
        if (!(await allowed(c))) continue;
        if (!seen.some(([u]) => u === c)) try { await sleep(PAUSE); const r = await get(c); seen.push([c, r.html]); } catch { continue; }
        city.set(q, c); break;
      }
    }
    const pageOf = u => seen.find(([x]) => x === u)?.[1];
    if ((!hit || other) && city.has(who.get(key))) { const own = hoursFromHtml(pageOf(city.get(who.get(key))), addr); if (own) { hit = own; at = city.get(who.get(key)); } }
    // Meerdere winkels met deze site: per winkel de eigen plaatspagina, of anders het blok onder het eigen adres (De Liemers: Zevenaar en 's-Heerenberg).
    if (shops.length > 1) for (const q of shops) {
      const k = PCK0(q.addr); if (!k) continue;
      if (city.has(q)) { const own = hoursFromHtml(pageOf(city.get(q)), q.addr); if (own) (res.per ??= {})[k] = { oh: own.oh, page: city.get(q) }; continue; }
      for (const [u, h] of seen) {
        if (res.per?.[k] || parseHoursNL(toText(h))) continue; // hele pagina leesbaar = één lijst voor iedereen, geen blokken
        const own = hoursFromHtml(h, q.addr); if (own) (res.per ??= {})[k] = { oh: own.oh, page: u };
      }
    }
    const shut = !hit && seen.find(([, h]) => tempClosed(toText(h)));
    if (shut) { res.dicht = true; res.page = shut[0]; res.ok = res.read; res.note = 'tijdelijk gesloten'; return res; } // geen AI nodig
    if (!hit) [hit, at] = await viaAI(key, seen, at, res);
    // Postcodes op de pagina (4 cijfers): staat de winkel er niet tussen, dan is het misschien een andere winkel (zie fetch-osm).
    if (hit) { res.oh = hit.oh; res.page = at; res.ok = res.read; res.pc = [...new Set(seen.flatMap(([, h]) => [...toText(h).matchAll(/\b([1-9]\d{3})\s?[A-Z]{2}\b/g)].map(m => m[1])))].slice(0, 12); } // ook van de pagina met de tijden (/contact), niet alleen de homepage
    else { // geen tijden: wat zegt de site dan wel? Eerst de vaste regels, dan de AI-lezer (zie hours-ai.mjs: soorten en wat we ermee doen)
      const ap = seen.find(([, h]) => byAppointment(toText(h)));
      if (ap) Object.assign(res, { afspraak: true, page: ap[0], ok: res.read, note: 'op afspraak' });
      else {
        const [st, u] = await statusAI(key, seen, res);
        if (st?.k === 'afspraak') Object.assign(res, { afspraak: true, page: u, ok: res.read, note: 'op afspraak', q: st.q });
        else if (st?.k === 'dicht') Object.assign(res, { dicht: true, page: u, ok: res.read, note: 'tijdelijk gesloten', q: st.q, ...(st.tot ? { tot: st.tot } : {}) });
        else if (st) Object.assign(res, { meld: { k: st.k, q: st.q, page: u }, note: `website meldt: ${st.k}` });
        else res.note = 'geen tijden gevonden';
      }
    }
    // Eén winkel op deze site, en op de site staat precies één ander adres (postcode): misschien verhuisd (Old Goods). Geen keten (zie perHost). Beheer kijkt.
    const own = PCK0(addr), pcs = [...new Set(seen.flatMap(([, h]) => [...toText(h).matchAll(/\b([1-9]\d{3})\s?([A-Z]{2})\b/g)].map(m => m[1] + m[2])))];
    if (own && !res.meld && (perHost.get(key.split('/')[0]) ?? 1) === 1 && pcs.length === 1 && pcs[0].slice(0, 4) !== own.slice(0, 4)) {
      const t = seen.map(([, h]) => toText(h)).find(t => /\b[1-9]\d{3}\s?[A-Z]{2}\b/.test(t)), m = /[^\n]{0,60}\n?[^\n]{0,10}\b[1-9]\d{3}\s?[A-Z]{2}\b[^\n]{0,30}/.exec(t ?? '');
      res.meld = { k: 'adres', q: (m?.[0] ?? pcs[0]).replace(/\s+/g, ' ').trim(), page: at };
    }
    const arch = ARCHIEF.get(res.page); if (arch && res.ok) Object.assign(res, { ok: arch, archief: arch }); // gelezen uit een kopie: die datum telt
  } catch (e) {
    res.note = `fout: ${e.message ?? e.name}`;
    // Echt weg (domein bestaat niet meer, of 404/410), niet even onbereikbaar: onthoud sinds wanneer. Een vorige fout telt als eerste keer.
    if (gone(e)) { const prev = cache[key]; res.dead = prev?.dead ?? (prev?.note?.startsWith('fout') ? prev.read : res.read); }
  }
  return keep(res, cache[key]);
}
/** Geen tijden: vraag de AI-lezer wat de site dan wel meldt. Alleen als er woorden als "afspraak", "gesloten" of "verhuisd" staan.
 *  Zelfde tekst als vorige keer = zelfde antwoord, gratis. */
async function statusAI(key, pages, res) {
  for (const [url, html] of pages) {
    const text = statusSnippet(toText(html)); if (!text) continue;
    const h = hashOf(text), prev = cache[key];
    res.stHash = h;
    if (prev?.stHash === h) { res.st = prev.st ?? null; return [prev.st ?? null, prev.st?.page ?? url]; }
    if (aiOff || aiAsked >= AI_MAX) { res.stHash = undefined; return [null, url]; }
    const p = who.get(key);
    try { aiAsked++; const r = await askStatus(p?.name ?? '', p?.addr ?? '', text); res.st = r ? { ...r, page: url } : null; if (r) console.log(`  AI-status: ${p?.name} → ${r.k}: ${r.q.slice(0, 80)}`); return [r, url]; }
    catch (e) { if (e.limit) { aiOff = true; console.log(`  AI-lezer gestopt: ${e.message}`); } else if (aiErr++ < 3) console.log(`  AI-fout: ${e.message}`); res.stHash = undefined; return [null, url]; }
  }
  return [null, pages[0]?.[0]];
}
/** Parser vond niets: laat de AI-lezer het stuk tekst rond "openingstijden" lezen. Zelfde tekst als vorige keer = zelfde antwoord, gratis. */
async function viaAI(key, pages, at, res) {
  for (const [url, html] of pages) {
    const text = snippet(toText(html)); if (!text) continue;
    const h = hashOf(text), prev = cache[key];
    res.aiHash = h;
    if (prev?.aiHash === h) { res.ai = prev.ai; return prev.ai && prev.oh ? [{ oh: prev.oh }, prev.page] : [null, at]; } // al eens gevraagd, pagina niet veranderd
    if (aiOff || aiAsked >= AI_MAX) return [null, at];
    const p = who.get(key);
    try { aiAsked++; const r = await askAI(p?.name ?? '', p?.addr ?? '', text); if (r) { aiFound++; res.ai = true; console.log(`  AI: ${p?.name} → ${r.oh} (${url})`); return [r, url]; } }
    catch (e) { if (e.limit) { aiOff = true; console.log(`  AI-lezer gestopt: ${e.message}`); } else if (aiErr++ < 3) console.log(`  AI-fout: ${e.message}`); res.aiHash = undefined; } // morgen/volgende week opnieuw
    return [null, at];
  }
  return [null, at];
}
const gone = e => e.cause?.code === 'ENOTFOUND' || /status 40[4]|status 410/.test(e.message); // verlopen certificaat, 403, 5xx: kan tijdelijk zijn

const hosts = [...byHost.values()]; let done = 0, found = 0;
const save = () => fs.writeFileSync(OUT, JSON.stringify(cache));
await Promise.all(Array.from({ length: WORKERS }, async () => {
  for (let q; (q = hosts.shift());) for (const [k, u] of q) {
    cache[k] = await read(k, u); done++; if (cache[k].oh) found++;
    if (done % 100 === 0) { console.log(`  ${done}/${todo.size} gelezen, ${found} met tijden`); save(); }
    await sleep(PAUSE);
  }
}));
save();
const all = Object.values(cache), notes = {};
for (const r of all) if (!r.oh) { const n = r.note?.startsWith('fout') ? 'fout (site niet bereikbaar)' : r.note; notes[n] = (notes[n] ?? 0) + 1; }
const kept = all.filter(r => r.oh && r.ok !== r.read && Date.parse(r.read) > Date.now() - 864e5).length;
console.log(`AI-lezer: ${aiFound} van ${aiAsked} gevraagd met tijden, ${aiErr} fouten${AI ? '' : ' (uit: CF_ACCOUNT_ID of CF_AI_TOKEN ontbreekt)'}`);
console.log(`Klaar: ${found} van ${done} nieuw gelezen sites met tijden (waarvan ${kept} oude tijden bewaard). In cache: ${all.filter(r => r.oh).length} van ${all.length} met tijden.`, notes);
// Zichtbaar in het GitHub-overzicht (annotaties), ook zonder in de logs te kijken.
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Websitetijden::${found} van ${done} gelezen met tijden, ${kept} oude bewaard. Zonder tijden: ${Object.entries(notes).map(([k, v]) => `${k} ${v}`).join(', ')}`);
