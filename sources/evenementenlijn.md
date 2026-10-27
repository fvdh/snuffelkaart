# De Evenementenlijn

- **Wat**: organisator (VOF) van binnenmarkten in sporthallen in Noord-Brabant (Kaatsheuvel, Breda, Best, Goirle, Vught, Hoogerheide, Drunen, Oisterwijk).
- **Agenda**: https://www.deevenementenlijn.nl/ (homepage "Markten in Brabant"): per markt hal, volledig adres, datum, tijden, kraamprijs, entree en binnen/buiten. Eén pagina, geen vervolgpagina's nodig.
- **Eigen markten**: ja. Geen verzamelsite.
- **robots.txt** (gecontroleerd 2026-10-27): `Disallow:` leeg, alles mag.
- **Voorwaarden**: disclaimer (PDF, https://www.deevenementenlijn.nl/wp-content/uploads/2025/02/Disclaimer-De-Evenementenlijn-VOF.pdf, gelezen 2026-10-27) gaat over aansprakelijkheid; geen verbod op hergebruik (geen juridische toets).
- **Wat we overnemen**: datum, tijden, hal, adres, binnen/buiten, entree, kraamprijs. Geen teksten of foto's.
- **Hoe vaak**: hooguit één keer per dag, één pagina, User-Agent `Snuffelkaart-PoC/0.1 (markten van organisatoren; freek@draad.nu)`.
- **Status in de app**: "Gecontroleerd op [datum]", met link naar hun marktpagina.
- **Test**: `app/scripts/fetch-markets.test.mjs` met `fixtures/evenementenlijn-agenda.html`.
- **Contact**: nog geen. Vragen ze ermee te stoppen: direct stoppen, gegevens verwijderen, eigen invoer aanbieden (§5.2).
