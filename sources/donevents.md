# Don Events

- **Wat**: eigen organisator van ±40 vlooienmarkten en kofferbakverkopen, vooral in Nederland (enkele in België/Duitsland).
- **Agenda**: https://donevents.nl/marktkalender/ → per markt een pagina `/product/…` met datum, tijden en volledig adres.
- **Eigen markten**: ja. "Alle evenementen worden georganiseerd door DonEvents" (kalenderpagina). Geen verzamelsite.
- **robots.txt** (gecontroleerd 2026-10-27): alleen `/wp-admin/`, winkelwagen-parameters en WooCommerce-logs zijn uitgesloten. Kalender en marktpagina's mogen.
- **Voorwaarden** (https://donevents.nl/algemene-voorwaarden/, gelezen 2026-10-27): gaan over kraamhuur en annuleren. Niets over hergebruik of uitlezen. Let op: "Controleer bij verwachte slechte weersomstandigheden altijd op de vrijdag voorafgaand via de website of de markt doorgaat." → in de app verwijzen naar hun pagina.
- **Wat we overnemen**: alleen feiten: datum, tijden, locatie + adres, aantal kramen, kraamhuur, binnen (afgeleid uit de hal). Geen teksten, foto's of logo's.
- **Hoe vaak**: hooguit één keer per dag, 1,5 s tussen pagina's, User-Agent `Snuffelkaart-PoC/0.1 (markten van organisatoren; freek@draad.nu)`.
- **Status in de app**: "Gecontroleerd op [datum]", met link naar hun marktpagina (daar boek je ook een kraam).
- **Test**: `app/scripts/fetch-markets.test.mjs` met opgeslagen pagina's in `app/scripts/fixtures/`.
- **Contact**: nog geen. Vraagt Don Events ermee te stoppen: direct stoppen, gegevens verwijderen, eigen invoer aanbieden (§5.2).
