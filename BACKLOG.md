# Backlog

Klein en uitvoerbaar. Elke taak: wat, klaar als, test. Status: ☐ open · ◐ bezig · ☑ klaar.

## Ronde 1 · App-skelet met echte data
| # | Taak | Klaar als | Test |
|---|---|---|---|
| 1 | ☑ Project opzetten (Astro 6 + React, git) | `npm run dev` start | handmatig |
| 2 | ☑ OSM-kringlopen ophalen en normaliseren | `public/data/places.json` met naam, coördinaten, adres, tijden, bron; rapport met aantallen | script draait, telling |
| 3 | ☑ Logica: status, dagplan, slimste volgorde | open/dicht/onbekend correct voor echte OSM-tijden en feestdagen | vitest |
| 4 | ☑ Kaart: eigen stijl, pins, groepjes | pins in ontwerpvorm, groeperen < 30 px, splitsen bij inzoomen | handmatig 375/1280 |
| 5 | ☑ Lijst + filters + zoeken | type, Nu open/Vandaag/Dit weekend/datum, gratis/overdekt, zoeken op naam/plaats; < 100 ms (pin-filter: geen data in OSM-import) | vitest (filter), handmatig |
| 6 | ☑ Bottom sheet (mobiel) / split (desktop) | 3 standen met veeg, desktop lijst + kaart | handmatig 375/1280 |
| 7 | ☑ Detail kringloop + markt | status, tijden per dag, onbekende tijden, bron + controledatum, bevestigingsstatus | handmatig |
| 8 | ☑ Mijn zaterdag als kassabon | stops, aankomsttijden, waarschuwingen, slimste volgorde, route naar Google/Apple Maps | vitest (plan), handmatig |
| 9 | ☑ Favorieten op het apparaat | hartje bewaart in localStorage | handmatig |

## Ronde 2 · Voorstel
| # | Taak | Klaar als |
|---|---|---|
| 10 | ☑ Bewegingen uit het ontwerp | lijst herordent (FLIP), pins vallen in, groepjes splitsen geanimeerd, bon print, lijst → detail met View Transition |
| 11 | ☑ Zoeken op plaats/postcode (PDOK) | “Utrecht” of “3811” verplaatst de kaart en het afstandspunt |
| 12 | ☑ Eerste keer openen + locatie | welkomstpaneel, locatie pas na tik, geweigerd-staat |
| 13 | ☑ Valse treffers OSM opschonen | regels voor tweedehands/vintage, handmatige uitzonderingenlijst |
| 14 | ☐ Eerste echte organisator-uitlezer (§5.2) | één organisatorsite → markten met status “gecontroleerd”, test met opgeslagen pagina |
| 15 | ☐ Preview-deploy (Cloudflare Pages) | privé-preview-URL; account: Freek |
| 16 | ☐ Testronde op de echte app | testscript draaien met 3 personen |
| 17 | ☑ Overture als tweede bron | ontbrekende kringlopen (Nunspeet) staan erin, ontdubbeld, met bron |
| 18 | ☐ Foursquare OS Places als derde bron | account Hugging Face (Freek); zelfde ontdubbeling |
| 19 | ☐ Openingstijden voor Overture-winkels | van de eigen website van de winkel (met bronlabel), §5.1 |

## Later
- Melden ("Klopt er iets niet?"), stadspagina's, PWA/offline, "Hoe we controleren", aanmelden organisatoren.
- Echte markten: uitlezers voor organisatorsites (§5.2).
- Supabase, accounts, beheer, deploy naar Cloudflare (accounts en secrets: Freek).
- Testronde draaien op de echte app.
