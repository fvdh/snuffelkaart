# Organisatie Bureau VAC

- **Wat**: organisator van vlooienmarkten in Limburg ("de gezelligste vlooienmarkten van het zuiden"), ±45 per jaar, vooral in sporthallen; ook buitenmarkten (Pinkpop-plein, Drakenrijk).
- **Agenda**: https://org-vac.nl/ (homepage = agenda): per markt datum, plaats, hal, binnen/buiten, tijden, bezoekersentree, kraamprijs, en een pagina per datum (`/product/…`) met het adres.
- **Eigen markten**: ja. Geen verzamelsite.
- **robots.txt** (gecontroleerd 2026-10-27): alleen `/wp-admin/`, winkelwagen-parameters en WooCommerce-logs uitgesloten. Agenda en marktpagina's mogen.
- **Voorwaarden**: marktreglement voor standhouders, geen verbod op hergebruik gevonden (onderzoek 2026-10-27, geen juridische toets).
- **Wat we overnemen**: datum, tijden, plaats + hal + adres, binnen/buiten, entree, kraamprijs. Geen teksten of foto's.
- **Hoe vaak**: hooguit één keer per dag; elke datumpagina één keer, 1,5 s ertussen. User-Agent `Snuffelkaart-PoC/0.1 (markten van organisatoren; freek@draad.nu)`.
- **Status in de app**: "Gecontroleerd op [datum]", met link naar hun datumpagina (kraam reserveren).
- **Test**: `app/scripts/fetch-markets.test.mjs` met `fixtures/vac-agenda.html` en `fixtures/vac-markt.html`.
- **Contact**: nog geen. Vraagt VAC ermee te stoppen: direct stoppen, gegevens verwijderen, eigen invoer aanbieden (§5.2).
