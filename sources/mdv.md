# MDV Evenementen

- **Wat**: organisator van rommelmarkten in sporthallen rond Rotterdam (Margriethal Schiedam; ook Maassluis, Vlaardingen, Dordrecht, De Lier op de locatiepagina). Nu (2026-10-27) staan alleen Schiedam-markten in de agenda, ongeveer één per maand.
- **Agenda**: https://www.mdv-evenementen.nl/ (blok "Agenda", per maand een tab): per markt datum, tijden ("09:00 17:00"), titel "22 November 2026 – (VOLGEBOEKT …) Mega-Rommelmarkt in de Margriethal in Schiedam" en link naar de eventpagina. Adressen van de hallen staan op https://www.mdv-evenementen.nl/locaties/; we koppelen op de plaats uit de titel.
- **Eigen markten**: ja. Geen verzamelsite.
- **robots.txt** (gecontroleerd 2026-10-27): alleen `/wp-admin/` dicht. Geen Crawl-delay.
- **Voorwaarden** (https://www.mdv-evenementen.nl/av/, gelezen 2026-10-27): voorwaarden voor standhouders; geen verbod op hergebruik gevonden (geen juridische toets).
- **Wat we overnemen**: datum, tijden, hal, adres, binnen (alleen sporthallen). Entree: op de eventpagina staat "Prijs € 4,50" zonder uitleg (entree of kraam?): niet overgenomen, "onbekend". "VOLGEBOEKT" gaat over kramen, niet over bezoekers: weggelaten. Geen teksten of foto's.
- **Hoe vaak**: hooguit één keer per dag, twee pagina's, 1,5 s ertussen, User-Agent `Snuffelkaart-PoC/0.1 (markten van organisatoren; freek@draad.nu)`.
- **Status in de app**: "Gecontroleerd op [datum]", met link naar hun eventpagina.
- **Test**: `app/scripts/fetch-markets.test.mjs` met `fixtures/mdv-agenda.html` en `fixtures/mdv-locaties.html`.
- **Contact**: nog geen. Vraagt MDV ermee te stoppen: direct stoppen, gegevens verwijderen, eigen invoer aanbieden (§5.2).
