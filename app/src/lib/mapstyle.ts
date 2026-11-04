// Kaartstijl, gedeeld door de app (MapView) en de kaartjes op de statische pagina's (KaartBlok).
import type * as ML from 'maplibre-gl';

/** Ontwerptoken (OKLCH in CSS) → rgb-string die MapLibre begrijpt. */
export function token(name: string): string {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const x = c.getContext('2d')!; x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'; x.fillRect(0, 0, 1, 1);
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data; return `rgb(${r},${g},${b})`;
}
/** Kaartkleuren uit DESIGN.md over de positron-stijl heen (licht én donker). */
export function paint(map: ML.Map) {
  const T = Object.fromEntries(['--m-land', '--m-park', '--m-water', '--m-urban', '--m-road', '--m-casing', '--m-hwy', '--m-hwy-casing', '--m-rail', '--m-label', '--m-halo', '--ink'].map(k => [k, token(k)]));
  for (const l of map.getStyle().layers) {
    const id = l.id, set = (p: string, v: string) => { try { (map.setPaintProperty as (l: string, p: string, v: string) => void).call(map, id, p, v); } catch { /* laag mist eigenschap */ } };
    if (l.type === 'background') set('background-color', T['--m-land']);
    else if (/park|wood/.test(id)) set('fill-color', T['--m-park']);
    else if (/^water$/.test(id)) set('fill-color', T['--m-water']);
    else if (id === 'waterway') set('line-color', T['--m-water']);
    else if (/residential|building/.test(id)) set('fill-color', T['--m-urban']);
    else if (/motorway.*casing/.test(id)) set('line-color', T['--m-hwy-casing']);
    else if (/motorway/.test(id)) set('line-color', T['--m-hwy']);
    else if (/casing/.test(id)) set('line-color', T['--m-casing']);
    else if (/^highway/.test(id) && l.type === 'line') set('line-color', T['--m-road']);
    else if (/railway/.test(id)) set('line-color', T['--m-rail']);
    else if (l.type === 'symbol') {
      set('text-color', T['--m-label']); set('text-halo-color', T['--m-halo']);
      // Nederlandse namen ("Den Haag", "Nederland"), niet de Engelse van de stijl.
      if (/name/.test(JSON.stringify(l.layout?.['text-field'] ?? ''))) try { map.setLayoutProperty(id, 'text-field', ['coalesce', ['get', 'name:nl'], ['get', 'name']]); } catch { /* geen tekstlaag */ }
    }
  }
  if (map.getLayer('route')) { map.setPaintProperty('route', 'line-color', T['--ink']); map.setPaintProperty('route-halo', 'line-color', T['--m-land']); }
}

