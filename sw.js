const CACHE_NAME = "spielplaetze-gluecksburg-649be5412f";
const IMAGE_CACHE_NAME = "spielplaetze-gluecksburg-images-v1";
const IMAGE_CACHE_LIMIT = 80;
const APP_SHELL = [
  "./",
  "./index.html",
  "./impressum.html",
  "./ueber-das-projekt.html",
  "./assets/css/styles.css",
  "./assets/js/app.js",
  "./assets/js/pwa.js",
  "./assets/data/playgrounds.json",
  "./assets/vendor/leaflet/leaflet.css",
  "./assets/vendor/leaflet/leaflet.js",
  "./assets/vendor/leaflet/images/marker-icon.png",
  "./assets/vendor/leaflet/images/marker-icon-2x.png",
  "./assets/vendor/leaflet/images/marker-shadow.png",
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
  const keep = [CACHE_NAME, IMAGE_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => !keep.includes(key)).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.includes("/assets/images/spielplatz-")) {
    event.respondWith(cachedImage(event));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse.ok && url.origin === self.location.origin) {
          const responseCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
        }

        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

async function cachedImage(event) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const cached = await cache.match(event.request);
  const update = fetch(event.request).then(async (networkResponse) => {
    if (networkResponse.ok) {
      await cache.put(event.request, networkResponse.clone());
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - IMAGE_CACHE_LIMIT)).map((key) => cache.delete(key)));
    }
    return networkResponse;
  });
  if (!cached) return update;

  event.waitUntil(update.catch(() => {}));
  return cached;
}
