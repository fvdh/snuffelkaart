# Snuffelkaart · app

Kringlopen en rommelmarkten op één kaart. Astro 6 + een React-eiland voor kaart, lijst en dagplan.
Ontwerp: `../DESIGN.md` en `../ontwerp/`. Plan: `../snuffelkaart-pva.md`. Keuzes: `../DECISIONS.md`.

```sh
npm install
npm run dev          # http://localhost:4321
npm test             # logica: openingstijden, filters, dagplan
npm run data         # alles opnieuw: Overture ophalen + OSM ophalen en samenvoegen
npm run data:overture # alleen Overture (data-raw/overture.json)
npm run data:web     # openingstijden van de eigen websites lezen (cache 7 dagen; -- --limit=50 als proef)
npm run data:markets # markten uit de agenda van organisatoren (14, zie ../sources/; -- --only=mikki: alleen die)
npm run data:osm     # OSM ophalen en samenvoegen met Overture en websitetijden (-- --cached: zonder downloaden)
npm run build        # statische site in dist/
npx wrangler deploy  # dist/ naar de preview op Cloudflare (account Freek, zie wrangler.jsonc)
npm run db:push:places   # na data:osm: winkels naar Supabase (bron van waarheid; met de hand vastgezette velden blijven)
npm run db:push:markets  # na data:markets: markten naar Supabase (verdwenen edities → nog niet bevestigd)
npm run db:export        # Supabase → public/data/*.json, openingstijden vooruit vanaf vandaag
# Elke nacht doet .github/workflows/nachtelijk.yml: markten → Supabase → export, test, build, deploy.
# Schema: ../supabase/migrations (npx supabase db push --linked).
# Beheer: /beheer (inloglink per e-mail; beheerders in tabel admins). Auth-URL's: ../supabase/config.toml (npx supabase config push).
```

Handig bij testen: `?nu=2026-10-31T09:10` zet de klok op een vast moment (de app is tijdsbewust).

## Hoe het werkt
- `scripts/fetch-osm.mjs` haalt winkels uit OSM, knipt op de landsgrens (CBS-provincies; `REGION` voor een deel), schoont valse treffers op (regels + `FIXES`) en rekent hun openingstijden **21 dagen vooruit** (`scripts/hours-precompute.mjs`). De browser laadt daardoor geen openingstijden-bibliotheek; de nachtelijke build ververst het venster.
- Overture (`scripts/fetch-overture.mjs`, DuckDB op S3) vult aan wat OSM mist; OSM heeft voorrang, dubbelingen vallen weg.
- `public/data/places.json` is de enige databron (±245 kB gz, heel NL), lokaal gefilterd.
- Markten komen uit de eigen agenda van organisatoren (`scripts/fetch-markets.mjs` → `public/data/markets.json`); zie `../sources/`.
- `src/lib/` bevat alle logica (getest), `src/components/` de UI. De CSS in `src/styles/design.css` komt uit het ontwerp; pas het ontwerp mee aan.
