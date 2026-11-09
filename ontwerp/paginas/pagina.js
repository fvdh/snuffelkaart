// Ontwerp: status op dit moment (de HTML heeft al de hele week als tekst), vandaag markeren, aftellen naar de markt, toestand wisselen.
const DAG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const hm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const now = new Date(), d = now.getDay(), min = now.getHours() * 60 + now.getMinutes();

/** Status uit een week (index = getDay): [klasse, kop, toelichting]. */
function status(w) {
  const iv = w[d] ?? [], cur = iv.find(([a, b]) => min >= a && min < b), later = iv.find(([a]) => a > min);
  if (cur) return ['open', `Nu open · tot ${hm(cur[1])}`, cur[1] - min <= 30 ? 'Sluit bijna' : `Vandaag ${iv.map(([a, b]) => `${hm(a)}–${hm(b)}`).join(' en ')}`];
  if (later) return ['', `Nu dicht · opent om ${hm(later[0])}`, 'Vandaag'];
  for (let k = 1; k < 8; k++) { const x = w[(d + k) % 7]; if (x?.length) return ['', `Nu dicht · opent ${k === 1 ? 'morgen' : DAG[(d + k) % 7]} om ${hm(x[0][0])}`, '']; }
  return ['', 'Dicht', ''];
}
const nu = document.getElementById('nu');
if (nu?.dataset.h) { const [c, b] = status(JSON.parse(nu.dataset.h)); nu.classList.toggle('open', c === 'open'); nu.querySelector('b').textContent = b; }
document.querySelectorAll('.st[data-h]').forEach(el => { const w = JSON.parse(el.dataset.h); const [c, b] = status(w); el.classList.toggle('open', c === 'open'); el.textContent = b; });

// vandaag in de tijdentabel, met een streep op het huidige tijdstip
document.querySelectorAll(`.hours tr[data-dag="${d}"]`).forEach(tr => {
  tr.classList.add('today'); tr.querySelector('th').insertAdjacentHTML('beforeend', ' <small>vandaag</small>');
  const t = tr.querySelector('.track'); if (t && min >= 480 && min <= 1200 && !tr.closest('.unk')) t.insertAdjacentHTML('beforeend', `<span class="nu" style="left:${((min - 480) / 720) * 100}%" title="nu"></span>`);
});

// markt: aftellen
const af = document.getElementById('aftel'), mk = document.getElementById('markt');
if (af && mk) { const days = Math.round((new Date(mk.dataset.date + 'T12:00') - new Date(now.toDateString())) / 864e5); af.textContent = days === 0 ? 'vandaag' : days === 1 ? 'morgen' : days < 14 ? `over ${days} dagen` : `over ${Math.round(days / 7)} weken`; }

// delen
document.getElementById('deel')?.addEventListener('click', e => { const t = { title: document.title, url: location.href }; if (navigator.share) navigator.share(t).catch(() => {}); else navigator.clipboard?.writeText(t.url).then(() => { e.currentTarget.lastChild.textContent = 'Link gekopieerd'; }); });

// subnavigatie: waar ben je
const links = [...document.querySelectorAll('.sub a[href^="#"]')];
const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) links.forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === `#${x.target.id}`)); }), { rootMargin: '-40% 0px -55% 0px' });
links.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) io.observe(s); });

// ontwerp: toestand wisselen (tweedehands: onbekend / op afspraak)
document.querySelectorAll('.proto button[data-s]').forEach(b => b.onclick = () => {
  document.querySelectorAll('.proto button[data-s]').forEach(x => x.setAttribute('aria-pressed', x === b));
  document.querySelectorAll('[data-state]').forEach(el => { el.hidden = el.dataset.state !== b.dataset.s; });
});
