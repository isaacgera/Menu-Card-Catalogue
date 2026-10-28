/**
 * Service worker — offline-first precache. Split into:
 *   CORE     — atomic addAll; if any of these fail, install fails (they're essential).
 *   OPTIONAL — best-effort cache.add().catch(); a missing optional asset (e.g. a vendored lib
 *              or an icon) must NOT fail the whole install and kill offline. (ios-pwa-patterns)
 *
 * Bump CACHE_NAME on every release so clients pick up new assets (a cache-first SW otherwise
 * keeps serving stale files). On iPhone, fully close + reopen the installed app after an update.
 */
const CACHE_NAME = 'mcc-v7';

const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/tokens.css',
  './styles/app.css',
  './js/app.js',
  './js/xlsx-reader.js',
  './js/parser.js',
  './js/store.js',
  './js/pdf.js',
];

const OPTIONAL = [
  './vendor/jspdf.umd.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './screenshots/screenshot-wide.png',
  './screenshots/screenshot-narrow.png',
  './data/Middleware_Menu_Card.xlsx',
];

// The bundled Menu Card is served NETWORK-FIRST so a newly dropped-in card is picked up on the
// next online load (then cached for offline). Everything else stays cache-first.
const NETWORK_FIRST = ['/data/Middleware_Menu_Card.xlsx'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE); // atomic — essential assets
    await Promise.all(OPTIONAL.map((u) => cache.add(u).catch(() => { /* best-effort */ })));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Network-first for the bundled Menu Card so a redeployed card is seen; fall back to cache offline.
  const path = new URL(request.url).pathname;
  if (NETWORK_FIRST.some((p) => path.endsWith(p))) {
    event.respondWith((async () => {
      try {
        const res = await fetch(request);
        if (res && res.ok && new URL(request.url).origin === self.location.origin) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, res.clone());
        }
        return res;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error('bundled card offline and not cached');
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const res = await fetch(request);
      // runtime-cache same-origin GETs so first-seen assets work offline next time
      if (res && res.ok && new URL(request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, res.clone());
      }
      return res;
    } catch {
      // offline and uncached — for navigations, fall back to the app shell
      if (request.mode === 'navigate') return caches.match('./index.html');
      throw new Error('offline and not cached');
    }
  })());
});
