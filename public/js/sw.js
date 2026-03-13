const CACHE_NAME = "my-express-app-v1";
const urlsToCache = [
  "/",
  "../css/styles.css",
  "/js/app.js",
  "../site.webmanifest",
  "../icons/icon-192.png",
  "../icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
}); 