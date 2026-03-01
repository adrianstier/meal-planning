// Self-uninstalling service worker
// Replaces the old cache-first SW that caused stale asset loading
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clear all caches from the old service worker
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((name) => caches.delete(name)))
    ).then(() => self.registration.unregister())
  );
});
