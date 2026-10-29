# Snuffelkaart · overdracht

Stand 29 oktober 2026 (laatste commit `2bbbf9f`). Voor wie het project oppakt: wat er is, hoe het draait, wat nog openstaat.
Details en het waarom staan in `DECISIONS.md`; dit document vat samen en verwijst.

## In één alinea
Snuffelkaart is een PWA met alle kringlopen, tweedehandswinkels en rommelmarkten van Nederland op één kaart, met openingstijden die kloppen voor de dag dat je gaat en een dagplan als kassabon. Eigenaar en beslisser: Freek. Status: alles van M0 t/m M6 is gebouwd behalve de lancering zelf; draait als preview zonder eigen domein en is nog niet vindbaar.

- **Preview:** https://snuffelkaart.ironfront-relay.workers.dev (open link, noindex)
- **Repo:** deze map; de app staat in `app/`
- **Lokaal:** `cd app && npm install && npm run dev` → http://localhost:4321. `?nu=2026-10-31T09:10` zet de klok vast (de app is tijdsbewust).

## Documenten in de repo
| Bestand | Wat |
|---|---|
| `snuffelkaart-pva.md` | Plan van aanpak: doelen, mijlpalen M0–M7, besluiten D1–D9 |
| `DECISIONS.md` | Alle keuzes met reden, nieuwste onderaan. Bijwerken bij elke keuze |
| `BACKLOG.md` | Taken ronde 1–2 (verouderd na ronde 2; deze handoff is actueler) |
| `PRODUCT.md`, `DESIGN.md` | Product, toon, ontwerptokens. Bron voor de UI |
| `ontwerp/` | Oorspronkelijk ontwerp (`snuffelkaart-ontwerp.html`), testscript, en `voorstel/` (canvas met 6 schermen, zie onder) |
| `LICENTIES.md` | Licentie per datastroom (ODbL, Overture CDLA, organisatoren) |
| `SEO-GEO-PLAN.md` | Plan voor vindbaarheid in Google en AI-antwoorden |
| `M0-RAPPORT.md` | Uitkomst proof of concept |
| `sources/` | Per marktorganisator: voorwaarden, robots.txt, hoe de uitlezer werkt |
| `app/README.md` | Alle commando's |

## Stack
- **Astro 6** (statisch) + één **React**-eiland (`App.tsx`) voor kaart, lijst, detail, dagplan en Jij. Geen Tailwind, geen Motion, geen supabase-js: CSS-tokens uit het ontwerp, Web Animations, `fetch`.
- **MapLibre 6** met OpenFreeMap-tegels (positron) en eigen kleuren; clustering met `supercluster`.
- **Supabase** (eu-west-1, gratis plan) als bron van waarheid: winkels, markten, favorieten, meldingen, bijdragen, beheerders, importlog, fouten. RLS op alles, getest.
- **Cloudflare Workers** met statische bestanden + een cron-Worker (`app/worker/klok.js`).
- **GitHub Actions** voor import, export, build en deploy.
- **Resend** voor inlogmails (tijdelijk vanaf `snuffelkaart@runebinder.app`).
- Node 22.22 lokaal; daarom Astro 6 en niet 7 (vraagt ≥ 22.23.4). Vite 7 vastgezet via `overrides`.

## Code: waar zit wat
```
app/src/lib/          alle logica, met tests (vitest; 87+ tests)
  hours.ts            openingstijden: status nu / op een dag, intervallen
  filter.ts           filters (soort, open op de gekozen dag, gratis, overdekt, zoeken)
  plan.ts             dagplan: aankomsttijden, slimste volgorde, dagvoorstellen (dayProposals)
  model.ts            types, winkelsoorten (catOf)
  auth.ts             inloggen met code/link, sessie verversen
  bijdragen.ts        reviews, foto's, tijden insturen; Nederlandse foutteksten (errText)
  beheer.ts           voorbeoordeling wachtrij
  seo.ts, sitedata.ts statische pagina's, SITE-adres
app/src/components/
  App.tsx             state: dag, filters, plan, view, sessie; kaart + paneel
  Views.tsx           ListView, DetailView, PlanView, DagView, MeView (Snuffelpas), DayPick
  MapView.tsx         kaart, pins, groepjes, route
  Bijdragen.tsx       formulieren review/foto/tijden, schermnaam
  Beheer.tsx          /beheer
app/src/styles/design.css   alle UI-CSS (uit het ontwerp)
app/scripts/          imports: OSM, Overture, websitetijden, markten, Gemeenteblad, db push/export
app/public/data/      places.json, markets.json, extra.json (gegenereerd door de export)
supabase/migrations/  schema; supabase/tests/rls.sql (npm run test:rls)
.github/workflows/    nachtelijk, winkels, controle, backup
```

## Gegevens
- **Winkels:** 3701 (OSM 1049 + Overture 2652, ontdubbeld; OSM heeft voorrang). 1106 met bekende openingstijden (OSM, eigen website van de winkel, of doorgegeven door bezoekers). Soorten: kringloop, antiek, kleding/vintage, sloop, pandjeshuis/opkoop, vaste vlooienmarkt, overige tweedehands.
- **Markten:** 195 komende, uit de agenda's van 14 organisatoren (zie `sources/`) plus Gemeenteblad-kandidaten die in /beheer gekeurd worden. Status: bevestigd / gecontroleerd / nog niet bevestigd / afgelast.
- **Openingstijden 21 dagen vooruitgerekend** bij de export; de browser laadt geen tijdenbibliotheek. Zonder verse build worden tijden na 21 dagen "onbekend".
- **Statusbestand** (`rpc/market_status`): afgelastingen en verborgen winkels binnen minuten in de app, ook op een oude build.
- **Imports overschrijven nooit met de hand vastgezette velden** (`locked`). Veilige import: veel minder dan vorige keer → oude stand blijft.

## Wat de app kan (bezoeker)
- Kaart + lijst (bottom sheet op mobiel, versleepbare zijbalk op desktop; op desktop volgt de lijst de kaart).
- **De snuffellus** (29 okt, zie DECISIONS): tabbalk Kaart / Mijn dag / Jij; bovenaan de pil "Rond Zwolle · Nu" voor plek en moment (nu, of een dag + tijd binnen twee weken); de lijst op afstand, in secties (nu open, gaat nog open, tijden onbekend…). Het dagplan heeft een eigen dag, tijd en vertrekpunt. Desktop ≥ 1200 px: lijst, kaart en Mijn dag naast elkaar; iPad staand: zwevend paneel.
- Zoeken op naam; plaats of postcode (PDOK) via "Waar en wanneer", met recente plekken; filters open, soort, gratis, overdekt.
- Detail winkel/markt met tijden per dag, bron + controledatum, meldknop "Klopt er iets niet?" (zonder account).
- **Dagplan als kassabon**: vertrekblok, stops verplaatsen, dichte stop vervangen, terug rond, slimste volgorde, route naar Google/Apple, delen als link, en een onderweg-stand (volgende stop, hier ben ik, overslaan).
- **"Maak een dag voor me"**: tot 4 snuffelwinkels binnen 20 km die die dag zeker open zijn, geclusterd, "Ander voorstel" bladert. Startpunt: je locatie, anders gekozen plaats, anders Amersfoort. Geen sloop, opkoop of winkels die aan hun naam iets anders zijn.
- **Jij = Snuffelpas**: stempelkaart voor bijdragen, schermnaam kiezen/wijzigen, bewaarde plekken, mini-bon van het dagplan, gegevens downloaden, account verwijderen.
- Inloggen met een code van 8 cijfers per mail; favorieten synchroniseren.
- Bijdragen: reviews, foto's (verkleind, zonder EXIF) en openingstijden, via een wachtrij in /beheer.
- PWA, offline met de laatst geladen stand. Toegankelijkheid: axe 0 bevindingen.
- Statische pagina's: 537 plaatsen, 3701 winkels, 195 markten, sitemap, JSON-LD. Privacy, voorwaarden, colofon, "Hoe we controleren".

## Beheer (`/beheer`)
Wachtrij (Gemeenteblad-kandidaten, verdwenen markten), markten, winkels (soort, verbergen, pin verplaatsen), meldingen, bijdragen, bronnen (kapotte uitlezers, fouten bij bezoekers), moderatielog. Beheerders in tabel `admins`.
**Let op:** elke letter is een sneltoets (A = goedkeuren). Nooit typen zonder gefocust invoerveld. Z of de balk onderin draait een besluit 10 s terug.

## Uitrollen en automatisering
- **Push rolt niet uit.** Met de hand: `cd app && npm run build && npx wrangler deploy`.
- Workflows (alleen via `workflow_dispatch`, gestart door de klok):
  - `nachtelijk.yml`: 02:30 UTC markten → Supabase → export → test → build → deploy; elk kwartier alleen export+deploy als er in beheer iets veranderde.
  - `winkels.yml`: maandag, OSM + Overture + websitetijden → Supabase.
  - `controle.yml`: elk half uur, site en data van buitenaf controleren.
  - `backup.yml`: 02:00, versleutelde dump als GitHub-artifact (30 dagen). Herstel geoefend.
- **De klok draait nog niet**: de Worker mist secret `GITHUB_TOKEN`. Tot die er is, gebeurt er niets automatisch; data veroudert en tijden lopen na 21 dagen af.
- GitHub's eigen `schedule` startte in deze repo nooit; daarom de Cloudflare-cron.

## Werkafspraken
- Freek schrijft Nederlands; antwoorden in het Nederlands. Freek beslist over product, juridisch, accounts, domein en contact met buitenstaanders (agent stelt teksten op, Freek verstuurt).
- **Secrets** plakt Freek zelf (in `.env` of GitHub/Cloudflare). Nooit in chat, nooit in de repo, nooit door een agent in een webveld.
- **Geen diensten die een creditcard vragen** (dus geen R2).
- In tests: nooit globaal uitloggen via `/auth/v1/logout`; geen echte gegevens van Freek wijzigen; localStorage (`snuffel-plan`) na afloop herstellen.
- Preview blijft noindex tot het eigen domein.
- Elke keuze in `DECISIONS.md`. Klein houden: ponytail-opmerkingen markeren bewuste vereenvoudigingen en wanneer ze te upgraden.

## Ontwerpvoorstel (canvas)
Canvas op claude.ai (Design-artifact, versie 9): https://claude.ai/artifact/Fr75URXfGfJEqXbdANLVjs. Bestanden in `ontwerp/voorstel/project/*.dc.html` (Main, Desktop, DesktopJij, Dag, …). Gebouwd: dagkeuze, Jij als groot paneel / Snuffelpas, "Maak een dag voor me". Nog niet gebouwd: zie backlog.

---

## Backlog

### Wacht op Freek (accounts, secrets, besluiten)
| Wat | Waarom het ertoe doet |
|---|---|
| `GITHUB_TOKEN` op de klok-Worker (fine-grained, alleen deze repo, Actions read/write) | Zonder dit draait niets automatisch |
| Secrets in GitHub: `RESEND_API_KEY` (dagelijkse mail), `SUPABASE_ACCESS_TOKEN` (back-up + RLS-test), `BACKUP_WACHTWOORD` | Back-up en mail slaan zichzelf nu over |
| snuffelkaart.nl: nameservers bij Strato naar Cloudflare | Daarna: app koppelen, mail van eigen domein, Cloudflare Access voor /beheer, SEO fase 0 |
| SSO: Google- en Apple-login aanzetten in Supabase | Verschijnt dan vanzelf in de app |
| Testronde met 3–5 personen (`ontwerp/snuffelkaart-testronde.html`) | Bewijs voor M1/M3; nog nooit gedraaid |
| SEO-besluiten: AI-crawlers (zoek-bots toelaten, trainings-bots blokkeren?), Cloudflare Web Analytics aan?, adresstructuur vastleggen | Nodig vóór het domein live gaat |
| Thomas09 en Supervlooi: toestemming vragen? (disclaimer verbiedt overnemen) | Agent schrijft de mail, Freek verstuurt |
| Foursquare OS Places: Hugging Face-account | Derde bron voor winkels |
| KvK en adres in het colofon zodra er een onderneming is | Wettelijk (art. 3:15d BW) |

### Ontwerpvoorstel afbouwen (volgende stap in de app)
- **Plaatsoverzicht**: blok bovenaan de lijst met soortchips en aantallen per plaats.
- **Plaatskiezer in de kop** met recente plaatsen (localStorage).
- **Lijstsecties** "Nu open" / "Tijden onbekend".
- Dagvoorstel ook **op de kaart** tonen (pins + route).
- Vlag in /beheer om een winkel uit dagvoorstellen te houden (nu alleen soort + naamregels).
- Weekend als twee dagen tegelijk kiezen (pas als za/zo los kiezen onhandig blijkt).

### P2 uit de UX-review
- Rustiger kaart.
- Markten sorteren op datum en herhalingen samenvoegen.
- Dubbele winkels OSM/Overture die de ontdubbeling mist.
- **Gemeenteblad-uitlezer: datumfout** (inzagedatum wordt als marktdatum gelezen).

### Data
- Meer organisatoren (14 van ±20, lijst in `sources/organisatoren.md`).
- Winkelimport via het Geofabrik-extract in plaats van Overpass.
- `payment:*` uit OSM → pin-filter terug.
- Gemeenteblad: verzamellijsten geven ook andere evenementen; AI-extractie pas als afwijzen te veel werk wordt.

### Community (M5-rest)
- Sterren in de lijst.
- AI-voorbeoordeling van bijdragen (§7.2 plan) als losse, testbare module met testset.
- Winkel of markt toevoegen door bezoekers; aanmeldformulier voor organisatoren.
- Reviews voor markten (D6: voorlopig niet).
- Turnstile pas bij spam.

### SEO / GEO (`SEO-GEO-PLAN.md`)
- Fase 0 zodra het domein werkt: `SITE` aanpassen, noindex en `Disallow` weg, Search Console + Bing, IndexNow, og:image per pagina.
- Fase 1: openingHoursSpecification, BreadcrumbList, dateModified, WebSite/Organization; validatie in CI.
- Fase 2 (nov–dec): plaats + dag (`/utrecht/zondag/`), plaats + soort, provincie, markten dit weekend, feestdagen; Koningsdag-pagina's vanaf maart 2027.
- Fase 3–4: citeerbare openingszinnen, `/llms.txt`, open-datapagina, outreach (branche, gemeenten, communities, OSM-NL).

### Techniek en klein
- Astro 7 zodra Node ≥ 22.23.4.
- Eigen kaarttegels (D2, Protomaps) — alleen zonder creditcard-dienst.
- Offline-detectie bij slecht bereik (nu alleen `navigator.onLine`).
- Favoriet offline gewijzigd terwijl ingelogd gaat verloren bij sync.
- Focus terug naar de rij waar je vandaan kwam (nu naar de lijsttitel).
- VoiceOver met de hand testen: bottom sheet en kaartpins.
- Statische pagina's: geen kaartje op de stadspagina, twee plaatsen met dezelfde naam vallen samen.
- Niet geverifieerd in de laatste ronde: "vervang bestaand plan"-bevestiging in Maak een dag voor me.

### Later (M7)
Markten landelijk, België (Vlaanderen), Koningsdag-campagne, ads op publieke pagina's, winkels/organisatoren laten claimen, vertrouwde bijdragers.
