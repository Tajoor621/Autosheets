/* AutoSheets service worker — offline shell, fresh HTML when online. */
const CACHE_NAME = "autosheets-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./rental-books.js",
  "./rental-desk.js",
  "./sw.js",
  "./assets/icon-192x192.png",
  "./assets/icon-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => /^autosheets-v\d+$/.test(k) && k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isDocument(request) {
  if (request.mode === "navigate") return true;
  const url = new URL(request.url);
  return url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const scope = new URL(self.registration.scope);
  const url = new URL(event.request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (["rental-books.js", "rental-desk.js"].some((name) => url.pathname === new URL(name, scope).pathname)) {
    event.respondWith(fetch(event.request).then((response) => {
      if (!response.ok) throw new Error("Rental script unavailable");
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || Response.error())));
    return;
  }

  if (isDocument(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html").then((cached) => cached || caches.match("./")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached || caches.match("./index.html"));
      return cached || network;
    })
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "autosheets-sync") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.postMessage({ type: "SYNC", tag: event.tag }));
      })
    );
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "autosheets-periodic") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.postMessage({ type: "PERIODIC_SYNC" }));
      })
    );
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "AutoSheets", body: "You have an update" };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "AutoSheets", {
      body: data.body || "",
      icon: "./assets/icon-192x192.png",
      badge: "./assets/icon-192x192.png",
      data: data.url || "./index.html"
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data || "./index.html";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      for (const c of list) {
        if (c.url.includes("Autosheets") && "focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
