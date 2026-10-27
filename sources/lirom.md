# LIROM Kofferbakmarkten

- **Wat**: Organisatie bureau LIROM (Venlo), kofferbakmarkten in Reuver bij manege/evenemententerrein De Paardenvriend: binnenmarkten in de winter, buitenmarkten van april t/m oktober, ongeveer 10 per jaar.
- **Agenda**: https://lirom.nl/agenda/: twee tabellen ("Overzicht datums “Binnen” markten" en "… “Buiten” markten") met dag, datum ("08 november 2026", ook "14 mei (hemelvaartsdag) 2026"), plaats en locatie. Adres op https://lirom.nl/locatie-markten/ (Bergerhofweg 1, 5953 NR Reuver; binnen en buiten hetzelfde).
- **Tijden**: staan nergens op de site (het reglement noemt alleen "niet voor 15.30 uur inpakken"): tijd onbekend, `timeKnown: false`.
- **Eigen markten**: ja. Geen verzamelsite.
- **robots.txt** (gecontroleerd 2026-10-27): alleen commentaar over Cloudflare-"content signals", zonder `Content-Signal`-regel en zonder `Disallow`: geen beperkingen.
- **Voorwaarden**: reglement (https://lirom.nl/reglement-lirom-kofferbak-markten/, gelezen 2026-10-27) gaat over standhouders; onderaan "© 2026 Lirom All Rights Reserved" (over hun site, wij nemen alleen feiten over). Geen verbod op hergebruik gevonden (geen juridische toets).
- **Wat we overnemen**: datum, plaats, locatie, adres, binnen/buiten. Geen teksten of foto's. Tikfout "De Paardenvrend" wordt "De Paardenvriend".
- **Let op**: op 2026-10-27 staat er nog maar één toekomstige markt in (8 november 2026); de agenda voor 2027 volgt later.
- **Hoe vaak**: hooguit één keer per dag, twee pagina's, 1,5 s ertussen, User-Agent `Snuffelkaart-PoC/0.1 (markten van organisatoren; freek@draad.nu)`.
- **Status in de app**: "Gecontroleerd op [datum]", met link naar hun agenda.
- **Test**: `app/scripts/fetch-markets.test.mjs` met `fixtures/lirom-agenda.html` en `fixtures/lirom-locatie.html`.
- **Contact**: nog geen. Vraagt LIROM ermee te stoppen: direct stoppen, gegevens verwijderen, eigen invoer aanbieden (§5.2).
