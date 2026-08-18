// Ten-Eight service worker — caches the app shell so the board still loads
// (and all your logged data, which lives in localStorage, stays reachable)
// with no signal. Live features that need the network — Open Food Facts
// search/barcode lookups, AI photo estimate, web fonts — fail gracefully
// and fall back to the local food database, same as when those calls are
// blocked for any other reason.
const CACHE_NAME = 'ten-eight-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];
// Files that change often and should always be fetched fresh when online —
// cache is purely an offline fallback for these, never served first.
const NETWORK_FIRST = ['./', './index.html', './manifest.json'];

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

// HTML/manifest: network-first, so a new deploy is picked up on the very
// next load instead of being masked by a stale cached copy forever — only
// falls back to cache when actually offline. Icons: cache-first, since
// those never change and cache-first means one less round trip. Anything
// cross-origin (APIs, fonts, CDN scripts): pass straight through, no
// caching, so live data stays live.
self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var path = url.pathname.endsWith('/') ? './' : ('.'+url.pathname);
  var isNetworkFirst = NETWORK_FIRST.indexOf(path) !== -1 || req.mode === 'navigate';

  if (isNetworkFirst) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).then(function(res) {
        var resClone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(req, resClone); });
        return res;
      }).catch(function() {
        return caches.match(req).then(function(cached) { return cached || caches.match('./index.html'); });
      })
    );
  } else {
    event.respondWith(
      caches.match(req).then(function(cached) {
        return cached || fetch(req).then(function(res) {
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(req, resClone); });
          return res;
        });
      })
    );
  }
});
