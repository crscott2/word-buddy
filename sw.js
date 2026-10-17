/* Word Buddy service worker — v2.4.1
   Network-first for the shell (HTML / JS / CSS / manifest) so a bad cached copy
   cannot trap the home-screen app. skipWaiting + clients.claim so an update
   takes over the open page. Old app caches are deleted on activate.
   Word clips stay in their own cache (word-buddy-words-v1) across versions.

   iOS Safari sends Range on asset requests. GitHub Pages answers 206, and a
   partial app.js does not parse — every button then does nothing. Shell fetches
   drop Range and only cache complete 200 responses. Word clips are still
   served as 206 slices from a full cached file so audio keeps working. */
var CACHE = "word-buddy-v2.4.1";
var WORD_CACHE = "word-buddy-words-v1";
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

function isSwScript(url) {
  return /\/sw\.js$/i.test(url.pathname);
}

/** Full-file GET. Never forwards Range (that becomes a 206 slice of JS/CSS/HTML). */
function fetchFull(url) {
  return fetch(url, { cache: "no-store", credentials: "same-origin" });
}

function putIfComplete(cache, url, response) {
  if (!response || response.status !== 200) return;
  var copy;
  try { copy = response.clone(); } catch (e) { return; }
  try {
    cache.put(url, copy).catch(function () {});
  } catch (e2) {}
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(ASSETS.map(function (url) {
        return fetchFull(new URL(url, self.location).toString()).then(function (response) {
          putIfComplete(cache, url, response);
        }).catch(function () {});
      }));
    }).then(function () {
      return self.skipWaiting();
    }).catch(function () {
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

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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
      if (cached && cached.status === 200) return rangeResponse(request, cached);
      return fetchFull(url).then(function (response) {
        if (response && response.status === 200) {
          putIfComplete(cache, url, response);
          var path = new URL(url).pathname;
          cache.keys().then(function (reqs) {
            reqs.forEach(function (r) {
              if (r.url !== url && new URL(r.url).pathname === path) cache.delete(r);
            });
          }).catch(function () {});
          return rangeResponse(request, response);
        }
        return response;
      });
    });
  }).catch(function () {
    return fetch(request).catch(function () {
      return new Response("", { status: 504, statusText: "Offline" });
    });
  });
}

function matchCached(cache, request) {
  var url = request.url.split("#")[0];
  return cache.match(url).then(function (hit) {
    if (hit && hit.status === 200) return hit;
    return cache.match(url, { ignoreSearch: true }).then(function (hit2) {
      if (hit2 && hit2.status === 200) return hit2;
      if (request.mode === "navigate" || /\/$/.test(new URL(url).pathname) || /index\.html$/i.test(url)) {
        return cache.match("./index.html");
      }
      return undefined;
    });
  });
}

function shellResponse(request) {
  var url = request.url.split("#")[0];
  return fetchFull(url).then(function (response) {
    /* 200 only. A 206 here is a sliced script/page and must not reach the document. */
    if (response && response.status === 200) {
      var copy;
      try { copy = response.clone(); } catch (e) { copy = null; }
      if (copy) {
        caches.open(CACHE).then(function (cache) {
          putIfComplete(cache, url, copy);
        }).catch(function () {});
      }
      return response;
    }
    return caches.open(CACHE).then(function (cache) {
      return matchCached(cache, request).then(function (cached) {
        if (cached) return cached;
        if (response && response.status !== 206) return response;
        return new Response("", { status: 502, statusText: "Partial shell blocked" });
      });
    });
  }).catch(function () {
    return caches.open(CACHE).then(function (cache) {
      return matchCached(cache, request).then(function (cached) {
        if (cached) return cached;
        return new Response("", { status: 504, statusText: "Offline" });
      });
    });
  });
}

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url;
  try { url = new URL(event.request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  /* Let the browser update sw.js itself; never serve a cached worker script. */
  if (isSwScript(url)) return;

  if (isWordClip(event.request)) {
    event.respondWith(wordClipResponse(event.request));
    return;
  }

  if (isShellRequest(event.request)) {
    event.respondWith(shellResponse(event.request));
    return;
  }

  event.respondWith(shellResponse(event.request));
});
