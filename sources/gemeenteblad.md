# Gemeenteblad (Officiële Bekendmakingen)

Gemeenteblad-test (M0, §5.2 en §9). Onderzoek 2026-10-27, periode **2026-09-27 t/m 2026-10-27** (publicatiedatum). Niemand benaderd.

- **Wat**: gemeentelijke bekendmakingen, waaronder aanvragen en besluiten voor evenementenvergunningen en meldingen klein evenement.
- **Licentie**: CC-0 ([data.overheid.nl, "officiele-bekendmakingen"](https://data.overheid.nl/dataset/officiele-bekendmakingen)). Feiten mogen we overnemen; bronvermelding toch tonen ("Bron: Gemeenteblad [gemeente], [datum]" + link).
- **Hoe vaak**: één keer per dag, 1 s tussen verzoeken, User-Agent `Snuffelkaart-PoC/0.1 (gemeenteblad-test; freek@draad.nu)`. Geen sleutel nodig.
- **Testscript**: `app/scripts/gemeenteblad-test.mjs` (los, niet gekoppeld aan de app).

## Zo bevraag je het

SRU 2.0 op `https://repository.overheid.nl/sru`, parameters `query` (CQL), `maximumRecords` (max. 100), `startRecord` (bladeren via `nextRecordPosition`). Antwoord is XML.

```
c.product-area==officielepublicaties
AND w.publicatienaam==Gemeenteblad
AND dt.available>=2026-09-27 AND dt.available<=2026-10-27
AND (cql.textAndIndexes="rommelmarkt" OR cql.textAndIndexes="vlooienmarkt" OR …)
```

Valkuilen:
- `dt.type==gemeenteblad` geeft 0: `dt.type` is de **rubriek** (bv. `"evenementenvergunning"`, `"evenementmelding"`), niet het blad. Het blad is `w.publicatienaam`.
- Zoektermen **tussen aanhalingstekens**. De index stemt zelf ("rommelmarkt" vindt ook "rommelmarkten", allebei 22). Een `*` werkt níet betrouwbaar (`rommel*` gaf 6, `snuffel*` 0).
- Per record staan in de metadata al: id (`gmb-2026-…`), titel, gemeente (`dcterms:creator`), publicatiedatum, rubriek (`dcterms:type`), soms adres + **coördinaat** (`overheidwetgeving:locatiepunt`, WGS84) en de link `https://zoek.officielebekendmakingen.nl/<id>.html`. De volledige tekst staat in de XML-variant (`gzd:url`).

## Resultaat (één maand)

| Zoekterm | Treffers |
|---|---|
| rommelmarkt | 22 |
| vlooienmarkt | 22 |
| braderie | 25 |
| snuffelmarkt | 18 |
| garagesale / "garage sale" | 4 / 2 |
| vrijmarkt | 2 |
| kofferbakmarkt / kofferbakverkoop | 1 / 0 |
| curiosamarkt | 0 |
| **Uniek** | **80** |

Ter vergelijking: "evenementenvergunning" alleen al geeft 2.710 publicaties in dezelfde maand.

**Beoordeling van de 80 (alle teksten gelezen):**

| | Aantal |
|---|---|
| Vals-positief: APV's, legesverordeningen, beleidsregels, subsidieregels, omgevingsplannen (de term staat in een opsomming) | 19 |
| **Echt markt-evenement** (aanvraag, vergunning of melding) | **61** (47 gemeenten) |
| — waarvan aanvraag / verleend / melding | 21 / 29 / 11 |
| — met datum | 60 (Noordenveld noemt alleen "dec 2026") |
| — met plek (adres, straat, hal of plein) | ±55; 44 hebben ook een coördinaat in de metadata |
| — met tijden | 29 |
| — met organisator bij naam | ±10 (vereniging, kerk, scouting, Animo Vlooienmarkten); meestal weggelaten |
| — **nog in de toekomst** (minstens één datum na 2026-10-27) | **48 publicaties, ±83 edities** (Vlaardingen alleen al 24 zondagen in 2027) |
| — al voorbij | 13 (was bij publicatie wél toekomst, op één na) |
| — al gedekt door onze organisator-uitlezers (De Haspel, A Gene Bek, Glanerbrook, Strijthagen, Fluitpolder) | 9 |

Vals-positieven zijn **perfect te scheiden op rubriek**: alle 19 zijn "algemeen verbindend voorschrift (verordening)", "beleidsregel", "ruimtelijk plan of omgevingsdocument" of "ander besluit van algemene strekking"; de 61 echte zijn "evenementenvergunning" (46), "evenementmelding" (9), "andere beschikking/vergunning", "omgevingsvergunning" of "overige overheidsinformatie". Dus: rubrieken met regelgeving uitsluiten, niet alleen evenementenvergunning toelaten (dan mis je 7 echte).

Twijfelgevallen binnen de 61: "Markt/braderie" Azewijn (12:00–01:00, met alcohol en vuur: eerder een winterfeest), "Paardenmarkt met braderie" Lottum, boekenmarkt Roden, cadeaumarkt Rijswijk. Een mens beslist.

**Voorlooptijd**: aanvragen komen vaak maanden vooruit (IJ-Hallen juli 2027, Putten juni 2027, garagesale Heerlen mei 2027). Besluiten en meldingen soms pas een paar dagen ervoor (braderie Rotterdam-Vuurplaats: gepubliceerd 2 okt, markt 3 okt). Katwijk: aanvraag gepubliceerd 15 okt voor "10-07-2026", vermoedelijk tikfout voor 2027.

**Wie publiceert, en de gaten**: sterk in Limburg (Heerlen, Sittard-Geleen, Landgraaf, Echt-Susteren, Roerdalen, Maasgouw, Leudal, Maastricht) en Brabant (Breda, Goirle, Nuenen, Oisterwijk, Oss, Land van Cuijk, Maashorst, Loon op Zand, Helmond). Ook Rotterdam, Utrecht, Amsterdam (alleen de IJ-Hallen). Geen enkele treffer uit Zeeland en Flevoland, nauwelijks uit Friesland (alleen Opsterland) en Groningen (Veendam, Midden-Groningen), en niets uit Den Haag, Eindhoven, Tilburg, Nijmegen, Groningen-stad, Almere, Haarlem. Vermoedelijke oorzaken: geen publicatieplicht voor meldingen klein evenement, publicatie alleen op de eigen site of in het huis-aan-huisblad, of een marktnaam zonder onze zoekwoorden ("Najaarsmarkt", "Hobbymarkt").

**Seizoen en volume**: dezelfde zoekvraag over heel 2025 geeft 2.031 treffers (2024: 1.933). Per maand 2025: jan 155, mrt 247, apr 249, jun 149, okt 60, dec 260. December zit vol met nieuwe APV's en legesverordeningen (±70% regelgeving in een steekproef van 200), april en juni ±20–25%. Schatting: **±1.200–1.500 markt-publicaties per jaar**, goed voor naar schatting 1.000+ edities (veel publicaties dekken meerdere data). Oktober is een rustige maand.

## Steekproef (bruikbaar, in de toekomst)

| Gemeente | Soort | Datum | Plek | Status | Link |
|---|---|---|---|---|---|
| Breda | vlooienmarkt | 8 nov 2026, 09:00–16:30 | Nieuwe Inslag 99 | verleend | [gmb-2026-465006](https://zoek.officielebekendmakingen.nl/gmb-2026-465006.html) |
| Bronckhorst | vlooienmarkt | 3 jan 2027 | Monumentenweg 30, Hoog-Keppel | verleend | [gmb-2026-494697](https://zoek.officielebekendmakingen.nl/gmb-2026-494697.html) |
| De Ronde Venen | braderie (4×) | 27 mrt, 19 jun, 2 okt, 20 nov 2027, 09–17 | Raadhuisplein/Dorpsstraat, Mijdrecht | aanvraag (verzamellijst) | [gmb-2026-457170](https://zoek.officielebekendmakingen.nl/gmb-2026-457170.html) |
| Dordrecht | rommelmarkt | 5 jun 2027 | Dubbelsteynlaan West 70 | aanvraag | [gmb-2026-486715](https://zoek.officielebekendmakingen.nl/gmb-2026-486715.html) |
| Echt-Susteren | rommelmarkt (3×) | 6 dec 2026, 17 jan, 7 mrt 2027, 09–16 | Bandertlaan 7, Echt | verleend | [gmb-2026-468218](https://zoek.officielebekendmakingen.nl/gmb-2026-468218.html) |
| Epe | rommelmarkt | 31 okt 2026 | Kuipersheem | melding | [gmb-2026-468076](https://zoek.officielebekendmakingen.nl/gmb-2026-468076.html) |
| Heerlen | garagesale (route) | 2 mei 2027 | Wehr, Overbroekerstraat e.a., Hoensbroek | aanvraag | [gmb-2026-459327](https://zoek.officielebekendmakingen.nl/gmb-2026-459327.html) |
| Lansingerland | rommelmarkt (3×) | 29 nov 2026, 31 jan, 7 mrt 2027 | Oostmeerhal, Hoge Land 19, Berkel en Rodenrijs | verleend | [gmb-2026-468431](https://zoek.officielebekendmakingen.nl/gmb-2026-468431.html) |
| Leudal | rommelmarkt particulieren (2×) | 29 nov 2026, 14 mrt 2027, 09–16 | Arevenlaan 3, Heythuysen | verleend | [gmb-2026-495183](https://zoek.officielebekendmakingen.nl/gmb-2026-495183.html) |
| Maastricht | garagesale | 8 nov 2026, 10–16 | Praaglaan 108 (Randwyck) | aanvraag melding | [gmb-2026-459176](https://zoek.officielebekendmakingen.nl/gmb-2026-459176.html) |
| Nuenen | garagesale (route) | 1 nov 2026, 09:30–15:00 | Beukenlaan, Eikenlaan e.a. | melding | [gmb-2026-488802](https://zoek.officielebekendmakingen.nl/gmb-2026-488802.html) |
| Putten | rommelmarkt | 12 jun 2027, 09–15 | Krachtighuizerweg 38 | aanvraag | [gmb-2026-471879](https://zoek.officielebekendmakingen.nl/gmb-2026-471879.html) |
| Rhenen | rommelmarkt (kerk) | 21 nov 2026, 10–15 | Achterbergsestraatweg 59a | verleend | [gmb-2026-491467](https://zoek.officielebekendmakingen.nl/gmb-2026-491467.html) |
| Roerdalen | vlooienmarkt (2×) | 1 nov, 13 dec 2026, 09–16 | Apollolaan 2, Melick | melding | [gmb-2026-452271](https://zoek.officielebekendmakingen.nl/gmb-2026-452271.html) |
| Utrecht | rommelmarkt | 22 nov 2026, 09–17 | Plantage | aanvraag | [gmb-2026-462914](https://zoek.officielebekendmakingen.nl/gmb-2026-462914.html) |
| Veendam | snuffelmarkt | 8 nov 2026 | Sorghvliethal, Jan Salwaplein 1 | melding | [gmb-2026-466037](https://zoek.officielebekendmakingen.nl/gmb-2026-466037.html) |
| Vlaardingen | snuffelmarkt (12×) | 1e zondag/mnd 2027, 12–16 (+ tweede reeks 12×) | Veerplein | verleend | [gmb-2026-497816](https://zoek.officielebekendmakingen.nl/gmb-2026-497816.html) |
| Wijdemeren | vlooienmarkt | 1 nov 2026 | Zuidsingel 54, Kortenhoef | verleend | [gmb-2026-475949](https://zoek.officielebekendmakingen.nl/gmb-2026-475949.html) |

## Conclusie

**Bruikbaar als ontdekkanaal, niet als hoofdbron.** ±75% van de treffers is een echt markt-evenement, bijna alles met datum en plek, en ze vullen precies het gat van de organisator-uitlezers: buurtrommelmarkten, garagesale-routes, kerk- en scoutingmarkten. Maar de dekking is grillig (sterk in Limburg/Brabant, gaten in Zeeland, Flevoland, Friesland en de grote steden), tijden staan er maar in de helft, organisator zelden, en een aanvraag is nog geen vergunning.

Wat een uitlezer moet doen:
1. Dagelijks SRU met de query hierboven, `dt.available>=` gisteren; termen rommelmarkt, vlooienmarkt, kofferbakmarkt, kofferbakverkoop, braderie, vrijmarkt, garagesale, "garage sale", snuffelmarkt (later uitbreiden met bv. "boekenmarkt", "kleedjesmarkt" en toetsen).
2. Rubrieken met regelgeving weggooien (verordening, beleidsregel, ruimtelijk plan, besluit van algemene strekking).
3. Velden uit de XML-tekst halen: soort, datum(s) (één publicatie kan 1–24 data hebben; verzamellijsten bevatten meerdere evenementen), tijden, locatie, organisator, status (aanvraag / verleend / melding). De teksten zijn per gemeente vaak een vast sjabloon ("Naam evenement:", "Datum:", "Locatie:"); voor de rest regex of AI-hulp.
4. Coördinaat uit `locatiepunt` gebruiken als die er is, anders adres + gemeente geocoderen via PDOK Locatieserver.
5. Ontdubbelen: aanvraag en latere vergunning van hetzelfde evenement (zelfde zaaknummer of gemeente + datum + plek), en tegen markten die al uit organisatorsites komen.
6. Alles als **kandidaat** in de wachtrij met bron "Gemeenteblad [gemeente], [datum]" en link; nooit automatisch als "bevestigd" op de kaart. Aanvraag = "aangevraagd, nog niet zeker".

Volume: ±1.200–1.500 publicaties per jaar, na filtering ±1.000 bruikbare kandidaten, piek maart–juni (braderieën, Koningsdag-vrijmarkten, garagesales) en veel regelgeving in december.
