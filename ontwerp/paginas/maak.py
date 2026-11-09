# Ontwerp v2 "deurbordje": vier voorbeeldpagina's (kringloop, tweedehands, markt-reeks, organisator) uit de echte data.
# Gebruik: python3 ontwerp/paginas/maak.py   (schrijft de .html-bestanden naast dit script)
# Uitgangspunten (kritiek 9 nov): alles wat een zoeker wil weten staat als tekst in de HTML (geen "…" die JS invult), met
# structured data (Store/Event/Organization + BreadcrumbList); kopjes met de naam; gewone feitelijke taal; geen band, nepkaart,
# bon of subnavigatie; één hoofdknop "Bekijk op de kaart". Markten: één pagina per reeks (zelfde organisator, plek en zaal).
# ponytail: alleen voor het ontwerp; de echte pagina's worden Astro-componenten met dezelfde opbouw.
import json, math, html, os, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', '..', 'app', 'public', 'data')
P = json.load(open(os.path.join(DATA, 'places.json')))['places']
M = json.load(open(os.path.join(DATA, 'markets.json')))['markets']
FROM = dt.date(2026, 11, 9)  # h[0] in places.json = deze maandag
SITE = 'https://snuffelkaart.nl'
e = html.escape

DAGEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']
KORT = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']
MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
OSM_DAG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

def km(a, b):
    r = math.radians
    return 6371 * 2 * math.asin(math.sqrt(math.sin(r(b['lat'] - a['lat']) / 2) ** 2 + math.cos(r(a['lat'])) * math.cos(r(b['lat'])) * math.sin(r(b['lon'] - a['lon']) / 2) ** 2))
def kmtxt(k): return f"{round(k * 1000 / 50) * 50} m" if k < 1 else f"{k:.1f} km".replace('.', ',')
def hm(m): return f"{m // 60}:{m % 60:02d}"
def iso_hm(m): return f"{m // 60:02d}:{m % 60:02d}"
def ivtxt(iv): return ' en '.join(f"{hm(a)}–{hm(b)}" for a, b in iv) if iv else 'dicht'
def dlong(iso, cap=True):
    d = dt.date.fromisoformat(iso); s = f"{DAGEN[d.weekday()]} {d.day} {MAANDEN[d.month - 1]}{'' if d.year == FROM.year else f' {d.year}'}"
    return s[0].upper() + s[1:] if cap else s
def nice(v):  # zaalnamen in hoofdletters ("HANGAR 11 VLIEGVELD TWENTE") netjes
    return v.title() if v and v.isupper() and len(v) > 3 else (v or '')
def week(p): return [p['h'][i] for i in range(7)] if p.get('h') else None
def week_line(w):
    """Hele week in één regel: 'ma 13:00–17:30 · di–vr 8:30–17:30 · za 8:30–17:00 · zo dicht'."""
    out, i = [], 0
    while i < 7:
        j = i
        while j + 1 < 7 and w[j + 1] == w[i]: j += 1
        out.append(f"{KORT[i]}{'–' + KORT[j] if j > i else ''} {ivtxt(w[i])}"); i = j + 1
    return ' · '.join(out)
def jsweek(w): return json.dumps([w[6]] + w[:6])  # index = JS getDay (zo = 0)
def is_tw(p): return p.get('kind') == 'tweedehands'
def fmt_tel(t):
    """Nederlandse notatie: '+31 38 337 5670' -> '038 337 5670', '0644443820' -> '06 44 44 38 20'."""
    d = ''.join(c for c in t if c.isdigit())
    if d.startswith('31'): d = '0' + d[2:]
    if len(d) != 10: return t
    if d.startswith('06'): return f"06 {d[2:4]} {d[4:6]} {d[6:8]} {d[8:]}"
    return f"{d[:3]} {d[3:6]} {d[6:]}"

ICON = {
  'tag': '<path d="M3 12V4h8l9 9-8 8-9-9Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  'map': '<path d="m9 4-5 2v14l5-2 6 2 5-2V4l-5 2-6-2Zm0 0v14m6-12v14"/>',
  'phone': '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  'route': '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M6 16V9a3 3 0 0 1 3-3h4m-2 12h4a3 3 0 0 0 3-3V8"/>',
}
def ic(n): return f'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{ICON[n]}</svg>'

def by_id(i): return next(p for p in P if p['id'] == i)
def near_places(c, r, n, pred=lambda o: True):
    """Dichtstbij eerst; dezelfde naam maar één keer (twee vestigingen van Harry's verwarren)."""
    seen, out = {c.get('name', '').lower()}, []
    for o in sorted([o for o in P if o.get('id') != c.get('id') and km(c, o) < r and pred(o)], key=lambda o: km(c, o)):
        if o['name'].lower() in seen: continue
        seen.add(o['name'].lower()); out.append(o)
    return out[:n]

# ---------- bouwstenen ----------
def hours_table(name, w):
    rows = ''.join(f'<tr data-dag="{(i + 1) % 7}"><th scope="row">{DAGEN[i].capitalize()}</th><td>{ivtxt(iv) if w else "onbekend"}</td></tr>' for i, iv in enumerate(w or [None] * 7))
    return f'<table class="hours{"" if w else " unk"}"><caption style="position:absolute;left:-9999px">Openingstijden van {e(name)} in een gewone week</caption><tbody>{rows}</tbody></table>'

def row_place(o, ref, day=None):
    w = week(o); sh = f'shape{" tw" if is_tw(o) else ""}{"" if w else " unk"}'
    if day is not None and w: when = f'<span class="o">{KORT[day]} {ivtxt(w[day])}</span>'
    else: when = week_line(w) if w else 'tijden onbekend'
    sort = 'Tweedehands' if is_tw(o) else 'Kringloop'
    return f'<li><a class="row" href="#"><span class="{sh}" aria-hidden="true"></span><span class="nm">{e(o["name"])}</span><span class="rt">{kmtxt(km(ref, o))}</span><span class="mt">{sort} · {when}</span></a></li>'

def market_rows(ms, show_place=True, next_id=None):
    out = []
    for m in ms:
        tm = f"{hm(m['start'])}–{hm(m['end'])}" if m.get('end') else f"vanaf {hm(m['start'])}"
        fee = m['entree'] if m.get('entree') and m['entree'] != 'onbekend' else ''
        st = {'org': 'bevestigd', 'chk': 'gecontroleerd', 'unconf': 'nog niet bevestigd', 'cancel': 'afgelast'}[m['status']]
        where = f"{e(m['place'])}{', ' + e(nice(m.get('venue'))) if m.get('venue') else ''}" if show_place else e(nice(m.get('venue')) or m['place'])
        cls = ' class="next"' if m['id'] == next_id else ''
        out.append(f'<tr{cls}><th scope="row">{dlong(m["date"])}</th><td>{where}</td><td class="hide-m">{tm}</td><td class="r">{e(fee)}<span class="hide-m">{" · " if fee else ""}{st}</span></td></tr>')
    return ''.join(out)

def head(title, desc, path, ld):
    return f'''<title>{e(title)} · Snuffelkaart</title>
<meta name="description" content="{e(desc)}"><link rel="canonical" href="{SITE}{path}">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:type" content="website">
<link rel="preload" href="../../app/public/fonts/figtree.woff2" as="font" type="font/woff2" crossorigin>
{''.join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)}'''

def crumbs_ld(items): return {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': SITE + u} for i, (n, u) in enumerate(items)]}
def crumbs_html(items):
    li = ''.join((f'<li><a href="#">{e(n)}</a></li>' if i < len(items) - 1 else f'<li aria-current="page">{e(n)}</li>') for i, (n, _) in enumerate(items))
    return f'<ol class="crumbs" aria-label="Kruimelpad">{li}</ol>'

def hours_spec(w):
    return [{'@type': 'OpeningHoursSpecification', 'dayOfWeek': f'https://schema.org/{OSM_DAG[i]}', 'opens': iso_hm(a), 'closes': iso_hm(b)} for i, iv in enumerate(w) for a, b in iv]

def mail(plek): return f'''<section class="mail" aria-labelledby="mail-h"><h2 id="mail-h">Elke donderdag de markten rond {e(plek)}</h2><p>Een korte mail met de rommelmarkten van het weekend, binnen de afstand die je kiest. Geen markten in de buurt, dan geen mail.</p>
<form onsubmit="return false"><label>Je e-mailadres<input type="email" autocomplete="email"></label><label>Plaats of postcode<input value="{e(plek)}"></label><label>Afstand<select><option>10 km</option><option selected>25 km</option><option>50 km</option></select></label><button class="btn prim">Aanmelden</button></form>
<small>Eerst krijg je een mail om te bevestigen. Afmelden kan met één klik. <a href="#">Wat we bewaren</a></small></section>'''

PAGES = [('kringloop.html', 'Kringloop'), ('tweedehands.html', 'Tweedehands'), ('markt.html', 'Markt'), ('organisator.html', 'Organisator')]
def page(fname, *, body, headtags, crumbs, sign, main, mapcta, plek, proto_extra=''):
    nav = ''.join(f'<a href="{f}" aria-current="{"true" if f == fname else "false"}">{n}</a>' for f, n in PAGES)
    out = f'''<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
{headtags}
<link rel="stylesheet" href="stijl.css"></head>
<body class="{body}">
<header class="top"><div class="wrap"><a class="brand" href="#"><i>{ic('tag')}</i>Snuffelkaart</a>{crumbs_html(crumbs)}</div></header>
<main><div class="wrap">
<section class="sign" id="bordje">{sign}</section>
{main}
{mail(plek)}
<footer class="foot"><a href="#">Alle plaatsen</a><a href="#">Hoe we controleren</a><a href="#">Privacy</a><a href="#">Voorwaarden</a><a href="#">Colofon</a><a href="#">Open data (ODbL)</a></footer>
</div></main>
<div class="dock" id="dock"><a class="btn prim" href="#">{ic('map')}{e(mapcta)}</a></div>
<div class="proto" role="navigation" aria-label="Ontwerp: andere pagina's"><span>ONTWERP</span>{nav}{proto_extra}</div>
<script src="pagina.js"></script>
</body></html>'''
    open(os.path.join(HERE, fname), 'w').write(out)

def shop_page(fname, p, *, body, street, pc, place, src_line, owner_txt, unk_extra='', proto_extra=''):
    w = week(p); name = p['name']; tw = is_tw(p); sort = 'Tweedehandswinkel' if tw else 'Kringloopwinkel'
    raw = (p.get('phone') or '').split(';')[0].strip(); tel = fmt_tel(raw) if raw else ''; tel_href = ''.join(c for c in raw if c.isdigit() or c == '+')
    site = p.get('website'); site_txt = site.replace('https://', '').replace('http://', '').replace('www.', '').rstrip('/') if site else None
    nb = near_places(p, 2.5, 40)
    sat = [o for o in nb if week(o) and week(o)[5]]
    slug = ''.join(c if c.isalnum() else '-' for c in name.lower()).strip('-')
    path = f"/winkel/{slug}-{place.lower()}/"
    crumbs = [('Snuffelkaart', '/'), (place, f'/{place.lower()}/'), (name, path)]
    ld = [{'@context': 'https://schema.org', '@type': 'Store', 'name': name, 'url': SITE + path,
           'address': {'@type': 'PostalAddress', 'streetAddress': street, 'postalCode': pc, 'addressLocality': place, 'addressCountry': 'NL'},
           'geo': {'@type': 'GeoCoordinates', 'latitude': p['lat'], 'longitude': p['lon']}, **({'telephone': tel} if tel else {}), **({'sameAs': site} if site else {}),
           **({'openingHoursSpecification': hours_spec(w)} if w else {})}, crumbs_ld(crumbs)]
    desc = f"{sort} in {place}, {street}. " + (f"Open {week_line(w)}." if w else "Openingstijden nog onbekend; bel even voordat je gaat.") + (f" Telefoon {tel}." if tel else '')
    title = f"{name}, {place}: openingstijden en adres"
    now = f'<p class="now" id="nu" data-h=\'{jsweek(w)}\' hidden></p>' if w else ''
    weekline = (f'<p class="week">{e(week_line(w))}</p>' if w else
                '<p class="week unk" data-state="onbekend">Openingstijden <em>onbekend</em>. Bel even voordat je gaat.</p><p class="week unk" data-state="afspraak" hidden>Geen vaste openingstijden: <em>alleen op afspraak</em>.</p>')
    tel_fact = f'<div><dt>Telefoon</dt><dd><a class="big" href="tel:{tel_href}">{e(tel)}</a></dd></div>' if tel else ''
    web_fact = f'<div><dt>Website</dt><dd><a href="#">{e(site_txt)}</a></dd></div>' if site else ('<div><dt>Facebook</dt><dd><a href="#">Op Facebook</a></dd></div>' if p.get('fb') else '')
    facts = f'<dl class="facts"><div><dt>Adres</dt><dd>{e(street)}<small>{e(pc)} {e(place)}</small></dd></div>{tel_fact}{web_fact}</dl>'
    bel = f'<a class="btn" href="tel:{tel_href}">{ic("phone")}Bel</a>' if tel else ''
    sign = f'''<h1>{e(name)}</h1><p class="what"><span class="shape" aria-hidden="true"></span>{sort} in {e(place)}</p>
<div class="door">{now}{weekline}</div>{facts}
<div class="acts"><a class="btn prim" href="#">{ic('map')}Bekijk op de kaart</a>{bel}<a class="btn" href="#">{ic('route')}Route</a></div>
<p class="src">{src_line}</p>'''
    if len(sat) >= 2:
        near_block = f'<section class="s"><h2>Op loopafstand en zaterdag open</h2><ul class="rows">{"".join(row_place(o, p, 5) for o in sat[:5])}</ul><a class="more" href="#">Alle {len(nb)} winkels rond {e(name)} op de kaart</a></section>'
    else:
        near_block = f'<section class="s"><h2>Tweedehands rond {e(name)}</h2><ul class="rows">{"".join(row_place(o, p) for o in nb[:6])}</ul><a class="more" href="#">Alle {len(nb)} op de kaart</a></section>'
    ms = sorted([m for m in M if km(p, m) < 12 and m['date'] >= FROM.isoformat()], key=lambda m: m['date'])[:4]
    markets = f'<section class="s"><h2>Markten in de buurt van {e(place)}</h2><table class="dates"><tbody>{market_rows(ms)}</tbody></table></section>' if ms else ''
    main = f'''<div class="two"><section class="s"><h2>Openingstijden {e(name)}</h2>{hours_table(name, w)}{unk_extra}</section>
<section class="s"><h2>Reviews</h2><p class="reviews-empty">Nog geen reviews. Ben je er geweest? <a href="#">Schrijf de eerste</a>; we zetten hem erop na controle.</p></section></div>
{near_block}
{markets}
<div class="owner"><p>{owner_txt}</p><a href="#">Gegevens doorgeven</a></div>'''
    page(fname, body=body, headtags=head(title, desc, path, ld), crumbs=crumbs, sign=sign, main=main, mapcta='Bekijk op de kaart', plek=place, proto_extra=proto_extra)

# ---------- 1. kringloop met tijden ----------
shop_page('kringloop.html', by_id('osm-n2500673121'), body='t-kringloop', street='Rieteweg 13', pc='8041 AJ', place='Zwolle',
  src_line='Tijden uit OpenStreetMap, nog niet door ons nagekeken. Rond feestdagen kan het afwijken. <a href="#">Klopt er iets niet?</a>',
  owner_txt='Is dit jouw winkel? Pas je tijden zelf aan; we zetten ze erop na een korte controle.')

# ---------- 2. tweedehands zonder tijden / op afspraak ----------
shop_page('tweedehands.html', by_id('ov-857134613358'), body='t-tweedehands', street='Krispijnseweg 37', pc='3314 KA', place='Dordrecht',
  src_line='Deze winkel komt uit een open kaartbron (Overture Maps) en is nog niet door ons bekeken.',
  owner_txt='Is dit jouw winkel? Zet je openingstijden erop, dan zien mensen in Dordrecht wanneer je open bent.',
  unk_extra='<p class="intro" data-state="onbekend">Ben je er geweest en weet je wanneer hij open is? <a href="#">Geef de tijden door</a>.</p><div data-state="afspraak" hidden><p class="quote">“Wij hebben geen vaste openingstijden en adviseren een afspraak te maken als u wilt komen kijken, omdat we niet altijd aanwezig zijn.”</p><p class="src">Letterlijk van <a href="#">hun website</a>, gelezen op 9 november.</p></div>',
  proto_extra='<span>TOESTAND</span><button data-s="onbekend" aria-pressed="true">Tijden onbekend</button><button data-s="afspraak" aria-pressed="false">Op afspraak</button>')

# ---------- 3. markt-reeks: alle data van één markt op één pagina ----------
first = next(x for x in M if x['id'].startswith('don-mega-vlooienmarkt-zwolle'))
serie = sorted([x for x in M if x['org'] == first['org'] and x['place'] == first['place'] and x.get('venue') == first.get('venue') and x['date'] >= FROM.isoformat()], key=lambda x: x['date'])
nx = serie[0]; venue = nice(nx['venue']); fee = nx['entree']; tm = f"{hm(nx['start'])}–{hm(nx['end'])}"
yrs = sorted({x['date'][:4] for x in serie}); path = '/markt/vlooienmarkt-zwolle-wrzv-hallen/'
crumbs = [('Snuffelkaart', '/'), ('Markten', '/markten/'), ('Zwolle', '/zwolle/'), (f"Vlooienmarkt Zwolle, {venue}", path)]
ev = [{'@context': 'https://schema.org', '@type': 'Event', 'name': f"{x['name']} {dlong(x['date'], False)}", 'url': f"{SITE}{path}#{x['date']}", 'startDate': f"{x['date']}T{iso_hm(x['start'])}:00+01:00", 'endDate': f"{x['date']}T{iso_hm(x['end'])}:00+01:00",
       'eventStatus': 'https://schema.org/EventScheduled', 'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
       'location': {'@type': 'Place', 'name': venue, 'address': {'@type': 'PostalAddress', 'streetAddress': 'Grote Voort 4', 'postalCode': '8041 AM', 'addressLocality': 'Zwolle', 'addressCountry': 'NL'}, 'geo': {'@type': 'GeoCoordinates', 'latitude': x['lat'], 'longitude': x['lon']}},
       'offers': {'@type': 'Offer', 'price': x['entree'].replace('€', '').replace(',', '.'), 'priceCurrency': 'EUR', 'url': x.get('url'), 'availability': 'https://schema.org/InStock'},
       'organizer': {'@type': 'Organization', 'name': x['org'], 'url': 'https://donevents.nl'}, 'description': f"Vlooienmarkt binnen in de {venue} in Zwolle, entree {x['entree']}."} for x in serie]
desc = f"Vlooienmarkt in de {venue} in Zwolle. Volgende: {dlong(nx['date'], False)}, {tm}, entree {fee}. Alle data van {'–'.join(yrs)}, binnen, door {nx['org']}."
shops = near_places(nx, 6, 60); sun = [o for o in shops if week(o) and week(o)[6]]
other = [x for x in sorted(M, key=lambda x: x['date']) if x['org'] == nx['org'] and x not in serie and x['date'] >= FROM.isoformat()][:6]
sign = f'''<h1>Vlooienmarkt Zwolle in de {e(venue)}</h1><p class="what"><span class="shape rond" aria-hidden="true"></span>Vlooienmarkt, binnen · door <a href="organisator.html">{e(nx['org'])}</a></p>
<div class="door"><p class="now" id="aftel" data-date="{nx['date']}" hidden></p><p class="week">Volgende: {dlong(nx['date'], False)}, {tm}</p></div>
<dl class="facts"><div><dt>Entree</dt><dd class="big">{e(fee)}</dd></div><div><dt>Binnen of buiten</dt><dd>Binnen<small>dus ook bij regen</small></dd></div><div><dt>Adres</dt><dd>Grote Voort 4<small>8041 AM Zwolle</small></dd></div></dl>
<div class="acts"><a class="btn prim" href="#">{ic('map')}Bekijk op de kaart</a><a class="btn" href="#">{ic('route')}Route</a></div>
<p class="src">Datum en tijden nagekeken op 9 november bij <a href="#">{e(nx['org'])}</a>. We lezen hun agenda elke nacht; afgelast staat er de volgende ochtend op.</p>'''
sun_rows = ''.join(row_place(o, nx, 6) for o in sun[:4]) or '<li class="row"><span></span><span class="mt">Geen kringloop in de buurt open op zondag.</span></li>'
main = f'''<section class="s"><h2>Alle data van de Vlooienmarkt Zwolle</h2><table class="dates"><tbody>{market_rows(serie, show_place=False, next_id=nx['id'])}</tbody></table></section>
<section class="s"><h2>Op zondag ook open</h2><p class="intro">Op zondag zijn de meeste kringlopen in Zwolle dicht. Deze zijn op een gewone zondag open.</p><ul class="rows">{sun_rows}</ul><a class="more" href="#">Alle {len(shops)} winkels in de buurt op de kaart</a></section>
<section class="s"><h2>Meer van {e(nx['org'])}</h2><table class="dates"><tbody>{market_rows(other)}</tbody></table><a class="more" href="organisator.html">Alle markten van {e(nx['org'])}</a></section>'''
page('markt.html', body='t-markt', headtags=head(f"Vlooienmarkt Zwolle ({venue}) {'–'.join(yrs)}: data, tijden en entree", desc, path, ev + [crumbs_ld(crumbs)]),
  crumbs=crumbs, sign=sign, main=main, mapcta='Bekijk op de kaart', plek='Zwolle')

# ---------- 4. organisator ----------
D = sorted([x for x in M if x['org'] == 'Don Events' and x['date'] >= FROM.isoformat()], key=lambda x: x['date'])
nx = D[0]; places = sorted({x['place'] for x in D}); path = '/organisator/don-events/'
crumbs = [('Snuffelkaart', '/'), ('Markten', '/markten/'), ('Don Events', path)]
months = {}
for x in D: months.setdefault(x['date'][:7], []).append(x)
mk = list(months.items())
def month_tables(items): return ''.join(f'<table class="dates"><caption>{MAANDEN[int(k[5:]) - 1].capitalize()} {k[:4]}</caption><tbody>{market_rows(xs)}</tbody></table>' for k, xs in items)
n_rest = sum(len(xs) for _, xs in mk[2:]); last = mk[-1][0]
ld = [{'@context': 'https://schema.org', '@type': 'Organization', 'name': 'Don Events', 'url': 'https://donevents.nl', 'sameAs': ['https://donevents.nl'],
       'event': [{'@type': 'Event', 'name': x['name'], 'startDate': x['date'], 'url': f"{SITE}/markt/#{x['id']}", 'location': {'@type': 'Place', 'name': nice(x.get('venue')) or x['place'], 'address': x['place']}} for x in D]}, crumbs_ld(crumbs)]
desc = f"Alle {len(D)} vlooienmarkten van Don Events in {len(places)} plaatsen, met data, tijden en entree. Volgende: {dlong(nx['date'], False)} in {nx['place']}."
sign = f'''<h1>Don Events</h1><p class="what"><span class="shape rond" aria-hidden="true"></span>Organisator van vlooienmarkten, bijna allemaal binnen in sporthallen</p>
<div class="door"><p class="week">Volgende markt: {dlong(nx['date'], False)} in {e(nx['place'])}, {hm(nx['start'])}–{hm(nx['end'])}</p></div>
<dl class="facts"><div><dt>Markten</dt><dd class="big">{len(D)}</dd></div><div><dt>Plaatsen</dt><dd class="big">{len(places)}</dd></div><div><dt>Website</dt><dd><a href="#">donevents.nl</a><small>ook voor een kraam huren</small></dd></div></dl>
<div class="acts"><a class="btn prim" href="#">{ic('map')}Alle {len(D)} op de kaart</a></div>
<p class="src">We lezen de agenda van Don Events elke nacht. Afgelast of verplaatst staat er de volgende ochtend op.</p>'''
places_html = ''.join(f'<a href="#">{e(p)}</a><small>{sum(1 for x in D if x["place"] == p)}×</small> ' for p in places)
main = f'''<section class="s"><h2>Agenda van Don Events</h2>{month_tables(mk[:2])}
<details><summary class="more" style="cursor:pointer">Nog {n_rest} markten, tot {MAANDEN[int(last[5:]) - 1]} {last[:4]}</summary>{month_tables(mk[2:])}</details></section>
<section class="s"><h2>Plaatsen met een markt van Don Events</h2><p class="places">{places_html}</p></section>
<div class="owner"><p>Organiseer je deze markten? Zet onze badge op je site, dan vinden bezoekers ze ook op de kaart.</p><a href="#">Badge en code</a></div>'''
page('organisator.html', body='t-org', headtags=head(f"Markten van Don Events {nx['date'][:4]}–{D[-1]['date'][:4]}: data, tijden en entree", desc, path, ld),
  crumbs=crumbs, sign=sign, main=main, mapcta=f'Alle {len(D)} op de kaart', plek='jouw plaats')

rows = ''.join(f'<li><a class="row" href="{f}"><span class="shape" aria-hidden="true"></span><span class="nm">{n}</span><span class="rt"></span><span class="mt">{d}</span></a></li>' for f, n, d in [
    ('kringloop.html', 'Kringloop met tijden', 'Harry’s Kringloophal, Zwolle'), ('tweedehands.html', 'Tweedehands zonder tijden of op afspraak', 'Witgoed-Krispijn, Dordrecht'),
    ('markt.html', 'Markt (één pagina per reeks)', 'Vlooienmarkt Zwolle, WRZV Hallen'), ('organisator.html', 'Organisator', 'Don Events')])
open(os.path.join(HERE, 'index.html'), 'w').write(f'<!DOCTYPE html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ontwerp pagina\'s</title><link rel="stylesheet" href="stijl.css"><body><main class="wrap" style="padding:40px 20px"><h1 style="font-size:2rem">Ontwerp v2: het deurbordje</h1><ul class="rows">{rows}</ul></main></body></html>')
print('klaar')
