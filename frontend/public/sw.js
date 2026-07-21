// Service worker minimal — requis pour l'installabilité PWA, pas de mode hors-ligne (CDC UI §8).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {
  // Aucune interception : tout part au réseau normalement.
})
