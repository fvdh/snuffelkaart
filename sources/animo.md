# Animo Vlooienmarkten

- **Wat**: organisator (Animo-Vlooienmarkten B.V., Amersfoort) van binnenvlooienmarkten in sporthallen in Gelderland (Achterhoek, Velp, Elst, Doesburg, Druten, Beuningen…).
- **Agenda**: https://animo-vlooienmarkten.nl/kalender: per markt plaats, hal, datum, adres (wisselend: alleen straat, of met postcode, of met plaats) en binnen/buiten, met een knop "Meer info" naar de marktpagina (`/kalender/<plaats>[-n]`, één pagina per editie). Op de marktpagina staan de tijden ("09:00 tot 16:00") en de kraamprijs.
- **Eigen markten**: ja. Geen verzamelsite.
- **robots.txt** (gecontroleerd 2026-10-27): `/admin`, `/api/` en `/kalender-flyer` dicht; kalender en marktpagina's mogen. Geen Crawl-delay.
- **Voorwaarden** (https://animo-vlooienmarkten.nl/voorwaarden, gelezen 2026-10-27): voorwaarden voor standhouders; geen verbod op hergebruik van gegevens gevonden. Onderaan elke pagina staat wel "Alle rechten voorbehouden": dat gaat over hun teksten en foto's; wij nemen alleen feiten over (geen juridische toets).
- **Wat we overnemen**: datum, tijden, plaats, hal, adres, binnen/buiten, kraamprijs. Entree staat er niet bij (alleen "kinderen tot 12 jaar gratis" in de lopende tekst): "onbekend". Geen teksten of foto's.
- **Let op**: adressen zonder postcode worden gezocht als "straat plaats"; bij een tikfout ("Schuberstraat 1, Elst") valt de plek terug op de plaats (niet exact). De markt in Druten ligt in Afferden ("Invictusstraat 1, Afferden/Druten"); we zoeken in Afferden.
- **Hoe vaak**: hooguit één keer per dag, 1,5 s tussen pagina's, User-Agent `Snuffelkaart-PoC/0.1 (markten van organisatoren; freek@draad.nu)`.
- **Status in de app**: "Gecontroleerd op [datum]", met link naar hun marktpagina.
- **Test**: `app/scripts/fetch-markets.test.mjs` met `fixtures/animo-kalender.html` en `fixtures/animo-markt.html`.
- **Contact**: nog geen. Vraagt Animo ermee te stoppen: direct stoppen, gegevens verwijderen, eigen invoer aanbieden (§5.2).
