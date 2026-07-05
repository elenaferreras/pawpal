const CACHE = 'pawpal-v1';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

// Cache the app shell
self.addEventListener('fetch', e => {
  if(e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/pawpal/pawpal.html'))
    );
  }
});

// Show notifications from the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      if(list.length > 0) return list[0].focus();
      return clients.openWindow('/pawpal/pawpal.html');
    })
  );
});
