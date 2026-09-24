/* Word Buddy service worker — v1.30: network-first shell so version UI updates; skipWaiting + clients.claim; offline assets still cached */
var CACHE = "word-buddy-v1.30";
var ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./audio/miss.wav",
  "./audio/correct.wav",
  "./audio/win.wav",
  "./audio/lose.wav",
  "./audio/blip.wav"
];

function isShellRequest(request) {
  if (request.mode === "navigate") return true;
  var url = new URL(request.url);
  var path = url.pathname;
  if (path.endsWith("/") || /\/index\.html$/i.test(path)) return true;
  if (/\.(?:css|js|webmanifest)$/i.test(path)) return true;
  return false;
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
          return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  // Network-first for HTML / CSS / JS / manifest so version bumps land on refresh.
  // Offline: fall back to precached shell.
  if (isShellRequest(event.request)) {
    event.respondWith(
      fetch(event.request).then(function (response) {
        if (response && response.ok && event.request.url.indexOf(self.location.origin) === 0) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      }).catch(function () {
        return caches.match(event.request).then(function (cached) {
          if (cached) return cached;
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return undefined;
        });
      })
    );
    return;
  }

  // Cache-first for audio, icons, and other same-origin assets (offline play).
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        var copy = response.clone();
        if (response.ok && event.request.url.indexOf(self.location.origin) === 0) {
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      });
    })
  );
});
