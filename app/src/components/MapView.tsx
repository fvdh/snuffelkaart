import { useEffect, useMemo, useRef, useState } from 'react';
import type * as ML from 'maplibre-gl';

// MapLibre (±295 kB gz) laadt pas na de eerste weergave, zodat de lijst niet wacht (§6.3).
let maplibregl: typeof ML;
import Supercluster from 'supercluster';
import type { Item, LatLon } from '../lib/model';
import { DEFAULT_CENTER } from '../lib/model';
import { isUnsure, isTw, kindIcon } from './ui';

const STYLE = 'https://tiles.openfreemap.org/styles/positron';

/** Ontwerptoken (OKLCH in CSS) → rgb-string die MapLibre begrijpt. */
function token(name: string): string {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const x = c.getContext('2d')!; x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'; x.fillRect(0, 0, 1, 1);
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data; return `rgb(${r},${g},${b})`;
}
/** Kaartkleuren uit DESIGN.md over de positron-stijl heen (licht én donker). */
function paint(map: ML.Map) {
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
    else if (l.type === 'symbol') { set('text-color', T['--m-label']); set('text-halo-color', T['--m-halo']); }
  }
  if (map.getLayer('route')) { map.setPaintProperty('route', 'line-color', T['--ink']); map.setPaintProperty('route-halo', 'line-color', T['--m-land']); }
}

export interface MapProps {
  items: Item[]; sel: string | null; planIds: string[]; me: LatLon | null; bottomPad: number;
  focus: { lat: number; lon: number; key: number } | null; fit: { pts: LatLon[]; key: number } | null; route: LatLon[];
  pinClass: (it: Item) => string; onSelect: (id: string) => void;
}

const icon = (n: string) => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;

export default function MapView(p: MapProps) {
  const box = useRef<HTMLDivElement>(null), mapRef = useRef<ML.Map | null>(null);
  const marks = useRef(new Map<string, { m: ML.Marker; el: HTMLDivElement }>());
  const meMark = useRef<ML.Marker | null>(null);
  const [ready, setReady] = useState(false), [tick, setTick] = useState(0);
  const cb = useRef(p); cb.current = p;

  useEffect(() => {
    let map: ML.Map | null = null, gone = false;
    (async () => {
      const [lib, style] = await Promise.all([import('maplibre-gl'), fetch(STYLE).then(r => r.json())]);
      maplibregl = lib;
      if (gone || !box.current) return;
      map = new maplibregl.Map({ container: box.current, style, center: [DEFAULT_CENTER.lon, DEFAULT_CENTER.lat], zoom: 11.5, attributionControl: false, pitchWithRotate: false, dragRotate: false });
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-left'); // bovenin: onderin ligt het paneel
      map.on('load', () => {
        map!.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map!.addLayer({ id: 'route-halo', type: 'line', source: 'route', paint: { 'line-width': 9, 'line-opacity': .85 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        map!.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-width': 4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        paint(map!); setReady(true);
      });
      map.on('moveend', () => setTick(t => t + 1));
      mapRef.current = map;
    })();
    const mq = matchMedia('(prefers-color-scheme: dark)'), onTheme = () => mapRef.current?.isStyleLoaded() && paint(mapRef.current);
    mq.addEventListener('change', onTheme);
    return () => { gone = true; mq.removeEventListener('change', onTheme); map?.remove(); };
  }, []);

  // ponytail: supercluster op alle zichtbare items; HTML-markers zodat pins exact het ontwerp volgen. Bij duizenden punten: symbol-laag.
  const index = useMemo(() => {
    const sc = new Supercluster<{ id: string; t: string }>({ radius: 34, maxZoom: 16 });
    sc.load(p.items.filter(it => it.id !== p.sel && !p.planIds.includes(it.id)).map(it => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [it.lon, it.lat] }, properties: { id: it.id, t: it.t } })));
    return sc;
  }, [p.items, p.sel, p.planIds]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    const b = map.getBounds(), z = Math.round(map.getZoom());
    const byId = new Map(p.items.map(it => [it.id, it]));
    const want = new Map<string, { lnglat: [number, number]; html: string; cls: string; onClick: () => void; label: string }>();
    for (const f of index.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], z)) {
      const [lon, lat] = f.geometry.coordinates as [number, number], pr = f.properties as unknown as { cluster?: boolean; cluster_id: number; point_count: number; id: string };
      if (pr.cluster) {
        const leaves = index.getLeaves(pr.cluster_id, 500), nk = leaves.filter(l => l.properties.t === 'k').length, n = pr.point_count;
        const bg = nk && nk < n ? `conic-gradient(var(--kring) 0 ${Math.round(nk / n * 360)}deg,var(--markt-ink) 0)` : nk ? 'var(--kring)' : 'var(--markt-ink)';
        want.set(`c${pr.cluster_id}`, { lnglat: [lon, lat], cls: 'mk', label: `${n} locaties, tik om in te zoomen`, html: `<button class="cluster" style="background:${bg}" aria-label="${n} locaties: ${nk} kringlopen, ${n - nk} markten. Tik om in te zoomen.">${n > 99 ? '99+' : n}</button>`, onClick: () => map.easeTo({ center: [lon, lat], zoom: Math.min(index.getClusterExpansionZoom(pr.cluster_id), 17) }) });
      } else { const it = byId.get(pr.id); if (it) want.set(it.id, pinFor(it)); }
    }
    for (const id of [p.sel, ...p.planIds]) { const it = id && byId.get(id); if (it) want.set(it.id, pinFor(it)); }
    function pinFor(it: Item) {
      const n = p.planIds.indexOf(it.id), sel = it.id === p.sel;
      return { lnglat: [it.lon, it.lat] as [number, number], cls: `mk${sel ? ' zsel' : ''}`, label: it.name, onClick: () => cb.current.onSelect(it.id),
        html: `<button class="pin ${it.t}${isTw(it) ? ' tw' : ''} ${cb.current.pinClass(it)}${it.t === 'k' && isUnsure(it) ? ' unknown' : ''}${sel ? ' sel' : ''}${n >= 0 ? ' numbered' : ''}${p.planIds.length && n < 0 ? ' dim' : ''}" aria-label="${it.name.replace(/"/g, '&quot;')}"><span class="pin-b">${icon(kindIcon(it))}</span><span class="pin-dot"></span><span class="pin-n">${n + 1}</span><span class="pin-lbl"></span></button>` };
    }
    const cur = marks.current;
    for (const [id, v] of cur) if (!want.has(id)) { v.m.remove(); cur.delete(id); }
    for (const [id, w] of want) {
      let v = cur.get(id);
      if (!v) { const el = document.createElement('div'); v = { el, m: new maplibregl.Marker({ element: el }).setLngLat(w.lnglat).addTo(map) }; cur.set(id, v); }
      v.el.className = w.cls; if (v.el.dataset.h !== w.html) { v.el.innerHTML = w.html; v.el.dataset.h = w.html; const l = v.el.querySelector('.pin-lbl'); if (l) l.textContent = w.label; }
      v.el.onclick = e => { e.stopPropagation(); w.onClick(); };
      v.m.setLngLat(w.lnglat);
    }
  }, [ready, tick, index, p.items, p.sel, p.planIds, p.pinClass]);

  useEffect(() => { // eigen locatie
    const map = mapRef.current; if (!map || !ready) return;
    if (!p.me) { meMark.current?.remove(); meMark.current = null; return; }
    if (!meMark.current) { const el = document.createElement('div'); el.className = 'me-mk'; meMark.current = new maplibregl.Marker({ element: el }).setLngLat([p.me.lon, p.me.lat]).addTo(map); }
    else meMark.current.setLngLat([p.me.lon, p.me.lat]);
  }, [ready, p.me]);

  useEffect(() => { const map = mapRef.current; if (map && ready) map.easeTo({ padding: { bottom: p.bottomPad, top: 0, left: 0, right: 0 }, duration: 350 }); }, [ready, p.bottomPad]);
  useEffect(() => { const map = mapRef.current; if (map && ready && p.focus) map.easeTo({ center: [p.focus.lon, p.focus.lat], zoom: Math.max(map.getZoom(), 13), duration: 450 }); }, [ready, p.focus?.key]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || !p.fit || p.fit.pts.length < 1) return;
    const b = new maplibregl.LngLatBounds(); p.fit.pts.forEach(q => b.extend([q.lon, q.lat]));
    map.fitBounds(b, { padding: { top: 70, left: 50, right: 70, bottom: p.bottomPad + 50 }, maxZoom: 14, duration: 500 });
  }, [ready, p.fit?.key]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    const src = map.getSource('route') as ML.GeoJSONSource | undefined; if (!src) return;
    src.setData({ type: 'FeatureCollection', features: p.route.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: p.route.map(q => [q.lon, q.lat]) } }] : [] });
  }, [ready, p.route]);

  return <div className="map" ref={box} role="region" aria-label="Kaart" />;
}
