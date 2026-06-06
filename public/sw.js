// Anchored Steps Service Worker — v4 (lexicon card BG fix Jun 6)
const CACHE = 'anchored-steps-v4-lexcardbg';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // Clear ALL caches to force fresh fetches on next load
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.clients.claim();
    // Notify all clients to reload
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => client.postMessage({ type: 'SW_UPDATED_RELOAD' }));
  })());
});

// Handle push notifications
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'Anchored Steps';
  const options = {
    body: data.body || 'Your journal is waiting. Walk steadily today.',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: 'anchored-reminder',
    renotify: true,
    data: { url: data.url || '/' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
