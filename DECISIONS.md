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

## Preview op Cloudflare (2026-10-27)

- **Waar**: https://snuffelkaart.ironfront-relay.workers.dev, account van Freek. Uitrollen: `npm run build && npx wrangler deploy` in `app/`.
- **Workers, niet Pages**: Cloudflare stuurt nieuwe projecten naar Workers met statische bestanden (`wrangler.jsonc`, geen eigen code). Zelfde resultaat, gratis.
- **Open link** (Freek): wie de link heeft, kan erin. Niet vindbaar: `X-Robots-Tag: noindex` via `_headers` en `robots.txt` met `Disallow: /`. Achter een login (Cloudflare Access) kan later.
- **MapLibre-worker**: MapLibre 6 zoekt `maplibre-gl-worker.mjs` naast zijn eigen bestand; na bundelen staat die er niet en blijft de kaart leeg. We wijzen hem aan met `setWorkerUrl` en een `?url`-import.

## Licentieanalyse M0 (2026-10-27)

- **Analyse**: `LICENTIES.md`, per datastroom wat de licentie is, waar het landt en wat we moeten doen.
- **D4: OSM-afgeleide data accepteren onder ODbL** (Freek). Vermelding met downloadlink in de app; `public/data/LICENTIE.txt` naast het bestand. Het openbare `places.json` is voor het OSM-deel een afgeleide database; velden die we bij OSM-winkels aanvullen (Overture-website/telefoon, websitetijden) gaan daarin mee. Markten vallen er niet onder (geen OSM, plek via PDOK).
- **Organisatorsites**: databankenrecht beschermt verzamelen, niet maken (HvJ 2004), maar websitevoorwaarden kunnen hergebruik toch beperken (HvJ *Ryanair* 2015). Daarom blijft de voorwaardencheck per site nodig.

## Winkelsoorten met eigen kleur, icoon en filter (2026-10-27)

- **Wat** (Freek): zeven soorten (goede doelen telt als kringloop, zie onder), elk met eigen kleur en icoon op pin, tegel en groepje: kringloop, goede doelen, antiek en brocante, kleding, sloop en restpartijen, pandjeshuis, vaste vlooienmarkt, overige tweedehands. Filter "Soort" zet soorten aan/uit; standaard alles aan.
- **Indeling**: `catOf` in `model.ts`. Een kringloop blijft een kringloop, ook als Overture er "antiek" bij zet. Vaste vlooienmarkt in de marktkleur, maar als vierkant (winkel). Overige tweedehands neutraal leigrijs.
- **Kleuren**: één token per soort (`--cat-*`), gelijke lichtheid, eigen tint, apart voor donker. Iconen gift, vase, hammer, gem naar Lucide (ISC).
- **Typeschakelaar** heet nu "Winkels" in plaats van "Kringlopen"; tellers ook.
- **Goede doelen = kringloop** (Freek, 2026-10-28): voor de bezoeker hetzelfde. Eén soort, blauw met prijskaartje; `kind: 'goede-doelen'` blijft in de data.

## Nachtelijke verversing (2026-10-28)

- **Waarom**: openingstijden zijn 21 dagen vooruitgerekend; zonder nieuwe build wordt daarna alles "onbekend". En markten veranderen dagelijks.
- **Hoe**: GitHub Action `nachtelijk.yml` (03:30): markten opnieuw uitlezen, tijden vooruitrekenen, tests, build, `wrangler deploy`, en de nieuwe `public/data` terug in de repo (zo vergelijkt de veilige import met gisteren).
- **Tijden zonder OSM opnieuw op te halen**: `fetch-osm.mjs` schrijft de bron van elke openingstijd (OSM of eigen website) naar `app/data/hours.json`; `refresh-hours.mjs` rekent daarmee vooruit. Niet in de browser.
- **Niet nachtelijk**: OSM, Overture en websitetijden. Die import blijft met de hand tot de Geofabrik-import (§5.1).
- **Cloudflare**: account-id staat in `wrangler.jsonc` (geen geheim); het API-token als secret `CLOUDFLARE_API_TOKEN` in GitHub (Freek).

## Overige tweedehands uitgesplitst (2026-10-28)

- **Kringloop ook volgens de eigen website** (`scripts/soort.mjs`): staat "kringloop" in het adres van hun eigen site (kringloopteddy.eu, opnieuwenco.nl/kringloopwinkels/…), dan is het een kringloop. Gidssites (allekringloopwinkels, kringloop-info) tellen niet. Plus ketens op naam: Opnieuw & Co, Estafette, Kringloper, Kringloods.
- **Nadere soort uit de naam**, alleen als Overture er geen gaf: vintage/thrift/fashion/boetiek → "Vintage en kleding"; Used Products, Cash Converters → "Opkoop en pandjeshuis"; bouwmaterialen, houtbank → "Sloop en restpartijen".
- **Resultaat**: overige tweedehands 1068 → 824; kringloop 1089 → 1164, vintage en kleding 283 → 399, opkoop 22 → 72. De rest heeft geen signaal in naam of site; daarvoor is de beheerqueue (M2).

## M2 deel 1: Supabase als bron van waarheid (2026-10-28)

- **Project** `snuffelkaart` (eu-west-1, gratis plan, org via Vercel; Freek). Schema in `supabase/migrations`, uitrollen met `npx supabase db push --linked`.
- **Eén document per record** (`data jsonb`, zelfde vorm als de JSON voor de app) plus kolommen waarop we filteren of die beheer wijzigt: `status`, `date`, `source`, `locked`. Typed kolommen en PostGIS pas als een query ze nodig heeft.
- **Imports overschrijven nooit met de hand gezette velden** (`locked`, ook voor `status`). Markten die van de site van de organisator verdwijnen, worden "nog niet bevestigd" (niet weg) als die organisator die nacht vers is gelezen.
- **Export** maakt `places.json` en `markets.json` in de oude vorm; de app verandert niet. Tijden rekent de export vooruit uit `oh`; `hours.json` en `refresh-hours.mjs` zijn weg.
- **Terugdraaien**: elke nachtelijke export staat in git (bot-commit). Een eerdere stand terugzetten = dat bestand pushen.
- **RLS** op alle tabellen; publiek leest niets (getest met de publishable key). Beheerders (`admins`) lezen en wijzigen via `is_admin()`. Scripts gebruiken de secret key.
- **Geen supabase-js in de scripts**: REST met `fetch` volstaat.

## M2 deel 2: beheer (2026-10-28)

- **/beheer** (noindex, niet in de service worker): inloggen met een link per e-mail (Supabase Auth). Beheerders: info@freekvanderhorst.com en freekfc@gmail.com (tabel `admins`; Freek). De ingebouwde mail van Supabase stuurt alleen naar leden van het Supabase-team (Gmail); voor andere adressen is eigen SMTP nodig. Noodweg: `node scripts/inloglink.mjs` opent een inloglink zonder mail. Wie geen beheerder is, ziet niets (RLS, getest).
- **Markten**: status zetten (bevestigd, gecontroleerd, nog niet bevestigd, afgelast met reden, kandidaat afwijzen). **Winkels**: zoeken, soort wijzigen, verbergen. Alles wat je zet, komt in `locked`: een import overschrijft het niet.
- **Zichtbaar binnen ±15 minuten** (2026-10-28): de workflow draait ook elk kwartier en exporteert, bouwt en rolt alleen uit als er in Supabase een rij is met `updated_at` na de laatste export (beheer zet `updated_at`, imports niet). ponytail: polling via GitHub-cron (publieke repo, gratis; cron kan wat achterlopen). Sneller kan met een Supabase-webhook → `repository_dispatch`, maar dan moet er een GitHub-token in Supabase.
- **Geen supabase-js**: login (`/auth/v1/otp`) en data (REST) met fetch; na een uur opnieuw inloggen.
- **Publishable key in de build** via `astro.config.mjs` (`SUPABASE_ANON_KEY` uit `.env` of het secret in GitHub); de secret key komt nooit in de site (gecontroleerd in `dist`).
- **Supabase Auth-URL's** in `supabase/config.toml` (`npx supabase config push`); alleen wat daar staat wordt gezet.

## M2 deel 3: Gemeenteblad-uitlezer (2026-10-28)

- **`scripts/fetch-gemeenteblad.mjs`**, elke nacht (publicaties van de laatste 3 dagen): SRU-zoekdienst, regelgeving eruit op rubriek, per toekomstige datum één **kandidaat** (`status: kandidaat`, `source: gemeenteblad`). Nooit direct op de kaart: keuren in /beheer (tekstfragment en link erbij).
- **Regels, geen AI**: datums met jaar (termijnen als "bezwaar … tot en met" niet), eerste tijdvak, soort uit de zoekterm, plek uit de coördinaat in de metadata, anders het midden van de gemeente (PDOK, `exact: false`). Hooguit ruim een jaar vooruit.
- **Dubbel** = zelfde dag binnen 1 km van een bekende markt (organisator of eerdere publicatie): overslaan. Bestaande kandidaten worden nooit overschreven, ook afgewezen niet (`ignore-duplicates`).
- **Bekend zwak punt**: verzamellijsten (Landgraaf, Rhenen) geven ook datums van andere evenementen (Sinterklaas). De beheerder wijst die af; AI-extractie pas als het afwijzen te veel werk wordt.

## Beheer volgens het ontwerp (2026-10-28)
- **/beheer heeft de opbouw uit het ontwerp (§07):** zijbalk (Wachtrij, Kandidaten, Markten deze week, Winkels, Bronnen, Moderatielog), lijst en detail. Sneltoetsen: J/K bladeren, A goedkeuren, U nog niet bevestigd, E aanpassen, R afwijzen of afgelasten. Bij R is een reden verplicht; die staat in het moderatielog.
- **Wachtrij** = kandidaten uit het Gemeenteblad en markten die van de site van hun organisator verdwenen (niet vastgezet). Kritiek = binnen 7 dagen.
- **Voorbeoordeling met vaste regels** (`src/lib/beheer.ts`): dubbel (zelfde dag, < 1 km van een markt op de kaart) → waarschijnlijk afwijzen; verleend of melding, met plek en tijden → waarschijnlijk goed; anders twijfel. ponytail: de AI-voorbeoordeling (M5) vervangt dit achter dezelfde vorm.
- **Nog niet:** meldingen, reviews, foto's en wijzigingsvoorstellen (M5); een fout per uitlezer (de nachtrun gaat bij een fout door, maar legt hem nog niet vast); de pin verplaatsen.

## M3: accounts en favorieten (2026-10-28)
- **Zelfde Supabase-project** als beheer, tabel `favorites (user_id, item_id)` met RLS: alleen eigen rijen lezen, toevoegen en verwijderen; gasten niets (getest met twee gebruikers en anon). ponytail: §13 noemt een tweede project; pas splitsen als er een reden is (bijv. aparte staging).
- **Inloggen zonder supabase-js** (`src/lib/auth.ts`, gedeeld met /beheer): inloglink per e-mail; Apple en Google verschijnen vanzelf zodra ze in Supabase aan staan. De sessie blijft op het apparaat en wordt ververst met de refresh token.
- **"Jij"-paneel** (knop rechtsboven, ontwerp §05): bewaarde plekken (werkt zonder account), "Toon op de kaart", uitnodiging om in te loggen. Ingelogd: uitloggen, gegevens downloaden (JSON), account verwijderen (`delete_me()`, met favorieten via cascade). "Mijn locatie" zit nu bij de kaartknoppen (+, −, locatie).
- **Synchroniseren**: bij inloggen worden de favorieten van het apparaat samengevoegd met die van het account. Bij een latere start wint het account, zodat een favoriet die je elders weghaalde niet terugkomt. ponytail: een wijziging offline terwijl ingelogd gaat daardoor verloren.
- **Mail via Resend** (2026-10-28): SMTP in `supabase/config.toml`, sleutel als `RESEND_API_KEY` in `app/.env` (niet in git), Nederlandse mails in `supabase/templates/`. Tijdelijk vanaf `snuffelkaart@runebinder.app` (enige geverifieerde domein in Resend); overstappen = `admin_email` aanpassen zodra D1 een domein oplevert.
- **Inloggen met code** (2026-10-28): de mail bevat een code van 8 cijfers (ook in het onderwerp) naast de link. Reden: met de link kreeg Freek twee keer "invalid or expired", terwijl een nagespeelde link wel werkte; vermoedelijk liet Gmail de knop uit een oudere mail in hetzelfde gesprek zien (niet bewezen). Een uniek onderwerp voorkomt dat Gmail de mails samenvoegt, en de code werkt ook als de link in een andere browser opent (PWA). Mailgrens van Supabase opgehoogd van 2 naar 60 per uur.
- **Later (Freek)**: Google- en Apple-login (SSO).

## M4: betrouwbaar en veilig publiceren (2026-10-28)
- **Kapotte uitlezer wordt gemeld**: `fetch-markets` noteert per organisator een probleem (fout, of niets/veel minder dan vorige keer terwijl er markten waren). Die gaan mee in `import_runs`; `/beheer` toont ze onder Bronnen (rood getal), en de nachtrun eindigt rood zodat GitHub mailt. De rest is dan al uitgerold. Een bron die ruim een dag niet draaide, geeft ook een melding.
- **Gemeenteblad**: een datum direct na "voor/vóór" is een termijn, geen marktdag (Best, Dordrecht). Twee foute kandidaten automatisch afgewezen.
- **RLS-test** `supabase/tests/rls.sql` (`npm run test:rls`): RLS aan op elke tabel; gast leest en schrijft niets; gebruiker alleen eigen favorieten; beheerder leest alles en wijzigt markten/winkels, maar voegt geen beheerders toe en verwijdert niets. Draait in een transactie met rollback. Gecontroleerd dat hij faalt op een expres lek. Draait ook elke nacht in `backup.yml` (zodra SUPABASE_ACCESS_TOKEN in GitHub staat).
- **Statusbestand** (§6.1): `rpc/market_status` in Supabase, publiek leesbaar (security definer), met alleen id + status + reden van gepubliceerde markten in de komende 14 dagen en de id's van verborgen winkels (±2 kB). De app haalt het op bij openen, elke 5 minuten en bij terugkeer naar het tabblad, en legt het over de gebouwde data (`applyStatus`). Een afgelasting in /beheer staat zo binnen enkele minuten overal, ook op een oude build. Offline of onbereikbaar: de gebouwde data blijft gelden. ponytail: geen apart bestand op een CDN; Supabase is de cache-loze bron, ruim binnen het gratis quotum zolang het bezoek klein is. Een CDN-bestand (Worker/R2) pas bij veel verkeer.
- **Beheer achter Cloudflare Access**: nog niet. Access werkt per pad alleen op een eigen domein in Cloudflare; op workers.dev kan het alleen de hele site afschermen. Wacht op D1 (domein). Tot dan beschermen inloggen en RLS de gegevens; de pagina zelf bevat niets geheims.
- **Openingstijden-randgevallen getest** (`logic.test.ts`): over middernacht (vr 22–02 toont nu "sluit 2:00" in plaats van alleen "Open"; dat was een fout), precies op sluitingstijd, winter- en zomertijd (dag van 25/23 uur), feestdagen in het voorjaar. De opening_hours-bibliotheek telt Goede Vrijdag en 5 mei (elk jaar) als feestdag en 1e Paas-/Pinksterdag niet; bewust zo gelaten: "dicht" op Goede Vrijdag is de veilige fout (met de banner "bel even"), en 1e Paas-/Pinksterdag zijn zondagen.
- **Externe bron onbereikbaar** (handmatig nagelopen met een build tegen een niet-bestaand Supabase-adres): kaart, lijst, filters en "Jij" werken; statusbestand valt terug op de gebouwde data; inloggen geeft "geen verbinding met de inlogdienst" (was: "Failed to fetch"). PDOK-zoeken valt stil terug op niets; zonder kaarttegels blijft de lijst werken.
- **Back-up** (`backup.yml`): elke nacht `supabase db dump` (schema, en data van public + auth), versleuteld met AES-256 (openssl, wachtwoord in secret BACKUP_WACHTWOORD) als GitHub Actions-artifact, 30 dagen bewaard. **Geen R2**: dat vraagt een creditcard, en dat wil Freek niet. De repo is publiek, dus zonder wachtwoord is het artifact onbruikbaar. Versleutelen en ontsleutelen getest, ook dat een verkeerd wachtwoord wordt geweigerd. **Herstel geoefend** op 2026-10-28: dump teruggezet in een lege `supabase/postgres`-container; places 3701, markets 280, favorites 3, admins 2, import_runs 4, gelijk aan productie. De auth-tabellen konden daar niet terug (kaal image), wel in een nieuw Supabase-project; dat is het echte rampscenario. Zonder de secrets slaat de workflow zichzelf over (melding, geen rode run).

## Privacy en methode (2026-10-28)
- **/privacy en /hoe-we-controleren**: statische pagina's (layout `Tekst.astro`), gelinkt vanuit "Jij", het inlogscherm en de bronregel. Alleen beloven wat de app echt doet: geen herinneringsmails aan organisatoren, geen reviews/foto's, geen Foursquare (staan wel in het ontwerp). Contact: info@freekvanderhorst.com.
- **Lettertypen zelf gehost** (`public/fonts`, latin-subset): Google Fonts gaf het IP-adres van elke bezoeker aan Google. De app laadt nu alleen van de eigen server, OpenFreeMap (tegels), Supabase en, bij zoeken, PDOK.
- **Service worker v3**: elke pagina wordt onder haar eigen adres bewaard (eerder alles onder '/', waardoor de app offline als een andere pagina kon openen).

## Statische pagina's (2026-10-28)
- **Per plaats** (`/<plaats>/`, ≥2 winkels of markten: 536), **per winkel** (`/winkel/<naam-plaats>/`: 3701) en **per markt** (`/markt/<naam-datum>/`: 190), plus `/plaatsen/` en `sitemap.xml`. Gebouwd uit dezelfde `public/data` als de app (`src/lib/seo.ts`, getest), elke nacht opnieuw; ±10 s build, 74 MB.
- Inhoud: winkels met weektijden (feestdagen overgeslagen) en bron, markten in de buurt, veelgestelde vragen (zaterdag/zondag open), JSON-LD (Store, Event, ItemList). Marktpagina's lezen het statusbestand, dus een afgelasting klopt ook op een oude build.
- **Naar de app**: `/?open=<id>` opent een winkel/markt, `/?plek=…&lat=…&lon=…` zet de kaart op een plaats.
- **Nog niet vindbaar**: robots.txt blijft `Disallow: /` (+ noindex) zolang het de preview op workers.dev is. Open zetten = `SITE` in `src/lib/sitedata.ts` naar het echte domein, noindex en Disallow weg.
- ponytail: geen kaartje op de stadspagina (knop naar de app), geen provincie in het kruimelpad, twee plaatsen met dezelfde naam vallen samen.
- Kaart: de focus-animatie bij openen via een link werd onderbroken door de padding-animatie; die wacht nu als de kaart beweegt. (Let op bij testen in Chrome: in een achtergrondtabblad laadt de kaart niet, omdat requestAnimationFrame stilstaat. Dat is geen fout in de app.)

## Meldknop "Klopt er iets niet?" (2026-10-28)
- Bij elke winkel en markt; zonder account. Bezoeker kiest wat er niet klopt (+ optionele toelichting, max. 500 tekens).
- Gasten krijgen geen toegang tot de tabel `reports`; alleen `report()` (security definer) die het id controleert, de naam erbij zet en een rem heeft van 60 meldingen per uur voor iedereen samen. Geen IP of account opgeslagen (AVG). Per-bezoeker-rem pas als er spam komt.
- In /beheer: "Meldingen" met Afgehandeld, Bekijk op de kaart en (bij "gesloten") Winkel verbergen. De correctie zelf gaat via Winkels of Markten.
- OSM-link blijft ernaast ("Zelf aanpassen op OpenStreetMap"): wie het zelf kan, verbetert de bron.

## Winkels wekelijks automatisch (2026-10-28)
- `.github/workflows/winkels.yml`, maandag 00:30 UTC: OSM (Overpass), Overture (alleen bij een nieuwe release, gecachet), websitetijden (cache doorlopend, alleen ouder dan 7 dagen opnieuw) → `db.mjs push places`. De nachtelijke run zet het om 02:30 UTC op de kaart.
- Verdwijnt een winkel uit OSM én Overture, dan wordt hij **verborgen** met `gone` (niet gewist). Komt hij terug, dan weer actief. Met de hand verbergen of tonen in /beheer zet de status vast; de import blijft er dan af.
- Rem: zou een import meer dan 10% van de actieve winkels verbergen, dan schrijft hij niets (halve Overpass-uitkomst of ontbrekende Overture).
- /beheer → Bronnen waarschuwt als de winkelimport meer dan 8 dagen niet draaide.

## Beheer: pin verplaatsen, ongedaan maken, typen ≠ sneltoets (2026-10-28)
- Pin verplaatsen: coördinaten of een link van Google Maps/OSM plakken (`parseLatLon`, alleen binnen NL). Vastgezet (`lat`, `lon`); geen sleepkaart (later, als plakken te omslachtig blijkt).
- Elk besluit 10 seconden terug te draaien (balk onderin, of Z): vorige status, gegevens en vastgezette velden.
- Sneltoetsen (A/U/E/R/J/K) werken alleen als losse toets: letters binnen 350 ms na elkaar zijn typen. Aanleiding: typen terwijl de pagina laadde keurde per ongeluk een kandidaat goed.

## M6: offline getest (2026-10-28)
Getest met de productiebuild, server uit na één bezoek:
- **Werkt:** de kaart-app opent met alle winkels en markten van het laatste bezoek, favorieten en dagplan; "Nu open" rekent gewoon (tijden staan vooruitgerekend in de data); eerder bekeken pagina's (winkel, markt, plaats, privacy) openen.
- **Werkt niet, en zegt dat:** een pagina die je nog niet bekeek → eigen pagina "Geen verbinding" met link naar de kaart (was: foutpagina van de browser). Melden → "Versturen lukte niet: geen verbinding" (was: Engelse foutmelding).
- **Werkt niet:** zoeken op plaats of postcode (PDOK) geeft geen resultaten; inloggen geeft een nette melding; kaarttegels alleen van gebieden die je al bekeek.
- ponytail: de offline-banner leunt op `navigator.onLine`; bij heel slecht bereik ("wel verbonden, niets komt door") verschijnt hij niet. De app werkt dan wel met de bewaarde gegevens. Beter detecteren als testers het missen.
- Gebruiksvoorwaarden en colofon toegevoegd. Nog te doen bij een onderneming: adres en KvK-nummer in het colofon (art. 3:15d BW).

## M6: toegankelijkheid (2026-10-28)
- axe-core (WCAG 2.2 AA + best practices) op lijst, winkel, markt, meldformulier, dagplan, Jij, plaats-, winkel- en tekstpagina's en /beheer: **0 bevindingen** na deze ronde.
- Opgelost: geen landmarks in de app (paneel is nu `<main>`, dagplanbalk `<aside>`, kaart was al een region); `--fg-3` licht 0.55 → 0.53 (was 4,47:1, nu ≥ 4,6:1 op alle achtergronden); meldkeuzes waren role=radio met aria-pressed (nu gewone aan/uit-knoppen in een groep); tellerknoppen 21 → 24 px hoog; /beheer zonder `main` en `h1`; scrollend citaat in beheer niet met toetsenbord bereikbaar.
- Focus: na een schermwissel door de gebruiker gaat de focus naar de titel van het nieuwe scherm (schermlezer leest hem voor). Terug gaat naar de titel van de lijst, niet naar de rij waar je vandaan kwam (ponytail: rij onthouden als testers het missen).
- Niet automatisch te testen, nog met de hand te doen met VoiceOver op een telefoon: de bottom sheet slepen (alternatief: de greep is een knop) en de kaartpins (de lijst toont dezelfde winkels).

## M6: monitoring (2026-10-28)
- **Van buitenaf** (`controle.yml`, elk half uur): kaart laadt, `places/markets.json` < 36 uur oud, Supabase-statusbestand antwoordt. Rood = GitHub mailt.
- **Bij bezoekers**: JS-fouten (error, unhandledrejection) anoniem via `log_error()` → `client_errors` (tekst, pagina, browser; geen IP/account; 30 dagen; rem 200/uur, max. 3 per paginabezoek). In /beheer → Bronnen per fout gegroepeerd, en in de dagelijkse mail. Niet in dev.
- Geen Sentry e.d.: dit is genoeg om te zien dát er iets stukgaat; een bibliotheek pas als we stacktraces nodig hebben.
- **Gevonden bij het inrichten:** de geplande GitHub-runs (kwartier, nacht) zijn sinds het toevoegen (07:28 UTC) nog niet één keer gestart; alleen handmatige runs. Workflows staan aan, repo is publiek. Waarschijnlijk de bekende vertraging bij nieuwe repositories; `controle.yml` laat het zien als het zo blijft.

## M5: bijdragen van bezoekers: tijden, reviews, foto's (2026-10-28)
Besluiten (Freek): doorgegeven tijden zijn **van ons, apart van het open OSM-bestand**; bij bijdragen staat een **zelfgekozen schermnaam**; tijden, reviews en foto's **in één ronde**.
- **Eén tabel `contributions`** (kind tijden/review/foto, data jsonb, status nieuw/goed/afgewezen, reden). Eén wachtrij in /beheer → Bijdragen (J/K, A, R met verplichte reden, Z ongedaan maken). De inzender ziet status en reden bij Jij → Mijn bijdragen (DSA art. 17).
- **De database is de grens:** trigger controleert schermnaam, bestaande winkel, inhoud (sterren 1–5, tekst ≤ 1000, bezoekmaand niet in de toekomst en ≤ 3 jaar oud; tijden gezien ≤ 90 dagen geleden; foto in eigen map) en limieten (20 bijdragen, 10 foto's per dag). Zelf goedkeuren kan niet (status gaat bij elke wijziging door de gebruiker terug naar nieuw). Eén review per persoon per winkel; aanpassen = opnieuw keuren. RLS-test uitgebreid.
- **Foto's:** in de browser verkleind tot max. 1600 px WebP (EXIF/GPS verdwijnt), naar privébucket `fotos-nieuw` (eigen map). Goedkeuren = kopie naar openbare bucket `fotos`. Wat geen (geldige) bijdrage meer heeft, ruimt de export op (`orphan_photos()`): afgewezen, ingetrokken, account verwijderd, en het origineel na goedkeuring. Zo kan niemand onze opslag als gratis fotohosting gebruiken.
- **Publiceren:** goedgekeurd → export → `/data/extra.json` (tijden vooruitgerekend, reviews, foto-URL's met schermnaam). De app legt het over de winkels: tijden van bezoekers gaan voor OSM en website en tellen mee voor "Nu open"; bron "doorgegeven door X, gecontroleerd door ons". Statische winkelpagina's tonen ze ook (met AggregateRating in JSON-LD). Kwartierrun publiceert ook bij een besluit over een bijdrage.
- **Juridisch:** voorwaarden (regels, niet-exclusieve toestemming voor tonen, uitleg bij afwijzen, intrekken), privacy (schermnaam, bijdragen, foto's; weg bij account verwijderen), "Hoe we reviews controleren" (Omnibus: we controleren met de hand, niet of iemand er echt was; bezoekmaand verplicht; negatieve reviews niet verborgen, geen beloning). Download van je gegevens bevat nu ook bijdragen.
- **Getest van begin tot eind** (lokaal, echte database): review, foto en tijden insturen → Mijn bijdragen "in behandeling" → beheer: review en foto goedgekeurd, tijden afgewezen met reden → export → foto en review in de app, reden zichtbaar bij Mijn bijdragen. Testgegevens daarna verwijderd. axe: 0 bevindingen op de nieuwe schermen.
- **Nog niet:** sterren in de lijst; AI-voorbeoordeling (§7.2); Turnstile (alleen ingelogd + limieten volstaat voorlopig); markten reviewen (een markt is per datum; eerst winkels); winkel toevoegen.

## Klok: Cloudflare-cron in plaats van GitHub-planning (2026-10-28)
- GitHubs `schedule` startte in deze repository nooit (07:28–12:45 UTC nul geplande runs; geen storing bij GitHub; workflows geldig, handmatige runs slagen; uit/aan zetten hielp niet).
- Nu: `app/worker/klok.js` met Cloudflare-cron `*/15` (gratis, zelfde Worker als de site) start via workflow_dispatch: nachtelijk (modus kwartier, 02:30 UTC alles), controle (elk half uur), back-up (02:00), winkels (maandag 00:30). Alle `schedule`-triggers uit de workflows gehaald: één klok, niets dubbel.
- Nodig: secret `GITHUB_TOKEN` op de Worker (fine-grained, alleen deze repository, Actions read/write). Zonder token doet de klok niets (log-waarschuwing).
- Bijeffect: de Worker heeft nu code (`main`), maar elk verzoek gaat nog steeds rechtstreeks naar de statische bestanden.

## UX-ronde 1 na review (2026-10-28)
Review (impeccable critique, 26/40) → Freek koos: eerst het mobiele lijstscherm, alle P1's, kaart alleen olijfgroen weg.
- **Lijstscherm:** alleen zoeken + filters plakken bij scrollen (titel, tellers, meldingen scrollen mee). Halve stand toont nu ±2 winkels i.p.v. 1. Locatiebanner wordt na een gekozen plaats één regel.
- **Filters:** tijdchips vooraan (Nu open, Vandaag, Dit weekend, Kies datum), dan type, dan "Meer filters" (markt: gratis/overdekt; soort winkel). Rand van de chiprij vervaagt zodat je ziet dat hij doorloopt.
- **Groen:** `--open-soft` als vaste token; color-mix in oklch draaide de tint naar beige, waardoor "Bevestigd" op een waarschuwing leek.
- **Plandag:** met een dagplan voor een andere dag (en geen tijdfilter) tonen regels en suggesties de status op die dag. Wacht je bij de eerste stop > 45 min, dan stelt het plan met één tik een latere vertrektijd voor.
- **Tellers** in de kop tellen binnen 25 km van de gekozen plek (stond "893 nu open" bij "rond Amersfoort").
- **Sloop en restpartijen:** petrol i.p.v. olijfgroen (groen = alleen open). Greep van het paneel 24 px hoog (raakvlak).
- Nog open uit de review (P2): rustiger kaart, markten op datum en herhalingen samenvoegen, dubbele winkels OSM/Overture, datumfout Gemeenteblad-uitlezer (inzagedatum als marktdatum).

## Lijstbreedte versleepbaar (2026-10-28)
Op desktop/iPad (≥ 980 px) is de rand tussen lijst en kaart versleepbaar (300–680 px, kaart houdt ≥ 320 px), met pijltjestoetsen (±24 px) en dubbelklik = 400 px. Onthouden per apparaat (`snuffel-breedte`). CSS-variabele `--side` stuurt lijst, kaart, dagplanbalk en toast. MapLibre past de kaart zelf aan (ResizeObserver).

## Lijst volgt de kaart op desktop/iPad (2026-10-28)
Op ≥ 980 px toont de lijst alleen wat op de kaart in beeld is ("N plekken in beeld op de kaart"); pins blijven alles tonen. Niet bij zoeken op naam (landelijk) of "Bewaard". Leeg beeld → "Toon de dichtstbijzijnde" (kaart past zich aan de 5 dichtstbijzijnde aan). Telefoon niet: daar bedekt het paneel de kaart grotendeels.

## Eén dagkeuze: "Wanneer ga je?" (28 okt 2026)
- Niet iedereen snuffelt op zaterdag. Eén gekozen dag geldt overal: lijst, statussen, kaartpinnen, tellers en het dagplan (de plandag ís de gekozen dag; elke dag binnen twee weken).
- De app opent op **vandaag**: de meeste mensen openen de kaart als ze in de buurt zijn. Met een dagplan opent hij op de dag van dat plan. Het filter "Open vandaag" (nu open of gaat vandaag nog open) staat standaard **uit** (Freek: standaard filteren is niet handig); de status per regel laat zien wat open is.
- De tijdchips "Nu open", "Vandaag", "Dit weekend" en "Kies datum" zijn vervangen door de dagkeuze plus één filter dat meebeweegt ("Open vandaag" / "Open op za"). Winkels zonder bekende tijden vallen buiten dat filter (A6).
- Weekend als twee dagen tegelijk: nog niet; eerst kijken of za en zo los kiezen onhandig is.

## "Maak een dag voor me" (28 okt 2026)
- Voorstel voor de gekozen dag: tot 4 plekken binnen 20 km die die dag zeker open zijn (bekende tijden; markten alleen bevestigd), rond één startpunt geclusterd en in de slimste volgorde. Wat bij aankomst al dicht is, valt af.
- "Ander voorstel" bladert door verschillende voorstellen (startpunt 1 t/m 12, dubbele weg), met teller.
- Het huidige dagplan blijft staan tot je bevestigt; bij een bestaand plan vragen we eerst of het vervangen mag.
- Alleen snuffelwinkels: kringloop, vintage, antiek, vaste vlooienmarkt en overige tweedehands (boedelhuizen, brocante). Geen sloop en restpartijen, geen opkoop/pandjeshuis, en geen winkels die aan hun naam te zien iets anders zijn (auto, fiets, onderdelen, etalagepoppen…). Soorten die je in de filters uitzet, blijven ook uit het voorstel.

## Gemeenteblad: inzagedatum ná de datum (29 okt 2026)
- "Vanaf 28 oktober 2026 ligt een afschrift … ter inzage" werd als marktdag gelezen (Braderie Schiedam, label "waarschijnlijk goed"). Nu valt een datum ook af als in dezelfde zin daarna "ter inzage", "afschrift" of "bezwaar" staat. Test vastgelegd.

## Meten: Cloudflare Web Analytics (29 okt 2026, Freek)
- Paginabezoeken en verwijzers tellen, zonder cookies en zonder persoonsgegevens. Alleen op de app en de tekst-/plaatspagina's, niet in /beheer. Privacypagina aangepast.
- Token (openbaar) als `CF_BEACON` in `app/.env` en als GitHub-variabele (niet secret). Zonder token geen script.
- Nog niet: eigen telling van dagplannen en dagvoorstellen. Pas als paginabezoeken niet genoeg zeggen.

## De snuffellus: ombouw naar het ontwerp (29 okt 2026, Freek)
Ontwerp `ontwerp/lus/` (canvas "Snuffelkaart: de snuffellus"), na de UX-synthese van vier reviews (`ontwerp/ux-synthese.html`). Freek: "ga aan de slag met het ombouwen naar dit design". Daarmee vervallen twee eerdere keuzes:
- **Tabbalk**: Kaart, Mijn dag, Jij. Telefoon en iPad staand onderin; desktop bovenin het paneel. Vervangt de planbalk en de Jij-knop. (DESIGN.md had "geen tabbalk".)
- **Het dagplan houdt zijn eigen dag, vertrektijd en vertrekpunt** (vervangt "Eén dagkeuze"). De eerste stop neemt het moment en de plek over die je bekijkt; daarna staat het plan los. "Je locatie" als vertrekpunt beweegt mee.
- **Moment**: de pil "Rond Zwolle · Nu" stuurt lijst, kaart en detail. Nu, of een dag + vertrektijd (7:00–21:00) binnen twee weken. Niet bewaard: de app opent op nu. Status per regel op dat moment ("Open · tot 17:00", "Za open vanaf 13:00").
- **Lijst puur op afstand, daarna in secties** (nu open, gaat nog open, tijden onbekend, markten op andere dagen, dicht, afgelast) over de dichtstbijzijnde 40. Een winkel zonder tijden op 400 m stond eerst achter alle winkels met tijden in heel NL. "Open"-filter zit nu onder Filters.
- **Waar en wanneer** als eigen scherm: plaats of postcode (Enter kiest de eerste), mijn locatie, 3 recente plekken (`snuffel-recent`). Het zoekveld van de lijst zoekt alleen nog op naam. Welkomstpaneel weg; de banner "We tonen nu Amersfoort" blijft.
- **Winkel**: Route voorop (Apple Kaarten op iOS, anders Google), vanaf de gekozen plek; bewaren en delen rechtsboven. Status en weektijden volgen het moment.
- **Mijn dag**: vertrekblok, stops omhoog/omlaag, een dichte stop vervangen door de dichtstbijzijnde die dan open is, terug rond (terugreis), Start mijn dag → onderweg (volgende stop, navigeren per stop, hier ben ik, overslaan, daarna "klopten de tijden?" naar het tijdenformulier). Desktop ≥ 1200 px: derde kolom.
- **Delen** zonder backend: een winkel via zijn eigen pagina (`/winkel/…`), een markt via `/?open=`, een rondje als `/?dag=&v=&s=` (zonder vertrekpunt: privacy). De ontvanger ziet de status van nu en kan het overnemen.
- **Bugs uit de synthese**: losse "0" in de plankop, "vanaf Amersfoort" vast in de tekst, vertrek alleen 8–13 uur, na inloggen naar Jij (nu terug naar het formulier, ook na een inloglink), 10–17 vooringevuld bij onbekende tijden (nu alles uit), route uit het detail negeerde de gekozen plek, slimste volgorde bij elke render.
- **Nog niet**: "Klopt" zonder account (vraagt een rpc met rem; Freek beslist), alleen doorgeven wat anders is, inloggen pas bij versturen, zoeken op adres, Thuis als vast vertrekpunt, deel-afbeelding (og:image).

## Gekozen plaats alleen voor dit bezoek (29 okt 2026, Freek)
- Freek: de app moet niet bij elke start weer "Rond Zwolle" tonen. Een gekozen plaats geldt nu alleen tijdens het bezoek (sessionStorage); hij staat wel bij Recent. Bij openen: je locatie als je eerder toestemming gaf, anders "Waar wil je snuffelen?" in de pil (kaart en afstanden vanaf Amersfoort, met de banner). Vervangt "Gekozen plaats wordt bewaard" (27 okt).

## Rustiger lijst en Mijn dag (29 okt 2026, Freek: "voelt soms onoverzichtelijk")
- Regel in twee regels: naam, dan "tot 17:30 · kringloop". De sectiekop zegt al "nu open", dus geen groene "Open · sluit …" meer per regel; kleur alleen voor wat afwijkt (sluit bijna, opent later). Plaats alleen als die anders is dan waar je zoekt.
- Tellerregel onder de pil weg: hij telde binnen 25 km, de secties de dichtstbijzijnde 40, en dat sprak elkaar tegen.
- "Tijden onbekend" en "dicht": de dichtstbijzijnde drie, de rest achter "Nog N…". Markten op andere dagen staan vóór onbekend.
- Zoeken achter een vergrootglas in de filterrij; klapt open bij tikken.
- Mijn dag: vertrekblok als één regel met Wijzig; onder de bon alleen "Start mijn dag" en "Meer" (slimste volgorde, ander voorstel, kaart-apps). "Past ook" ingeklapt.
- Winkeldetail: weektijden vanaf de gekozen dag (geen voorbije dagen met "–"); meerdere telefoonnummers apart.

## Klikteller (30 oktober 2026)
- **Wat:** per dag, per plek en per soort een teller. Soorten: bekeken, in dagplan, gedeeld, route, website, bellen. Het gaat via `rpc count_click` (migratie `klikken`) en is te zien in /beheer → Klikken, ook per organisator.
- **Waarom:** zo zien we wat bezoekers echt gebruiken. Het is ook de onderbouwing voor afspraken met organisatoren, zoals een vergoeding per doorverwijzing naar kraamhuur of een betaalde organisatorpagina. Zie het verdienmodel: passief, geen advertenties, geen betaalde plek in de lijst.
- **Privacy:** we slaan geen losse klikken, IP-adres of account op, alleen het getal. Dat staat op de privacypagina.
- **Rem:** er is geen rem. Spam blaast hooguit tellers op; de opslag groeit er niet door, want er is één rij per dag, plek en soort. Komt er spam, dan voegen we een rem per uur toe.

## SEO: indexeren aan (30 oktober 2026)
- **Wanneer:** we indexeren nu al, niet pas na de testronde. Google doet weken over ruim 4.400 pagina's; wat testers vinden, passen we gewoon aan. Freek wil goed scoren in Google omdat de app van gebruikers afhangt.
- **Alleen snuffelkaart.nl in Google.** workers.dev houdt `X-Robots-Tag: noindex` (via `_headers` met hostnaam). /beheer, /data en adressen met `?` (app-standen) staan in robots.txt op disallow.
- **Echte 404's:** `not_found_handling` staat op "404-page" in plaats van SPA. De app gebruikt alleen `/` met parameters, dus de SPA-fallback leverde alleen zachte 404's op.
- **Homepage:** titel met zoekwoorden, een h1 voor schermlezers en zoekmachines, en links naar de grote steden en /markten onder de lijst.
- **Winkels:** openingstijden in `openingHoursSpecification` en in de description, bijvoorbeeld "open ma–vr 10:00–17:00, zo dicht". Dat is voor zoekopdrachten als "kringloop open zondag".
- **/markten/:** alle markten, eerst dit weekend en daarna per maand. Die pagina is voor "rommelmarkt dit weekend" en "vlooienmarkt".
- **Nog te doen:**
  - **Freek:**
    - Search Console aanmelden en de sitemap insturen.
    - www doorsturen naar de kale domeinnaam.
    - Bing Webmaster Tools via import uit Search Console.
  - **Code, gedaan:** de dubbele plaatsnamen zijn samengevoegd in `toFiles` (`placeNames`).
    - Andere namen gaan naar de naam die mensen zoeken: 's-Gravenhage en The Hague worden Den Haag, 's-Hertogenbosch wordt Den Bosch, Driebergen wordt Driebergen-Rijsenburg.
    - Verder wint per plaats de meest gebruikte schrijfwijze met hoofdletters.
    - 88 oude adressen sturen met een 301 door via `public/_redirects`.
    - ponytail: de lijst van `_redirects` is één keer gemaakt; een nieuwe alias vraagt een nieuwe regel.
  - **Code, nog te doen:** oude marktpagina's doorsturen naar de stadspagina.
    - Organisatoren vragen om naar hun pagina te linken (backlinks).

## UX-test met vier testers (30 oktober 2026)
Vier testers met elk een eigen ingang: Google naar een stad, de homepage met "nu open", /markten/, en een winkelpagina op de laptop. Dit is opgelost:
- **App:**
  - **Kaart rond de plek.** Openen vanaf een winkel- of marktpagina zet de kaart rond die plek in plaats van rond Amersfoort. `&plan=1` zet hem meteen in Mijn dag.
  - **Soortfilter.** Een tik toont alleen die soort, dan voeg je soorten toe, en wie de laatste uitzet ziet weer alles. Het telt als één filter.
  - **"Alleen open".** Dit is echt alleen open; "gaat nog open" valt eruit.
  - **Mijn dag.** "Start mijn dag" kan alleen op de dag zelf. "Rijden" telt de terugweg mee.
  - **Kleinere punten:**
    - Een postcode toont de plaatsnaam ("Rond Deventer").
    - De knop in Waar noemt de dag.
    - Delen gebruikt de leesbare pagina, ook voor markten.
    - De melding bij het hartje zegt waar je het terugvindt.
    - In het detail staat geen "0,0 km" meer, en de knoppen lopen niet meer uit het paneel.
- **Data:** markten krijgen altijd `t: 'm'` (`toFiles`). Gemeenteblad-markten stonden als "Kringloop · tijden onbekend".
- **Statische pagina's:**
  - **Stad:** "Open dit weekend" staat bovenaan, met tijden en links. Winkels met bekende tijden staan eerst; sloop en "tijden onbekend" onderaan.
  - **Winkel:** knoppen Route en Bel, het adres is een link, vandaag staat gemarkeerd, de datum is leesbaar, en de knop "Plan in Mijn dag" doet wat hij zegt.
  - **Markt:** "Markten" staat in het kruimelpad, met knoppen Plan, Route en Deel.
  - **/markten/:** zoeken op plaats.
- **Nog open:**
  - de "+"-knoppen voor wie niet plant;
  - afgekapte plaatsnamen op een smal scherm;
  - "Dit weekend" als één keuze;
  - de entree bij markten uit het Gemeenteblad.

## Dashboard en anonieme tellers (30 okt 2026)
Freek wil zo veel mogelijk anonieme data, voor overzichten en om organisatoren te benaderen. Gekozen: alleen tellers per dag
(tabel `tellers`, naast `clicks`): paginabezoek, badge, afstand (4 groepen), gekozen plaats (alleen plaatsnaam), regio (vak van 0,1 graad),
filters, uur van openen, dagplan (actie, stops, markt, dag), zoeken zonder resultaat (niet de tekst). Bewust niet: IP, account, getypte
tekst, exacte plek, terugkerende bezoekers herkennen (dat vraagt opslag op het apparaat en dus een cookiebanner). In het rapport per
organisator staan aantallen onder de 5 als "<5". Badge-links (`?via=badge`) zijn in robots.txt toegestaan, anders telt de link niet mee.
