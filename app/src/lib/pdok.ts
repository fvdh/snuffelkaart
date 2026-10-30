import type { LatLon } from './model';

/** Een plek om rond te snuffelen: gekozen plaats of postcode. */
export interface Spot extends LatLon { label: string; sub: string }

// PDOK Locatieserver: open, geen sleutel, CORS open. Suggest matcht ook op een begin ("utr").
const URL_ = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest';

type Doc = { type: string; weergavenaam: string; centroide_ll: string };

/** PDOK-antwoord → plekken. Een kale postcode van 4 cijfers wordt één plek, niet tien straten. */
export function parsePdok(docs: Doc[], q: string): Spot[] {
  const pc4 = /^\d{4}$/.test(q.trim()), out: Spot[] = [], seen = new Set<string>();
  for (const d of docs) {
    const m = /POINT\(([\d.]+) ([\d.]+)\)/.exec(d.centroide_ll); if (!m) continue;
    const ll = { lon: +m[1], lat: +m[2] };
    let s: Spot;
    if (d.type === 'woonplaats') { // "Den Dolder, Zeist, Utrecht"
      const [name, gem, prov] = d.weergavenaam.split(', ');
      s = { ...ll, label: name, sub: gem && gem !== name ? `Gemeente ${gem}, ${prov}` : prov ?? '' };
    } else { // "Appelmarkt, 3811CT Amersfoort"; een kale postcode krijgt de plaatsnaam, zodat de pil "Rond Deventer" zegt
      const [street, rest = ''] = d.weergavenaam.split(', '), [pc, ...city] = rest.split(' ');
      s = pc4 ? { ...ll, label: city.join(' ') || q.trim(), sub: `postcode ${q.trim()}` } : { ...ll, label: pc, sub: `${street}, ${city.join(' ')}` };
    }
    const k = s.label + s.sub; if (seen.has(k)) continue; seen.add(k); out.push(s);
  }
  return out.slice(0, 3);
}

export async function searchSpots(q: string, signal: AbortSignal): Promise<Spot[]> {
  const u = `${URL_}?q=${encodeURIComponent(q)}&fq=type:(woonplaats%20OR%20postcode)&rows=6&fl=weergavenaam,centroide_ll,type`;
  const j = await (await fetch(u, { signal })).json();
  return parsePdok(j.response?.docs ?? [], q);
}
