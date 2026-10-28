// Snuffelkaart offline: app en gegevens werken zonder bereik (bijv. in een sporthal), met de laatst geladen stand.
// Verhoog VERSION bij een wijziging in dit bestand; de app-bestanden zelf hebben al een hash in hun naam.
const VERSION = 'v3', APP = `app-${VERSION}`, DATA = 'data', TILES = 'tiles', MAX_TILES = 1500;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(['/', '/manifest.webmanifest', '/icons/icon-192.png', '/favicon.svg'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('app-') && k !== APP).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/** Eerst het net (vers), anders de laatst bewaarde versie. */
async function networkFirst(req, cacheName, fallback) {
  const c = await caches.open(cacheName);
  try { const r = await fetch(req); if (r.ok) c.put(fallback ?? req, r.clone()); return r; }
  catch { return (await c.match(fallback ?? req)) ?? Response.error(); }
}
/** Eerst bewaard (snel), anders het net en dan bewaren. */
async function cacheFirst(req, cacheName, max) {
  const c = await caches.open(cacheName), hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === 'opaque') {
    await c.put(req, r.clone());
    if (max) c.keys().then(ks => ks.length > max && Promise.all(ks.slice(0, ks.length - max).map(k => c.delete(k)))); // ponytail: oudste eruit, geen echte LRU
  }
  return r;
}

self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET') return;
  if (u.origin === location.origin) {
    if (u.pathname.startsWith('/beheer')) return; // altijd vers, en niet bewaren als '/' (dan opent de app offline als beheer)
    if (req.mode === 'navigate') return e.respondWith(networkFirst(req, APP, u.pathname === '/' ? '/' : undefined)); // elke pagina onder haar eigen adres
    if (u.pathname.startsWith('/data/')) return e.respondWith(networkFirst(req, DATA));
    if (/^\/(_astro|icons|fonts)\//.test(u.pathname)) return e.respondWith(cacheFirst(req, APP));
    return;
  }
  // Kaart: stijl vers als het kan, tegels die je al zag blijven bewaard (begrensd).
  if (u.host === 'tiles.openfreemap.org') return e.respondWith(/\/styles\//.test(u.pathname) ? networkFirst(req, TILES) : cacheFirst(req, TILES, MAX_TILES));
  // PDOK (zoeken) en de rest: gewoon het net.
});
