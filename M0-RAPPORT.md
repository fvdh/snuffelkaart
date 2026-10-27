# M0-rapport: werkt het met echte gegevens?

Stand 2026-10-27, gemeten op `app/public/data/*.json` na de laatste uitlezing. Vraag uit §9 M0: per bron het aantal bruikbare records, markten per weekend per provincie, hoeveel organisatorsites uitleesbaar zijn, en het onderhoud per uitlezer.

## Kort

- **Kringlopen: ja.** 3701 winkels in heel Nederland, 30% met openingstijden. Genoeg voor een bruikbare kaart; tijden zijn het zwakke punt.
- **Markten: ja, maar dun en scheef verdeeld.** 190 markten van 14 organisatoren, ±8 per weekend landelijk. Noord-Holland, Brabant en Limburg goed; Friesland, Groningen en Zeeland bijna leeg.
- **Gemeenteblad: bruikbaar als ontdekkanaal** (±1.200–1.500 markten per jaar, vooral kleine), niet als hoofdbron.

## Kringlopen (per bron)

| Bron | Winkels | Met openingstijden |
|---|---|---|
| OpenStreetMap | 1049 | 574 (uit OSM) |
| Overture | 2652 | — |
| Eigen website van de winkel | — | 532 (bij OSM- en Overture-winkels) |
| **Totaal** | **3701** (895 kringloop, 194 goede doelen, 2612 overige tweedehands) | **1106 (30%)** |

Foursquare (derde bron) nog niet getest: wacht op een Hugging Face-account. De steekproef van 50 bekende kringlopen (Freek) staat nog open.

## Markten

**Organisatorsites:** 24 organisatoren met een eigen agenda gevonden.

| Uitkomst | Aantal |
|---|---|
| Uitgelezen | 14 |
| Niet zonder toestemming (verbod in de voorwaarden) | 2 (Thomas09, Supervlooi) |
| Niet uitleesbaar (robots.txt, datums als plaatje, lopende tekst) | 2 (Ferrion, ReZi) |
| Niets bruikbaars (alleen kerst/winter, datums nog niet bekend, voorbij) | 4 |
| Geen website gevonden | 2 |

**Resultaat:** 190 markten, van 31 okt 2026 t/m 22 aug 2027. 187 met tijden, 180 met exacte plek. Allemaal "gecontroleerd". Soorten: 148 vlooienmarkt, 17 rommelmarkt, 11 kofferbakmarkt, 5 braderie, overig 9.

**Per organisator:** Don Events 40, Van Aerle 35, VAC 21, Mikki 18, De Evenementenlijn 15, IJ-Hallen 14, Animo 11, Vitalis 10, Carbootsale Horst 10, Wildro 6, JoJo 5, MDV 2, Twentse Vlooienmarkt 2, LIROM 1.

**Per weekend:** de komende 9 weekenden (31 okt t/m 20 dec) samen 75 markten, ±8 per weekend landelijk.

| Provincie | 9 weekenden | Per weekend | Alle bekende datums |
|---|---|---|---|
| Noord-Holland | 16 | 1,8 | 48 |
| Noord-Brabant | 11 | 1,2 | 27 |
| Limburg | 10 | 1,1 | 34 |
| Zuid-Holland | 9 | 1,0 | 18 |
| Drenthe | 9 | 1,0 | 11 |
| Gelderland | 6 | 0,7 | 22 |
| Utrecht | 5 | 0,6 | 11 |
| Overijssel | 4 | 0,4 | 12 |
| Groningen | 3 | 0,3 | 3 |
| Zeeland | 1 | 0,1 | 2 |
| Fryslân | 1 | 0,1 | 2 |
| Flevoland | 0 | 0 | 0 |

**Let op bij het lezen:**
- Het voorjaar lijkt leeg (april–augustus samen 29), maar dat komt doordat organisatoren 2027 nog niet hebben gepubliceerd. Het marktseizoen piekt juist dan.
- Wildro (±80 per jaar) staat er met 6 in: hun buitenseizoen is voorbij.
- Dit zijn vooral grote, georganiseerde markten. De kleine buurt-, kerk- en schoolmarkten ontbreken; die komen uit het Gemeenteblad en van gebruikers.

## Gemeenteblad (verslag: `sources/gemeenteblad.md`)

Eén maand (27 sep – 27 okt): 80 treffers, 61 echte markten uit 47 gemeenten, 29 met tijden, 48 nog in de toekomst (±83 marktdagen), 9 al gedekt door organisatoren. Over heel 2025: 2.031 treffers, geschat 1.200–1.500 markten. Gaten: Zeeland, Flevoland, Den Haag, Eindhoven, Tilburg, Nijmegen, Almere, Haarlem. Rol: kandidaten voor de wachtrij (M2), nooit automatisch gecontroleerd.

## Onderhoud per uitlezer

Nog niet te meten: de uitlezers draaien pas één dag. Wat we wel weten:
- Bouwen is goedkoop: de laatste 7 uitlezers (onderzoek, uitlezer, test met opgeslagen pagina, bronbestand) kostten een agent samen ±20 minuten.
- Elke uitlezer heeft een test; een import met 0 of veel minder markten wordt per organisator tegengehouden.
- Kwetsbaar: sites zonder jaartal (JoJo, Twentse Vlooienmarkt) en adressen in vrije tekst (geocoding valt dan terug op de plaats).

Meten na 4–6 weken dagelijks draaien: hoe vaak breekt een uitlezer, en hoeveel tijd kost herstel.

## Besluiten

- **D8, proefregio markten (Freek).** Het voorstel was Gelderland + Utrecht. Op organisatordata scoren die matig (samen ±1,3 markt per weekend). Sterker: Noord-Holland, of de strook Brabant + Limburg. Alternatief: heel Nederland tonen zoals nu, met de kringlopen als basis.
- **Organisatoren benaderen?** Alleen Thomas09 (±67 per jaar, Friesland) en Supervlooi (Leeuwarden) zijn het waard: samen het gat in het noorden. Contact = Freek.
- **D4 (ODbL):** genomen, zie `LICENTIES.md`.

## Nog open (houdt M2 niet tegen)

Steekproef 50 kringlopen, een weekend snuffelen met de app (testronde #16), Foursquare (#18), zoekwoordonderzoek (§8), naam en domein (D1).
