# Ontwerp-generator: vier voorbeeldpagina's (kringloop, tweedehands, markt, organisator) uit de echte data.
# Gebruik: python3 ontwerp/paginas/maak.py   (schrijft de .html-bestanden naast dit script)
# ponytail: alleen voor het ontwerp; de echte pagina's worden Astro-componenten met dezelfde opbouw.
import json, math, html, os, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', '..', 'app', 'public', 'data')
P = json.load(open(os.path.join(DATA, 'places.json')))['places']
M = json.load(open(os.path.join(DATA, 'markets.json')))['markets']
FROM = dt.date(2026, 11, 9)  # h[0] in places.json = deze datum (maandag)
SAT = 5  # h-index van zaterdag 14 november

e = html.escape
def km(a, b):
    r = math.radians
    return 6371 * 2 * math.asin(math.sqrt(math.sin(r(b['lat'] - a['lat']) / 2) ** 2 + math.cos(r(a['lat'])) * math.cos(r(b['lat'])) * math.sin(r(b['lon'] - a['lon']) / 2) ** 2))
def kmtxt(k): return f"{round(k * 1000 / 50) * 50} m" if k < 1 else f"{k:.1f} km".replace('.', ',')
def hm(m): return f"{m // 60}:{m % 60:02d}"
def ivtxt(iv): return ' en '.join(f"{hm(a)}–{hm(b)}" for a, b in iv) if iv else 'dicht'
DAGEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']
MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
def dlong(iso):
    d = dt.date.fromisoformat(iso); return f"{DAGEN[d.weekday()].capitalize()} {d.day} {MAANDEN[d.month - 1]} {d.year}"
def week(p):
    """Gewone week, maandag eerst, uit de vooruitgerekende dagen (h[0] = maandag 9 nov)."""
    return [p['h'][i] for i in range(7)] if p.get('h') else None
def jsweek(p):  # voor de live status: index = JS getDay (zo=0)
    w = week(p); return json.dumps([w[6]] + w[:6]) if w else 'null'
def cat(p): return 'tw' if p.get('kind') == 'tweedehands' else 'kr'

ICON = {
  'tag': '<path d="M3 12V4h8l9 9-8 8-9-9Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  'hanger': '<path d="M12 7a2 2 0 1 1 2-2c0 1.2-2 1.5-2 3v1l9 6v2H3v-2l9-6"/>',
  'kraam': '<path d="M3 9h18l-2-5H5L3 9Zm0 0c0 1.5 1.3 2.5 3 2.5S9 10.5 9 9c0 1.5 1.3 2.5 3 2.5s3-1 3-2.5c0 1.5 1.3 2.5 3 2.5s3-1 3-2.5M5 11.5V20h14v-8.5"/>',
  'cal': '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4m8-4v4"/>',
  'map': '<path d="m9 4-5 2v14l5-2 6 2 5-2V4l-5 2-6-2Zm0 0v14m6-12v14"/>',
  'phone': '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  'route': '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M6 16V9a3 3 0 0 1 3-3h4m-2 12h4a3 3 0 0 0 3-3V8"/>',
  'plan': '<path d="M4 7h16M4 12h10M4 17h7m9-3v6m-3-3h6"/>',
  'share': '<path d="M12 3v12m0-12-4 4m4-4 4 4M5 13v6h14v-6"/>',
  'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-9.5v.5"/>',
  'check': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'edit': '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>',
  'ext': '<path d="M14 4h6v6m0-6-9 9M18 14v6H4V6h6"/>',
}
def ic(n): return f'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{ICON[n]}</svg>'

# ---------- kaartje (geschetste straten, onze eigen pins: vierkant = winkel, rond = markt) ----------
def minimap(center, items, href, label, scale=150, me_label=''):
    W, H, cx, cy = 800, 600, 400, 300
    def xy(o):
        return (cx + (o['lon'] - center['lon']) * math.cos(math.radians(center['lat'])) * 111.32 * scale,
                cy - (o['lat'] - center['lat']) * 110.57 * scale)
    roads = ''.join(f'<path d="{d}"/>' for d in ['M-20 210 L820 190', 'M-20 420 L820 445', 'M250 -20 C270 200 230 380 270 620', 'M560 -20 L545 620', 'M-20 320 L820 300'])
    small = ''.join(f'<path d="{d}"/>' for d in ['M120 -20 L110 620', 'M400 -20 L410 190', 'M410 300 L420 445', 'M680 -20 L690 620', 'M270 520 L820 540', 'M-20 90 L250 80', 'M560 110 L820 120'])
    pins = []
    for o in sorted(items, key=lambda o: -km(center, o)):
        x, y = xy(o)
        if not (-20 < x < 820 and -20 < y < 620): continue
        if o.get('t') == 'm':
            pins.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="13" fill="var(--markt)" stroke="white" stroke-width="2.5"/>')
        else:
            fill = 'var(--pruim)' if o.get('kind') == 'tweedehands' else 'var(--kring)'
            if not o.get('h'):  # tijden onbekend: wit met gestippelde rand
                pins.append(f'<rect x="{x - 12:.0f}" y="{y - 12:.0f}" width="24" height="24" rx="7" fill="white" stroke="{fill}" stroke-width="2" stroke-dasharray="3 2.5"/>')
            else:
                pins.append(f'<rect x="{x - 12:.0f}" y="{y - 12:.0f}" width="24" height="24" rx="7" fill="{fill}" stroke="white" stroke-width="2.5"/>')
    me = center
    shape = (f'<circle cx="{cx}" cy="{cy}" r="21" fill="var(--markt)" stroke="var(--ink)" stroke-width="3.5"/>' if me.get('t') == 'm'
             else f'<rect x="{cx - 20}" y="{cy - 20}" width="40" height="40" rx="11" fill="{"var(--pruim)" if me.get("kind") == "tweedehands" else "var(--kring)"}" stroke="var(--ink)" stroke-width="3.5"/>')
    return f'''<a class="minimap" href="{href}" aria-label="{e(label)}">
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="{W}" height="{H}" fill="var(--m-land)"/><path d="M-20 520 C200 480 360 600 560 560 S760 500 820 520 V620 H-20Z" fill="var(--m-water)"/>
    <rect x="590" y="215" width="200" height="70" rx="6" fill="var(--m-park)"/><rect x="130" y="100" width="100" height="90" rx="6" fill="var(--m-urban)"/><rect x="290" y="330" width="230" height="95" rx="6" fill="var(--m-urban)"/><rect x="590" y="330" width="200" height="100" rx="6" fill="var(--m-urban)"/><rect x="430" y="40" width="100" height="130" rx="6" fill="var(--m-urban)"/>
    <g fill="none" stroke-linecap="round"><g stroke="var(--m-casing)" stroke-width="22">{roads}</g><g stroke="var(--m-road)" stroke-width="18">{roads}</g><g stroke="var(--m-road)" stroke-width="8">{small}</g></g>
    <g style="filter:drop-shadow(0 1px 2px oklch(0.2 0.02 260 / .25))">{''.join(pins)}</g>
    <g style="filter:drop-shadow(0 2px 6px oklch(0.2 0.02 260 / .3))">{shape}</g>
  </svg>
  {f'<span class="me-lab">{e(me_label)}</span>' if me_label else ''}
  <span class="btn prim go">{ic('map')}{e(label)}</span>
</a>'''

NL = [(3.36,51.37),(3.6,51.6),(4.0,51.95),(4.4,52.2),(4.55,52.45),(4.65,52.75),(4.75,53.0),(5.1,53.1),(5.4,53.2),(5.6,53.35),(6.2,53.42),(6.9,53.45),(7.2,53.25),(7.05,52.85),(7.05,52.6),(6.7,52.5),(6.95,52.25),(6.75,52.0),(6.1,51.85),(5.95,51.75),(6.2,51.5),(6.0,51.1),(5.85,50.75),(5.65,50.78),(5.8,51.15),(5.2,51.3),(4.8,51.45),(4.3,51.37),(3.8,51.25)]
IJ = [(5.0,52.4),(5.6,52.35),(5.85,52.6),(5.6,52.85),(5.4,53.05),(5.05,52.95),(5.1,52.65)]
def nlmap(items, href, label):
    W, H = 800, 600
    X = lambda lon: (lon - 3.2) / 4.2 * 560 + 120; Y = lambda lat: (53.6 - lat) / 2.95 * 580 + 10
    poly = lambda pts: 'M' + ' L'.join(f"{X(a):.0f} {Y(b):.0f}" for a, b in pts) + 'Z'
    seen, pins = set(), []
    for m in items:
        k = (round(m['lat'], 2), round(m['lon'], 2))
        if k in seen: continue
        seen.add(k); pins.append(f'<circle cx="{X(m["lon"]):.0f}" cy="{Y(m["lat"]):.0f}" r="10" fill="var(--markt)" stroke="white" stroke-width="2.5"/>')
    return f'''<a class="minimap" href="{href}" aria-label="{e(label)}">
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect width="{W}" height="{H}" fill="var(--m-water)"/>
    <path d="{poly(NL)}" fill="var(--m-land)" stroke="var(--m-casing)" stroke-width="2"/><path d="{poly(IJ)}" fill="var(--m-water)"/>
    <g style="filter:drop-shadow(0 1px 2px oklch(0.2 0.02 260 / .25))">{''.join(pins)}</g></svg>
  <span class="btn prim go">{ic('map')}{e(label)}</span>
</a>'''

# ---------- bouwstenen ----------
def hours_table(p, unk=False):
    A, B = 480, 1200  # as van 8 tot 20 uur; ticks hieronder komen uit dezelfde getallen
    w = week(p) if not unk else [None] * 7
    rows = []
    for i, iv in enumerate(w):
        js = (i + 1) % 7
        bars = ''.join(f'<i style="left:{(max(a, A) - A) / (B - A) * 100:.1f}%;width:{(min(b, B) - max(a, A)) / (B - A) * 100:.1f}%"></i>' for a, b in (iv or []))
        rows.append(f'<tr data-dag="{js}"><th scope="row">{DAGEN[i].capitalize()}</th><td class="tx">{"onbekend" if unk else ivtxt(iv)}</td><td class="bar" aria-hidden="true"><div class="track">{bars}</div></td></tr>')
    ticks = ''.join(f'<span style="left:{(t - A) / (B - A) * 100:.1f}%">{t // 60}</span>' for t in range(A, B + 1, 120))
    return f'<table class="hours{" unk" if unk else ""}"><caption class="sr">Openingstijden in een gewone week</caption><tbody>{"".join(rows)}</tbody></table><div class="axis" aria-hidden="true"><span></span><span></span><div>{ticks}</div></div>'

def row_place(o, ref):
    t = cat(o); icon = 'hanger' if t == 'tw' else 'tag'
    st = f'<span class="st" data-h=\'{jsweek(o)}\'>…</span>' if o.get('h') else '<span class="st unk">Tijden onbekend</span>'
    sort = 'Tweedehands' if t == 'tw' else 'Kringloop'
    return f'<li><a class="row" href="#"><span class="tl {"tw" if t == "tw" else ""}{" unc" if not o.get("h") else ""}">{ic(icon)}</span><span class="nm">{e(o["name"])}</span><span class="km">{kmtxt(km(ref, o))}</span>{st}<span class="mt2">{sort} · {e((o.get("addr") or o.get("place") or "").split(",")[0])}</span></a></li>'

def row_market(m, ref=None, show_place=True):
    d = dt.date.fromisoformat(m['date'])
    dist = f'<span class="km">{kmtxt(km(ref, m))}</span>' if ref else '<span class="km"></span>'
    st = {'org': ('open', 'Bevestigd door de organisator'), 'chk': ('', 'Gecontroleerd'), 'unconf': ('unk', 'Nog niet bevestigd'), 'cancel': ('', 'Afgelast')}[m['status']]
    where = f"{e(m['place'])} · {e(m.get('venue') or '')}" if show_place else e(m.get('venue') or m['place'])
    return f'''<li><a class="row" href="#"><span class="date"><small>{DAGEN[d.weekday()][:2]}</small><b>{d.day}</b><small>{MAANDEN[d.month - 1][:3]}</small></span><span class="nm">{e(m["name"])}</span>{dist}<span class="st {st[0]}">{st[1]}</span><span class="mt2">{str(d.year) + ' · ' if d.year != FROM.year else ''}{where} · {hm(m["start"])}–{hm(m["end"]) if m.get("end") else ""}{" · " + e(m["entree"]) if m.get("entree") and m["entree"] != "onbekend" else ""}</span></a></li>'''

def bon(title, meta, stops, note, cta='Open dit rondje op de kaart'):
    sure = sum(1 for s in stops if s['zeker'])
    li = ''.join(f'<li class="{"" if s["zeker"] else "maybe"}"><span class="tm">{hm(s["t"])}</span><span><b>{e(s["name"])}</b><small>{e(s["sub"])}</small></span><span class="ok">{"open" if s["zeker"] else "bel eerst"}</span></li>' for s in stops)
    walk = sum(s.get('walk', 0) for s in stops)
    return f'''<div class="bon"><h3>{e(title)}</h3><div class="meta">{e(meta)}</div><hr><ol>{li}</ol><hr>
  <div class="tot"><span>{len(stops)} stops</span><b>{sure} van {len(stops)} zeker open</b></div><div class="tot"><span>± {walk} min onderweg</span><span>klaar rond {hm(stops[-1]["t"] + 40)}</span></div>
  <a class="btn prim" href="#">{ic('map')}{e(cta)}</a><p class="note">{e(note)}</p></div>'''

def plan_rondje(start, cands, day, t0=600, first_zeker=True, first_sub='', stay=30, pace=12):
    """Lopen (12 min/km, minstens 5), 30 min per winkel; een buur alleen als hij open is als je er bent."""
    stops = [{'name': start['name'], 'sub': first_sub, 't': t0, 'zeker': first_zeker}]
    t, here = t0 + stay, start
    for o in sorted(cands, key=lambda o: km(start, o)):
        walk = max(5, round(km(here, o) * pace)); arr = t + walk
        iv = o['h'][day] if o.get('h') else []
        if any(a <= arr and arr + 20 <= b for a, b in iv):
            stops.append({'name': o['name'], 'sub': f"{(o.get('addr') or '').split(',')[0]} · {kmtxt(km(here, o))}", 't': arr, 'zeker': True, 'walk': walk})
            t, here = arr + 30, o
        if len(stops) == 4: break
    return stops

def page(fname, *, title, body, crumbs, head, mapblock, sub, main, dock, mailplek, proto_extra=''):
    pages = [('kringloop.html', 'Kringloop'), ('tweedehands.html', 'Tweedehands'), ('markt.html', 'Markt'), ('organisator.html', 'Organisator')]
    nav = ''.join(f'<a href="{f}" aria-current="{"true" if f == fname else "false"}">{n}</a>' for f, n in pages)
    subnav = ''.join(f'<a href="#{i}">{n}</a>' for i, n in sub)
    mail = f'''<section class="mail" aria-labelledby="mail-h"><div><h2 id="mail-h">Elke donderdag de markten rond {e(mailplek)}</h2><p>Een korte mail met de rommelmarkten van het weekend, binnen de afstand die je kiest. Geen markten in de buurt, dan geen mail.</p></div>
  <form onsubmit="return false"><label>Je e-mailadres<input type="email" autocomplete="email"></label><label>Plaats of postcode<input value="{e(mailplek)}"></label>
  <label>Afstand<select><option>10 km</option><option selected>25 km</option><option>50 km</option></select></label><button class="btn">Aanmelden</button></form>
  <small>Eerst krijg je een mail om te bevestigen. Afmelden kan met één klik. <a href="#">Wat we bewaren</a></small></section>'''
    out = f'''<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} · Snuffelkaart (ontwerp)</title><link rel="stylesheet" href="stijl.css"></head>
<body class="{body}">
<header class="top"><div class="wrap"><a class="brand" href="#"><i>{ic('tag')}</i>Snuffelkaart</a><span class="crumbs">{crumbs}</span><span class="sp"></span><a class="btn sm" href="#">{ic('map')}Naar de kaart</a></div></header>
<div class="head"><div class="wrap"><div>{head}</div>{mapblock}</div></div>
<nav class="sub" aria-label="Op deze pagina"><div class="wrap">{subnav}<span class="sp"></span><a class="btn sm prim" href="#">{ic('map')}Bekijk op de kaart</a></div></nav>
<main><div class="wrap">{main}
{mail}
<footer class="foot"><a href="#">Alle plaatsen</a><a href="#">Hoe we controleren</a><a href="#">Privacy</a><a href="#">Voorwaarden</a><a href="#">Colofon</a><a href="#">Open data (ODbL)</a></footer>
</div></main>
<nav class="dock" aria-label="Snel">{dock}</nav>
<div class="proto" role="navigation" aria-label="Ontwerp: andere pagina's"><span>ONTWERP</span>{nav}{proto_extra}</div>
<script src="pagina.js"></script>
</body></html>'''
    open(os.path.join(HERE, fname), 'w').write(out)

def by_id(i): return next(p for p in P if p['id'] == i)
def near_places(c, r, n, pred=lambda o: True): return sorted([o for o in P if o is not c and o['id'] != c.get('id') and km(c, o) < r and pred(o)], key=lambda o: km(c, o))[:n]
def near_markets(c, r, n): return sorted([m for m in M if km(c, m) < r and m['date'] >= FROM.isoformat()], key=lambda m: m['date'])[:n]

# ---------- 1. kringloop met tijden: Harry's Kringloophal, Zwolle ----------
h = by_id('osm-n2500673121')
nb = near_places(h, 3, 40)
st = plan_rondje(h, [o for o in nb if o['name'] != h['name']], SAT, t0=600, first_sub='start hier · open 8:30–17:00')
ms = near_markets(h, 12, 3)
phone = h['phone']; tel = phone.replace(' ', '')
page('kringloop.html', title=f"{h['name']}, Zwolle", body='t-kringloop',
  crumbs='<a href="#">Snuffelkaart</a> › <a href="#">Zwolle</a> › Harry’s Kringloophal',
  head=f'''<span class="kind"><span class="tile">{ic('tag')}</span>Kringloopwinkel in Zwolle</span>
<h1>{e(h["name"])}</h1><p class="where">Rieteweg 13, 8041 AJ Zwolle</p>
<div class="now" id="nu" data-h='{jsweek(h)}'><span class="dot"></span><div><b>…</b><span>Volgens OpenStreetMap. Rond feestdagen kan het afwijken.</span></div></div>
<div class="acts"><a class="btn prim" href="#">{ic('map')}Bekijk op de kaart</a><a class="btn" href="tel:{tel}">{ic('phone')}Bel</a><a class="btn" href="#">{ic('route')}Route</a><a class="btn" href="#">{ic('plan')}In Mijn dag</a></div>''',
  mapblock=minimap(h, nb + ms, '#', f'{len(nb)} plekken in de buurt op de kaart', me_label=h['name']),
  sub=[('tijden', 'Openingstijden'), ('contact', 'Contact'), ('rondje', 'Rondje'), ('buurt', 'In de buurt'), ('markten', 'Markten')],
  main=f'''<div class="cols"><div>
<section class="s" id="tijden"><h2>Openingstijden</h2>{hours_table(h)}
<p class="src">{ic('info')}<span>Uit OpenStreetMap, nog niet door ons gecontroleerd. Klopt er iets niet? <a href="#">Geef het door</a>.</span></p></section>
<section class="s" id="contact"><h2>Contact en adres</h2><dl class="facts"><dt>Adres</dt><dd>Rieteweg 13<br>8041 AJ Zwolle</dd><dt>Telefoon</dt><dd><a href="tel:{tel}">{e(phone)}</a></dd>
<dt>Website</dt><dd><a href="#">harryskringloophal.nl</a></dd><dt>Soort</dt><dd>Kringloopwinkel<small>Tweedehands spullen die mensen brengen; meestal lage prijzen en elke week ander aanbod.</small></dd></dl></section>
</div><aside>
<section class="s" id="rondje"><h2>Maak er een rondje van</h2><p class="intro">Zaterdag, lopend, alleen langs winkels die dan zeker open zijn.</p><div class="mt">{bon('Zaterdag 14 november', 'rondje vanaf Harry’s · lopend', st, 'Uitgerekend met de tijden die we kennen. Op de kaart kun je stops wisselen.')}</div></section>
</aside></div>
<section class="s" id="buurt"><h2>Kringlopen en tweedehands in de buurt</h2><ul class="rows two">{''.join(row_place(o, h) for o in [o for o in nb if o['name'] != h['name']][:6])}</ul><a class="btn more" href="#">{ic('map')}Alle {len(nb)} op de kaart</a></section>
<section class="s" id="markten"><h2>Markten in de buurt</h2><ul class="rows two">{''.join(row_market(m, h) for m in ms)}</ul></section>
<div class="owner"><div><b>Is dit jouw winkel?</b><p>Kloppen je tijden niet, of wil je er iets bij zetten? Gratis, en snuffelaars zien het meteen.</p></div><a class="btn" href="#">{ic('edit')}Gegevens aanpassen</a></div>''',
  dock=f'<a class="btn prim" href="#">{ic("map")}Bekijk op de kaart</a><a class="btn" href="tel:{tel}">{ic("phone")}<span>Bel</span></a><a class="btn" href="#">{ic("route")}<span>Route</span></a>',
  mailplek='Zwolle')

# ---------- 2. tweedehands zonder tijden (of op afspraak): Witgoed-Krispijn, Dordrecht ----------
w = by_id('ov-857134613358')
nb = near_places(w, 3, 40)
st = plan_rondje(w, nb, SAT, t0=600, first_zeker=False, first_sub='tijden onbekend')
ms = near_markets(w, 12, 3)
page('tweedehands.html', title='Witgoed-Krispijn, Dordrecht', body='t-tweedehands', crumbs='<a href="#">Snuffelkaart</a> › <a href="#">Dordrecht</a> › Witgoed-Krispijn',
  head=f'''<span class="kind"><span class="tile">{ic('hanger')}</span>Tweedehandswinkel in Dordrecht</span>
<h1>Witgoed-Krispijn</h1><p class="where">Krispijnseweg 37, 3314 KA Dordrecht</p>
<div class="now unk" data-state="onbekend"><span class="dot"></span><div><b>Openingstijden onbekend</b><span>We hebben ze nog niet. Bel even voordat je gaat.</span></div></div>
<div class="now afs" data-state="afspraak" hidden><span class="dot"></span><div><b>Alleen op afspraak</b><span>Staat op hun eigen website, gelezen op 9 november.</span></div></div>
<div class="acts"><a class="btn prim" href="#">{ic('map')}Bekijk op de kaart</a><a class="btn" href="tel:0644443820">{ic('phone')}06 44 44 38 20</a><a class="btn" href="#">{ic('route')}Route</a></div>''',
  mapblock=minimap(w, nb + ms, '#', f'{len(nb)} plekken in de buurt op de kaart', me_label='Witgoed-Krispijn'),
  sub=[('tijden', 'Openingstijden'), ('contact', 'Contact'), ('rondje', 'Rondje'), ('buurt', 'In de buurt'), ('markten', 'Markten')],
  main=f'''<div class="cols"><div>
<section class="s" id="tijden"><h2>Openingstijden</h2>
<div data-state="onbekend">{hours_table(w, unk=True)}
<div class="help"><span class="ic">{ic('clock')}</span><div><b>Ben jij er weleens geweest?</b><p>Geef door wanneer hij open was. Wij controleren het en zetten het erop, zodat de volgende niet voor een dichte deur staat.</p></div><div class="btns"><a class="btn" href="#">{ic('edit')}Tijden doorgeven</a></div></div></div>
<div data-state="afspraak" hidden><blockquote>“Wij hebben geen vaste openingstijden en adviseren een afspraak te maken als u wilt komen kijken, omdat we niet altijd aanwezig zijn.”</blockquote>
<p class="src">{ic('info')}<span>Letterlijk van <a href="#">hun website</a>, gelezen op 9 november.</span></p></div>
<p class="src">{ic('info')}<span>Deze winkel komt uit Overture Maps en is nog niet door ons gecontroleerd. Misschien bestaat hij niet meer.</span></p></section>
<section class="s" id="contact"><h2>Contact en adres</h2><dl class="facts"><dt>Adres</dt><dd>Krispijnseweg 37<br>3314 KA Dordrecht</dd><dt>Telefoon</dt><dd><a href="tel:0644443820">06 44 44 38 20</a></dd>
<dt>Facebook</dt><dd><a href="#">Witgoed-Krispijn op Facebook</a></dd><dt>Soort</dt><dd>Tweedehandswinkel<small>Geen standaard kringloop: eigen aanbod en eigen prijzen. Hier vooral witgoed.</small></dd></dl></section>
</div><aside>
<section class="s" id="rondje"><h2>Maak er een rondje van</h2><p class="intro">Zaterdag, lopend, langs winkels die dan zeker open zijn. Witgoed-Krispijn kan erbij als je eerst belt.</p><div class="mt">{bon('Zaterdag 14 november', 'rondje in Krispijn · lopend', st, 'Uitgerekend met de tijden die we kennen. Op de kaart kun je stops wisselen.')}</div></section>
</aside></div>
<section class="s" id="buurt"><h2>Tweedehands om de hoek</h2><ul class="rows two">{''.join(row_place(o, w) for o in nb[:6])}</ul><a class="btn more" href="#">{ic('map')}Alle {len(nb)} op de kaart</a></section>
<section class="s" id="markten"><h2>Markten in de buurt</h2><ul class="rows two">{''.join(row_market(m, w) for m in ms)}</ul></section>
<div class="owner"><div><b>Is dit jouw winkel?</b><p>Zet je openingstijden erop. Gratis, en snuffelaars in Dordrecht zien meteen wanneer je open bent.</p></div><a class="btn" href="#">{ic('edit')}Tijden doorgeven</a></div>''',
  dock=f'<a class="btn prim" href="#">{ic("map")}Bekijk op de kaart</a><a class="btn" href="tel:0644443820">{ic("phone")}<span>Bel</span></a><a class="btn" href="#">{ic("route")}<span>Route</span></a>',
  mailplek='Dordrecht', proto_extra='<span>TOESTAND</span><button data-s="onbekend" aria-pressed="true">Tijden onbekend</button><button data-s="afspraak" aria-pressed="false">Op afspraak</button>')

# ---------- 3. markt: Vlooienmarkt Zwolle, WRZV Hallen ----------
m = next(x for x in M if x['id'].startswith('don-mega-vlooienmarkt-zwolle-wrzv'))
m = {**m, 't': 'm'}
shops = near_places(m, 3, 40)
shops6 = near_places(m, 6, 80)
sun = plan_rondje({'name': 'Vlooienmarkt Zwolle', 'lat': m['lat'], 'lon': m['lon']}, shops6, 6, t0=540, first_sub='WRZV Hallen · 9:00–16:00 · 2 uur rondkijken', stay=120, pace=4)
other = [x for x in sorted(M, key=lambda x: x['date']) if x['org'] == m['org'] and x['id'] != m['id'] and x['date'] >= FROM.isoformat()][:5]
page('markt.html', title='Vlooienmarkt Zwolle, zondag 28 maart 2027', body='t-markt', crumbs='<a href="#">Snuffelkaart</a> › <a href="#">Markten</a> › <a href="#">Zwolle</a>',
  head=f'''<span class="kind"><span class="tile rond">{ic('kraam')}</span>Vlooienmarkt · binnen</span>
<h1>Vlooienmarkt Zwolle</h1><p class="where">WRZV Hallen, Grote Voort 4, Zwolle</p>
<div class="now" id="markt" data-date="{m['date']}"><span class="dot" style="background:var(--markt)"></span><div><b>Zondag 28 maart 2027 · <span style="white-space:nowrap">9:00–16:00</span></b><span>1e Paasdag · <span id="aftel">…</span></span></div></div>
<p class="src">{ic('check')}<span>Gecontroleerd op 9 november bij <a href="#">Don Events</a>, de organisator. We kijken elke nacht opnieuw.</span></p>
<div class="acts"><a class="btn prim" href="#">{ic('map')}Bekijk op de kaart</a><a class="btn" href="#">{ic('plan')}In Mijn dag</a><a class="btn" href="#">{ic('route')}Route</a><button class="btn" type="button" id="deel">{ic('share')}Deel</button></div>''',
  mapblock=minimap(m, shops, '#', f'Markt en {len(shops)} winkels in de buurt', me_label='WRZV Hallen'),
  sub=[('praktisch', 'Praktisch'), ('combineren', 'Combineren'), ('meer', 'Meer van Don Events'), ('buurt', 'In de buurt')],
  main=f'''<div class="cols"><div>
<section class="s" id="praktisch"><h2>Praktisch</h2><dl class="facts"><dt>Wanneer</dt><dd>Zondag 28 maart 2027<small>1e Paasdag</small></dd><dt>Tijd</dt><dd>9:00–16:00</dd><dt>Entree</dt><dd>€4,50</dd>
<dt>Binnen of buiten</dt><dd>Binnen, in de WRZV Hallen<small>Dus ook bij regen.</small></dd><dt>Adres</dt><dd>Grote Voort 4, 8041 AM Zwolle</dd>
<dt>Organisator</dt><dd><a href="organisator.html">Don Events</a><small><a href="#">Naar hun site, ook voor een kraam</a></small></dd></dl></section>
</div><aside>
<section class="s" id="combineren"><h2>Combineer op zondag</h2><p class="intro">Op zondag zijn de meeste kringlopen dicht. Deze zijn dan wel open, met de tijden van een gewone zondag.</p><div class="mt">{bon('Zondag 28 maart', 'markt + winkels · op de fiets', sun, 'Op 1e Paasdag kunnen winkels anders open zijn. Bel bij twijfel.') if len(sun) > 1 else '<p class="help">Op zondag is hier in de buurt geen kringloop open. Op de kaart zie je wat er op zaterdag 27 maart open is.</p>'}</div></section>
</aside></div>
<section class="s" id="meer"><h2>Meer markten van Don Events</h2><ul class="rows two">{''.join(row_market(x) for x in other)}</ul><a class="btn more" href="organisator.html">Alle 43 markten van Don Events</a></section>
<section class="s" id="buurt"><h2>Kringlopen en tweedehands in de buurt</h2><ul class="rows two">{''.join(row_place(o, m) for o in shops[:6])}</ul><a class="btn more" href="#">{ic('map')}Alle {len(shops)} op de kaart</a></section>''',
  dock=f'<a class="btn prim" href="#">{ic("map")}Bekijk op de kaart</a><a class="btn" href="#">{ic("plan")}<span>In Mijn dag</span></a><a class="btn" href="#">{ic("route")}<span>Route</span></a>',
  mailplek='Zwolle')

# ---------- 4. organisator: Don Events ----------
D = sorted([x for x in M if x['org'] == 'Don Events' and x['date'] >= FROM.isoformat()], key=lambda x: x['date'])
nxt = D[0]; places = sorted({x['place'] for x in D}); months = {}
for x in D: months.setdefault(x['date'][:7], []).append(x)
mk = list(months.items())
agenda = ''
for i, (k, xs) in enumerate(mk):
    y, mo = k.split('-'); block = f'<h3 class="mt" style="font-size:1rem;font-weight:700">{MAANDEN[int(mo) - 1].capitalize()} {y}</h3><ul class="rows two" style="margin-top:6px">{"".join(row_market(x) for x in xs)}</ul>'
    agenda += block if i < 2 else ''
rest = sum(len(xs) for _, xs in mk[2:])
chips = ''.join(f'<a class="btn sm" href="#">{e(p)} <span style="color:var(--fg-3);font-weight:500">{sum(1 for x in D if x["place"] == p)}</span></a>' for p in places)
page('organisator.html', title='Markten van Don Events', body='t-org', crumbs='<a href="#">Snuffelkaart</a> › <a href="#">Markten</a> › Don Events',
  head=f'''<span class="kind"><span class="tile rond">{ic('cal')}</span>Organisator van vlooienmarkten</span>
<h1>Don Events</h1><p class="where">{len(D)} markten in {len(places)} plaatsen, bijna allemaal binnen in sporthallen.</p>
<div class="now"><span class="dot" style="background:var(--markt)"></span><div><b>Volgende: {dlong(nxt['date'])[0].lower() + dlong(nxt['date'])[1:]}</b><span>{e(nxt['place'])}, {e(nxt.get('venue') or '')} · {hm(nxt['start'])}–{hm(nxt['end'])} · {e(nxt.get('entree') or '')}</span></div></div>
<p class="src">{ic('check')}<span>We lezen hun agenda elke nacht. Afgelast of verplaatst staat er de volgende ochtend op.</span></p>
<div class="acts"><a class="btn prim" href="#">{ic('map')}Alle {len(D)} op de kaart</a><a class="btn" href="#">{ic('ext')}Naar donevents.nl</a></div>''',
  mapblock=nlmap(D, '#', f'Alle {len(D)} markten op de kaart'),
  sub=[('agenda', 'Agenda'), ('plaatsen', 'Plaatsen'), ('organisator', 'Voor organisatoren')],
  main=f'''<section class="s" id="agenda"><h2>Agenda</h2><p class="intro">De eerstvolgende twee maanden. Op de kaart zie je ook welke kringlopen er die dag open zijn.</p>{agenda}
<a class="btn more" href="#">Nog {rest} markten tot {MAANDEN[int(mk[-1][0][5:]) - 1]} {mk[-1][0][:4]}</a></section>
<section class="s" id="plaatsen"><h2>Plaatsen</h2><div class="acts">{chips}</div></section>
<section class="s" id="organisator"><h2>Organiseer je deze markten?</h2><p class="intro">Zet onze badge op je site, dan vinden bezoekers je markten ook op de kaart, samen met de kringlopen in de buurt. Klopt er iets niet? Mail ons.</p>
<p class="mt"><img src="../../app/public/badge.svg" alt="Onze markten staan op Snuffelkaart" width="200" height="48"></p></section>''',
  dock=f'<a class="btn prim" href="#">{ic("map")}Alle {len(D)} op de kaart</a><a class="btn" href="#">{ic("ext")}<span>Site</span></a>',
  mailplek='jouw plaats')

# overzicht
open(os.path.join(HERE, 'index.html'), 'w').write('<!DOCTYPE html><html lang="nl"><meta charset="utf-8"><title>Ontwerp pagina\'s</title><link rel="stylesheet" href="stijl.css"><body><main class="wrap" style="padding:40px 20px"><h1 style="font-size:2rem">Ontwerp: pagina\'s als kleine websites</h1><ul class="rows">' +
  ''.join(f'<li><a class="row" href="{f}"><span class="tl">{ic("map")}</span><span class="nm">{n}</span><span class="km"></span><span class="mt2">{d}</span></a></li>' for f, n, d in [
    ('kringloop.html', 'Kringloop met tijden', 'Harry’s Kringloophal, Zwolle'), ('tweedehands.html', 'Tweedehands zonder tijden / op afspraak', 'Witgoed-Krispijn, Dordrecht'),
    ('markt.html', 'Markt', 'Vlooienmarkt Zwolle, 28 maart 2027'), ('organisator.html', 'Organisator', 'Don Events, 43 markten')]) + '</ul></main></body></html>')
print('klaar')
