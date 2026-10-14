// Service worker: precache the app shell, runtime-cache art/audio (cache-first),
// and keep code files network-first so updates arrive. Bump VERSION to invalidate.
const VERSION = 'freecell-worlds-v25-custom-themes';
const SHELL = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/main.js', './js/rules.js', './js/card.js', './js/animation.js', './js/textures.js', './js/themes.js', './js/theme-expansion.js',
  './js/table.js', './js/post.js', './js/fx.js', './js/audio.js', './js/ui.js', './js/fullscreen.js', './js/stats.js', './js/store.js',
  './js/solver.worker.js', './js/account.js', './js/sync.js', './js/custom-themes.js', './vendor/three.module.js',
  './css/voyage.css', './js/voyage/ui.js', './js/voyage/chart.js', './js/voyage/fog.js', './js/voyage/run.js', './js/voyage/map.js', './js/voyage/charms.js',
  './js/voyage/scoring.js', './js/voyage/config.js', './js/voyage/rng.js', './js/voyage/stats.js',
  './js/voyage/dealer.js', './js/voyage/dealer.worker.js',
  './js/voyage/registry.js',
  './js/voyage/boardrules.js', './js/voyage/boss-yields.json',
  './js/voyage/content/bosses.js', './js/voyage/content/special/boss.fog.js',
  // v2 overhaul modules.
  './js/voyage/content/plaster.js',
  './js/voyage/content/backrooms.js',
  './js/voyage/content/vaporwave.js',
  './js/voyage/content/cinema.js',
  './js/voyage/port.js', './js/voyage/stickers.js', './js/voyage/stuck.js', './js/difficulty.js', './js/shortsolve.js',
  './js/voyage/content/special/aero.dolphin.js',
  './js/voyage/content/special/arctic.aurora.js',
  './js/voyage/content/special/arctic.heatlamp.js',
  './js/voyage/content/special/azulejo.glaze.js',
  './js/voyage/content/special/boss.house.js',
  './js/voyage/content/special/boss.mirror.js',
  './js/voyage/content/special/carvings.totem.js',
  './js/voyage/content/special/cutpaper.octavo.js',
  './js/voyage/content/special/cyber.zeroday.js',
  './js/voyage/content/special/deepstorage.redaction.js',
  './js/voyage/content/special/saffron.loom.js',
  './js/voyage/content/special/saloon.quickdraw.js',
  './js/voyage/content/special/winterglass.icicle.js',
  './js/voyage/content/broadcast.js',
  './js/voyage/content/aero.js',
  './js/voyage/content/arctic.js',
  './js/voyage/content/azulejo.js',
  './js/voyage/content/cafe.js',
  './js/voyage/content/deepsea.js',
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
  './js/voyage/content/darkroom.js',
  './js/voyage/content/forest.js',
  './js/voyage/content/forge.js',
  './js/voyage/content/harvest.js',
  './js/voyage/content/honeyhouse.js',
  './js/voyage/content/index.js',
  './js/voyage/content/jetset.js',
  './js/voyage/content/bloodmoon.js',
  './js/voyage/content/kit.js',
  './js/voyage/content/lapis.js',
  './js/voyage/content/library.js',
  './js/voyage/content/lowtide.js',
  './js/voyage/content/mint.js',
  './js/voyage/content/moth.js',
  './js/voyage/content/muertos.js',
  './js/voyage/content/museum.js',
  './js/voyage/content/smokewatch.js',
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
  './js/voyage/content/signal.js',
  './js/voyage/content/special/deepsea.current.js',
  './js/voyage/content/special/carvings.raven.js',
  './js/voyage/content/special/concrete.spraytag.js',
  './js/voyage/content/special/cyber.ghost.js',
  './js/voyage/content/special/bloodmoon.seal.js',
  './js/voyage/content/special/library.bookmark.js',
  './js/voyage/content/special/lowtide.tidepool.js',
  './js/voyage/content/special/museum.digsite.js',
  './js/voyage/content/special/signal.pull.js',
  './js/voyage/content/special/theater.understudy.js',
  './js/voyage/content/special/toybox.jackinbox.js',
  './js/voyage/content/theater.js',
  './js/voyage/content/toybox.js',
  './js/voyage/content/rink.js',
  './js/voyage/content/winterglass.js',
  './js/voyage/content/zen.js',
  // The seed bank is under assets/ (cache-first): bump VERSION whenever it is rebuilt.
  './assets/data/seedbank.json',
  './assets/art/chart/sea.webp', './assets/art/chart/fog.webp', './assets/art/chart/boat.webp', './assets/art/chart/boss-landmark.webp', './assets/art/chart/fog-isle.webp',
  './assets/art/chart/markets/stickers.webp', './assets/art/chart/markets/boons.webp', './assets/art/chart/markets/upgrades.webp',
  './assets/art/stickers/wild.webp', './assets/art/stickers/fool.webp', './assets/art/stickers/key.webp', './assets/art/stickers/gold.webp', './assets/art/stickers/lucky.webp',
  // Written out (not mapped) so tools/prepare-pages.mjs can check every shell path.
  './assets/art/chart/islands/roman.webp',
  './assets/art/chart/islands/cyber.webp',
  './assets/art/chart/islands/aero.webp',
  './assets/art/chart/islands/zen.webp',
  './assets/art/chart/islands/forest.webp',
  './assets/art/chart/islands/deco.webp',
  './assets/art/chart/islands/muertos.webp',
  './assets/art/chart/islands/space.webp',
  './assets/art/chart/islands/azulejo.webp',
  './assets/art/chart/islands/jetset.webp',
  './assets/art/chart/islands/riverboat.webp',
  './assets/art/chart/islands/carvings.webp',
  './assets/art/chart/islands/varsity.webp',
  './assets/art/chart/islands/driftwood.webp',
  './assets/art/chart/islands/pinecone.webp',
  './assets/art/chart/islands/winterglass.webp',
  './assets/art/chart/islands/concrete.webp',
  './assets/art/chart/islands/library.webp',
  './assets/art/chart/islands/conservatory.webp',
  './assets/art/chart/islands/nighttrain.webp',
  './assets/art/chart/islands/saffron.webp',
  './assets/art/chart/islands/harvest.webp',
  './assets/art/chart/islands/carnival.webp',
  './assets/art/chart/islands/canyon.webp',
  './assets/art/chart/islands/lowtide.webp',
  './assets/art/chart/islands/theater.webp',
  './assets/art/chart/islands/forge.webp',
  './assets/art/chart/islands/saloon.webp',
  './assets/art/chart/islands/lapis.webp',
  './assets/art/chart/islands/canopy.webp',
  './assets/art/chart/islands/diner.webp',
  './assets/art/chart/islands/cove.webp',
  './assets/art/chart/islands/keep.webp',
  './assets/art/chart/islands/deepstorage.webp',
  './assets/art/chart/islands/cafe.webp',
  './assets/art/chart/islands/arctic.webp',
  './assets/art/chart/islands/museum.webp',
  './assets/art/chart/islands/mint.webp',
  './assets/art/chart/islands/toybox.webp',
  './assets/art/chart/islands/prizelights.webp',
  './assets/art/chart/islands/safetypin.webp',
  './assets/art/chart/islands/honeyhouse.webp',
  './assets/art/chart/islands/moth.webp',
  './assets/art/chart/islands/cutpaper.webp',
  './assets/art/chart/islands/broadcast.webp',
  './assets/art/chart/islands/sewing.webp',
  './assets/art/chart/islands/risograph.webp',
  './assets/art/chart/islands/runes.webp',
  './assets/art/chart/islands/signal.webp',
  './assets/art/chart/islands/rink.webp',
  './assets/art/chart/islands/darkroom.webp',
  './assets/art/chart/islands/smokewatch.webp',
  './assets/art/chart/islands/bloodmoon.webp',
  './assets/art/chart/islands/deepsea.webp',
  './assets/art/chart/islands/plaster.webp',
  './assets/art/chart/islands/backrooms.webp',
  './assets/art/chart/islands/vaporwave.webp',
  './assets/art/chart/islands/cinema.webp',
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
