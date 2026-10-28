// Dagelijkse mail aan de beheerders: nieuwe meldingen ("Klopt er iets niet?") en fouten bij bezoekers van de afgelopen 24 uur. Niets nieuw = geen mail.
// Gebruik: node scripts/meldingen-mail.mjs          (versturen; nachtelijke run)
//          node scripts/meldingen-mail.mjs --dry    (alleen tonen)
// Versturen via Resend (zelfde afzender als de inlogmails); zonder RESEND_API_KEY slaat hij over.
import { req } from './db.mjs';

const WHAT = { dicht: 'Gesloten of bestaat niet meer', tijden: 'Andere tijden', plek: 'Verkeerde plek of adres', afgelast: 'Markt gaat niet door', anders: 'Iets anders' };
const SITE = 'https://snuffelkaart.ironfront-relay.workers.dev';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Mail uit de open meldingen (en fouten bij bezoekers); null als er in de laatste 24 uur niets bij kwam. */
export function digest(open, now, errors = 0) {
  const fresh = open.filter(r => now - Date.parse(r.created_at) < 864e5);
  if (!fresh.length && !errors) return null;
  const fout = errors ? `<p>Daarnaast ${errors === 1 ? 'is er 1 fout' : `zijn er ${errors} fouten`} bij bezoekers opgetreden. Zie <a href="${SITE}/beheer">beheer → Bronnen</a>.</p>` : '';
  if (!fresh.length) return { subject: `Snuffelkaart: ${errors} fout${errors === 1 ? '' : 'en'} bij bezoekers`, html: fout };
  const rows = fresh.map(r => `<li><b>${esc(r.name)}</b>: ${esc(WHAT[r.what] ?? r.what)}${r.note ? `<br><i>“${esc(r.note)}”</i>` : ''}</li>`).join('');
  return {
    subject: `Snuffelkaart: ${fresh.length} nieuwe melding${fresh.length === 1 ? '' : 'en'}`,
    html: `<p>${fresh.length === 1 ? 'Er is een nieuwe melding' : `Er zijn ${fresh.length} nieuwe meldingen`} binnengekomen${open.length > fresh.length ? ` (${open.length} open in totaal)` : ''}:</p><ul>${rows}</ul><p><a href="${SITE}/beheer">Open beheer → Meldingen</a></p>${fout}`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const open = await req('reports?select=*&done_at=is.null&order=created_at');
  const errors = (await req(`client_errors?select=id&at=gte.${new Date(Date.now() - 864e5).toISOString()}`)).length;
  const mail = digest(open, Date.now(), errors);
  if (!mail) { console.log('Geen nieuwe meldingen; geen mail.'); process.exit(0); }
  const to = (await req('admins?select=email')).map(a => a.email);
  if (process.argv.includes('--dry') || !process.env.RESEND_API_KEY) { console.log(process.env.RESEND_API_KEY ? '(dry)' : 'RESEND_API_KEY ontbreekt; niet verstuurd.', to, mail.subject); process.exit(0); }
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Snuffelkaart <snuffelkaart@runebinder.app>', to, ...mail }) });
  if (!r.ok) throw new Error(`Resend: ${r.status} ${await r.text()}`);
  console.log(`Mail verstuurd aan ${to.length} beheerder(s): ${mail.subject}`);
}
