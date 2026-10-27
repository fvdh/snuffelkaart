# Licentieanalyse van de datastromen (M0, §12)

Stand 2026-10-27, op basis van wat de code nu echt doet. Inschatting, geen juridisch advies. Doel: weten wat we moeten delen, wat van ons blijft, en wat Freek moet beslissen (D4).

## Stromen

| Stroom | Licentie / grondslag | Waar het landt | Wat we moeten doen | Status |
|---|---|---|---|---|
| OSM-winkels (Overpass, later Geofabrik) | ODbL 1.0 | `places.json` (`src: 'osm'`) | Bronvermelding; afgeleide database op verzoek onder ODbL (zie onder) | In orde (vermelding + ODbL-melding, D4) |
| Overture Places | CDLA Permissive 2.0 | `places.json` (`src: 'overture'`, id `ov-…`) en website/telefoon bij OSM-winkels | Bronvermelding; geen share-alike | In orde |
| Foursquare OS Places (#18) | Apache 2.0 | nog niet | Bronvermelding + licentietekst meeleveren | n.v.t. |
| Openingstijden van de eigen winkelsite | Feiten, geen databank van een ander | `places.json` (`hs: 'web'`) | Bron + datum tonen (doen we); robots.txt (doen we) | In orde |
| Markten van organisatorsites | Feiten; zie "Organisatorsites" | `markets.json` | Regels §5.2; voorwaarden per site in `sources/<naam>.md` | In orde, per site vastgelegd |
| Gemeenteblad | CC0 | nog niet (test loopt) | Niets verplicht | n.v.t. |
| PDOK Locatieserver (BAG) | CC0 | coördinaten van marktadressen, zoeken | Niets verplicht | In orde |
| CBS-grenzen (PDOK) | CC BY 4.0 | alleen om te knippen, niet gepubliceerd | Niets, zolang we de grenzen zelf niet tonen | In orde |
| Kaarttegels OpenFreeMap | OSM (ODbL) + OpenMapTiles, als *Produced Work* | de kaart | Zichtbare vermelding op de kaart | Compacte vermelding linksboven: controleren of die op mobiel zichtbaar genoeg is |

## OSM en share-alike (ODbL)

- **De kaart en de lijst** zijn een *Produced Work*: alleen bronvermelding nodig.
- **`places.json` is zelf een database** die iedereen kan downloaden. Het OSM-deel daarvan is een *Derivative Database* (gefilterd, opgeschoond, aangevuld). Publiek gebruik betekent: dat deel onder ODbL aanbieden.
- **Wat erin gemengd is, wordt ODbL.** Bij OSM-winkels vullen we website en telefoon uit Overture aan, en openingstijden van hun eigen site. Die velden horen daarna bij het afgeleide OSM-record. Mag van Overture (CDLA laat dat toe) en van ons zelf, maar we geven ze daarmee weg.
- **Overture-records die apart staan** (`src: 'overture'`) zijn naar onze lezing een *Collective Database*: OSM-licentie geldt er niet voor. **Twijfelpunt:** we gebruiken OSM om Overture-dubbelingen weg te gooien. Of dat volgens de OSMF-richtlijn (Collective Database Guideline) de Overture-records "afgeleid" maakt, is niet uitgezocht. Gevolg is beperkt: in het ergste geval valt het hele bestand onder ODbL.
- **Markten** (`markets.json`) komen niet uit OSM en gebruiken PDOK voor de plek: geen ODbL.
- **Wat het in de praktijk kost:** iemand kan onze opgeschoonde kringlooplijst overnemen. Dat kan nu al (het bestand is openbaar). De markten, onze eigenlijke voorsprong, vallen er niet onder.

## Organisatorsites

- **Databankenrecht** beschermt de investering in het *verzamelen en controleren* van bestaande gegevens, niet in het *maken* ervan (HvJ EU, *British Horseracing Board* en *Fixtures Marketing*, 2004). Een organisator die zijn eigen marktdatums publiceert, heeft daardoor meestal geen beschermde databank. Verzamelsites wel: die blijven verboden terrein.
- **Auteursrecht**: datum, tijd, adres en prijs zijn feiten. We nemen geen teksten, foto's of logo's over.
- **Gebruiksvoorwaarden tellen wél.** Is een databank niet beschermd, dan mag de eigenaar hergebruik toch contractueel beperken (HvJ EU, *Ryanair / PR Aviation*, 2015). Of losse websitevoorwaarden een bezoeker binden, is in Nederland niet zeker, maar we gaan uit van ja. Daarom: Thomas09 en Supervlooi niet zonder toestemming, en per site de voorwaarden vastleggen (doen we).
- **robots.txt** is geen wet, maar we volgen het. Met stoppen-op-verzoek en bronlink naar de organisator houden we het risico laag.

## Te doen

1. ☑ **D4 (Freek, 2026-10-27): accepteren.** Scheiden kost veel (twee bestanden, geen aanvulling van OSM-winkels) en beschermt alleen de kringlooplijst, die toch al openbaar is.
2. ☑ ODbL-vermelding (§4.3): in de app bij de bronnen, met downloadlink, en `public/data/LICENTIE.txt` naast het bestand.
3. OSMF Collective Database Guideline nalezen voor het ontdubbelen van Overture tegen OSM (twijfelpunt hierboven).
4. Kaartvermelding op 375 px controleren tegen de OSMF Attribution Guideline.
5. Bij Foursquare (#18): Apache-licentietekst en vermelding toevoegen.
6. Terugbijdragen aan OSM: niet automatisch (importrichtlijnen van OSM). Wel de knop "Pas het aan op OpenStreetMap" houden, en later eventueel handmatig ontbrekende kringlopen invoeren.
