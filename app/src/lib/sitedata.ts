// Kaartdata voor de statische pagina's, één keer gelezen tijdens de build (dezelfde bestanden als de app laadt).
import fs from 'node:fs';
import path from 'node:path';
import type { Place, Market } from './model';
import { siteIndex } from './seo';

const read = (n: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', `${n}.json`), 'utf8'));
const P = read('places'), M = read('markets');
export const places: Place[] = P.places;
export const markets: Market[] = M.markets.filter((m: Market) => m.date >= P.from);
export const from: string = P.from, holidays: string[] = P.holidays ?? [], generated: string = P.generated;
export const ix = siteIndex(places, markets);
export const SITE = 'https://snuffelkaart.ironfront-relay.workers.dev'; // ponytail: één plek om te wijzigen zodra D1 een domein oplevert
