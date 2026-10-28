// Kaartdata voor de statische pagina's, één keer gelezen tijdens de build (dezelfde bestanden als de app laadt).
import fs from 'node:fs';
import path from 'node:path';
import type { Place, Market } from './model';
import { siteIndex } from './seo';
import { applyExtra, NO_EXTRA, type Extra } from './bijdragen';

const read = (n: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', `${n}.json`), 'utf8'));
const P = read('places'), M = read('markets');
const X: Extra = fs.existsSync(path.join(process.cwd(), 'public/data/extra.json')) ? read('extra') : NO_EXTRA;
export const extra = X;
export const places: Place[] = applyExtra(P.places, X); // tijden van bezoekers gaan voor, net als in de app
export const markets: Market[] = M.markets.filter((m: Market) => m.date >= P.from);
export const from: string = P.from, holidays: string[] = P.holidays ?? [], generated: string = P.generated;
export const ix = siteIndex(places, markets);
export const SITE = 'https://snuffelkaart.ironfront-relay.workers.dev'; // ponytail: één plek om te wijzigen zodra D1 een domein oplevert
