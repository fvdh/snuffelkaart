// Eén keer: "de kaartmaker is klaar" naar wie zich op de wachtlijst zette (aanmeldingen, lijst kaartmaker) en bevestigde.
// Zo beloofd (privacy → Mail van ons): één mail, daarna wissen we de aanmelding. Freek beslist wanneer; niet in een workflow.
// Gebruik: node scripts/kaartmaker-mail.mjs          (alleen tonen wie hem zou krijgen)
//          node scripts/kaartmaker-mail.mjs --stuur  (versturen en wissen; RESEND_API_KEY nodig, uit app/.env)
// ponytail: Resend gratis = 100 mails per dag; hooguit 90 per keer, de rest morgen met hetzelfde commando.
import { req } from './db.mjs';
import { stuur } from '../worker/mail.js';

const SITE = 'https://snuffelkaart.nl', MAX = 90;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function klaarMail(a) {
  const link = `${SITE}/kaartmaker/`, waar = a.notitie ? ` Je schreef erbij: "${a.notitie}".` : '';
  return {
    to: a.email,
    subject: 'De kaartmaker van Snuffelkaart is klaar',
    html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.5;color:#1e2229;max-width:560px"><p>Hoi,</p>`
      + `<p>Je vroeg ons om een mail als de kaartmaker klaar is. Dat is hij: zet je vrijmarkt, buurtmarkt of garagesale gratis op de kaart.${esc(waar)}</p>`
      + `<p><a href="${link}" style="color:#1e2229;font-weight:600">Maak je kaart</a></p>`
      + `<p>Bij een garagesale zetten buren zelf hun adres erop, zonder account. Na de garagesale wissen we die adressen weer.</p>`
      + `<p style="color:#545a66;font-size:13px">Dit is de enige mail die je hierover krijgt; je adres hebben we nu gewist.</p><p>Groet,<br>Freek van Snuffelkaart</p></div>`,
    text: `Je vroeg ons om een mail als de kaartmaker klaar is. Dat is hij: zet je vrijmarkt, buurtmarkt of garagesale gratis op de kaart.${waar}\n\n${link}\n\nDit is de enige mail die je hierover krijgt; je adres hebben we nu gewist.`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stuurt = process.argv.includes('--stuur');
  const lijst = await req(`aanmeldingen?select=id,email,notitie&lijst=eq.kaartmaker&bevestigd=not.is.null&order=bevestigd&limit=${MAX}`);
  console.log(`${lijst.length} bevestigde aanmeldingen voor de kaartmaker${lijst.length === MAX ? ` (hooguit ${MAX} per keer; daarna nog eens)` : ''}.`);
  if (!stuurt) { lijst.forEach(a => console.log(' ', a.email.replace(/(.).*@/, '$1…@'))); console.log('Niets verstuurd. Met --stuur gaat het echt.'); process.exit(0); }
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY ontbreekt (app/.env).');
  for (const a of lijst) {
    await stuur(process.env, klaarMail(a));
    await req(`aanmeldingen?id=eq.${a.id}`, { method: 'DELETE' }); // pas na de mail: mislukt hij, dan staat de aanmelding er nog
  }
  console.log(`${lijst.length} mails verstuurd en aanmeldingen gewist.`);
}
