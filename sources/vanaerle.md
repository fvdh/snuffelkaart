# Van Aerle (vlooienmarkten.nl)

- **Wat**: organisator van grote hallenmarkten door heel Nederland (Brabanthallen, Expo Houten, Gelredome, Jaarbeurs, Autotron, Gorinchem, Breda, Zutphen, Hilversum…), 35–40 per jaar.
- **Agenda**: https://www.vlooienmarkten.nl/agenda-markten/ ("aankomende evenementen georganiseerd door van Aerle"): tabel met datum + aantal dagen, naam, locatie, plaats, kraamprijs, type; per markt een productpagina met vaste velden (Openingstijden, Inbrengtijden, Toegangsprijs, Locatienaam, Adres, Postcode, Plaats).
- **Eigen markten**: ja. Geen verzamelsite.
- **robots.txt** (gecontroleerd 2026-10-27): geen regels.
- **Voorwaarden**: geen verbod op hergebruik gevonden (onderzoek 2026-10-27, geen juridische toets).
- **Wat we overnemen**: datum(s), openingstijden (niet de inbrengtijden), entree, kraamprijs, hal + adres. Binnen/buiten uit naam en hal ("openlucht", "buitenmarkt" gaan voor). Geen teksten of foto's.
- **Valkuilen**: "€ 6 voor volwassenen, Gratis Parkeren" is níet gratis (bedrag gaat voor); "00:00 - 00:00" = tijden niet ingevuld → "tijden bij de organisator".
- **Hoe vaak**: hooguit één keer per dag, 1,5 s tussen pagina's, User-Agent `Snuffelkaart-PoC/0.1 (markten van organisatoren; freek@draad.nu)`.
- **Status in de app**: "Gecontroleerd op [datum]", met link naar hun marktpagina (kraam boeken).
- **Test**: `app/scripts/fetch-markets.test.mjs` met `fixtures/aerle-agenda.html` en `fixtures/aerle-product.html`.
- **Contact**: nog geen. Vraagt Van Aerle ermee te stoppen: direct stoppen, gegevens verwijderen, eigen invoer aanbieden (§5.2).
