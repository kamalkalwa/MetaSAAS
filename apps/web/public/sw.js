/**
 * MetaSAAS Service Worker
 *
 * Provides offline capabilities and asset caching for the PWA.
 * Strategy: Network-first for API calls, Cache-first for static assets.
 *
 * This is a baseline service worker. For production, consider using
 * Workbox or next-pwa for more sophisticated caching strategies.
 */

const CACHE_NAME = "metasaas-v1";

/**
 * Static assets to pre-cache on install.
 * These are available immediately, even offline.
 */
const PRECACHE_URLS = ["/dashboard", "/login"];

// ---------------------------------------------------------------------------
// Install — pre-cache critical routes
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ---------------------------------------------------------------------------
// Activate — clean up old caches
// ---------------------------------------------------------------------------

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// Fetch — network-first for API, cache-first for assets
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST, PUT, DELETE, etc.)
  if (request.method !== "GET") return;

  // Skip API calls — always go to network (data must be fresh)
  if (url.pathname.startsWith("/api/")) return;

  // For everything else: try network first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for offline use
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(request);
      })
  );
});
