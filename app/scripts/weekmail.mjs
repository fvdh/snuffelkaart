// "Markten dit weekend" (donderdag, via .github/workflows/weekmail.yml): elke bevestigde aanmelding krijgt de markten van zaterdag en zondag
// binnen haar straal. Geen markten in de buurt = geen mail. Ook: onbevestigde aanmeldingen ouder dan 7 dagen wissen (zo beloofd).
// Gebruik: node scripts/weekmail.mjs          (versturen)
//          node scripts/weekmail.mjs --dry    (alleen tonen wie wat zou krijgen)
// ponytail: Resend gratis = 100 mails per dag; boven de ±90 abonnees een betaald plan of over twee dagen spreiden.
import { req } from './db.mjs';

const SITE = 'https://snuffelkaart.nl', FROM = 'Snuffelkaart <markten@snuffelkaart.nl>', REPLY = 'info@freekvanderhorst.com', MAX = 12;
const DAG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'], MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const dag = iso => { const d = new Date(`${iso}T12:00:00Z`); return `${DAG[d.getUTCDay()]} ${d.getUTCDate()} ${MAAND[d.getUTCMonth()]}`; };
export const km = (a, b) => { const r = Math.PI / 180, h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

/** Zaterdag en zondag van dit weekend, vanaf een datum in Nederland (YYYY-MM-DD). */
export function weekend(vandaag) {
  const d = new Date(`${vandaag}T12:00:00Z`), tot = (6 - d.getUTCDay() + 7) % 7, plus = n => new Date(+d + n * 864e5).toISOString().slice(0, 10);
  return d.getUTCDay() === 0 ? [plus(-1), vandaag] : [plus(tot), plus(tot + 1)];
}

/** Markten voor één abonnee: dat weekend, niet afgelast, binnen de straal; op datum en dan afstand. */
export function kies(markets, sub, [za, zo]) {
  return markets.filter(m => (m.date === za || m.date === zo) && m.status !== 'cancel')
    .map(m => ({ m, d: km(sub, m) })).filter(x => x.d <= sub.km)
    .sort((a, b) => a.m.date.localeCompare(b.m.date) || a.d - b.d).slice(0, MAX);
}

export function mail(sub, lijst, [za, zo]) {
  const afmeld = `${SITE}/api/afmelden?t=${sub.token}`, kaart = `${SITE}/kaart/?plek=${encodeURIComponent(sub.plek)}&lat=${sub.lat}&lon=${sub.lon}&markten=${lijst.map(x => encodeURIComponent(x.m.id)).join(',')}`; // alleen deze markten, rond je plek
  const tijd = m => (m.timeKnown === false ? 'tijden nog onbekend' : `${hm(m.start)}${m.end ? `–${hm(m.end)}` : ''}`);
  const regel = ({ m, d }) => `<li style="margin:0 0 12px"><a href="${SITE}/kaart/?open=${encodeURIComponent(m.id)}" style="color:#1e2229;font-weight:600">${esc(m.name)}</a><br>`
    + `<span style="color:#545a66">${dag(m.date)} · ${tijd(m)} · ${esc(m.venue ? `${m.venue}, ${m.place}` : m.place)} · ${Math.round(d)} km`
    + `${m.entree && !/onbekend/i.test(m.entree) ? ` · entree ${esc(m.entree)}` : ''}${m.status === 'unconf' ? ' · <b>nog niet bevestigd</b>' : ''}</span></li>`;
  return {
    to: sub.email,
    subject: `${lijst.length} ${lijst.length === 1 ? 'markt' : 'markten'} rond ${sub.plek} dit weekend`,
    headers: { 'List-Unsubscribe': `<${afmeld}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.5;color:#1e2229;max-width:560px">`
      + `<p>Dit weekend (${dag(za)} en ${dag(zo)}) binnen ${sub.km} km van ${esc(sub.plek)}:</p><ul style="padding-left:18px">${lijst.map(regel).join('')}</ul>`
      + `<p><a href="${kaart}">Bekijk ze op de kaart</a>. Tik daar op <b>Dit weekend</b> om ook de kringlopen in de buurt te zien. Gaat een markt niet door, dan zie je dat op de kaart.</p>`
      + `<p style="color:#545a66;font-size:13px">Je krijgt deze mail omdat je je aanmeldde op snuffelkaart.nl. <a href="${afmeld}" style="color:#545a66">Afmelden</a> kan altijd, met één klik.</p></div>`,
    text: `Dit weekend binnen ${sub.km} km van ${sub.plek}:\n\n${lijst.map(({ m, d }) => `- ${m.name}: ${dag(m.date)}, ${tijd(m)}, ${m.place} (${Math.round(d)} km)\n  ${SITE}/kaart/?open=${encodeURIComponent(m.id)}`).join('\n')}\n\nAfmelden: ${afmeld}`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dry = process.argv.includes('--dry') || !process.env.RESEND_API_KEY;
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  if (!dry) await req(`aanmeldingen?bevestigd=is.null&aangemaakt=lt.${week}`, { method: 'DELETE' });
  const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
  const wk = weekend(vandaag), markets = (await (await fetch(`${SITE}/data/markets.json`)).json()).markets;
  const vijfDagen = new Date(Date.now() - 5 * 864e5).toISOString(); // opnieuw starten op dezelfde dag stuurt niet dubbel
  const subs = await req(`aanmeldingen?select=id,email,plek,lat,lon,km,token&lijst=eq.weekend&bevestigd=not.is.null&or=(gemaild.is.null,gemaild.lt.${vijfDagen})`);
  const mails = subs.map(s => ({ s, l: kies(markets, s, wk) })).filter(x => x.l.length).map(x => ({ id: x.s.id, mail: mail(x.s, x.l, wk) }));
  console.log(`Weekend ${wk.join(' + ')}: ${subs.length} abonnees, ${mails.length} met markten in de buurt.`);
  if (dry) { mails.forEach(x => console.log(' ', x.mail.to.replace(/(.).*@/, '$1…@'), '|', x.mail.subject)); console.log(process.env.RESEND_API_KEY ? '(dry)' : 'RESEND_API_KEY ontbreekt; niet verstuurd.'); process.exit(0); }
  for (let i = 0; i < mails.length; i += 100) { // batch-API: hooguit 100 per keer
    const deel = mails.slice(i, i + 100);
    const r = await fetch('https://api.resend.com/emails/batch', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(deel.map(x => ({ from: FROM, reply_to: REPLY, ...x.mail }))) });
    if (!r.ok) throw new Error(`Resend: ${r.status} ${await r.text()}`);
    await req(`aanmeldingen?id=in.(${deel.map(x => x.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ gemaild: new Date().toISOString() }) });
  }
  console.log(`${mails.length} mails verstuurd.`);
}
