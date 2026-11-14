/* Atomic, same-origin application shell. Business records stay outside the cache. */
const CACHE = "autosheets-v7";
const SHELL = [
  "index.html", "app.css", "web-app.js", "vault.js", "accounting.js", "accounting-ui.js",
  "rental-books.js", "rental-desk.js", "manifest.json", "assets/icon-192x192.png", "assets/icon-512x512.png"
];
const scope = self.registration.scope;
const paths = new Set(SHELL.map(path => new URL(path, scope).href));

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache =>
    cache.addAll(SHELL.map(path => new Request(new URL(path, scope), { cache: "reload" })))
  ).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => /^autosheets-v\d+$/.test(key) && key !== CACHE).map(key => caches.delete(key)))
  ).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  url.search = "";
  const key = url.href === scope ? new URL("index.html", scope).href : url.href;
  if (!paths.has(key)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(key)).then(cached => cached || fetch(request)));
});
