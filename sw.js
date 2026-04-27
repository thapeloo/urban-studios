const CACHE_NAME = "urban-threads-v3";
const STATIC_ASSETS = [
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

// ── Install: cache static assets only (NOT index.html) ──────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting(); // activate immediately without waiting
});

// ── Activate: delete ALL old caches so no stale version survives ─────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // take control of all open tabs immediately
  );
});

// ── Fetch: network-first for HTML, cache-first for everything else ────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isHTML = event.request.headers.get("accept") &&
    event.request.headers.get("accept").includes("text/html");
  const isSameOrigin = url.origin === self.location.origin;

  // Network-first for index.html and navigation requests
  // This ensures every page load always tries to get the latest version
  if (isHTML || url.pathname === "/" || url.pathname.endsWith("index.html")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }) // bypass browser cache too
        .then((networkResponse) => {
          // Got fresh version — update the cache
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback — serve cached index.html
          return caches.match("./index.html") || caches.match("./");
        })
    );
    return;
  }

  // Cache-first for static assets (icons, manifest, fonts)
  if (isSameOrigin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return networkResponse;
        });
      })
    );
    return;
  }

  // Pass through all external requests (Firebase, Google Fonts, etc.)
  event.respondWith(fetch(event.request));
});

// ── Message handler: force update when triggered from app ────────────────────
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
