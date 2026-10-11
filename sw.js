// Service worker: precache the app shell, runtime-cache art/audio (cache-first),
// and keep code files network-first so updates arrive. Bump VERSION to invalidate.
const VERSION = 'freecell-worlds-v5-28-worlds';
const SHELL = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/main.js', './js/rules.js', './js/card.js', './js/animation.js', './js/textures.js', './js/themes.js', './js/theme-expansion.js',
  './js/table.js', './js/post.js', './js/fx.js', './js/audio.js', './js/ui.js', './js/stats.js', './js/store.js',
  './js/solver.worker.js', './vendor/three.module.js',
  './css/voyage.css', './js/voyage/ui.js', './js/voyage/run.js', './js/voyage/map.js', './js/voyage/charms.js',
  './js/voyage/scoring.js', './js/voyage/config.js', './js/voyage/rng.js', './js/voyage/stats.js',
  './js/voyage/dealer.js', './js/voyage/dealer.worker.js',
  // The seed bank is under assets/ (cache-first): bump VERSION whenever it is rebuilt.
  './assets/data/seedbank.json',
  './vendor/lights/RectAreaLightUniformsLib.js', './vendor/lights/RectAreaLightTexturesLib.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isAsset = /\/assets\//.test(req.url) || /\/vendor\//.test(req.url);
  if (isAsset) {
    // Cache-first: generated art/audio never changes under the same name.
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
            return res;
          })
      )
    );
    return;
  }
  // Network-first for code and pages; fall back to cache when offline.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
