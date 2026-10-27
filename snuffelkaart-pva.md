# Snuffelkaart — Plan van aanpak MVP

*Werknaam: **Snuffelkaart**. Kringloopwinkels én rommelmarkten op één kaart.*
**Versie:** v2.1 · 27 oktober 2026 · **Eigenaar:** Freek · **Uitvoering:** Claude Code

> **Nieuw in v2** (na een externe review): M0 is een validatiefase met organisatoren; markten worden opgeslagen als reeks + losse edities en nooit automatisch als bevestigd getoond; een publicatieaanpak zodat annuleringen snel zichtbaar zijn; mijlpalen in plaats van weken; kringlopen landelijk, markten eerst in een proefregio; het communitydeel (accounts, reviews, foto's) als eigen mijlpaal na de kernreis; betere meetpunten. Ongewijzigd: de ambitie dat Snuffelkaart mooi is en prettig voelt — dat hoort bij de kern, niet bij de afwerking.

> **Nieuw in v2.1:** M0 is nu een **proof of concept** die Freek en Claude Code zelf bouwen, zonder eerst organisatoren te benaderen. Markten komen in eerste instantie van de **eigen websites van organisatoren** (uitgelezen volgens vaste regels, §5.2); organisatoren benaderen kan later, waar nodig. Daarnaast een **werkwijze voor Claude Code** (§9b) en een nieuwe volgorde: accounts en favorieten in M3, community in M5, lancering in M6.

> **Voor Claude Code:** dit document beschrijft wat we bouwen en waarom. Technische keuzes die nog open staan, staan als vraag in §14. Beslis niets wat in §15 als "beslissing van Freek" staat. Wat als *te verifiëren* is gemarkeerd, is een onderzoekstaak, geen feit. **Werk volgens §9b.**

---

## 1. Samenvatting

**Wat:** een moderne, snelle website (installeerbaar als app, PWA) die op één kaart laat zien waar je deze week kunt snuffelen: **kringloopwinkels** (open of dicht) en **rommel-, vlooien- en kofferbakmarkten**, inclusief braderieën en garagesale-routes.

**Voor wie:** tweedehands-jagers. Mensen die op zaterdag een paar kringlopen afgaan, en mensen die zondag naar een rommelmarkt willen. Vaak dezelfde mensen.

**Het gat:** bestaande sites zijn óf kringloopgidsen ([Kringloop App](https://apps.apple.com/us/app/kringloop-app/id646950383), [Kringloop-Info.nl](https://www.kringloop-info.nl/app/), [Kringloop Kompas](https://apps.apple.com/nl/app/kringloop-kompas/id6753792354)), óf marktagenda's zonder kaart ([MarktenMarkten](https://www.marktenmarkten.nl/markten/rommel-vlooienmarkten/?paginanr=1), [Rommelmarkten.org](https://www.rommelmarkten.org/), [MarktenMeer](https://marktenmeer.nl/rommelmarkt-agenda/)). Niemand beantwoordt de vrijdagavondvraag goed: **"wat kan ik dit weekend bij mij in de buurt doen, en in welke volgorde?"**

**Onderscheid:**
1. Eén kaart met kringlopen én markten.
2. "Dit weekend" en "Nu open" als vertrekpunt.
3. Een route langs meerdere stops ("Mijn zaterdag").
4. Filters die er echt toe doen: specialisatie, pin of contant, gratis entree, overdekt.
5. Een snelle, overzichtelijke, prettig animerende interface. Precies waar de bestaande apps tekortschieten.

**Seizoen:** het hele jaar door. Buitenmarkten pieken van lente tot herfst, kringlopen draaien het hele jaar, in de winter zijn er indoormarkten. Een jaarlijkse piek: de Koningsdag-vrijmarkt eind april.

**Scope:** **kringlopen in heel Nederland** vanaf de start (gegevens relatief goedkoop via OpenStreetMap, en landelijke dekking is nodig voor vindbaarheid). **Markten eerst in een proefregio** (voorstel: Gelderland en Utrecht, beslissing D8), en pas landelijk als bewezen is dat de marktagenda betrouwbaar bij te houden is. België (Vlaanderen) volgt later; het datamodel ondersteunt vanaf dag één meerdere landen.

**Twee pijlers, even belangrijk:**
1. **Betrouwbare informatie.** Eén keer voor niets naar een afgelaste markt rijden, en een gebruiker komt niet terug. Elke markt heeft daarom een zichtbare bevestigingsstatus en elke winkel een controledatum.
2. **Een product dat mensen graag gebruiken.** Snel, overzichtelijk, mooi, met prettige beweging. Dat wordt vanaf de eerste versie zo gebouwd, niet "later afgewerkt".

**Verdienmodel (na de MVP):** ads op publieke stads- en marktpagina's; later uitgelichte vermeldingen voor marktorganisatoren. Niet in de MVP.

---

## 2. Doelen van de MVP

| Doel | Meetbaar als |
|---|---|
| Iemand plant snel een bruikbare snuffeldag | Taaktest met 5 mensen: binnen 2 minuten een plan met minimaal 3 stops dat op de gekozen dag klopt (open, markt bevestigd), en de route geopend |
| Betrouwbare marktinformatie | In de proefregio: per weekend minimaal 10 bevestigde markten, en < 5% foute of verouderde markten (gemeten via steekproef en meldingen) |
| Actuele kringloopinformatie | Landelijk ≥ 1.000 winkels; in de proefregio ≥ 90% met openingstijden die in de laatste 6 maanden zijn gecontroleerd |
| Mensen komen terug | Aandeel bezoekers dat binnen 30 dagen terugkomt; aantal gemaakte dagplannen per week |
| Het voelt goed | Taaktest: gemiddelde score ≥ 4 van 5 op "prettig en overzichtelijk"; geen vastlopers in de kernreis |
| Snel | LCP < 1,5 s op stadspagina's; interactie met de kaart < 100 ms |
| Bijhouden kost niet te veel tijd | Gemeten: minuten per nieuwe locatie controleren, en minuten per week om de marktagenda voor het komende weekend actueel te houden |
| Vindbaar | Stadspagina's geïndexeerd voor de 100 grootste plaatsen |

**Bewust níet in de eerste versie:** ads, betaalde vermeldingen (pas als gebruikers op de kaart vertrouwen), organisator-dashboard met eigen accounts (alleen een simpel aanmeldformulier), een native app, België, Engels/Duits. Accounts en favorieten zitten in M3; reviews, foto's en bijdragen in M5, zodra beveiliging en moderatie aantoonbaar werken (§9).

---

## 3. Functionaliteit MVP

### 3.1 Bezoeker (kernreis — eerste versie)
- **Kaart + lijst:** alle kringlopen en markten, met clustering bij uitzoomen.
- **Snelle filters (chips):** Alles · Kringlopen · Markten | Nu open | Vandaag · Dit weekend · Kies datum | Gratis entree | Overdekt | Pinnen mogelijk.
- **Specialisatie-filters** (kringlopen): meubels, kleding/vintage, boeken, platen/media, elektronica, kinderspullen, bouwmaterialen, groot (> 1.000 m²).
- **Zoeken:** op plaats, postcode of naam. Locatie delen voor "in de buurt".
- **Detailpagina** per kringloop: openingstijden met "nu open / sluit om 17:00", adres, route, telefoon/website, specialisaties, betaalmethoden, foto's, reviews.
- **Detailpagina** per markt: datum en tijd, terugkerend schema ("elke eerste zondag"), locatie, binnen/buiten, entree, aantal kramen (als bekend), organisator, contact voor standhouders.
- **"Mijn zaterdag" (route):** stops aanvinken → volgorde optimaliseren → openen in Google Maps of Apple Maps met tussenstops. Controle of alle stops open zijn op de gekozen dag.
- **Stadspagina's** ("Kringlopen en rommelmarkten in Apeldoorn"): statisch, snel, vindbaar, met lijst en kaart.
- **Melden:** "Klopt er iets niet?" → fout, gesloten, verkeerde openingstijden, markt afgelast (ook zonder account, met captcha).
- **Favorieten in de browser:** hartje werkt al zonder account (opgeslagen op het apparaat). Bij het aanmaken van een account (M3) gaan ze automatisch mee.
- **Bevestigingsstatus zichtbaar** bij elke markt (§5.2): "Bevestigd door organisator", "Gecontroleerd op [datum]", "Nog niet bevestigd" of "Afgelast".

### 3.2 Ingelogd (accounts en favorieten in M3; reviews, foto's en bijdragen in M5)
- **Account:** e-mail via magic link, plus inloggen met Google en Apple.
- **Favorieten:** winkels en markten opslaan; "mijn favorieten op de kaart".
- **Reviews:** sterren + korte tekst, met verplichte bezoekdatum (maand). Eén review per persoon per locatie, aan te passen.
- **Foto's toevoegen** aan een winkel of markt.
- **Wijziging voorstellen:** openingstijden, specialisaties, betaalmethoden.
- **Winkel of markt toevoegen** → altijd naar de moderatiewachtrij (§7).
- **Mijn bijdragen:** overzicht van ingediende voorstellen en hun status.
- **Account verwijderen en data exporteren** (AVG).

### 3.3 Beheer (alleen Freek)
- **Moderatiewachtrij:** nieuwe locaties, wijzigingen, reviews, foto's, meldingen. Met AI-voorbeoordeling (§7.2) en knoppen goedkeuren / aanpassen / afwijzen.
- **Bronnenoverzicht:** welke data uit welke bron komt, wanneer laatst bijgewerkt.
- **Kandidatenlijst:** winkels die in externe bronnen staan maar nog niet bij ons (§5.1).

---

## 4. Ontwerp en gevoel

### 4.1 Principes

*Ontwerp is onderdeel van de kern. De kernreis (dit weekend → stops kiezen → route) wordt vanaf de eerste versie gebouwd met de volledige ontwerpkwaliteit hieronder: het moet vanaf dag één mooi zijn en prettig voelen.*

1. **Zeer overzichtelijk.** Eén hoofdvraag per scherm. Hooguit twee niveaus diep (kaart/lijst → detail). Elke kaart of lijstregel toont drie dingen: *type*, *open/dicht of datum*, *afstand*.
2. **Voelt snel.** Alles wat kan, gebeurt direct in de browser: filteren, zoeken in de lijst, schakelen tussen tabs. Geen laadspinners maar skeletons; optimistische updates bij favoriet maken.
3. **Prettige beweging, nooit vertragend.** Animaties duren 150–250 ms, met veren (springs) in plaats van lineaire overgangen. Respecteer `prefers-reduced-motion`.
4. **Kaart-eerst op mobiel, gesplitst op desktop.**
5. **Toegankelijk:** type nooit alleen via kleur (ook icoon en label), contrast WCAG 2.2 AA, volledig met toetsenbord te bedienen.

### 4.2 Lay-out
- **Mobiel:** kaart op volledig scherm met een **bottom sheet** (zoals Apple Maps) met drie standen: ingeklapt (zoekbalk + chips), half (lijst), volledig (lijst of detail). Vegen tussen de standen met veerwerking.
- **Desktop:** links een lijst (±400 px) met filters, rechts de kaart. Hover op een lijstregel licht de pin op, en andersom.
- **Detail:** schuift in als paneel (desktop) of sheet (mobiel), met een View Transition vanaf de lijstkaart (afbeelding en titel "vliegen" naar hun plek).
- **Startscherm:** "Dit weekend bij jou in de buurt", met twee tellers ("12 kringlopen open · 3 markten zondag") en de kaart.

### 4.3 Microinteracties
- Hartje bij favoriet maken: kleine "pop"-animatie, direct opgeslagen.
- Filterchips: de lijst herordent met layout-animaties (items glijden naar hun nieuwe plek).
- Kaartpins: zachte "drop" bij het laden, cluster splitst animerend bij inzoomen.
- "Nu open"-badge met een rustig pulserend groen bolletje.
- Route: lijn tekent zich animerend tussen de stops.

### 4.4 Visuele stijl (voorstel, uitwerken in de ontwerpfase)
- Warm en eigentijds: een rustige basis met één accentkleur voor kringlopen en één voor markten, plus iconen.
- Kaartstijl: licht, rustig, met gedempte achtergrond zodat de pins opvallen; donkere modus inbegrepen.
- Typografie: één modern schreefloos lettertype, met duidelijke grootteverschillen tussen titel, kerninfo en details.

---

## 5. Gegevensbronnen

Dit is het belangrijkste en lastigste deel. Uitgangspunt: **alleen bronnen met een licentie die hergebruik toestaat**, plus eigen invoer. Andere gidsen of agenda's kopiëren mag niet: in de EU zijn databanken beschermd (databankenrecht), ook als losse adressen dat niet zijn.

### 5.1 Kringloopwinkels

| Bron | Wat het oplevert | Licentie / voorwaarden | Rol in de MVP |
|---|---|---|---|
| **OpenStreetMap** (via Geofabrik-extract NL en BE) | Winkels met `shop=second_hand` en `shop=charity`, vaak met naam, adres, openingstijden (`opening_hours`), website | ODbL: gratis, met bronvermelding. **Let op share-alike:** een database die we afleiden uit OSM-data moet op verzoek onder ODbL beschikbaar zijn (§12) | **Basis.** Wekelijks importeren. Volledigheid voor NL *te verifiëren* (eerste taak) |
| **Overture Maps Places** | POI's met categorieën, naam, adres, website, telefoon, betrouwbaarheidsscore. Geen openingstijden | CDLA Permissive 2.0: vrij te hergebruiken, **zonder share-alike** ([catalogus](https://catalog.dvrpc.org/dataset/overture-maps-places)). Te verifiëren welke categorieën kringlopen dekken | **Aanvulling en ontdekking:** winkels die in OSM ontbreken komen als kandidaat in de wachtrij |
| **Foursquare Open Source Places** | POI's met 1.000+ categorieën (waaronder tweedehands/vintage, te verifiëren) | Apache 2.0 ([Foursquare](https://docs.foursquare.com/data-products/docs/fsq-places-open-source)) | **Aanvulling en ontdekking**, net als Overture |
| **Ketens met eigen winkelzoeker** (o.a. Het Goed, Emmaus, Leger des Heils ReShare, De Kringwinkel in België) | Actuele lijst van hun eigen vestigingen | Niet automatisch overnemen; **toestemming vragen** of met de hand invoeren (enkele tientallen vestigingen) | Handmatige controle en aanvulling; later eventueel partnerschap |
| **Winkels zelf** | Openingstijden, specialisaties, foto's | Eigen invoer | Formulier "Is dit jouw winkel?" (claimen in M7) |
| **Gebruikers** | Wijzigingen, nieuwe winkels, foto's, reviews | Eigen invoer, via moderatie | Doorlopend |
| **Google Places** | Beste dekking en openingstijden | **Niet gebruiken als bron:** volgens de voorwaarden mag je alleen de `place_id` blijvend opslaan, coördinaten 30 dagen, overige velden niet ([overzicht](https://openplacesapi.com/blog/can-you-store-places-api-results)). Kost geld per aanroep | Niet in de MVP |
| **KvK** (NL) / **KBO** (BE) | Bedrijven met branchecode tweedehands (SBI/NACE 47.79) | KvK-data met adressen is betaald; KBO-opendata in België is gratis ([FOD Economie](https://economie.fgov.be/en/themes/enterprises/crossroads-bank-enterprises/services-everyone/public-data-available-reuse)) | België (M7): KBO als ontdekbron. NL: niet nodig |

**Importproces kringlopen (wekelijks, GitHub Actions):**
1. Download Geofabrik-extract NL (en later BE), filter met `osmium` op winkeltags + naam bevat "kringloop/kringwinkel/tweedehands".
2. Normaliseer: naam, adres, coördinaten, `opening_hours` (parsen met de `opening_hours`-bibliotheek), website, telefoon.
3. Koppel aan bestaande records op OSM-ID; nieuwe records worden kandidaat.
4. Elk kwartaal: Overture- en Foursquare-data voor NL/BE downloaden, filteren op relevante categorieën, ontdubbelen (afstand < 75 m én naamgelijkenis), ontbrekende winkels als kandidaat in de wachtrij.
5. Elk veld krijgt een **bronlabel** (osm / overture / fsq / user / owner / freek) en een datum. Zo weten we wat gecontroleerd is en wat van wie komt.

**Openingstijden zonder Google:**
- OSM `opening_hours` waar beschikbaar.
- Anders: website van de winkel handmatig of met AI-hulp uitlezen tijdens de eerste vulling (alleen feiten, met bronlabel), en gebruikers/eigenaren laten aanvullen.
- Feestdagen: Nederlandse (en Belgische) feestdagen in de logica, met "let op: mogelijk afwijkend op feestdagen".
- Elk record toont "openingstijden laatst gecontroleerd: [datum]".

### 5.2 Markten (rommel-, vlooien-, kofferbak-, indoormarkten, braderieën, garagesale-routes)

Er is geen open, landelijke bron. De aanpak is daarom gelaagd:

| Bron | Wat | Voorwaarden | Rol |
|---|---|---|---|
| **Websites van organisatoren** | De agenda van hun eigen markten: datum, tijd, plaats, locatie, standhoudersprijs. Voorbeelden: [Don Events](https://donevents.nl/marktkalender/) (±40 markten verspreid over Nederland, plus enkele in België en Duitsland), [JoJo Vlooienmarkten](https://www.jojovlooienmarkten.nl/agenda-vlooienmarkten) (Gooi en Utrechtse Heuvelrug) | Eigen agenda van de organisator, geen verzamelsite; regels hieronder | **Hoofdbron vanaf M0.** Per site een uitlezer, dagelijks opnieuw uitgelezen |
| **Organisatoren zelf** | Aanvullingen, correcties, afgelastingen | Eigen invoer | Gratis vermelding via formulier, CSV of iCal. Actief benaderen pas na de PoC, en alleen waar het iets toevoegt (bijvoorbeeld organisatoren zonder online agenda) |
| **iCal/ICS-feeds van organisatoren** | Automatisch bijgewerkte datums | Alleen met toestemming | Waar organisatoren een agenda-feed hebben |
| **Gemeenteblad (Officiële Bekendmakingen)** | Verleende evenementenvergunningen, soms voor rommelmarkten, braderieën en vrijmarkten | CC-0, dagelijks bijgewerkt, via SRU-zoekdienst ([data.overheid.nl](https://data.overheid.nl/dataset/officiele-bekendmakingen)) | **Experimenteel ontdekkanaal:** dagelijks zoeken op "rommelmarkt", "vlooienmarkt", "braderie", "vrijmarkt" → kandidaat in de wachtrij. Niet elke gemeente publiceert dit, en niet altijd op tijd (te verifiëren) |
| **UiTdatabank (Vlaanderen)** | Vlaamse evenementendatabank met API; bevat vermoedelijk veel rommelmarkten | Voorwaarden en toegang via publiq *te verifiëren* | **België (M7)** |
| **Gemeentepagina's Koningsdag** | Vrijmarktlocaties | Feiten, met de hand of via gebruikers | Jaarlijkse campagnepagina in april |
| **Gebruikers** | Nieuwe markten | Via moderatie | Doorlopend |
| **Bestaande agendasites** (MarktenMarkten, Rommelmarkten.org, MarktenMeer, DagjeWeg) | — | **Niet uitlezen of overnemen** (databankenrecht) | Alleen gebruiken om organisatoren met een eigen website te vinden |

**Regels voor het uitlezen van organisatorsites:**
- Alleen de eigen agenda van een organisator over **zijn eigen markten**. Nooit verzamelsites of agenda's die markten van anderen bundelen.
- Per site vooraf robots.txt en gebruiksvoorwaarden controleren en vastleggen (bijvoorbeeld in `sources/<organisator>.md`). Verbieden de voorwaarden het, dan niet uitlezen.
- Maximaal één keer per dag, met een herkenbare user-agent en contactadres.
- Alleen feiten overnemen (datum, tijd, plaats, locatie, prijs, binnen/buiten). Geen teksten, foto's of logo's.
- Altijd bronvermelding met link: "Bron: website van [organisator], gecontroleerd op [datum]". De bezoeker kan daar ook een kraam boeken, dus de organisator heeft er baat bij.
- Vraagt een organisator ermee te stoppen: direct stoppen, gegevens verwijderen en eigen invoer aanbieden.
- Elke uitlezer heeft een test met een opgeslagen voorbeeldpagina. Levert een uitlezing 0 resultaten of een grote afwijking op, dan wordt de import tegengehouden en komt er een melding (§6.1, veilige imports).
- Waarom dit anders is dan verzamelsites: het databankenrecht beschermt de investering in het *verzamelen* van gegevens, niet in het organiseren van de markten zelf. Een organisator die zijn eigen datums publiceert, heeft daardoor meestal geen beschermde databank. Dit is een inschatting, geen juridisch advies; de licentieanalyse in M0 toetst het.

**Reeks en edities apart:** veel markten zijn periodiek ("elke tweede zondag van de maand", "elke zaterdag van april t/m oktober"). We slaan dat op als:
- een **reeks** (`event_series`): naam, organisator, vaste locatie, herhaalpatroon (RRULE), seizoen;
- losse **edities** (`event_editions`): één record per datum, met eigen status, eventueel afwijkende locatie of tijden.

Het herhaalpatroon *stelt edities voor*; het maakt ze niet bevestigd. Seizoensstops, verplaatsingen en een andere locatie worden per editie vastgelegd. Tijden altijd in de tijdzone Europe/Amsterdam (en Europe/Brussels).

**Bevestigingsstatus per editie:**

| Status | Betekenis | Op de kaart |
|---|---|---|
| Bevestigd door organisator | Organisator heeft deze datum zelf opgegeven of bevestigd | Normaal |
| Gecontroleerd | Wij hebben de datum gecontroleerd bij een betrouwbare bron (site of poster van de organisator), met datum. Ook automatisch: de editie stond bij de laatste dagelijkse uitlezing nog op de site van de organisator | Normaal, met controledatum |
| Nog niet bevestigd | Alleen afgeleid uit het herhaalpatroon of een tip | Zichtbaar met duidelijk label; **niet** standaard in "Mijn zaterdag" |
| Afgelast | Geannuleerd | Doorgestreept tot de datum voorbij is, daarna weg |

**Toon nooit automatisch een toekomstige editie als bevestigd** alleen omdat eerdere edities plaatsvonden. Verdwijnt een editie van de site van de organisator, dan gaat ze naar de wachtrij als "mogelijk afgelast" en verdwijnt ze uit "Mijn zaterdag" tot iemand het heeft gecontroleerd. Bij organisatoren die zelf invoeren gaat twee weken voor de datum een herinnering ("klopt dit nog?"); zonder antwoord blijft de status "nog niet bevestigd".

**Versheid:** edities in het verleden verdwijnen automatisch uit de kaart; de pagina van de reeks blijft bestaan met "volgende editie" of "geen nieuwe datum bekend".

**Proefregio:** markten verzamelen we in de eerste versie alleen voor de proefregio (D8). Uitbreiden naar andere regio's gebeurt pas als de meetpunten uit §2 (bevestigde markten per weekend, foutpercentage, tijd per week) in de proefregio gehaald worden.

### 5.3 Overige basisgegevens

| Onderdeel | Bron | Opmerking |
|---|---|---|
| Kaarttegels | OpenFreeMap (gratis vectortegels op basis van OSM) of eigen Protomaps-bestand (PMTiles) op Cloudflare R2 | Beide zonder kosten per weergave; keuze in §14 |
| Kaartbibliotheek | MapLibre GL JS | Open source, vloeiend, vectorstijlen |
| Adres zoeken NL | PDOK Locatieserver | Gratis, officiële adresdata |
| Adres zoeken BE | Geolocation-API van Digitaal Vlaanderen | *Te verifiëren* (M7) |
| Plaatsen en gemeenten (stadspagina's) | CBS/PDOK gemeentegrenzen en woonplaatsen | Open data |
| Route langs stops | MVP: optimaliseren in de browser (enkele stops) en openen in Google/Apple Maps met tussenstops | Geen eigen routeserver nodig |
| Feestdagen | Open bibliotheek of vaste lijst per land | — |

---

## 6. Techniek

Zelfde basis als RuneBinder: **statisch-eerst op het gratis Cloudflare-plan, met Supabase.**

### 6.1 Architectuur
- **Frontend:** React, met een statische sitegenerator voor de publieke pagina's (voorstel: Astro met React-componenten voor de interactieve kaart). Tailwind CSS. Animaties met Motion (voorheen Framer Motion) en de View Transitions API.
- **Publieke pagina's** (home, stadspagina's, detailpagina's van winkels en markten, over/methode/privacy): **vooraf gebouwd en statisch**, elke nacht opnieuw gebouwd en gepubliceerd via GitHub Actions. Ze gebruiken geen Worker (gratis en onbeperkt op Cloudflare).
- **Publicatie en actualiteit (één bron van waarheid):**
  - Supabase is de bron van waarheid. Kaart, lijst en detailpagina's lezen hun status uit **hetzelfde gepubliceerde kaartdata-bestand**, zodat kaart en detail nooit iets anders zeggen.
  - **Normale wijzigingen** (goedgekeurd voorstel, nieuwe winkel): binnen ±15 minuten zichtbaar via een automatische herbouw die bij goedkeuring wordt gestart (GitHub Actions), plus de nachtelijke herbouw als vangnet.
  - **Kritieke wijzigingen** (markt afgelast, winkel definitief dicht): binnen enkele minuten zichtbaar. De status van markten in de komende 14 dagen staat in een klein, apart statusbestand met korte cache (bijvoorbeeld 5 minuten), dat bij elke kritieke wijziging direct wordt bijgewerkt en door zowel kaart als detailpagina wordt gelezen.
  - De statische detailpagina toont de status uit dat statusbestand, zodat een afgelaste markt ook op een eerder gebouwde pagina meteen als afgelast verschijnt.
- **Imports veilig:** imports schrijven eerst naar een staging-tabel, worden gevalideerd (aantallen, ontbrekende velden, verschillen met de vorige keer), en overschrijven **nooit** velden die handmatig zijn gecontroleerd of door een organisator of eigenaar zijn opgegeven. Elke import is terug te draaien.
- **Kaartdata:** één compact, geversioneerd JSON-bestand met alle locaties en de markten voor de komende 60 dagen (orde grootte enkele honderden kB gecomprimeerd, *te meten*). De browser filtert en zoekt daarin direct (bijvoorbeeld met MiniSearch). Daardoor voelt alles direct aan en zijn er geen serververzoeken per filterklik.
- **Supabase (gratis plan):**
  - **Auth:** magic link, Google, Apple.
  - **Postgres met PostGIS:** locaties, markten, herhaalregels, reviews, favorieten, voorstellen, meldingen, moderatie.
  - **RLS** op elke tabel: publiek leest alleen goedgekeurde inhoud; gebruikers schrijven alleen hun eigen bijdragen.
- **Foto's:** opslaan in Cloudflare R2 (10 GB gratis). De browser verkleint en converteert vóór upload naar WebP (bijvoorbeeld max. 1600 px) en verwijdert EXIF-data (inclusief GPS). Een kleine Worker geeft een ondertekende upload-URL. Foto's komen pas na goedkeuring online.
- **Cloudflare Worker** alleen voor: ondertekende foto-uploads, moderatie-aanroepen, en eventueel `/api/*`. Binnen het gratis quotum (100.000 aanroepen per dag).
- **Jobs (GitHub Actions, privé-repo):** wekelijkse OSM-import, kwartaalimport Overture/Foursquare, dagelijkse check van het Gemeenteblad, nachtelijke build, nachtelijke back-up (`pg_dump` naar R2), dagelijkse schrijfactie in Supabase (voorkomt pauzeren van het gratis project).
- **Monitoring:** Sentry (fouten), Healthchecks.io (jobs), cookieloze analytics (Umami of Cloudflare Web Analytics).
- **PWA:** installeerbaar, offline de laatst geladen kaartdata en favorieten.

### 6.2 Datamodel (kern)

| Tabel | Belangrijkste velden |
|---|---|
| `places` | id, type (kringloop / marktlocatie), naam, slug, adres, land, coördinaten (PostGIS), website, telefoon, opening_hours (OSM-syntax), specialisaties[], betaalmethoden[], grootte, status (actief/gesloten/kandidaat), bron per veld, laatst_gecontroleerd |
| `event_series` | id, titel, type (rommel/vlooien/kofferbak/indoor/braderie/garagesale/vrijmarkt), organizer_id, standaardlocatie (place_id of adres), herhaalpatroon (RRULE), seizoen, standaardtijden, binnen/buiten, entree, aantal_kramen |
| `event_editions` | id, series_id (optioneel voor eenmalige markten), datum, start/einde (met tijdzone), afwijkende locatie, status (bevestigd door organisator / gecontroleerd / nog niet bevestigd / afgelast), bron, gecontroleerd_op, gecontroleerd_door |
| `organizers` | id, naam, website, contact (alleen intern), aantal markten |
| `profiles` | user_id, weergavenaam, vertrouwensniveau, aangemaakt |
| `favorites` | user_id, place_id of event_id |
| `reviews` | id, user_id, place_id, sterren, tekst, bezoekmaand, status, moderatie_reden |
| `photos` | id, user_id, place_id/event_id, r2_key, breedte/hoogte, status |
| `submissions` | id, user_id, soort (nieuw / wijziging), doel_id, voorgestelde_data (JSON), AI-score, status, beoordeeld_door |
| `reports` | id, (user_id of anoniem), doel, reden, toelichting, status |
| `sources` | bron, licentie, laatste import, aantal records |

### 6.3 Snelheidsbudget
- Stadspagina's: LCP < 1,5 s op 4G, CLS < 0,05, minimale JavaScript tot de kaart nodig is.
- De kaartbibliotheek en de kaartdata laden pas als de kaart in beeld komt (of na de eerste weergave).
- Interactie (filter, sheet, favoriet): direct zichtbaar resultaat (< 100 ms).
- Afbeeldingen met vaste afmetingen, lazy laden behalve de eerste.
- Lighthouse-budget als controle in CI.

---

## 7. Bijdragen van gebruikers zonder troep

### 7.1 Regels
- **Alles via goedkeuring** (besluit van Freek): nieuwe winkels en markten, wijzigingen, reviews en foto's komen eerst in de wachtrij.
- **Alleen ingelogd** bijdragen (behalve "Klopt er iets niet?"-meldingen, die met captcha mogen).
- **Limieten:** bijvoorbeeld max. 5 voorstellen en 10 foto's per dag per account. Cloudflare Turnstile tegen bots.
- **Ontdubbelen:** bij "winkel toevoegen" eerst tonen: "Bedoel je een van deze?" (binnen 150 m, vergelijkbare naam).
- **Verplichte velden** bij een nieuwe markt: datum, tijd, adres (geocode-check), type, bron (link naar organisator of poster/foto).

### 7.2 AI-voorbeoordeling (scheelt beoordelingstijd)
Elke bijdrage krijgt automatisch een voorbeoordeling:
- **Tekst** (reviews, beschrijvingen): scheldwoorden, spam, reclame, persoonsgegevens, nep-reviews (bijvoorbeeld de eigenaar die zijn eigen winkel prijst).
- **Foto's:** ongepaste inhoud, herkenbare personen (vragen om weg te laten of vervagen), foto's die niet bij de locatie passen.
- **Locaties en markten:** bestaat het adres, ligt het in NL/BE, lijkt het op een kringloop of markt, is het een duplicaat, klopt de datum (niet in het verleden)?
- Uitkomst: *waarschijnlijk goed / twijfel / waarschijnlijk afwijzen*, met reden. Freek keurt goed met één klik. De AI-score is een hulpmiddel; de beslissing ligt altijd bij een mens. Kosten: enkele euro's per maand, met een harde limiet.
- **Later (na de MVP):** vertrouwde bijdragers wiens voorstellen jarenlang goed zijn, mogen kleine wijzigingen (openingstijden) direct doorvoeren. Niet in de MVP.

### 7.3 Reviews: wettelijke en eerlijke basis

*Vóór de bouw van M5 wordt uitgezocht welke verplichtingen echt gelden voor reviews, foto's en bijdragen (consumentenrecht, DSA, AVG), en welke gegevens we strikt nodig hebben. Dat bepaalt de uitvoering hieronder.*

- Op de site uitleggen **hoe reviews worden gecontroleerd** (verplicht volgens Europese consumentenregels zodra je reviews toont; *te verifiëren hoe precies*).
- Geen betaalde of beloonde reviews; geen reviews verbergen omdat ze negatief zijn.
- Eigenaren kunnen reageren (M7), niet verwijderen.

### 7.4 DSA en meldingen
Met reviews, foto's en eigen bijdragen is Snuffelkaart een hostingdienst onder de Digital Services Act. Nodig vóór lancering: gebruiksvoorwaarden met moderatieregels, een meldknop op elke review en foto, een contactpunt, en een motivering bij verwijdering (moderatielog). Zie ook de juridische laag van het RuneBinder-plan.

---

## 8. Vindbaarheid (SEO)

- **Stadspagina's** voor alle Nederlandse woonplaatsen met minimaal één kringloop of markt: "Kringlopen en rommelmarkten in [plaats]". Met echte gegevens (lijst, kaart, openingstijden, aankomende markten), niet als lege sjabloonpagina. Plaatsen zonder locaties krijgen geen eigen pagina.
- **Detailpagina's** per winkel en per markt, met unieke inhoud (openingstijden, specialisaties, foto's, reviews).
- **Structured data:** `Event` voor markten (Google toont evenementen in zoekresultaten; *te verifiëren voor deze soort evenementen*), `LocalBusiness` voor kringlopen, `BreadcrumbList` overal.
- **Snelle, statische pagina's** met canonical, sitemap (met echte wijzigingsdatum) en Open Graph-afbeelding per pagina.
- **Seizoenspagina's:** Koningsdag-vrijmarkten (april), indoormarkten (winter), garagesale-routes (voorjaar).
- **Zoekwoordonderzoek vooraf:** volume voor "kringloop [plaats]", "rommelmarkt [plaats]", "rommelmarkt dit weekend", "vlooienmarkt vandaag" via Google Keyword Planner (taak in M0).
- Gebruikersaccount-pagina's en de beheeromgeving op `noindex`.

---

## 9. Mijlpalen

Elke mijlpaal heeft een bewijs dat je verder kunt. Tijd is een indicatie, geen harde eis.

### M0 — Proof of concept: werkt het met echte gegevens? (±1–2 weken)
Freek en Claude Code bouwen dit zelf, **zonder externe contacten**. Functioneel, nog niet het eindontwerp; de code mag daarna weg.
- **Kringlopen:** OSM-extract NL filteren en tellen; vergelijken met Overture en Foursquare; steekproef van 50 kringlopen die Freek kent (hoeveel staan erin, met openingstijden?).
- **Markten van organisatorsites:** Claude Code zoekt organisatoren met een eigen online agenda (beginnend bij Don Events en JoJo Vlooienmarkten) en schrijft per site een uitlezer volgens de regels in §5.2.
- **Gemeenteblad-test:** één maand terugzoeken op "rommelmarkt/vlooienmarkt/braderie/vrijmarkt"; hoeveel bruikbare tips?
- **Simpele kaart** (lokaal of op een preview-URL, niet openbaar) met kringlopen en markten, en een filter "dit weekend".
- **Bureauwerk tegelijk:** licentieanalyse van de datastromen, inclusief het uitlezen van organisatorsites (§12); zoekwoordonderzoek (§8); naam en domein (D1).
- **Bewijs:** Freek gebruikt de PoC zelf een weekend om een snuffeldag te plannen. Rapport: per bron het aantal bruikbare records, het aantal markten per weekend per provincie, hoeveel organisatorsites uitleesbaar zijn, en hoeveel onderhoud een uitlezer kost. **Besluit:** in welke regio('s) starten we met markten (D8), en is het daarnaast nodig organisatoren te benaderen?

### M1 — Ontwerp (±1–2 weken, kan parallel aan M0)
- Wireframes van de kernschermen (mobiel en desktop): start "Dit weekend", kaart met lijst en filters, detail kringloop, detail markt (met bevestigingsstatus), "Mijn zaterdag".
- Klikbaar prototype met de animaties uit §4.3, om het gevoel te testen.
- Visuele stijl en kaartstijl, inclusief donkere modus.
- **Bewust:** de ontwerpkwaliteit uit §4 geldt vanaf de eerste bouwmijlpaal.
- **Bewijs:** Freek keurt ontwerp en gevoel goed; 3 testpersonen vinden het prototype prettig en overzichtelijk.

### M2 — Kernproduct werkt
- Datamodel, importjobs (OSM; Overture/Foursquare als kandidaten) met staging en terugdraaien, beheeromgeving voor correcties, toevoegen, bevestigen en verwijderen.
- Eerste vulling: kringlopen landelijk, markten in de proefregio.
- Kaart + lijst + filters + zoeken + detailpagina's, met het volledige ontwerp en de animaties.
- **Bewijs:** met echte gegevens werkt de kaart snel en klopt de informatie in een steekproef.

### M3 — Een dag plannen werkt, met accounts en favorieten
- "Mijn zaterdag": stops kiezen, alleen open of bevestigde stops voorgesteld, volgorde optimaliseren, route openen in Google Maps of Apple Maps.
- Favorieten in de browser.
- Inloggen (magic link, Google, Apple), favorieten synchroniseren; browserfavorieten gaan bij het inloggen automatisch mee.
- **Bewijs:** 5 testgebruikers maken binnen 2 minuten een bruikbaar plan met minimaal 3 stops (§2); favorieten blijven bewaard bij inloggen op een ander apparaat.

### M4 — Publiceren is betrouwbaar en veilig
- Publicatieaanpak uit §6.1 werkend: herbouw bij goedkeuring, statusbestand voor kritieke wijzigingen.
- Getest: import met fouten wordt tegengehouden; handmatige gegevens worden niet overschreven; een afgelaste markt is binnen minuten overal zichtbaar; back-up is te herstellen; de site blijft werken als een externe bron niet bereikbaar is; een uitlezer die stukgaat, wordt gemeld.
- Openingstijden getest rond middernacht, feestdagen en zomer/wintertijd.
- **Beveiliging:** RLS-tests per tabel (een gebruiker ziet en wijzigt alleen eigen gegevens; gasten kunnen niets schrijven); beheer alleen achter Cloudflare Access; secrets niet in de repo.
- **Bewijs:** alle bovenstaande scenario's slagen in een geautomatiseerde test.

### M5 — Community
- Vooraf de juridische check uit §7.3.
- Reviews, foto's, wijzigingen voorstellen, winkels en markten toevoegen via de wachtrij, meldknoppen (DSA).
- AI-voorbeoordeling als **afzonderlijke, testbare module**, met een testset van goede en foute bijdragen.
- Met dezelfde ontwerpkwaliteit als de kernreis.
- **Bewijs:** spam- en misbruiktests slagen; testbijdragen komen correct in de wachtrij; de moderatie kost < 15 minuten per dag.

### M6 — Bèta-lancering
- Stadspagina's + SEO-basis; juridische pagina's (privacy, gebruiksvoorwaarden, colofon, bronvermelding OSM/Overture/Foursquare/PDOK en organisatoren); PWA; toegankelijkheid; monitoring.
- **PWA offline getest** vóór het als klaar geldt: wat werkt zonder verbinding (bewaarde favorieten, laatst bekeken plan), en wat niet.
- Lancering in tweedehands-communities in de proefregio (met eigenaarsvermelding), en landelijk voor de kringloopkant.
- **Bewijs:** echte bezoekers maken dagplannen en komen terug (§2); de tijd voor bijhouden blijft acceptabel.

### M7 — Uitbreiden en verdienen
- Markten in meer regio's, daarna landelijk, op basis van de meetpunten uit de proefregio.
- Koningsdag-campagnepagina (eind april).
- **België (Vlaanderen):** OSM-import BE, De Kringwinkel-vestigingen, KBO als ontdekbron, UiTdatabank voor markten (na verificatie van de voorwaarden), adres zoeken via Digitaal Vlaanderen.
- **Ads** op publieke stads- en marktpagina's zodra er voldoende verkeer is (CMP, geen ads in het ingelogde deel). Pas daarna uitgelichte vermeldingen voor organisatoren, als gebruikers op de kaart vertrouwen.
- Winkels en organisatoren hun pagina laten claimen; vertrouwde bijdragers.

*Grove indicatie bij werken met Claude Code naast een baan: M0–M6 in 2–4 maanden. Lancering van de markten bij voorkeur in het voorjaar, als het marktseizoen begint.*

---

## 9b. Werkwijze voor Claude Code

Claude Code bouwt het project van begin tot eind. Freek bepaalt de richting, keurt belangrijke keuzes goed en beoordeelt het resultaat. Om te voorkomen dat fouten zich opstapelen:

1. **Eerst een uitvoerbaar plan.** Elke mijlpaal wordt opgedeeld in kleine taken met acceptatiecriteria, afhankelijkheden en vereiste tests, in `BACKLOG.md`. Keuzes en de reden erachter gaan in `DECISIONS.md`.
2. **Bouwen én testen.** Per taak: code, tests, fouten oplossen, en controleren dat bestaande functionaliteit blijft werken. Eén PR per taak, met een Cloudflare-preview-URL.
3. **Bewijs van voltooiing.** Een taak is niet klaar omdat de code bestaat. Bij elke afgeronde taak: testresultaten, screenshots op 375 en 1280 px breed (bij UI), resultaten van beveiligings- en RLS-tests (bij data), Lighthouse (bij pagina's), en een lijst van wat nog niet werkt.
4. **Nooit:** onbewezen aannames als feit presenteren; licentie- of juridische vragen stilzwijgend zelf beslissen; werk als klaar melden zonder tests; ontwerpkwaliteit inleveren om sneller te zijn.
5. **Toestemming van Freek nodig voor:** DNS en domein, iets live of openbaar zetten, contact met buitenstaanders (de agent stelt teksten op, Freek verstuurt), accounts en secrets, licentie- en juridische keuzes, en alles in §15.
6. **Freek houdt zelf:** productbeslissingen (wat belooft Snuffelkaart en welke afwegingen zijn acceptabel), de praktijktoets (klopt de informatie echt, voelt het goed) en de eindverantwoordelijkheid voor veiligheid, privacy en licenties.

---

## 10. Wat Freek zelf moet doen

| Actie | Wanneer |
|---|---|
| Naam en domein kiezen en registreren (D1) | M0 |
| Accounts: Cloudflare, Supabase (tweede project), Sentry; Google/Apple-inlog (Apple Developer bestaat al via Heading) in M3 | M0 / M3 |
| Steekproef: 50 kringlopen die je kent, voor de datacontrole | M0 |
| Ontwerp goedkeuren | M1 |
| De PoC een weekend zelf gebruiken en beoordelen | **M0** |
| Organisatoren benaderen, alleen als dat na de PoC nodig blijkt (de agent maakt lijst en e-mailteksten, jij verstuurt) | Optioneel, na M0 |
| Correcties en bevestigingen afhandelen, later ook de moderatiewachtrij (doel: < 15 min per dag) | Vanaf M2 |
| Juridische pagina's goedkeuren; KvK/zakelijke basis delen met RuneBinder (zie RuneBinder-plan) | Vóór lancering |

---

## 11. Kosten (MVP)

| Post | Per maand |
|---|---|
| Cloudflare (Workers, R2, Pages) | €0 binnen gratis limieten |
| Supabase | €0 (gratis plan; let op 500 MB database en 1 GB opslag — foto's staan in R2) |
| Kaarttegels (OpenFreeMap of eigen PMTiles) | €0 |
| PDOK Locatieserver | €0 |
| GitHub Actions (privé) | €0 binnen 2.000 minuten |
| AI-voorbeoordeling | ±€2–10, met harde limiet |
| Domein | ±€1 (jaarlijks ±€10–15) |

Gratis plannen hebben limieten. Claude Code legt per dienst vast wat de limiet is, hoe we die bewaken, en wat er gebeurt bij overschrijding (bijvoorbeeld: Supabase-database boven 500 MB wordt alleen-lezen; Worker-quotum op). Dezelfde aanpak als in het RuneBinder-plan.

---

## 12. Juridisch en licenties

- **OpenStreetMap (ODbL):** bronvermelding "© OpenStreetMap-bijdragers" op de kaart en in de footer. **Share-alike:** onze database met daaruit afgeleide gegevens moet op verzoek onder ODbL beschikbaar zijn. Gevolg: concurrenten kunnen die verrijkte OSM-afgeleide data opvragen. Opties: (a) accepteren en zelfs terugbijdragen aan OSM (goed voor de community en de datakwaliteit), (b) eigen invoer en Overture/Foursquare-data (geen share-alike) gescheiden houden van OSM-afgeleide data. De keuze is niet simpelweg één of twee databases: in M0 komt er een **concrete licentieanalyse van de datastromen** (wat we verplicht moeten delen, wat eigen data blijft). Daarna beslissing D4.
- **Overture (CDLA Permissive 2.0)** en **Foursquare OS Places (Apache 2.0):** bronvermelding conform licentie.
- **Databankenrecht:** geen gegevens overnemen uit andere gidsen of verzamelagenda's.
- **Organisatorsites uitlezen:** alleen volgens de regels in §5.2 (eigen markten, voorwaarden en robots.txt gecheckt, alleen feiten, bronvermelding, stoppen op verzoek). De licentieanalyse in M0 toetst dit.
- **Gemeenteblad:** CC-0.
- **AVG:** privacyverklaring; EXIF/GPS uit foto's verwijderen; geen herkenbare personen op foto's zonder toestemming; account en data verwijderen mogelijk; verwerkers (Cloudflare, Supabase, AI-dienst, Sentry) benoemen.
- **DSA en reviews:** zie §7.3 en §7.4.
- **Cookies:** cookieloze analytics, dus geen banner nodig in de MVP; pas bij ads een CMP.
- **Zakelijk:** zodra er inkomsten zijn, dezelfde basis als RuneBinder (KvK, colofon, belasting; zie het RuneBinder-plan).

---

## 13. Risico's

| Risico | Impact | Maatregel |
|---|---|---|
| Te weinig of onbetrouwbare marktdata (kip-ei) | Hoog | Proof of concept in M0 met organisatorsites en OSM vóór de echte bouw; proefregio; bevestigingsstatus per editie; Gemeenteblad als ontdekkanaal; lanceren in het voorjaar |
| Organisatorsite verandert of organisator wil niet uitgelezen worden | Middel | Test per uitlezer en melding bij afwijking; bij bezwaar direct stoppen; organisator eigen invoer aanbieden |
| OSM-dekking kringlopen valt tegen | Middel | Overture/Foursquare als ontdekbron; handmatige vulling met AI-hulp; ketens om toestemming vragen |
| Openingstijden verouderd | Middel | "Laatst gecontroleerd"-datum; meldknop; eigenaren laten claimen |
| Bijhouden en moderatie kosten te veel tijd | Middel | AI-voorbeoordeling; limieten; later vertrouwde bijdragers |
| Kringloop-Info.nl (10 jaar voorsprong) en Google Maps | Middel | Onderscheiden met markten + kringlopen op één kaart, route, snelheid en overzicht |
| ODbL share-alike | Laag–middel | Beslissing D4, data gescheiden houden |
| Beperkte opbrengst (alleen ads) | Middel | Verwachting realistisch houden; organisatoren-vermeldingen als tweede bron |

---

## 14. Vragen voor Claude Code (technisch)

1. Astro + React-componenten, of een andere statische aanpak die past bij de RuneBinder-codebase? Wat is het makkelijkst te delen tussen beide projecten?
2. Kaarttegels: OpenFreeMap (extern, gratis) of eigen Protomaps-PMTiles op R2 (meer controle over stijl en beschikbaarheid)? Wat kost dat aan opslag voor NL + BE?
3. Hoe groot wordt het kaartdata-JSON-bestand bij ±2.000 locaties en ±500 markten, en is opsplitsen per regio nodig?
4. OSM-import: osmium-filter en tagselectie; welke naam- en tagcombinaties vangen kringlopen zonder valse treffers (bijvoorbeeld antiekwinkels, vintage-boetieks)?
5. Overture/Foursquare: welke categorieën horen bij kringlopen en markten, en hoe ontdubbelen we betrouwbaar met OSM?
6. Gemeenteblad-SRU: zoekquery, frequentie, en hoe halen we datum en locatie uit de tekst (AI-extractie met controle)?
6b. Uitlezers voor organisatorsites: per site een eigen uitlezer, of één generieke AI-extractie met controle? Hoe detecteren we wijzigingen in de site, verdwenen edities en dubbele markten?
7. Reeksen en edities (§5.2): hoe stellen we edities voor uit het herhaalpatroon zonder ze als bevestigd te tonen, en hoe verwerken we uitzonderingen, seizoensstops en afwijkende locaties?
7b. Publicatieaanpak (§6.1): herbouw bij goedkeuring, het statusbestand voor kritieke wijzigingen (waar opgeslagen, cache, hoe gelezen door kaart en detailpagina), en de garantie dat kaart en detail nooit verschillen.
7c. Veilige imports: staging, validatie, bescherming van handmatige velden, terugdraaien.
8. "Nu open"-berekening in de browser met `opening_hours`, tijdzone en feestdagen.
9. Route-optimalisatie in de browser voor 2–8 stops, en deeplinks naar Google Maps en Apple Maps met tussenstops (limieten per dienst).
10. Foto-upload: ondertekende R2-uploads, verkleinen/EXIF verwijderen in de browser, en hoe we foto's pas na goedkeuring tonen.
11. AI-voorbeoordeling: welk model, welke prompts, kosten per bijdrage, harde limiet.
12. Auth: magic link + Google + Apple in Supabase; RLS-beleid per tabel.
13. Bottom sheet met snap-punten en View Transitions: welke bibliotheken (bijvoorbeeld Vaul, Motion) passen bij de prestatie-eisen?
14. Hoe borgen we het snelheidsbudget (§6.3) met de kaart erbij?

---

## 15. Beslissingen voor Freek

| ID | Beslissing | Voorstel |
|---|---|---|
| D1 | Naam en domein (Snuffelkaart, Snuffelroute, iets anders?) | Kiezen in M0; beschikbaarheid domein checken |
| D2 | Kaarttegels: extern (OpenFreeMap) of eigen (Protomaps op R2) | Eigen, als de opslag binnen het gratis R2-quotum past |
| D3 | Inlogmethoden | Magic link + Google + Apple |
| D4 | OSM share-alike: accepteren en terugbijdragen, of OSM-afgeleide data gescheiden houden | Na de licentieanalyse in M0; voorkeur: accepteren en terugbijdragen |
| D5 | Lanceertijdstip | Kringlopen zodra M6 klaar is; markten in de proefregio bij voorkeur in het voorjaar 2027 (begin marktseizoen) |
| D6 | Reviews ook voor markten, of alleen voor kringlopen | Alleen kringlopen in de MVP (markten zijn eenmalige edities) |
| D7 | Organisatoren in de MVP: alleen formulier, of al een eigen account | Alleen formulier; accounts in M7 |
| D8 | Proefregio voor markten | Gelderland + Utrecht (dicht bij huis, veel markten, je kent de omgeving); definitief na de PoC (M0) |
| D9 | Worden "nog niet bevestigde" edities standaard getoond op de kaart? | Ja, met duidelijk label, maar niet in "Mijn zaterdag" tenzij je ze zelf toevoegt |

---

## 16. Bronnen

- Kringloop App (App Store): https://apps.apple.com/us/app/kringloop-app/id646950383 · reviews: https://www.appwereld.nl/app/kringloop-app/646950383/reviews/
- Kringloop Kompas: https://apps.apple.com/nl/app/kringloop-kompas/id6753792354
- Kringloop-Info.nl: https://www.kringloop-info.nl/app/
- Marktagenda's: https://www.marktenmarkten.nl/markten/rommel-vlooienmarkten/?paginanr=1 · https://www.rommelmarkten.org/ · https://marktenmeer.nl/rommelmarkt-agenda/ · https://www.dagjeweg.nl/kalender/rommelmarkt
- Kringloop Barneveld (rondje als concept): https://duurzaam.barneveld.nl/hergebruiken/kringlooprondje-barneveld
- Markt kringlopen (16 mln klanten, €156 mln omzet 2025): https://www.welingelichtekringen.nl/samenleving/kringloopwinkels-halen-recordomzet-en-verliezen-toch-geld-dit-merk-je-straks-aan-de-kassa
- OpenStreetMap-tag `shop=second_hand`: https://wiki.openstreetmap.org/wiki/Tag:shop=second_hand
- Overture Maps Places (CDLA Permissive 2.0): https://catalog.dvrpc.org/dataset/overture-maps-places
- Foursquare OS Places (Apache 2.0): https://docs.foursquare.com/data-products/docs/fsq-places-open-source
- Google Places-opslagregels: https://openplacesapi.com/blog/can-you-store-places-api-results
- Officiële Bekendmakingen (CC-0, SRU): https://data.overheid.nl/dataset/officiele-bekendmakingen
- KBO Open Data (België): https://economie.fgov.be/en/themes/enterprises/crossroads-bank-enterprises/services-everyone/public-data-available-reuse
- Openingsuren kringwinkels Vlaanderen (referentie, niet overnemen): https://www.openingsuren.vlaanderen/kringloopwinkels
