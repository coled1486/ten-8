// Ten-Eight service worker — caches the app shell so the board still loads
// (and all your logged data, which lives in localStorage, stays reachable)
// with no signal. Live features that need the network — Open Food Facts
// search/barcode lookups, AI photo estimate, web fonts — fail gracefully
// and fall back to the local food database, same as when those calls are
// blocked for any other reason.
const CACHE_NAME = 'ten-eight-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL);
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; }).map(function(n) { return caches.delete(n); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Cache-first for same-origin app-shell requests; network-first (no caching)
// for everything else (APIs, fonts, CDN scripts) so live data stays live
// when a connection is available, but a cached shell still boots offline.
self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(function(cached) {
        return cached || fetch(req).then(function(res) {
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(req, resClone); });
          return res;
        }).catch(function() { return caches.match('./index.html'); });
      })
    );
  }
});
