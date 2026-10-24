const CACHE_NAME = "block-blast-v14";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./game.js",
  "./js/shapes.js",
  "./js/board.js",
  "./js/generator.js",
  "./js/audio.js",
  "./js/ui.js",
  "./js/effects.js",
  "./js/overlay.js",
  "./js/storage.js",
  "./manifest.json",
  "./js/themes.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(error => {
    if (event.request.mode === "navigate") return caches.match("./index.html");
    throw error;
  })));
});
