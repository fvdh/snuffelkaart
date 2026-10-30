# Snuffelkaart · overdracht

Stand 30 oktober 2026 (commit `5e41cb6`). Voor wie het project oppakt: wat er is, hoe het draait, wat nog openstaat.
Details en het waarom staan in `DECISIONS.md`; dit document vat samen en verwijst.

## In één alinea
Snuffelkaart is een PWA met alle kringlopen, tweedehandswinkels en rommelmarkten van Nederland op één kaart, met openingstijden die kloppen voor de dag dat je gaat en een dagplan als kassabon. Eigenaar en beslisser: Freek. Status: **live op https://snuffelkaart.nl**, geïndexeerd (Google Search Console en Bing, sitemap ingediend), automatisch elke nacht en elk kwartier ververst. Fase nu: wachten op bezoekers en zoekdata; verdienen pas later (passief, geen ads; zie memory `verdienmodel`).

- **Live:** https://snuffelkaart.nl (www → 301 naar het hoofddomein). `snuffelkaart.ironfront-relay.workers.dev` blijft bereikbaar met noindex.
- **Repo:** deze map, GitHub `fvdh/snuffelkaart`; de app staat in `app/`
- **Lokaal:** `cd app && npm install && npm run dev` → http://localhost:4321. `?nu=2026-10-31T09:10` zet de klok vast (de app is tijdsbewust). Voor testen liever `npx astro preview --port 43xx --host 127.0.0.1` na een build (dev-server hydrateert soms oude modules).

## Documenten in de repo
| Bestand | Wat |
|---|---|
| `snuffelkaart-pva.md` | Plan van aanpak: doelen, mijlpalen M0–M7, besluiten D1–D9 |
| `DECISIONS.md` | Alle keuzes met reden, nieuwste onderaan. Bijwerken bij elke keuze |
| `BACKLOG.md` | Verouderd; de backlog hieronder is actueel |
| `PRODUCT.md`, `DESIGN.md` | Product, toon, ontwerptokens. Bron voor de UI |
| `ontwerp/` | Oorspronkelijk ontwerp, testscript, `voorstel/` (canvas) |
| `LICENTIES.md` | Licentie per datastroom (ODbL, Overture CDLA, organisatoren, Gemeenteblad CC-0) |
| `SEO-GEO-PLAN.md` | Plan voor vindbaarheid; fase 0, 1 en een deel van 2 zijn gedaan (zie onder) |
| `sources/` | Per marktorganisator: voorwaarden, robots.txt, hoe de uitlezer werkt; `organisatoren.md` = wie nog niet |
| `app/README.md` | Alle commando's |

## Stack
- **Astro 6** (statisch) + één **React**-eiland (`App.tsx`) voor kaart, lijst, detail, dagplan en Jij; `/beheer` is een tweede eiland. Geen Tailwind, geen supabase-js: CSS-tokens uit het ontwerp, `fetch`.
- **MapLibre 6** met OpenFreeMap-tegels (positron); pins als DOM-markers, groepjes met `supercluster`, markten op dezelfde plek gestapeld (`stackMarkets`, badge met aantal).
- **Supabase** (eu-west-1, gratis plan): winkels, markten, favorieten, meldingen, bijdragen, beheerders, importlog, fouten, klikteller, tellers. RLS op alles.
- **Cloudflare Workers**: statische bestanden + cron (`app/worker/klok.js`). Zone snuffelkaart.nl in Cloudflare (Always HTTPS, min. TLS 1.2, redirect-regel www → root). `not_found_handling: 404-page`.
- **GitHub Actions** voor import, export, build en deploy (gestart door de klok).
- **Resend** voor inlogmails vanaf `inloggen@snuffelkaart.nl` (domein geverifieerd, EU).
- **Cloudflare Web Analytics** (cookieloos; token `CF_BEACON` in `app/.env` en als GitHub-variabele).
- Node 22.22 lokaal; daarom Astro 6. Vite 7 vastgezet via `overrides`.

## Code: waar zit wat
```
app/src/lib/          logica, met tests (vitest; 106 tests: npx vitest run)
  hours.ts            openingstijden: status nu / op een dag, intervallen
  filter.ts           filters, zoeken op naam én soort (KIND_WORDS), groupRows, stackMarkets
  plan.ts             dagplan: aankomsttijden (km incl. terugweg), slimste volgorde, dagvoorstellen
  model.ts            types, winkelsoorten (catOf), spotKey
  auth.ts             inloggen met code, sessie; api() wil het hele pad (rest/v1/…)
  bijdragen.ts        reviews, foto's, tijden; ohText (tijden leesbaar), errText
  klik.ts             klikteller (count_click) + anonieme tellers (tel, kmBucket, regio, placeOf)
  beheer.ts           voorbeoordeling wachtrij
  seo.ts              siteIndex (winkels, markten, plaatsen, organisatoren), thin(), PROVINCES, MARKET_KINDS
  sitedata.ts         data voor de statische build, SITE, prov (provincie per plaats)
app/src/components/
  App.tsx             state: dag, filters, plan, view, sessie, tellers; kaart + paneel
  Views.tsx           ListView, DetailView (meldknop onthoudt melding), PlanView, MeView (Snuffelpas)
  MapView.tsx         kaart, pins, groepjes, route
  Bijdragen.tsx       review/foto/tijden, schermnaam (regel zichtbaar, NL-melding)
  Beheer.tsx          /beheer (tabbladen); Dashboard.tsx = dashboard + rapport per organisator
  MarktAgenda.astro   marktlijst (dit weekend + per maand + zoeken) voor de statische pagina's
  Soort.astro, ItemRow.astro
app/src/pages/        index, [stad], winkel/, markt/, organisator/, provincie/, markten, rommelmarkt-dit-weekend,
                      vlooienmarkten, rommelmarkten, kofferbakmarkten, sitemap.xml.ts, 404, privacy, voorwaarden, …
app/src/styles/       design.css (app) en app.css; beheer-stijlen staan in pages/beheer.astro
app/scripts/          imports: OSM, Overture, websitetijden, markten (14 organisatoren), Gemeenteblad, provincies, db push/export
app/public/data/      places.json, markets.json, extra.json, provincies.json (gegenereerd; CI commit ze)
app/public/           _headers (noindex alleen op workers.dev), _redirects (88× 301), robots.txt, badge.svg, og.png
supabase/migrations/  schema; supabase/tests/rls.sql
.github/workflows/    nachtelijk, winkels, controle, backup
```

## Gegevens
- **Winkels:** 3694 (OSM 1042 + Overture 2652). 1104 met openingstijden (OSM, eigen website, of bezoekers). Dubbelen met dezelfde naam op (bijna) dezelfde plek worden bij de export samengevoegd (`dedupe` in `scripts/db.mjs`).
- **Markten:** 274 komende: 14 organisatoren (zie `sources/`) + 78 uit het Gemeenteblad (gekeurd in /beheer). Entree uitgelezen bij o.a. Don Events en IJ-Hallen; Animo noemt geen bezoekersprijs.
- **Plaatsnamen samengevoegd** (`placeNames`): 's-Gravenhage → Den Haag e.d.; oude adressen in `_redirects`.
- **Provincie per plaats** via PDOK reverse (`scripts/provincies.mjs`, nachtelijk alleen nieuwe plaatsen).
- **Openingstijden 21 dagen vooruitgerekend** bij de export.
- **Statusbestand** (`rpc/market_status`): afgelastingen binnen minuten zichtbaar, ook op een oude build.
- **Imports overschrijven nooit met de hand vastgezette velden** (`locked`).

## Wat de app kan (bezoeker)
- Kaart + lijst (bottom sheet op mobiel, versleepbare zijbalk op desktop; tabbalk past zich aan de breedte aan).
- Pil "Rond Zwolle · Nu" voor plek en moment; lijst op afstand in secties (nu open, markten, tijden onbekend met oproep om tijden door te geven). Regel: status · plaats (of straat als de plaats al bekend is) · soort.
- Zoeken op naam of soort ("antiek", "vintage", "kofferbak"); plaats of postcode via Waar (PDOK). Filters: soort (tik = alleen deze), alleen open, gratis, overdekt, bewaard.
- Detail winkel/markt: tijden, bron + controledatum, route/bel/website, "Ook op deze plek" bij markten, meldknop (anoniem; onthoudt op het apparaat dat je al meldde).
- Dagplan als kassabon, "Maak een dag voor me", onderweg-stand. Deeplink `/?open=<id>&plan=1` zet een plek in Mijn dag.
- Jij = Snuffelpas: stempels voor bijdragen, schermnaam, bewaard, mini-bon, account (uitloggen en verwijderen apart), "Mis je een plek?" (mail).
- Inloggen met een code per mail; favorieten synchroniseren. Bijdragen: reviews, foto's, openingstijden via /beheer.
- PWA, offline met de laatst geladen stand.

## Statische pagina's (SEO)
- ±530 plaatsen (met "Open dit weekend"), 3694 winkels (live open/dicht, route, "Plan in Mijn dag", "Review, foto of tijden doorgeven"), 274 markten (Event-JSON-LD).
- `/markten/`, `/rommelmarkt-dit-weekend/` (per provincie), `/provincie/<naam>/` (12), `/vlooienmarkten/`, `/rommelmarkten/`, `/kofferbakmarkten/`, `/organisator/<naam>/` (14, met badge).
- Dunne winkelpagina's (Overture zonder tijden/website/telefoon, sloop, pandjeshuis: 497) hebben noindex en staan niet in de sitemap; op de kaart wel.
- Sitemap 4045 adressen; robots.txt sluit `/beheer`, `/data/` en `/*?` uit, behalve `/organisator/` (badge-links `?via=badge`).
- Links naar andere sites openen in een nieuw tabblad (route en bellen niet).
- Lighthouse (mobiel): statische pagina's 99; de kaart-app op de voorpagina ±48–70 (MapLibre en 3700 winkels omrekenen). Echte winst vraagt server-side lijst en pins als kaartlaag; pas doen als Search Console erom vraagt.

## Meten (alles anoniem, zie privacy "Wat we tellen" en DECISIONS)
- **Klikteller** (`clicks`, rpc `count_click`): per dag en plek: bekeken, in dagplan, gedeeld, route, website, gebeld.
- **Tellers** (`tellers`, rpc `tel`): paginabezoek, badge, afstand (4 groepen), gekozen plaats, regio (vak 0,1°), filters, uur van openen, dagplan, zoeken zonder resultaat. Nooit IP, account, getypte tekst of exacte plek; niets op het apparaat om te herkennen.
- **Dashboard** in /beheer (eerste tabblad): kerncijfers met verloop, heatmap uur × dag, regio's met aanbod, plaatsen, afstand, filters, dagplannen, organisatoren → rapport per organisator om te printen (aantallen onder 5 als "<5"). Leest via rpc `beheer_tellers` (alleen beheerders).

## Beheer (`/beheer`)
Dashboard, wachtrij, bijdragen, meldingen, kandidaten (Gemeenteblad), markten deze week, winkels, bronnen, klikken, moderatielog. Beheerders in tabel `admins`.
**Let op:** elke letter is een sneltoets (A = goedkeuren). Nooit typen zonder gefocust invoerveld. Z draait een besluit 10 s terug.

## Uitrollen en automatisering
- **Klok** (`worker/klok.js`, cron elk kwartier) start de workflows via `workflow_dispatch` met secret `GITHUB_TOKEN` (draait sinds 30 okt).
  - `nachtelijk.yml`: 02:30 UTC alles (markten → Supabase → Gemeenteblad → export → provincies → test → build → deploy); elk kwartier alleen export + deploy als er in beheer iets veranderde. Data-commit met rebase-en-opnieuw bij een geweigerde push.
  - `winkels.yml`: maandag, OSM + Overture + websitetijden. `controle.yml`: elk half uur van buitenaf. `backup.yml`: 02:00.
- **Met de hand uitrollen:** eerst `git pull --rebase` (CI commit verse data), dan `cd app && npm run build && npx wrangler deploy`, dan pushen. Rond :00/:15/:30/:45 kan een CI-deploy die vóór je push begon er ná jou overheen gaan: check `npx wrangler deployments list` en rol zo nodig opnieuw uit.
- Supabase-migraties: `set -a; . app/.env; set +a; npx supabase db push --linked --yes`. Auth-config: `npx supabase config push --yes`.

## Werkafspraken
- Freek schrijft Nederlands; antwoorden in het Nederlands. Freek beslist over product, juridisch, accounts, domein, moderatie en contact met buitenstaanders (agent stelt teksten op, Freek verstuurt).
- **Secrets** plakt Freek zelf (in `.env` of GitHub/Cloudflare). Nooit in chat, nooit in de repo, nooit door een agent in een webveld.
- **Geen diensten die een creditcard vragen** (dus geen R2).
- In tests: nooit globaal uitloggen via `/auth/v1/logout` op Freeks account; localStorage vooraf bewaren en daarna herstellen (en nooit sessiewaarden tonen); eigen tab en eigen preview-poort. Testaccounts alleen na akkoord, en daarna opruimen (account + bijdragen + foto's + meldingen).
- UX: rustig en passend, ook bij smalle zijbalk; nieuwe labels mogen het niet drukker maken.
- Elke keuze in `DECISIONS.md`. Ponytail-opmerkingen markeren bewuste vereenvoudigingen.

---

## Backlog

### Wacht op Freek
| Wat | Waarom |
|---|---|
| Organisatoren mailen over de badge | **Bewust uitgesteld** tot het dashboard echte aantallen per organisator laat zien (teksten liggen klaar) |
| Thomas09 en Supervlooi om toestemming vragen | ±70 markten/jaar in Friesland; los van de badge, kan nu al |
| Kandidaten in /beheer blijven keuren | Gemeenteblad levert elke nacht nieuwe aan |
| SSO (Google/Apple) aanzetten in Supabase | Verschijnt dan vanzelf in de app |
| HSTS aanzetten in Cloudflare | Lastig terug te draaien; pas als alles een tijd stabiel draait |
| KvK en adres in het colofon zodra er een onderneming is | Wettelijk |

### Eerstvolgende controles
- Nachtelijke verversing 31 okt: dubbelen weg, entree bij Don Events/IJ-Hallen, filtertelling in `tellers`.
- Over 1–2 weken Search Console: welke pagina's opgenomen, op welke zoektermen, 404's van voorbije markten (zo ja: doorsturen naar de stadspagina).
- Dashboard na een week: regio's met veel kijkers en weinig markten.

### Data
- Gemeenteblad-uitlezer (30 okt verbeterd: braderie alleen met tweedehands, alleen het item met de markt, plaats uit "te Gerwen", "tot en met", reeksen met het jaar achteraan). Nog: ontdubbelen op zaaknummer (aanvraag + besluit met andere datum).
- Meer organisatoren: de bruikbare zijn aangesloten; zie `sources/organisatoren.md`.
- Winkels zonder tijden (±2600): websitetijden lopen wekelijks; meer vraagt uitlezers per site.
- Foursquare OS Places als derde bron (Hugging Face-account nodig).

### Product
- "Markten bij jou dit weekend" als wekelijkse mail of push: pas als er bezoekers zijn om terug te halen.
- Snelheid voorpagina: lijst server-side, pins als kaartlaag (zie Lighthouse hierboven).
- "Dit weekend" als één keuze in Waar: besproken, voorlopig niet.
- Dagvoorstel op de kaart; vlag in /beheer om een winkel uit dagvoorstellen te houden.
- Sterren in de lijst; AI-voorbeoordeling van bijdragen; winkel/markt toevoegen door bezoekers; aanmeldformulier voor organisatoren.

### SEO / GEO (`SEO-GEO-PLAN.md`)
- Gedaan: domein, indexeren, Search Console + Bing, og:image, openingHoursSpecification, plaatsen/provincies/soorten/dit weekend/organisatoren.
- Nog: plaats + dag (`/utrecht/zondag/`), plaats + soort, feestdagen en Koningsdag (vanaf maart 2027), BreadcrumbList, IndexNow, `/llms.txt`, open-datapagina, outreach.

### Techniek en klein
- Astro 7 zodra Node ≥ 22.23.4.
- Twee plaatsen met dezelfde naam (Hengelo Ov/Gld) vallen samen.
- Offline-detectie bij slecht bereik; favoriet offline gewijzigd terwijl ingelogd gaat verloren bij sync.
- VoiceOver met de hand testen: bottom sheet en kaartpins.

### Later (M7)
België (Vlaanderen), Koningsdag-campagne, winkels/organisatoren laten claimen, vertrouwde bijdragers.
