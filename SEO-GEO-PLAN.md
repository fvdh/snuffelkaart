# Plan: vindbaar in Google én in AI-antwoorden (SEO + GEO)

Stand 28 oktober 2026. GEO = *generative engine optimization*: dat ChatGPT, Perplexity, Gemini, Claude en Google AI Overviews Snuffelkaart noemen en linken als iemand vraagt "welke kringlopen zijn zondag open in Amersfoort?".

## Waar we staan
- **Al gebouwd:** 537 plaatspagina's, 3701 winkelpagina's, 195 marktpagina's, `/plaatsen/`, sitemap, canonical-links, JSON-LD (Store met AggregateRating, Event met eventStatus, ItemList), methodepagina, privacy/voorwaarden/colofon. Snel en statisch.
- **Bewust uit:** `robots.txt Disallow: /` en `X-Robots-Tag: noindex` tot het eigen domein er is (anders indexeert Google het workers.dev-adres).
- **Onze voorsprong**, en dus waar elke pagina op moet leunen: *actueel en gecontroleerd*. Openingstijden met controledatum, "nu open", markten die we elke nacht nalopen, afgelastingen binnen minuten, en eigen reviews/foto's/tijden van bezoekers. Gidssites met verouderde lijsten hebben dat niet. AI-zoekmachines kiezen bronnen die concreet, recent en controleerbaar zijn: dat is precies dit.

## Fase 0 · Fundament (zodra snuffelkaart.nl werkt)
| # | Wat | Waarom |
|---|---|---|
| 0.1 | Domein koppelen; workers.dev → 301 naar snuffelkaart.nl; `SITE` aanpassen | één adres, alle autoriteit op het domein |
| 0.2 | noindex en `Disallow: /` eraf; `Sitemap:` in robots.txt | anders bestaat de site niet voor zoekmachines |
| 0.3 | Google Search Console én Bing Webmaster Tools (sitemap indienen) | Bing voedt ook ChatGPT-zoeken (deels), Copilot en DuckDuckGo |
| 0.4 | IndexNow aan (Cloudflare Crawler Hints doet het automatisch) | nieuwe/gewijzigde pagina's (markten, afgelastingen) binnen uren bij Bing/Yandex |
| 0.5 | **Cloudflare AI-crawlerinstellingen bewust kiezen** (zie besluiten): zoek-bots toelaten | Cloudflare blokkeert AI-crawlers standaard op nieuwe domeinen; dan citeert geen AI-zoekmachine ons |
| 0.6 | Deelafbeelding (`og:image`) per pagina: plaatsnaam + aantallen, automatisch gegenereerd bij de build | nette kaartjes in WhatsApp/Facebook-groepen, waar tweedehands-mensen zitten |

## Fase 1 · Gestructureerde gegevens afmaken (klein, veel effect)
- **Winkel (Store):** `openingHoursSpecification` uit onze vooruitgerekende tijden (nu ontbreken die in JSON-LD), postcode apart, `sameAs` naar OSM, `image` (bezoekersfoto's), `aggregateRating`/`review` (staat er al; wij zijn een derde partij, dus geldig).
- **Markt (Event):** `organizer`, `isAccessibleForFree`, `eventStatus` (staat er), `offers` bij entree; bij een reeks: `superEvent`.
- **Overal:** `BreadcrumbList`, `dateModified` (= laatste controle), op de home `WebSite` + `Organization` (naam, logo, contact).
- **Test:** Rich Results Test en Schema-validator in een check in CI (één script dat een paar gebouwde pagina's valideert).

## Fase 2 · Pagina's die echte zoekvragen beantwoorden
Alleen genereren waar genoeg echte inhoud is (bijv. ≥ 3 winkels of ≥ 2 markten), anders niet: dunne pagina's schaden.

| Pagina | Voorbeeld-zoekvraag | Bron |
|---|---|---|
| Plaats + dag: `/utrecht/zondag/` | "kringloop open zondag utrecht" | vooruitgerekende tijden |
| Plaats + soort: `/utrecht/antiek/`, `/utrecht/vintage/` | "antiek winkel utrecht" | onze soorten |
| Provincie: `/provincie/gelderland/` | "rommelmarkt gelderland dit weekend" | markten + winkels |
| Markten per weekend: `/rommelmarkten/dit-weekend/` + per provincie | "rommelmarkt dit weekend" | nachtelijke uitlezing |
| Terugkerende markt: `/markt/vlooienmarkt-ahoy/` met alle datums | "vlooienmarkt ahoy 2027 data" | reeksen bij organisatoren |
| **Koningsdag** `/koningsdag/<plaats>/` (ontwerp heeft hem al) | "vrijmarkt koningsdag amersfoort" | gemeentelijsten; live vanaf maart 2027 |
| Feestdagen: "welke kringlopen zijn open op 2e paasdag / tweede kerstdag" | seizoenspieken | tijden + feestdagenlogica |

Elke pagina: één openingszin met feiten en datum ("In Utrecht zijn 34 tweedehandswinkels, waarvan 12 kringlopen. Zaterdag 31 oktober zijn er 21 open."), dan de lijst, dan "hoe we dit controleren". Geen opvultekst.

## Fase 3 · GEO: geciteerd worden door AI
- **Citeerbare zinnen.** Feitelijke, op zichzelf staande zinnen met getal en datum bovenaan elke pagina (zie fase 2). Dat nemen AI-antwoorden letterlijk over.
- **Versheid zichtbaar én in de code:** "gecontroleerd op …" in tekst, `dateModified` in JSON-LD, sitemap-`lastmod` (staat er).
- **Vertrouwen (E-E-A-T):** "Hoe we controleren" en het colofon met een echte persoon bestaan al; uitbreiden met hoe we bronnen kiezen en hoeveel we per week controleren.
- **Toegang:** zoek-bots van AI toelaten (OAI-SearchBot, PerplexityBot, Claude-SearchBot, Googlebot/Bingbot), zie 0.5.
- **`/llms.txt`:** korte samenvatting van wat Snuffelkaart is en waar de belangrijkste pagina's en de open data staan. Kost een kwartier; het nut is onzeker, dus niet meer dan dat.
- **Open data als visitekaartje:** de winkellijst (ODbL) vindbaar maken met een eigen pagina; datasets worden vaak gelinkt en geciteerd.
- **Meten zonder tracking:** maandelijks een vaste set van ±20 vragen stellen aan ChatGPT, Perplexity, Gemini, Claude en Google (AI Overview), en noteren of en hoe we genoemd worden. Plus verwijzers (chatgpt.com, perplexity.ai) tellen, zie besluiten.

## Fase 4 · Autoriteit buiten de site (doorlopend)
- **Organisatoren en winkels:** een "staat op Snuffelkaart"-link of badge voor hun site; organisatoren hebben er belang bij (meer bezoekers). Past bij het aanmeldformulier (backlog).
- **Branche en gemeenten:** Branchevereniging Kringloopbedrijven Nederland, gemeentelijke afval/hergebruikpagina's ("waar breng ik spullen?") linken graag naar een actuele kaart.
- **Communities:** Facebook-groepen en fora over tweedehands en vlooienmarkten, Reddit (AI-antwoorden citeren Reddit veel). Behulpzaam, niet spammen: per plaats of markt de link als antwoord op een vraag.
- **Lokale media** rond Koningsdag en het marktseizoen: "deze 12 rommelmarkten zijn er dit weekend in de regio", met onze data.
- **OSM-gemeenschap:** we verwijzen naar OSM om tijden te verbeteren; een blogje op de OSM-NL-weblog over de toepassing levert links en goodwill.

## Wat we níet doen
Geen door AI gegenereerde opvulteksten per plaats, geen gekochte links, geen nep-reviews, geen pagina's zonder echte inhoud, geen keyword-stapelen. Het voordeel is betrouwbaarheid; dat mag nergens wijken.

## Planning
| Wanneer | Wat |
|---|---|
| Zodra het domein werkt | Fase 0 (een middag) en fase 1 (een dag) |
| November–december 2026 | Fase 2 deel 1: plaats + dag, plaats + soort, provincie, markten dit weekend; feestdagenpagina voor kerst |
| Januari–februari 2027 | Terugkerende markten, meetset GEO starten, eerste outreach (branche, gemeenten) |
| Maart 2027 | Koningsdag-pagina's live (zoekvolume start ruim een maand vooraf) |
| April 2027 en verder | Marktseizoen: communities en lokale media; maandelijks meten en bijsturen |

## Besluiten voor Freek
1. **AI-crawlers bij Cloudflare.** Voorstel: zoek-bots **toelaten** (dan kunnen AI-antwoorden ons citeren), trainings-bots (GPTBot, ClaudeBot, Google-Extended, CCBot) **blokkeren**: onze eigen gegevens (bezoekerstijden, reviews, foto's) zijn van ons. Alternatief: alles toelaten voor maximale bekendheid.
2. **Meten.** Cloudflare Web Analytics (gratis, zonder cookies, geen persoonsgegevens) aanzetten, zodat we zien welke pagina's en verwijzers (Google, chatgpt.com) werken? Dan de privacypagina aanpassen. Of helemaal niets meten en alleen Search Console gebruiken.
3. **Adresstructuur** zoals nu (`/utrecht/`, `/winkel/…`, `/markt/…`) houden en uitbreiden met `/utrecht/zondag/` enz. Voorstel: ja, niet meer veranderen na lancering.
