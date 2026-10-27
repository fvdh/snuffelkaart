# IJ-Hallen

- **Wat**: vlooienmarkt op de NDSM-werf in Amsterdam-Noord, een weekend per keer (zaterdag en zondag); binnen of buiten staat per weekend in de agenda.
- **Agenda**: https://ijhallen.nl/agenda.php: per weekend datum ("31 oktober en 1 november 2026"), tijden, aantal kramen en binnen/buiten. Eén pagina, geen pagina per markt.
- **Adres**: altijd hetzelfde, van https://ijhallen.nl/locatie.php: IJ-Hallen, NDSM-Plein 1, 1033 WC Amsterdam(-Noord). Staat vast in de uitlezer; verhuizen ze, dan moet de uitlezer mee.
- **Eigen markten**: ja. Geen verzamelsite.
- **robots.txt** (gecontroleerd 2026-10-27): `/robots.txt` stuurt door naar `/web2/robots.txt`, dat 403 geeft. Er is dus geen robots.txt; volgens de standaard (RFC 9309) geldt een 4xx als "geen beperkingen". De agenda zelf geeft gewoon 200.
- **Voorwaarden**: geen algemene voorwaarden of disclaimer op de site; het marktreglement (https://ijhallen.nl/marktreglement.php, gelezen 2026-10-27) gaat over standhouders. Geen verbod op hergebruik gevonden (geen juridische toets).
- **Wat we overnemen**: datum (één editie per dag), tijden, aantal kramen, binnen/buiten. Entree staat niet in de agenda (kaartjes via visitors.ijhallen.nl): "onbekend". Geen teksten of foto's.
- **Hoe vaak**: hooguit één keer per dag, één pagina, User-Agent `Snuffelkaart-PoC/0.1 (markten van organisatoren; freek@draad.nu)`.
- **Status in de app**: "Gecontroleerd op [datum]", met link naar hun agenda.
- **Test**: `app/scripts/fetch-markets.test.mjs` met `fixtures/ijhallen-agenda.html`.
- **Contact**: nog geen. Vragen ze ermee te stoppen: direct stoppen, gegevens verwijderen, eigen invoer aanbieden (§5.2).
