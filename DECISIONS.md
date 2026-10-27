# Beslissingen

Keuzes en waarom. Nieuwste onderaan. "Freek" = besloten door Freek; anders voorlopig, terug te draaien.

## 2026-10-27 · Ontwerp M1
- **Ontwerp**: `ontwerp/snuffelkaart-ontwerp.html` (artifact) + `DESIGN.md` + `PRODUCT.md` zijn de bron voor de UI. Freek: akkoord als eerste versie.
- **Testronde M1 uitgesteld** (Freek). Het testscript (`ontwerp/snuffelkaart-testronde.html`) blijft klaar; draaien op de echte app in plaats van het prototype.

## 2026-10-27 · Eerste bouw
- **Volgorde** (Freek): app-skelet in de echte stack, gevoed met echte OSM-kringlopen uit de proefregio. Combineert M0-vraag "klopt de data?" met M2-kernreis.
- **Stack** (Freek): Astro + React-eiland voor de kaart (§14.1). Code in `app/`.
- **Astro 6.4.8, niet 7**: Astro 7 eist Node ≥ 22.23.4; deze machine draait 22.22.0. Upgraden naar 7 is een kleine stap zodra Node is bijgewerkt.
- **Kaarttegels voor nu** (Freek): OpenFreeMap (positron) met eigen kleuren eroverheen. D2 (eigen PMTiles) blijft open.
- **Geen Tailwind (voorlopig)**: de ontwerptokens uit `DESIGN.md` staan al als CSS custom properties; het prototype-CSS is direct over te nemen. Tailwind toevoegen als het team dat wil; het plan noemde het als voorstel.
- **Geen Motion-library (voorlopig)**: CSS-transities en Web Animations dekken alle bewegingen uit het ontwerp. Toevoegen als de bottom sheet op echte telefoons niet goed genoeg voelt (§14.13).
- **Clustering**: `supercluster` met HTML-markers, zodat pins exact de ontworpen vorm en animaties hebben. Grens: ~30 px, zoals in het ontwerp.
- **Openingstijden**: OSM-syntax via de `opening_hours`-bibliotheek, met Nederlandse feestdagen (`PH`).
- **Data in de browser**: één JSON (`public/data/places.json`), lokaal gefilterd (§6.1). Geen server.
- **Markten**: nog geen echte bron. `app/src/lib/markets.ts` bevat de verzonnen markten uit het prototype, met datums relatief aan de komende zaterdag/zondag, en zichtbaar gemarkeerd als voorbeeld. Echte markten komen uit de organisator-uitlezers (M0, §5.2).
- **OSM-ophalen**: Overpass met een rechthoek om Utrecht + Gelderland (de provinciefilter time-out op de publieke servers). Gevolg: ook randjes van omliggende provincies. Prima voor de PoC; de echte import gaat via het Geofabrik-extract (§5.1).
- **Vite 7 vastgezet** (`overrides` in package.json): Vitest 5 trok Vite 8 binnen, wat met Astro 6 de React-plugin breekt.
- **MapLibre niet voorbundelen in dev** (`optimizeDeps.exclude`): MapLibre 6 laadt zijn worker relatief; voorbundelen breekt dat.
- **Openingstijden vooruitgerekend** (21 dagen) bij de import i.p.v. in de browser: scheelt ±160 kB gz en maakt elke statuscheck een opzoeking. Gevolg: zonder verse build worden tijden na 21 dagen "onbekend"; de nachtelijke build (§6.1) voorkomt dat.
- **MapLibre laadt lui** (dynamic import): eerste weergave ±90 kB gz JS, kaart (±300 kB gz) daarna.
- **Pin-filter (pinnen) weggelaten**: de OSM-import bevat (nog) geen betaalmethoden. Terug als `payment:*` wordt meegenomen.
