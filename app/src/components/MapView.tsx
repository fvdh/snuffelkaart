import { useEffect, useMemo, useRef, useState } from 'react';
import type * as ML from 'maplibre-gl';

// MapLibre (±295 kB gz) laadt pas na de eerste weergave, zodat de lijst niet wacht (§6.3).
let maplibregl: typeof ML;
import Supercluster from 'supercluster';
import type { Item, LatLon } from '../lib/model';
import { DEFAULT_CENTER } from '../lib/model';
import { isUnsure, catCls, kindIcon, CAT, EASE, reduced } from './ui';
import { CATS, catOf } from '../lib/model';

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
  /** Waar de kaart begint: de onthouden plaats, anders het standaardmidden. Alleen bij het aanmaken gebruikt. */
  home?: LatLon; focus: { lat: number; lon: number; key: number } | null; fit: { pts: LatLon[]; key: number } | null; route: LatLon[];
  pinClass: (it: Item) => string; onSelect: (id: string) => void; onLocate: () => void;
}

const icon = (n: string) => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;

export default function MapView(p: MapProps) {
  const box = useRef<HTMLDivElement>(null), mapRef = useRef<ML.Map | null>(null);
  const marks = useRef(new Map<string, { m: ML.Marker; el: HTMLDivElement; at: [number, number]; leaves?: string[] }>());
  const shownIndex = useRef<unknown>(null);
  const meMark = useRef<ML.Marker | null>(null), routeShown = useRef(false);
  const [ready, setReady] = useState(false), [tick, setTick] = useState(0);
  const cb = useRef(p); cb.current = p;

  useEffect(() => {
    let map: ML.Map | null = null, gone = false;
    (async () => {
      const [lib, style, worker] = await Promise.all([import('maplibre-gl'), fetch(STYLE).then(r => r.json()), import('maplibre-gl/dist/maplibre-gl-worker.mjs?url')]);
      maplibregl = lib;
      // MapLibre 6 zoekt zijn worker naast zijn eigen bestand; na bundelen staat die er niet, dus wijzen we hem aan.
      maplibregl.setWorkerUrl(worker.default);
      if (gone || !box.current) return;
      map = new maplibregl.Map({ container: box.current, style, center: [(p.home ?? DEFAULT_CENTER).lon, (p.home ?? DEFAULT_CENTER).lat], zoom: 11.5, attributionControl: false, pitchWithRotate: false, dragRotate: false });
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
    const sc = new Supercluster<{ id: string; c: string }>({ radius: 34, maxZoom: 16 });
    sc.load(p.items.filter(it => it.id !== p.sel && !p.planIds.includes(it.id)).map(it => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [it.lon, it.lat] }, properties: { id: it.id, c: it.t === 'm' ? 'm' : catOf(it) } })));
    return sc;
  }, [p.items, p.sel, p.planIds]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    const b = map.getBounds(), z = Math.round(map.getZoom());
    const byId = new Map(p.items.map(it => [it.id, it]));
    const want = new Map<string, { lnglat: [number, number]; html: string; cls: string; onClick: () => void; label: string; leaves?: string[] }>();
    for (const f of index.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], z)) {
      const [lon, lat] = f.geometry.coordinates as [number, number], pr = f.properties as unknown as { cluster?: boolean; cluster_id: number; point_count: number; id: string };
      if (pr.cluster) {
        // Verhouding per soort, in dezelfde kleuren als de pins; markten als laatste.
        const leaves = index.getLeaves(pr.cluster_id, 500), n = pr.point_count, nl = leaves.length;
        const per = [...CATS, 'm' as const].map(k => [k, leaves.filter(l => l.properties.c === k).length] as const).filter(([, v]) => v);
        let at = 0; const bg = `conic-gradient(${per.map(([k, v]) => `var(--cat-${k === 'm' ? 'markt' : k}) ${at}deg ${(at += v / nl * 360)}deg`).join(',')})`;
        const say = per.map(([k, v]) => `${Math.round(v * n / nl)} ${k === 'm' ? 'markten' : CAT[k][1].toLowerCase()}`).join(', ');
        want.set(`c${pr.cluster_id}`, { lnglat: [lon, lat], cls: 'mk', leaves: leaves.map(l => l.properties.id), label: `${n} locaties, tik om in te zoomen`, html: `<button class="cluster" style="background:${bg}" aria-label="${n} locaties: ${nl < n ? 'ongeveer ' : ''}${say}. Tik om in te zoomen.">${n > 99 ? '99+' : n}</button>`, onClick: () => map.easeTo({ center: [lon, lat], zoom: Math.min(index.getClusterExpansionZoom(pr.cluster_id), 17) }) });
      } else { const it = byId.get(pr.id); if (it) want.set(it.id, pinFor(it)); }
    }
    for (const id of [p.sel, ...p.planIds]) { const it = id && byId.get(id); if (it) want.set(it.id, pinFor(it)); }
    function pinFor(it: Item) {
      const n = p.planIds.indexOf(it.id), sel = it.id === p.sel;
      return { lnglat: [it.lon, it.lat] as [number, number], cls: `mk${sel ? ' zsel' : ''}`, label: it.name, onClick: () => cb.current.onSelect(it.id),
        html: `<button class="pin ${it.t}${catCls(it)} ${cb.current.pinClass(it)}${it.t === 'k' && isUnsure(it) ? ' unknown' : ''}${sel ? ' sel' : ''}${n >= 0 ? ' numbered' : ''}${p.planIds.length && n < 0 ? ' dim' : ''}" aria-label="${it.name.replace(/"/g, '&quot;')}"><span class="pin-b">${icon(kindIcon(it))}</span><span class="pin-dot"></span><span class="pin-n">${n + 1}</span><span class="pin-lbl"></span></button>` };
    }
    // Bewegingen: nieuwe data → pins vallen in (28 ms na elkaar, samen ≤ 0,5 s); groepje splitst → pins schuiven
    // vanuit het midden (450 ms); wat verdwijnt schaalt weg (180 ms).
    const still = reduced(), drop = shownIndex.current !== index; shownIndex.current = index;
    const cur = marks.current, from = new Map<string, [number, number]>();
    for (const [id, v] of cur) if (!want.has(id)) {
      v.leaves?.forEach(l => from.set(l, v.at)); cur.delete(id);
      const inner = v.el.firstElementChild as HTMLElement | null;
      if (still || !inner) { v.m.remove(); continue; }
      v.el.style.pointerEvents = 'none';
      inner.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.4)' }], { duration: 180, easing: EASE, fill: 'forwards' }).finished.finally(() => v.m.remove());
    }
    let n = 0;
    for (const [id, w] of want) {
      let v = cur.get(id), fresh = false;
      if (!v) { const el = document.createElement('div'); v = { el, at: w.lnglat, m: new maplibregl.Marker({ element: el }).setLngLat(w.lnglat).addTo(map) }; cur.set(id, v); fresh = true; }
      // classList, geen className: MapLibre's eigen klasse (position:absolute) moet blijven, anders schuiven pins bij uitzoomen weg.
      v.el.classList.add('mk'); v.el.classList.toggle('zsel', w.cls.includes('zsel')); if (v.el.dataset.h !== w.html) { v.el.innerHTML = w.html; v.el.dataset.h = w.html; const l = v.el.querySelector('.pin-lbl'); if (l) l.textContent = w.label; }
      v.el.onclick = e => { e.stopPropagation(); w.onClick(); };
      v.m.setLngLat(w.lnglat); v.at = w.lnglat; v.leaves = w.leaves;
      const inner = v.el.firstElementChild as HTMLElement | null;
      if (!fresh || still || !inner) continue;
      const src = from.get(id) ?? (w.leaves && w.leaves.map(l => from.get(l)).find(Boolean));
      if (src && !drop) { const a = map.project(src), b = map.project(w.lnglat); inner.animate([{ transform: `translate(${a.x - b.x}px,${a.y - b.y}px)` }, { transform: 'none' }], { duration: 450, easing: EASE }); }
      else if (drop && inner.classList.contains('pin')) { inner.classList.add('drop'); inner.style.setProperty('--i', String(Math.min(n++, 18))); }
      else inner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: EASE });
    }
  }, [ready, tick, index, p.items, p.sel, p.planIds, p.pinClass]);

  useEffect(() => { // eigen locatie
    const map = mapRef.current; if (!map || !ready) return;
    if (!p.me) { meMark.current?.remove(); meMark.current = null; return; }
    if (!meMark.current) { const el = document.createElement('div'); el.className = 'me-mk'; meMark.current = new maplibregl.Marker({ element: el }).setLngLat([p.me.lon, p.me.lat]).addTo(map); }
    else meMark.current.setLngLat([p.me.lon, p.me.lat]);
  }, [ready, p.me]);

  const pad = { bottom: p.bottomPad, top: 0, left: 0, right: 0 };
  // Ruimte onder het paneel; niet tijdens een andere beweging, anders breekt die af (bijv. de focus op een link van een statische pagina).
  useEffect(() => { const map = mapRef.current; if (map && ready && !map.isMoving()) map.easeTo({ padding: pad, duration: 350 }); }, [ready, p.bottomPad]);
  useEffect(() => { const map = mapRef.current; if (map && ready && p.focus) map.easeTo({ center: [p.focus.lon, p.focus.lat], zoom: Math.max(map.getZoom(), 13), padding: pad, duration: 450 }); }, [ready, p.focus?.key]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready || !p.fit || p.fit.pts.length < 1) return;
    const b = new maplibregl.LngLatBounds(); p.fit.pts.forEach(q => b.extend([q.lon, q.lat]));
    map.fitBounds(b, { padding: { top: 70, left: 50, right: 70, bottom: p.bottomPad + 50 }, maxZoom: 14, duration: 500 });
  }, [ready, p.fit?.key]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    const src = map.getSource('route') as ML.GeoJSONSource | undefined; if (!src) return;
    const pts = p.route.map(q => [q.lon, q.lat]), set = (c: number[][]) => src.setData({ type: 'FeatureCollection', features: c.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } }] : [] });
    // De lijn tekent zich van stop naar stop (700 ms), alleen als hij nieuw verschijnt; daarna springt hij mee.
    const draw = pts.length > 1 && !routeShown.current && !reduced(); routeShown.current = pts.length > 1;
    if (!draw) { set(pts); return; }
    const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1])), total = seg.reduce((a, b) => a + b, 0) || 1, t0 = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 4); let left = e * total; const out = [pts[0]];
      for (let i = 0; i < seg.length && left > 0; i++) { const f = Math.min(1, left / (seg[i] || 1)); out.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]); left -= seg[i]; }
      set(out); if (k < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); set(pts); };
  }, [ready, p.route]);

  const zoom = (d: number) => mapRef.current?.easeTo({ zoom: mapRef.current.getZoom() + d, duration: reduced() ? 0 : 250 });
  return (<>
    <div className="map" ref={box} role="region" aria-label="Kaart" />
    <div className="map-ctrl"><button onClick={() => zoom(1)} aria-label="Inzoomen"><svg className="i" aria-hidden="true"><use href="#i-plus" /></svg></button>
      <button onClick={() => zoom(-1)} aria-label="Uitzoomen"><svg className="i" aria-hidden="true"><use href="#i-minus" /></svg></button>
      <button onClick={p.onLocate} aria-label="Naar mijn locatie" aria-pressed={!!p.me}><svg className="i" aria-hidden="true"><use href="#i-loc" /></svg></button></div>
  </>);
}
