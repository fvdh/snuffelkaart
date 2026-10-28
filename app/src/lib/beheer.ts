// Wachtrij voor /beheer: wat moet er gekeurd worden, hoe dringend, en een voorbeoordeling met redenen.
// ponytail: vaste regels in plaats van AI (§7.2); de AI-module komt in M5 achter dezelfde vorm ({ verdict, why }).
import { km } from './model';

export type MRow = { id: string; date: string; status: string; locked: string[]; data: Record<string, any>; updated_at?: string };
export type Verdict = 'good' | 'doubt' | 'rej';
export type Judged = { row: MRow; kind: 'kandidaat' | 'verdwenen'; urgent: boolean; verdict: Verdict; label: string; why: string[] };

const PUBLIC = ['org', 'chk', 'unconf', 'cancel'];
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

/** Rijen die om een besluit vragen, dringendste eerst (binnen 7 dagen), daarna op datum. */
export function queue(rows: MRow[], today: string): Judged[] {
  const soon = addDays(today, 7), live = rows.filter(r => PUBLIC.includes(r.status));
  return rows.filter(r => r.date >= today && (r.status === 'kandidaat' || (r.status === 'unconf' && r.data.vanished && !r.locked.includes('status'))))
    .map(r => ({ row: r, kind: r.status === 'kandidaat' ? 'kandidaat' as const : 'verdwenen' as const, urgent: r.date <= soon, ...judge(r, live) }))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.row.date.localeCompare(b.row.date) || a.row.id.localeCompare(b.row.id));
}

export function judge(r: MRow, live: MRow[]): { verdict: Verdict; label: string; why: string[] } {
  const d = r.data, at = (x: Record<string, any>) => ({ lat: x.lat as number, lon: x.lon as number });
  if (r.status !== 'kandidaat') return { verdict: 'doubt', label: 'Mogelijk afgelast', why: [`Verdwenen van de site van de organisator op ${d.vanished}`, 'Kijk op hun site of social media; gaat hij door, keur dan goed'] };
  const dup = live.find(o => o.date === r.date && o.data.lat != null && d.lat != null && km(at(o.data), at(d)) < 1);
  if (dup) return { verdict: 'rej', label: 'Waarschijnlijk dubbel', why: [`Op dezelfde dag staat “${dup.data.name}” al op de kaart, ${Math.round(km(at(dup.data), at(d)) * 1000)} m verderop`] };
  const why = [
    d.stage === 'aanvraag' ? 'Alleen een aanvraag: de vergunning is nog niet verleend' : d.stage === 'verleend' ? 'Vergunning verleend' : 'Melding bij de gemeente (geen vergunning nodig)',
    d.exact ? 'Plek uit de publicatie' : 'Geen adres: de pin staat midden in de gemeente',
    d.timeKnown ? 'Tijden staan in de publicatie' : 'Geen tijden in de publicatie',
  ];
  return d.stage !== 'aanvraag' && d.exact && d.timeKnown ? { verdict: 'good', label: 'Waarschijnlijk goed', why } : { verdict: 'doubt', label: 'Twijfel', why };
}

export type Run = { id: number; source: string; at: string; counts: Record<string, any> };
/** Wat aandacht nodig heeft (M4): problemen uit de laatste marktenrun, en een nachtelijke bron die al ruim een dag niet draaide. */
export function alerts(runs: Run[], now: Date): string[] {
  const last = (src: string) => runs.filter(r => r.source === src).sort((a, b) => b.at.localeCompare(a.at))[0];
  const out = (last('markets')?.counts.problems ?? []).map((p: { org: string; why: string }) => `${p.org}: ${p.why}`);
  for (const [src, name] of [['markets', 'Markten van organisatoren'], ['gemeenteblad', 'Gemeenteblad']]) {
    const r = last(src);
    if (!r || now.getTime() - Date.parse(r.at) > 36 * 3600e3) out.push(`${name}: ${r ? `laatste run op ${r.at.slice(0, 10)}` : 'nog nooit gedraaid'}, de nachtelijke run is mislukt`);
  }
  return out;
}
