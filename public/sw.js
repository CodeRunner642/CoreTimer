self.addEventListener('install', (event) => {
  event.waitUntil(caches.open('core-timer-v1').then((cache) => cache.addAll(['/', '/manifest.webmanifest'])));
});
self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
});
