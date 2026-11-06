(() => {
  // Demo 'een zondag in Haarlem': een vast voorbeeld (tijden van 6 nov 2026, niet live). x/y = plek op de kaartafbeelding (0-1), uit MapLibre project().
  const START = { lat: 52.3874, lon: 4.6383, x: .5074, y: .4136 }; // Haarlem Centraal
  const STOPS = [
    { id: 'mk', t: 'm', name: 'Snuffelmarkt Haarlem', kort: 'Snuffelmarkt', addr: 'IJsbaanlaan 4A', lat: 52.40042, lon: 4.62708, x: .4033, y: .1257, za: [], zo: [[540, 960]], extra: 'entree\u00a0€\u00a04,50', stay: 75 },
    { id: 'rz', t: 'k', name: 'RataPlan', kort: 'RataPlan Zijlstraat', addr: 'Zijlstraat 12', lat: 52.38301, lon: 4.63043, x: .4344, y: .5108, za: [[600, 1080]], zo: [[720, 1020]], stay: 35 },
    { id: 'ae', t: 't', name: 'Appel & Ei', kort: 'Appel & Ei', addr: 'Kruisweg 52', lat: 52.38673, lon: 4.63649, x: .4906, y: .4286, za: [[600, 1080]], zo: [[720, 1080]], stay: 30 },
    { id: 'rs', t: 'k', name: 'RataPlan', kort: 'RataPlan Spaarndamseweg', addr: 'Spaarndamseweg 214', lat: 52.39257, lon: 4.64969, x: .6131, y: .2994, za: [[600, 1020]], zo: [[720, 1020]], stay: 35 },
    { id: 'nl', t: 't', name: 'Negen Levens', kort: 'Negen Levens', addr: 'Zijlweg 80', lat: 52.3849, lon: 4.62494, x: .3834, y: .469, za: [[600, 1020]], zo: [], stay: 25 },
    { id: 'zz', t: 't', name: 'Zazoe', kort: 'Zazoe', addr: 'Kleverparkweg 21b', lat: 52.392, lon: 4.63124, x: .4419, y: .312, za: [[720, 1020]], zo: [], stay: 25 },
  ];
  const ICON = { m: 'kraam', k: 'tag', t: 'hanger' }, SOORT = { m: 'Vlooienmarkt', k: 'Kringloop', t: 'Vintage en tweedehands' };
  const DAG = { za: { naam: 'zaterdag' }, zo: { naam: 'zondag' } };
  const CROP = { x0: .27, x1: .73, y0: .02, y1: .78 }; // uitsnede van de kaartafbeelding (1600 × 1100)
  const hm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const km = (a, b) => { const R = 6371, r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)) * 1.3; }; // × 1,3: niet hemelsbreed
  const FIETS = 15; // km/u
  const STIL = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dag = 'zo', gekozen = new Set(['mk', 'rz', 'ae']);
  const $ = s => document.querySelector(s);
  const use = id => `<svg class="i" aria-hidden="true" focusable="false"><use href="#i-${id}"/></svg>`;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const kaart = $('#kaart');
  const plaats = () => kaart.querySelectorAll('img').forEach(img => { const w = 100 / (CROP.x1 - CROP.x0), h = 100 / (CROP.y1 - CROP.y0); Object.assign(img.style, { width: w + '%', height: h + '%', left: -CROP.x0 * w + '%', top: -CROP.y0 * h + '%' }); });
  plaats();
  const pos = s => ({ l: (s.x - CROP.x0) / (CROP.x1 - CROP.x0) * 100, t: (s.y - CROP.y0) / (CROP.y1 - CROP.y0) * 100 });

  const status = (s, d = dag) => {
    const iv = s[d];
    if (!iv.length) return s.t === 'm' ? { c: 'dicht', txt: 'Alleen op zondag' } : { c: 'dicht', txt: `Dicht op ${DAG[d].naam}` };
    return s.t === 'm' ? { c: 'mkt', txt: `Markt ${hm(iv[0][0])}–${hm(iv[0][1])}` } : { c: 'open', txt: `Open ${hm(iv[0][0])}–${hm(iv[0][1])}` };
  };

  // Slimste volgorde: alle volgordes proberen (hooguit 6 stops = 720), minste wachten + fietsen, niets dicht bij aankomst.
  function plan(ids, d = dag) {
    const stops = STOPS.filter(s => ids.has(s.id));
    const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
    let best = null;
    for (const p of perms(stops)) {
      let t = 600, here = START, kmTot = 0, fiets = 0, cost = 0; const rows = [];
      for (const s of p) {
        const d1 = km(here, s), reis = Math.round(d1 / FIETS * 60); t += reis; kmTot += d1; fiets += reis; cost += reis;
        const iv = s[d][0], aankomst = t; let w = null;
        if (!iv) { w = { c: 'mis', sr: 'Kan niet: ', txt: s.t === 'm' ? `geen markt op ${DAG[d].naam}` : `${DAG[d].naam} dicht` }; cost += 1000; }
        else if (t < iv[0]) { const wacht = iv[0] - t; w = { c: 'let', sr: 'Let op: ', txt: `je wacht ${wacht} min, open om ${hm(iv[0])}` }; cost += wacht; t = iv[0]; }
        else if (t + 10 > iv[1]) { w = { c: 'mis', sr: 'Dicht: ', txt: `dicht om ${hm(iv[1])}` }; cost += 1000; }
        rows.push({ s, aankomst, w, iv }); if (iv) t += s.stay; here = s;
      }
      if (!best || cost < best.cost) best = { rows, cost, kmTot, fiets, eind: t };
    }
    return best;
  }
  const rond = m => hm(Math.round(m / 5) * 5);

  function bonHtml(p, d, print) {
    return `<div class="bon${print && !STIL ? ' print' : ''}">
      <div class="shop">SNUFFELKAART</div>
      <div class="sub">${DAG[d].naam.toUpperCase()} · HAARLEM</div>
      <hr>
      <div class="stop"><span></span><span>10:00</span><span>vertrek Haarlem Centraal</span></div>
      <ol style="margin-top:8px">${p.rows.map((r, i) => `<li class="stop"><span aria-hidden="true">${i + 1}</span><span>${hm(r.aankomst)}</span><span>${esc(r.s.kort)}</span>${r.w ? `<span class="w ${r.w.c}"><span aria-hidden="true">${r.w.c === 'mis' ? '✕' : '!'}</span><span class="sr-only">${r.w.sr}</span> ${r.w.txt}</span>` : `<span class="w">open tot ${hm(r.iv[1])}</span>`}</li>`).join('')}</ol>
      <hr>
      <div class="tot"><span>STOPS</span><span>${p.rows.length}</span></div>
      <div class="tot"><span>FIETSEN</span><span>${p.kmTot.toFixed(1).replace('.', ',')} km · ${p.fiets} min</span></div>
      <div class="tot big"><span>KLAAR ROND</span><span>${rond(p.eind)}</span></div>
      <div class="bar" aria-hidden="true"></div>
      <div class="bye">Fijne ${DAG[d].naam}!</div>
    </div>`;
  }

  // Lijst en pins één keer bouwen; daarna alleen bijwerken (focus blijft waar hij is).
  $('#rijen').innerHTML = STOPS.map(s => `<li class="rij" data-id="${s.id}">
    <span class="tile ${s.t === 'm' ? 'm' : s.t === 't' ? 't' : ''}">${use(ICON[s.t])}</span>
    <div><div class="nm">${esc(s.name)}</div><div class="meta">${SOORT[s.t]} · ${esc(s.addr).replace(/ (\S+)$/, '\u00a0$1')}${s.extra ? ' · ' + s.extra : ''}</div><div class="st"></div></div>
    <button type="button" class="plus" data-id="${s.id}"></button>
  </li>`).join('');
  const sp = document.createElement('span'), st0 = pos(START); sp.className = 'pin start'; sp.setAttribute('aria-hidden', 'true'); sp.style.left = st0.l + '%'; sp.style.top = st0.t + '%'; kaart.append(sp);
  for (const s of STOPS) {
    // Pins doen hetzelfde als de knoppen in de lijst: voor toetsenbord en schermlezer is de lijst de ingang.
    const b = document.createElement('button'), q = pos(s);
    b.type = 'button'; b.dataset.id = s.id; b.tabIndex = -1; b.setAttribute('aria-hidden', 'true');
    b.style.left = q.l + '%'; b.style.top = q.t + '%';
    b.onclick = () => wissel(s.id);
    kaart.append(b);
  }
  $('#rijen').querySelectorAll('.plus').forEach(b => b.onclick = () => wissel(b.dataset.id));

  function teken(print, melden) {
    document.querySelectorAll('.dagen button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dag === dag)));
    const p = gekozen.size ? plan(gekozen) : null, nr = new Map(p ? p.rows.map((r, i) => [r.s.id, i + 1]) : []);
    for (const s of STOPS) {
      const x = status(s), in_ = gekozen.has(s.id), open = s[dag].length > 0;
      const rij = $(`.rij[data-id="${s.id}"]`), st = rij.querySelector('.st');
      st.className = `st ${x.c}`; st.textContent = x.txt;
      const b = rij.querySelector('.plus');
      b.setAttribute('aria-pressed', String(in_)); b.setAttribute('aria-label', `Zet ${s.name}, ${s.addr}, in je dag`); b.innerHTML = use(in_ ? 'check' : 'plus');
      const pin = kaart.querySelector(`.pin[data-id="${s.id}"]`) || kaart.querySelector(`button[data-id="${s.id}"]`);
      pin.className = `pin ${s.t}${open ? '' : ' dicht'}`;
      pin.innerHTML = use(ICON[s.t]) + (open && s.t !== 'm' ? '<span class="od"></span>' : '') + (nr.has(s.id) ? `<span class="n">${nr.get(s.id)}</span>` : '');
    }
    const pts = p ? [START, ...p.rows.map(r => r.s)].map(pos) : [];
    const lijn = $('#lijn'); lijn.setAttribute('d', pts.length > 1 ? 'M' + pts.map(q => `${q.l} ${q.t}`).join(' L') : ''); lijn.setAttribute('vector-effect', 'non-scaling-stroke');
    $('#pb-n').textContent = gekozen.size;
    const mis = p ? p.rows.filter(r => r.w && r.w.c === 'mis').map(r => r.s.kort) : [];
    $('#pb-t').innerHTML = p ? `klaar rond ${rond(p.eind)}${mis.length ? ` <span class="let">· ${mis.length} kan niet</span>` : ''}` : 'nog geen stops';
    const vak = $('#bonvak');
    if (!p) { vak.innerHTML = '<p class="leeg">Tik op + of op een pin om stops te kiezen.</p>'; if (melden) $('#melding').textContent = 'Geen stops gekozen.'; return; }
    vak.innerHTML = `<h3 class="sr-only">Je dagplan</h3>${bonHtml(p, dag, print)}`;
    if (melden) $('#melding').textContent = `${DAG[dag].naam[0].toUpperCase() + DAG[dag].naam.slice(1)}: ${p.rows.length} ${p.rows.length === 1 ? 'stop' : 'stops'}, klaar rond ${rond(p.eind)}${mis.length ? `. Let op: ${mis.join(' en ')} kan die dag niet` : ''}.`;
  }
  function wissel(id) { gekozen.has(id) ? gekozen.delete(id) : gekozen.size < 6 && gekozen.add(id); teken(true, true); }
  document.querySelectorAll('.dagen button').forEach(b => b.onclick = () => { dag = b.dataset.dag; teken(true, true); });
  teken(false, false);

})();
