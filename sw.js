/* Word Buddy service worker — v2.3.1: network-first shell; skipWaiting + clients.claim; offline assets;
   recorded word clips (audio/words/*.mp3) cache-first in their own cache that survives version bumps,
   with Range (206) support so iOS Safari can play them from the cache. */
var CACHE = "word-buddy-v2.3.1";
var WORD_CACHE = "word-buddy-words-v1"; /* kept across versions; a re-recorded clip gets a new URL (?v=rev from js/word-audio.js) */
var ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/island.js",
  "./js/spell.js",
  "./js/levels-data.js",
  "./js/word-audio.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./audio/miss.wav",
  "./audio/correct.wav",
  "./audio/win.wav",
  "./audio/lose.wav",
  "./audio/blip.wav",
  "./data/words.json"
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
        keys.filter(function (k) { return k !== CACHE && k !== WORD_CACHE; }).map(function (k) {
          return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isWordClip(request) {
  return /\/audio\/words\/[a-z]+\.mp3$/i.test(new URL(request.url).pathname);
}

/** Serve a full cached response, sliced to 206 if the media element asked for a byte range */
function rangeResponse(request, full) {
  var range = request.headers.get("range");
  if (!range) return Promise.resolve(full);
  return full.clone().arrayBuffer().then(function (buf) {
    var m = /bytes=(\d*)-(\d*)/.exec(range);
    var size = buf.byteLength;
    var start = m && m[1] !== "" ? parseInt(m[1], 10) : 0;
    var end = m && m[2] !== "" ? parseInt(m[2], 10) : size - 1;
    if (m && m[1] === "" && m[2] !== "") { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
    end = Math.min(end, size - 1);
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + size } });
    }
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      statusText: "Partial Content",
      headers: {
        "Content-Type": full.headers.get("Content-Type") || "audio/mpeg",
        "Content-Range": "bytes " + start + "-" + end + "/" + size,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes"
      }
    });
  });
}

function wordClipResponse(request) {
  var url = request.url.split("#")[0];
  return caches.open(WORD_CACHE).then(function (cache) {
    return cache.match(url).then(function (cached) {
      if (cached) return rangeResponse(request, cached);
      /* Fetch the whole file (no Range) so it can be cached, then slice if needed */
      return fetch(url, { credentials: "same-origin" }).then(function (response) {
        if (response && response.status === 200) {
          cache.put(url, response.clone());
          /* A re-recorded clip (?v=rev) supersedes older cached copies of the same file */
          var path = new URL(url).pathname;
          cache.keys().then(function (reqs) {
            reqs.forEach(function (r) {
              if (r.url !== url && new URL(r.url).pathname === path) cache.delete(r);
            });
          });
          return rangeResponse(request, response);
        }
        return response;
      });
    });
  });
}

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  if (isWordClip(event.request)) {
    event.respondWith(wordClipResponse(event.request));
    return;
  }

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
