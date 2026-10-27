# Organisatieburo Vitalis

- **Wat**: organisatieburo van markten in Drenthe, Groningen en Overijssel (Eelde Flowerdome, Assen Expo, Martiniplaza, Hardenberg).
- **Agenda**: https://vitalismarkten.nl/agenda/ en hun eigen iCal-feed `https://vitalismarkten.nl/events.ics` (datum, tijden, soort, link naar de marktpagina). Hal, adres, entree en standplaatsprijs staan op de marktpagina (`/markten/<naam>/`).
- **Eigen markten**: ja. Geen verzamelsite.
- **robots.txt** (gecontroleerd 2026-10-27): alleen `/wp-admin/`, `/wp-json/`, winkelwagen en WooCommerce-mappen dicht. Feed en marktpagina's mogen.
- **Voorwaarden** (https://vitalismarkten.nl/voorwaarden/, gelezen 2026-10-27): voorwaarden voor standhouders; geen verbod op hergebruik van gegevens gevonden (geen juridische toets).
- **Wat we overnemen**: datum, tijden, soort (vlooienmarkt, braderie, platenbeurs), hal, adres, entree, standplaatsprijs. Geen teksten of foto's. Winterfairs en kerstmarkten niet.
- **Hoe vaak**: hooguit één keer per dag, 1,5 s tussen pagina's, User-Agent `Snuffelkaart-PoC/0.1 (markten van organisatoren; freek@draad.nu)`.
- **Status in de app**: "Gecontroleerd op [datum]", met link naar hun marktpagina.
- **Test**: `app/scripts/fetch-markets.test.mjs` met `fixtures/vitalis-events.ics` en `fixtures/vitalis-markt.html`.
- **Contact**: nog geen. Vraagt Vitalis ermee te stoppen: direct stoppen, gegevens verwijderen, eigen invoer aanbieden (§5.2).
