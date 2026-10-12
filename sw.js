// Service worker: precache the app shell, runtime-cache art/audio (cache-first),
// and keep code files network-first so updates arrive. Bump VERSION to invalidate.
const VERSION = 'freecell-worlds-v17-viking-runes';
const SHELL = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/main.js', './js/rules.js', './js/card.js', './js/animation.js', './js/textures.js', './js/themes.js', './js/theme-expansion.js',
  './js/table.js', './js/post.js', './js/fx.js', './js/audio.js', './js/ui.js', './js/stats.js', './js/store.js',
  './js/solver.worker.js', './vendor/three.module.js',
  './css/voyage.css', './js/voyage/ui.js', './js/voyage/run.js', './js/voyage/map.js', './js/voyage/charms.js',
  './js/voyage/scoring.js', './js/voyage/config.js', './js/voyage/rng.js', './js/voyage/stats.js',
  './js/voyage/dealer.js', './js/voyage/dealer.worker.js',
  './js/voyage/registry.js',
  './js/voyage/boardrules.js', './tools/boss-calibration.json',
  './js/voyage/content/bosses.js', './js/voyage/content/special/boss.fog.js',
  './js/voyage/content/broadcast.js',
  './js/voyage/content/aero.js',
  './js/voyage/content/arctic.js',
  './js/voyage/content/azulejo.js',
  './js/voyage/content/cafe.js',
  './js/voyage/content/canopy.js',
  './js/voyage/content/canyon.js',
  './js/voyage/content/carnival.js',
  './js/voyage/content/carvings.js',
  './js/voyage/content/concrete.js',
  './js/voyage/content/conservatory.js',
  './js/voyage/content/cove.js',
  './js/voyage/content/cutpaper.js',
  './js/voyage/content/cyber.js',
  './js/voyage/content/deco.js',
  './js/voyage/content/deepstorage.js',
  './js/voyage/content/diner.js',
  './js/voyage/content/driftwood.js',
  './js/voyage/content/forest.js',
  './js/voyage/content/forge.js',
  './js/voyage/content/harvest.js',
  './js/voyage/content/honeyhouse.js',
  './js/voyage/content/index.js',
  './js/voyage/content/jetset.js',
  './js/voyage/content/keep.js',
  './js/voyage/content/kit.js',
  './js/voyage/content/lapis.js',
  './js/voyage/content/library.js',
  './js/voyage/content/lowtide.js',
  './js/voyage/content/mint.js',
  './js/voyage/content/moth.js',
  './js/voyage/content/muertos.js',
  './js/voyage/content/museum.js',
  './js/voyage/content/nighttrain.js',
  './js/voyage/content/pinecone.js',
  './js/voyage/content/prizelights.js',
  './js/voyage/content/risograph.js',
  './js/voyage/content/riverboat.js',
  './js/voyage/content/roman.js',
  './js/voyage/content/runes.js',
  './js/voyage/content/saffron.js',
  './js/voyage/content/safetypin.js',
  './js/voyage/content/sewing.js',
  './js/voyage/content/saloon.js',
  './js/voyage/content/space.js',
  './js/voyage/content/special/canopy.zipline.js',
  './js/voyage/content/special/carvings.raven.js',
  './js/voyage/content/special/concrete.spraytag.js',
  './js/voyage/content/special/cyber.ghost.js',
  './js/voyage/content/special/keep.siegeengine.js',
  './js/voyage/content/special/library.bookmark.js',
  './js/voyage/content/special/lowtide.tidepool.js',
  './js/voyage/content/special/museum.digsite.js',
  './js/voyage/content/special/space.tractor.js',
  './js/voyage/content/special/theater.understudy.js',
  './js/voyage/content/special/toybox.jackinbox.js',
  './js/voyage/content/theater.js',
  './js/voyage/content/toybox.js',
  './js/voyage/content/varsity.js',
  './js/voyage/content/winterglass.js',
  './js/voyage/content/zen.js',
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
