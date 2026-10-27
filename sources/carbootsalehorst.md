# Carbootsale Horst (MCC Events)

- **Wat**: MCC Events organiseert de carbootsale/rommelmarkt op het evenemententerrein van Kasteelpark Ter Horst (Peeldijkje, 5961 NK Horst), buiten, maart t/m oktober, om de twee weken op zondag.
- **Agenda**: https://carbootsalehorst.nl/ (homepage): per zondag een blok "Zondag 4 april 2027 / MEGA CARBOOTSALE / … / Markt open van 8.30 tot 15.30 uur / Dagkassa bezoekers € 5,00 / … Peeldijkje, 5961 NK Horst / 450 standplaatsen". Eén pagina; per datum ook een pagina `/data/<datum>/`, die gebruiken we alleen als link.
- **Eigen markten**: ja. Geen verzamelsite.
- **robots.txt** (gecontroleerd 2026-10-27): voor alle bots `Crawl-delay: 10` en alleen technische mappen dicht; voor een lijst SEO- en AI-bots (o.a. ClaudeBot, anthropic-ai, ChatGPT-User) `Crawl-delay: 300`, maar geen `Disallow: /`. Onze User-Agent valt onder `*`. We halen één pagina per run, dus de Crawl-delay is vanzelf gerespecteerd.
- **Voorwaarden**: geen voorwaarden of disclaimer op de site gevonden; geen verbod op hergebruik (geen juridische toets).
- **Wat we overnemen**: datum, tijden, entree (dagkassa volwassenen), aantal standplaatsen, plek (weg Peeldijkje in Horst, geen huisnummer). Buiten. Geen teksten of foto's.
- **Let op**: de agenda loopt nu (2026-10-27) vanaf 4 april 2027; in de winter is er geen markt.
- **Hoe vaak**: hooguit één keer per dag, één pagina, User-Agent `Snuffelkaart-PoC/0.1 (markten van organisatoren; freek@draad.nu)`.
- **Status in de app**: "Gecontroleerd op [datum]", met link naar hun datumpagina.
- **Test**: `app/scripts/fetch-markets.test.mjs` met `fixtures/carbootsalehorst.html`.
- **Contact**: nog geen. Vraagt MCC Events ermee te stoppen: direct stoppen, gegevens verwijderen, eigen invoer aanbieden (§5.2).
