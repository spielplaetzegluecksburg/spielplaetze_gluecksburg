const CACHE_NAME = "spielplaetze-gluecksburg-v8";
const APP_SHELL = [
  "./",
  "./index.html",
  "./impressum.html",
  "./ueber-das-projekt.html",
  "./assets/css/styles.css",
  "./assets/js/app.js",
  "./assets/js/pwa.js",
  "./assets/data/playgrounds.json",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./favicon.ico",
  "./assets/fonts/dm-sans-latin.woff2",
  "./assets/fonts/dm-sans-latin-ext.woff2",
  "./assets/images/social-preview.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse.ok && event.request.url.startsWith(self.location.origin)) {
          const responseCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
        }

        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
