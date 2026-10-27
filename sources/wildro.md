# Organisatieburo Wildro

- **Wat**: organisatieburo sinds 1995; eigen braderieën en vlooienmarkten in Drenthe, Groningen en Overijssel (±80 per jaar, waarvan ±30 vlooienmarkten).
- **Agenda**: https://wildro.nl/vlooienmarkten/ en de openbare API van hun agenda-plugin: `https://wildro.nl/wp-json/tribe/events/v1/events` (datum, tijden, categorie). De plek ("Locatie: Nobellaan, Assen") staat op de eventpagina.
- **Eigen markten**: ja, organisatieburo van de markten zelf. Geen verzamelsite.
- **robots.txt** (gecontroleerd 2026-10-27): `Disallow:` leeg, alles mag.
- **Voorwaarden**: geen verbod op hergebruik gevonden (onderzoek 2026-10-27, geen juridische toets).
- **Wat we overnemen**: datum, tijden, soort (braderie/vlooienmarkt), plek (straat + plaats → PDOK), kraamprijs. Geen teksten of foto's. Kerstmarkten en lichtfestivals niet (geen tweedehands).
- **Hoe vaak**: hooguit één keer per dag, 1,5 s tussen pagina's, User-Agent `Snuffelkaart-PoC/0.1 (markten van organisatoren; freek@draad.nu)`.
- **Status in de app**: "Gecontroleerd op [datum]", met link naar hun eventpagina.
- **Test**: `app/scripts/fetch-markets.test.mjs` met `fixtures/wildro-event.html` en `fixtures/wildro-events.json`.
- **Contact**: nog geen. Vraagt Wildro ermee te stoppen: direct stoppen, gegevens verwijderen, eigen invoer aanbieden (§5.2).
