# Beslissingen

Keuzes en waarom. Nieuwste onderaan. "Freek" = besloten door Freek; anders voorlopig, terug te draaien.

## 2026-10-27 · Ontwerp M1
- **Ontwerp**: `ontwerp/snuffelkaart-ontwerp.html` (artifact) + `DESIGN.md` + `PRODUCT.md` zijn de bron voor de UI. Freek: akkoord als eerste versie.
- **Testronde M1 uitgesteld** (Freek). Het testscript (`ontwerp/snuffelkaart-testronde.html`) blijft klaar; draaien op de echte app in plaats van het prototype.

## 2026-10-27 · Eerste bouw
- **Volgorde** (Freek): app-skelet in de echte stack, gevoed met echte OSM-kringlopen uit de proefregio. Combineert M0-vraag "klopt de data?" met M2-kernreis.
- **Stack** (Freek): Astro + React-eiland voor de kaart (§14.1). Code in `app/`.
- **Astro 6.4.8, niet 7**: Astro 7 eist Node ≥ 22.23.4; deze machine draait 22.22.0. Upgraden naar 7 is een kleine stap zodra Node is bijgewerkt.
- **Kaarttegels voor nu** (Freek): OpenFreeMap (positron) met eigen kleuren eroverheen. D2 (eigen PMTiles) blijft open.
- **Geen Tailwind (voorlopig)**: de ontwerptokens uit `DESIGN.md` staan al als CSS custom properties; het prototype-CSS is direct over te nemen. Tailwind toevoegen als het team dat wil; het plan noemde het als voorstel.
- **Geen Motion-library (voorlopig)**: CSS-transities en Web Animations dekken alle bewegingen uit het ontwerp. Toevoegen als de bottom sheet op echte telefoons niet goed genoeg voelt (§14.13).
- **Clustering**: `supercluster` met HTML-markers, zodat pins exact de ontworpen vorm en animaties hebben. Grens: ~30 px, zoals in het ontwerp.
- **Openingstijden**: OSM-syntax via de `opening_hours`-bibliotheek, met Nederlandse feestdagen (`PH`).
- **Data in de browser**: één JSON (`public/data/places.json`), lokaal gefilterd (§6.1). Geen server.
- **Markten**: eerst verzonnen voorbeelden; sinds taak 14 echte markten uit de agenda van organisatoren (zie onder). `app/src/lib/markets.ts` blijft alleen voor de tests.
- **OSM-ophalen**: Overpass met een rechthoek om Utrecht + Gelderland (de provinciefilter time-out op de publieke servers). De import knipt daarna precies op de provinciegrenzen (CBS via PDOK); de echte import gaat via het Geofabrik-extract (§5.1).
- **Vite 7 vastgezet** (`overrides` in package.json): Vitest 5 trok Vite 8 binnen, wat met Astro 6 de React-plugin breekt.
- **MapLibre niet voorbundelen in dev** (`optimizeDeps.exclude`): MapLibre 6 laadt zijn worker relatief; voorbundelen breekt dat.
- **Openingstijden vooruitgerekend** (21 dagen) bij de import i.p.v. in de browser: scheelt ±160 kB gz en maakt elke statuscheck een opzoeking. Gevolg: zonder verse build worden tijden na 21 dagen "onbekend"; de nachtelijke build (§6.1) voorkomt dat.
- **MapLibre laadt lui** (dynamic import): eerste weergave ±90 kB gz JS, kaart (±300 kB gz) daarna.
- **Pin-filter (pinnen) weggelaten**: de OSM-import bevat (nog) geen betaalmethoden. Terug als `payment:*` wordt meegenomen.

## 2026-10-27 · Locatie en zoeken
- **Plaats zoeken via PDOK Locatieserver** (`suggest`, woonplaatsen + postcodes): open, geen sleutel, CORS open, matcht op een begin ("utr"). Rechtstreeks uit de browser; geen eigen server nodig. Een kale postcode van 4 cijfers wordt één plek.
- **Gekozen plaats wordt bewaard** op het apparaat (`snuffel-plek`), **GPS-locatie niet** (belofte in het welkom). Wie al toestemming gaf, krijgt de locatie stil opnieuw bij openen.
- **Welkom inline in het paneel**, geen pop-up (A10). Kaart toont tot die tijd Amersfoort, niet de hele regio zoals in het ontwerp; aanpassen als het testen dat vraagt.

## 2026-10-27 · OSM opschonen (§14.4)
- **Knippen op provinciegrenzen** Utrecht + Gelderland (CBS `provincie_gegeneraliseerd` via PDOK). De rechthoek gaf 178 winkels buiten de regio (Amsterdam, Zwolle, Duitsland). Gegeneraliseerde grens: een winkel vlak op de grens kan aan de verkeerde kant vallen; acceptabel voor de proef.
- **"Kringloop" alleen als we het weten** (naam of keten: Het Goed, Woord en Daad, 2Switch, Ecokring…). Onbekende naam = "tweedehandswinkel". Liever bescheiden dan een belofte die niet klopt (principe: betrouwbaar).
- **Goede doelen** = `shop=charity` of een bekende keten (Dorcas, Terre des Hommes, Leger des Heils…).
- **Weggelaten**: alleen winkels met nieuwe spullen (wereldwinkels, Unicef). Dumpstores, vintage, opkopers e.d. blijven (Freek), als **tweedehandswinkel**: eigen pruimkleur en kleerhanger-icoon, plus een uitleg in het detail.
- **Handmatige uitzonderingen** per OSM-id in `FIXES` (`scripts/fetch-osm.mjs`), met reden. Voorkeur: de fout in OSM zelf verbeteren, dan profiteert iedereen.

## 2026-10-27 · Bewegingen (taak 10)
- **Nog steeds geen Motion-library**: Web Animations API + CSS-keyframes uit het ontwerp dekken alles (FLIP, pins, groepjes, route). JS-animaties checken zelf `prefers-reduced-motion` (`reduced()` in `ui.tsx`); CSS-animaties doet de mediaquery.
- **Lijst → detail met View Transition** (alleen de naam vliegt); browsers zonder ondersteuning openen gewoon, met de schuifanimatie van de view.
- **Pins vallen alleen in bij nieuwe gegevens** (filter, eerste keer laden), niet bij pannen: anders blijft de kaart onrustig bewegen.
- **Route tekent zich alleen als hij verschijnt** (dagplan openen), niet bij elke wijziging van de stops.

## 2026-10-27 · Overture als tweede bron (§5.1)
- **Aanleiding**: in Nunspeet stonden 2 van de 3 kringlopen niet in OSM (alleen als kaal adrespunt). Overture had ze alle drie.
- **Freek: zoveel mogelijk data.** Alle tweedehandscategorieën uit Overture (ook antiek, kleding, schroot, pandjeshuis, vaste vlooienmarkt) plus alles met "kringloop" in de naam. De nadere soort staat erbij (`sub`).
- **OSM heeft voorrang**; Overture vult aan. Ontdubbelen: < 100 m, of < 400 m met een gedeeld naamwoord. Binnen Overture wint de hoogste betrouwbaarheid. Permanent gesloten eruit.
- **Eerlijk in de app**: Overture-winkels hebben geen openingstijden (gestippeld, nooit bij "Nu open"), tonen bron + "nog niet gecontroleerd" en een link om ze op OSM te zetten.
- **Licentie**: Overture Places = CDLA Permissive 2.0, bronvermelding, geen share-alike. Overture-records blijven herkenbaar gescheiden (`src: 'overture'`, id `ov-…`), zodat de ODbL-afweging (§12) per bron kan.
- **DuckDB** (`@duckdb/node-api`, dev) leest de Overture-parquet direct van S3, gefilterd op de rechthoek: ±10 s.
- **Foursquare OS Places** nog niet getest: vraagt een Hugging Face-account (Freek).

## 2026-10-27 · Heel Nederland (Freek)
- **Regio = heel Nederland**: knippen op de landsgrens (alle 12 CBS-provincies). Terug naar een paar provincies kan met `REGION` in `fetch-osm.mjs`.
- **Overpass in 3 × 3 vakken** met vier publieke servers als terugval: één NL-query loopt in een time-out. Duurt ±10 min. De wekelijkse import gaat later via het Geofabrik-extract (§5.1).
- **Resultaat**: 3701 winkels (OSM 1049, Overture 2652); 895 kringlopen, 194 goede doelen, 2612 overige tweedehands. Tijden bekend: 16%.
- **Databestand 243 kB gz** (ingekorte Overture-id's, lege velden weg, 5 decimalen). Werkbaar voor de PoC; bij groei opknippen per regio of tegels (§6.1).

## 2026-10-27 · Openingstijden van de eigen website (taak 19)
- **Bron**: de website van de winkel zelf (feiten, met bronlabel "gelezen op" + link). Geen gidssites van anderen (databankenrecht), geen sociale media.
- **Regels, geen AI (nog)**: `scripts/hours-from-web.mjs` herkent Nederlandse notaties en slaat blokken over met inname/inbreng, kantoor, telefoon, feestdagen of datums. **Bij twijfel niets**: twee verschillende blokken, een halve lijst, of te weinig dagen. Een fout "dicht" is erger dan "onbekend".
- **Ketenpagina's tellen niet**: deelt meer dan één winkel dezelfde pagina (bijv. `/contact` van het hoofdkantoor), dan nemen we de tijden niet over (dat waren kantoortijden).
- **Netjes lezen**: robots.txt, eigen User-Agent met contact, per domein na elkaar met pauze, ≤ 3 pagina's per winkel, cache 7 dagen.
- **Steekproef** (60 sites): 1 van 3 gecontroleerde uitkomsten was fout door inbrengtijden, 1 door een halve lijst; beide afgevangen en als test vastgelegd. Grotere steekproef volgt na de volle run.

## 2026-10-27 · Eerste echte markten: Don Events (taak 14)
- **Bron**: eigen agenda van Don Events (±40 markten, heel NL). robots.txt en voorwaarden gecontroleerd en vastgelegd in `sources/donevents.md`.
- **Alleen feiten**, per markt van hun eigen marktpagina: datum (ook "7 & 8 nov" en "2e paasdag 2027"), "geopend van … tot …", volledig adres (PDOK → exacte plek), kramen, kraamhuur. Status **gecontroleerd** (nooit "bevestigd"), met link naar hun pagina (kraam boeken, doorgaan bij slecht weer).
- **Niet raden**: binnen/buiten onbekend als de hal het niet zegt; entree "staat niet in de agenda"; zonder adres een pin op de plaats en "precieze plek staat bij de organisator". Losse tijden op de pagina negeren we (dat waren opbouw- en inbrengtijden); dan de tijd uit hun kalender.
- **Buiten NL** (België, Duitsland) vallen af: PDOK kent ze niet.
- **Veilige import**: 0 markten of minder dan de helft van vorige keer → oude bestand blijft (`--force` om toch te schrijven).
- **Geen voorbeeldmarkten meer in de app**: lukt het laden niet, dan geen markten, nooit verzonnen.

## 2026-10-27 · Meer organisatoren, websitetijden aangescherpt, PWA
- **Organisatoren** (onderzoek in `sources/organisatoren.md`): Don Events, Wildro, Bureau VAC en Van Aerle uitgelezen → 102 markten. Elk met eigen bronbestand, test met opgeslagen pagina's, en veilige import **per organisator** (gaat er één mis, dan blijft zijn vorige stand staan). Thomas09 en Supervlooi verbieden verveelvoudigen in hun disclaimer: niet zonder toestemming (Freek beslist over contact).
- **Entree pas "gratis" zonder bedrag** (Van Aerle: "€ 6 …, Gratis Parkeren"). Markten zonder tijden tonen "tijden bij de organisator" en krijgen een aandachtspunt in het dagplan.
- **Websitetijden, twee extra veiligheden** (steekproef 2: parser 0 fouten, 2 fouten uit de brondata): vaste vlooienmarkten krijgen geen weektijden; noemt de pagina alleen postcodes uit een andere buurt (eerste 3 cijfers), dan is het waarschijnlijk een andere winkel of het hoofdkantoor. Exact vergelijken was te streng (bron-postcodes wijken een paar huizen af).
- **Resultaat**: 532 winkels met tijden van hun eigen website; totaal 30% met tijden (was 16%).
- **PWA**: manifest, eigen icoon (prijskaartje op kassa-inkt), service worker alleen in de gebouwde site. App en gegevens werken offline met de laatst geladen stand ("Je bent offline. Je ziet de gegevens van …"); kaarttegels die je zag blijven bewaard (max 1500). Getest met de server uit. "Zet op beginscherm" bij het dagplan (Android: echte installatievraag; iPhone: uitleg via Deel).
- **Testtijd zichtbaar**: met `?nu=` staat rechtsboven "Testtijd: … · naar nu".
- **Groepjes** tonen nu kringloop / tweedehands / markt in hun eigen kleur.

## Standaard alles zien, tijd als filter (2026-10-27)

- **Wat**: de lijst en kaart starten met alle winkels en markten. "Nu open", "Vandaag", "Dit weekend" en "Kies datum" zijn aan/uit-chips; nog eens tikken zet het filter uit. Elke regel blijft zeggen of een winkel nu open is (of wanneer hij opengaat) en op welke dag een markt is.
- **Waarom**: Freek: "je moet ook gewoon alle winkels / markten kunnen zien". Het tijdsbewuste startpunt (doordeweeks "Nu open") verborg 's avonds bijna alles.
- **Pins bij uitzoomen**: markers hielden hun positie niet omdat `className` de klasse `maplibregl-marker` (position:absolute) wiste. Nu `classList`.
