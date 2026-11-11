// Anchored Steps Service Worker — v5 (daily reminders, Nov 10)
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

// Daily reminders sent by the server (api/send-reminders)
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(data.title || 'Anchored Steps', {
    body: data.body || "Today's step is ready.",
    icon: data.icon || '/icon.png',
    badge: data.icon || '/icon.png',
    tag: data.tag || 'daily-reminder',
    data: { url: data.url || '/' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) { if ('focus' in client) return client.focus(); }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
