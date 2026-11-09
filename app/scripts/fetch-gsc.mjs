// Zoekwoorden uit Google Search Console → Supabase (tabel zoekwoorden), voor /beheer → Verkeer en Inhoud.
// Elke nacht de laatste 7 dagen opnieuw: Search Console loopt ±2 dagen achter en vult dagen nog aan.
// Inloggen als serviceaccount (GSC_KEY = de json-sleutel van een Google Cloud-serviceaccount dat in Search Console gebruiker is).
// Geen extra pakket: het JWT ondertekenen we met node:crypto. Zonder GSC_KEY doet het script niets.
// Gebruik: node scripts/fetch-gsc.mjs [dagen=7]
import crypto from 'node:crypto';

const { GSC_KEY, GSC_SITE = 'sc-domain:snuffelkaart.nl', SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;
if (!GSC_KEY) { console.log('GSC_KEY ontbreekt: zoekwoorden overgeslagen'); process.exit(0); }
const days = +(process.argv[2] ?? 7), sa = JSON.parse(GSC_KEY);

/** Toegangstoken voor de serviceaccount (OAuth 2.0 JWT bearer, alleen lezen). */
async function token() {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url'), now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const jwt = `${body}.${crypto.sign('RSA-SHA256', Buffer.from(body), sa.private_key).toString('base64url')}`;
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
  if (!r.ok) throw new Error(`Google-inlog ${r.status}: ${await r.text()}`);
  return (await r.json()).access_token;
}

const iso = d => d.toISOString().slice(0, 10), start = iso(new Date(Date.now() - days * 864e5)), end = iso(new Date());
const t = await token(), rows = [];
for (let startRow = 0; ; startRow += 25000) {
  const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: start, endDate: end, dimensions: ['date', 'query', 'page'], rowLimit: 25000, startRow, dataState: 'all' }) });
  if (!r.ok) throw new Error(`Search Console ${r.status}: ${await r.text()}`);
  const j = await r.json(); rows.push(...(j.rows ?? []));
  if ((j.rows ?? []).length < 25000) break;
}
const out = rows.map(({ keys: [day, query, page], clicks, impressions, position }) => ({ day, query: query.slice(0, 300), page: page.replace(/^https?:\/\/(www\.)?snuffelkaart\.nl/, '').slice(0, 300) || '/', clicks, impressions, position: Math.round(position * 10) / 10 }));
console.log(`Search Console ${start} t/m ${end}: ${out.length} rijen, ${out.reduce((a, r) => a + r.clicks, 0)} klikken, ${out.reduce((a, r) => a + r.impressions, 0)} vertoningen`);
if (!SB || !KEY || !out.length) process.exit(0);
for (let i = 0; i < out.length; i += 1000) {
  const r = await fetch(`${SB}/rest/v1/zoekwoorden`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(out.slice(i, i + 1000)) });
  if (!r.ok) throw new Error(`supabase ${r.status} ${await r.text()}`);
}
