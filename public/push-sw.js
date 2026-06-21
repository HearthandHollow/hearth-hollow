/**
 * Native Web Push service worker for The Hearth & Hollow admin.
 *
 * Replaces the old OneSignal worker. The server (lib/push.ts) sends an
 * encrypted JSON payload { title, body, url } via the web-push protocol;
 * this worker decrypts it (the browser does that for us), shows the banner,
 * and on click focuses/opens the relevant admin page.
 */

self.addEventListener('install', () => {
  // Activate immediately so a freshly-registered worker can receive pushes
  // without waiting for all old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'The Hearth & Hollow', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'The Hearth & Hollow';
  const options = {
    body: data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'hearth-admin',
    renotify: true,
    data: { url: data.url || '/admin/dashboard' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/admin/dashboard';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        // Reuse an already-open admin tab if there is one.
        if ('focus' in client) {
          try {
            await client.navigate(targetUrl);
          } catch (e) {
            /* cross-origin navigate can throw; fall back to focus */
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});
