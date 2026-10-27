# Snuffelkaart · app

Kringlopen en rommelmarkten op één kaart. Astro 6 + een React-eiland voor kaart, lijst en dagplan.
Ontwerp: `../DESIGN.md` en `../ontwerp/`. Plan: `../snuffelkaart-pva.md`. Keuzes: `../DECISIONS.md`.

```sh
npm install
npm run dev          # http://localhost:4321
npm test             # logica: openingstijden, filters, dagplan
npm run data:osm     # kringlopen opnieuw ophalen uit OpenStreetMap (proefregio)
npm run build        # statische site in dist/
```

Handig bij testen: `?nu=2026-10-31T09:10` zet de klok op een vast moment (de app is tijdsbewust).

## Hoe het werkt
- `scripts/fetch-osm.mjs` haalt winkels uit OSM, knipt op de provinciegrenzen van Utrecht en Gelderland, schoont valse treffers op (regels + `FIXES`) en rekent hun openingstijden **21 dagen vooruit** (`scripts/hours-precompute.mjs`). De browser laadt daardoor geen openingstijden-bibliotheek; de nachtelijke build ververst het venster.
- `public/data/places.json` is de enige databron (±25 kB gz), lokaal gefilterd.
- Markten zijn nog **verzonnen voorbeelden** (`src/lib/markets.ts`), tot de organisator-uitlezers er zijn.
- `src/lib/` bevat alle logica (getest), `src/components/` de UI. De CSS in `src/styles/design.css` komt uit het ontwerp; pas het ontwerp mee aan.
