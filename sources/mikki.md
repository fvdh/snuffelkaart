# Organisatieburo Mikki

- **Wat**: organisatieburo van vlooien-, kofferbak-, curiosa- en jaarmarkten in Noord-Holland en de Bollenstreek (Purmerend, Hoorn, Hillegom, Heemstede, Hoofddorp, IJmuiden…).
- **Agenda**: https://www.mikki.nl/ (homepage met paginering, "Pagina 1 van 2") geeft de links; per markt een eventpagina (`/event/<naam>/`) met datum, tijden, titel "Vlooienmarkt, Sporthal De Vaart", blok "Adres", toegang (lopende tekst) en kraamprijs.
- **Eigen markten**: ja. Geen verzamelsite.
- **robots.txt** (gecontroleerd 2026-10-27): `Disallow:` leeg, alles mag.
- **Voorwaarden** (https://www.mikki.nl/algemene-voorwaarden/, gescand 2026-10-27): voorwaarden voor standhouders; geen verbod op hergebruik van gegevens gevonden (geen juridische toets).
- **Wat we overnemen**: datum, tijden, soort, hal, adres, toegang, kraamprijs. Geen teksten of foto's. Kerstmarkten niet.
- **Let op**: het adres heeft vaak geen huisnummer ("Koggenland, 1447 CN Purmerend"); PDOK vindt dan de straat binnen de postcode.
- **Hoe vaak**: hooguit één keer per dag, 1,5 s tussen pagina's, User-Agent `Snuffelkaart-PoC/0.1 (markten van organisatoren; freek@draad.nu)`.
- **Status in de app**: "Gecontroleerd op [datum]", met link naar hun eventpagina.
- **Test**: `app/scripts/fetch-markets.test.mjs` met `fixtures/mikki-event.html`.
- **Contact**: nog geen. Vraagt Mikki ermee te stoppen: direct stoppen, gegevens verwijderen, eigen invoer aanbieden (§5.2).
