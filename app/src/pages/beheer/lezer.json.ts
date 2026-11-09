// Websitelezer in /beheer: de stand van data-raw/web-hours.json (door de winkelrun gecommit), bij de build als statisch bestand.
// Alleen openbare gegevens (adres van een website, de tijden die erop staan). Per site: [sleutel, tijden, notitie, pagina, gelezen, ai, dicht].
import fs from 'node:fs';

export function GET() {
  const file = `${process.cwd()}/data-raw/web-hours.json`;
  const cache: Record<string, { oh?: string | null; note?: string | null; page?: string | null; read: string; ai?: boolean; dicht?: boolean; per?: object; v?: number }> =
    fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const sites = Object.entries(cache).map(([k, w]) => [k, w.oh ?? null, w.note ?? null, w.page ?? null, w.read, !!w.ai, !!w.dicht, !!w.per]);
  return new Response(JSON.stringify({ sites }), { headers: { 'Content-Type': 'application/json' } });
}
