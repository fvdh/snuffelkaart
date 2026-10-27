# JoJo Vlooienmarkten

- **Wat**: Organisatiebureau Jo-Jo (sinds 1990), vlooienmarkten in sporthallen in 't Gooi en de Vechtstreek (Bussum, Kortenhoef) en buiten in Doorn (Keizerswei). Ook braderieën, maar die agenda (`/agenda-braderieen`) is leeg ("Braderieën 2027", nog geen markten).
- **Agenda**: https://www.jojovlooienmarkten.nl/agenda-vlooienmarkten: een webshop (JouwWeb) met per markt een product (`/product/<nummer>/<naam>`). De producttitel is de datum en plaats: "Zondag 1 November Kortenhoef", "2de Paasdag (29 Maart) Keizerswei Doorn". Op de productpagina soms de hal ("wordt in sporthal De Fuik een grote vlooienmarkt…"), soms een adres ("De Beaufortweg 1 / 3941 PA Doorn"), en de kraamprijzen.
- **Jaar ontbreekt**: de titels hebben geen jaar. Keuze: **de eerstvolgende keer dat die dag en maand voorkomt, vanaf vandaag** (vandaag telt mee). Op 2026-10-27 wordt "1 november" dus 2026-11-01 en "28 februari" 2027-02-28. Controle: staat er een weekdag in de titel ("Zondag", of "2de Paasdag"/"2de Pinksterdag" = maandag), dan moet die kloppen met de gekozen datum; zo niet, dan slaan we de markt over (oude of foute pagina) in plaats van een jaar verder te zoeken. Alle vijf markten van 2026-10-27 klopten. De agendakop "2026-2027" bevestigt de keuze.
- **Tijden**: niet per markt vermeld. Het marktreglement (https://www.jojovlooienmarkten.nl/regelement) zegt "De marktlocaties zijn voor het publiek geopend van 9.00-16.00 uur"; die tijden gebruiken we voor alle markten.
- **Plek**: alleen Doorn heeft een adres (exacte plek). Bussum en Kortenhoef hebben alleen een halnaam, of (Kortenhoef 28 februari) zelfs die niet: de plek valt terug op de plaats (niet exact). Hal-adressen van elders aanvullen doen we niet.
- **Eigen markten**: ja. Geen verzamelsite.
- **robots.txt** (gecontroleerd 2026-10-27): alleen een `Sitemap:`-regel, geen beperkingen.
- **Voorwaarden**: geen algemene voorwaarden of disclaimer op de site; het marktreglement (gelezen 2026-10-27) gaat over standhouders. Geen verbod op hergebruik gevonden (geen juridische toets).
- **Wat we overnemen**: datum, plaats, hal of adres, binnen (bij "sporthal"/"overdekt"), kraamprijs (1 kraam). Entree: het reglement zegt dat er toegang wordt geheven, maar niet hoeveel: "onbekend". Geen teksten of foto's.
- **Hoe vaak**: hooguit één keer per dag, 1,5 s tussen pagina's, User-Agent `Snuffelkaart-PoC/0.1 (markten van organisatoren; freek@draad.nu)`.
- **Status in de app**: "Gecontroleerd op [datum]", met link naar hun productpagina.
- **Test**: `app/scripts/fetch-markets.test.mjs` met `fixtures/jojo-agenda.html`, `fixtures/jojo-markt.html` (Bussum, hal) en `fixtures/jojo-markt-adres.html` (Doorn, adres); de jaarkeuze apart (`nextDate`).
- **Contact**: nog geen. Vraagt JoJo ermee te stoppen: direct stoppen, gegevens verwijderen, eigen invoer aanbieden (§5.2).
