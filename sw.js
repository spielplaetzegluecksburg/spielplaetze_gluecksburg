const CACHE_NAME = "spielplaetze-gluecksburg-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./impressum.html",
  "./ueber-das-projekt.html",
  "./assets/css/styles.css",
  "./assets/js/app.js",
  "./assets/js/pwa.js",
  "./assets/data/playgrounds.json",
  "./assets/icons/icon.svg"
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

  const networkFirst = event.request.mode === "navigate"
    || event.request.destination === "style"
    || event.request.destination === "script";
  event.respondWith((networkFirst ? fetch(event.request) : caches.match(event.request))
    .then((response) => {
      if (response) return response;

      return fetch(event.request).then((networkResponse) => {
        const responseCopy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
        return networkResponse;
      });
    })
    .catch(() => caches.match(event.request)));
});
