// Haalt tweedehandswinkels uit Overture Maps Places (CDLA Permissive 2.0) en schrijft data-raw/overture.json.
// Daarna voegt `npm run data:osm` ze samen met OSM (OSM heeft voorrang). Zie §5.1.
// Gebruik: npm run data:overture            (nieuwste release)
//          npm run data:overture -- 2026-10-21.0
import fs from 'node:fs';
import { DuckDBInstance } from '@duckdb/node-api';

const BBOX = { w: 4.79, s: 51.73, e: 6.83, n: 52.52 }; // ruim; fetch-osm knipt op de provinciegrens
const OUT = new URL('../data-raw/overture.json', import.meta.url);

async function latestRelease() {
  const j = await (await fetch('https://stac.overturemaps.org/catalog.json')).json();
  return j.latest;
}

const release = process.argv[2] ?? await latestRelease();
const db = await (await DuckDBInstance.create()).connect();
await db.run("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';");
// Alle tweedehandscategorieën, plus alles met "kringloop" in de naam (soms staat een kringloop als goed doel of meubelzaak).
const res = await db.runAndReadAll(`
  SELECT id, names.primary AS name, taxonomy.primary AS cat, round(confidence, 2) AS conf, operating_status AS status,
    addresses[1].freeform AS street, addresses[1].postcode AS postcode, addresses[1].locality AS city,
    websites[1] AS website, phones[1] AS phone, (bbox.xmin + bbox.xmax) / 2 AS lon, (bbox.ymin + bbox.ymax) / 2 AS lat
  FROM read_parquet('s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*', hive_partitioning = 1)
  WHERE bbox.xmin BETWEEN ${BBOX.w} AND ${BBOX.e} AND bbox.ymin BETWEEN ${BBOX.s} AND ${BBOX.n}
    AND (basic_category = 'second_hand_store' OR regexp_matches(names.primary, 'kringlo|kringwinkel', 'i'))`);
const rows = res.getRowObjectsJson();
fs.mkdirSync(new URL('../data-raw/', import.meta.url), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ release, fetched: new Date().toISOString(), rows }));
console.log(`Overture ${release}: ${rows.length} plekken → ${OUT.pathname}`);
