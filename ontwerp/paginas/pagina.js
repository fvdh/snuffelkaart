// Ontwerp v2: alles staat al als tekst in de HTML. Dit voegt alleen toe wat van het moment afhangt (nu open, vandaag, aftellen)
// en blijft verborgen tot het berekend is, zodat Google en wie zonder JS kijkt nooit "…" of een verouderde status ziet.
const DAG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const hm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const now = new Date(), d = now.getDay(), min = now.getHours() * 60 + now.getMinutes();

const nu = document.getElementById('nu');
if (nu) {
  const w = JSON.parse(nu.dataset.h), iv = w[d] ?? [], cur = iv.find(([a, b]) => min >= a && min < b), later = iv.find(([a]) => a > min);
  let txt = cur ? `Nu open, tot ${hm(cur[1])}` : later ? `Nu dicht, opent vandaag om ${hm(later[0])}` : '';
  if (!txt) for (let k = 1; k < 8; k++) { const x = w[(d + k) % 7]; if (x?.length) { txt = `Nu dicht, opent ${k === 1 ? 'morgen' : DAG[(d + k) % 7]} om ${hm(x[0][0])}`; break; } }
  if (txt) { nu.textContent = txt; nu.classList.toggle('open', !!cur); nu.hidden = false; }
}
document.querySelectorAll(`.hours tr[data-dag="${d}"]`).forEach(tr => tr.classList.add('today'));

const af = document.getElementById('aftel');
if (af) {
  const days = Math.round((new Date(`${af.dataset.date}T12:00`) - new Date(now.toDateString())) / 864e5);
  af.textContent = days <= 0 ? 'Vandaag' : days === 1 ? 'Morgen' : days < 14 ? `Over ${days} dagen` : `Over ${Math.round(days / 7)} weken`; af.hidden = days < 0;
}

// mobiel: één vaste knop naar de kaart zodra het bordje uit beeld is
const dock = document.getElementById('dock');
new IntersectionObserver(([x]) => dock.classList.toggle('show', !x.isIntersecting)).observe(document.getElementById('bordje'));

// ontwerp: toestand wisselen (tweedehands: onbekend / op afspraak)
document.querySelectorAll('.proto button[data-s]').forEach(b => b.onclick = () => {
  document.querySelectorAll('.proto button[data-s]').forEach(x => x.setAttribute('aria-pressed', x === b));
  document.querySelectorAll('[data-state]').forEach(el => { el.hidden = el.dataset.state !== b.dataset.s; });
});
