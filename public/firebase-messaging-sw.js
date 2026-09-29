// SOL Theory — Firebase Cloud Messaging Service Worker for Background Push Notifications
// Works on both Mobile (PWA / Android / iOS 16.4+) and Desktop (Chrome / Edge / Firefox / macOS)

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: "studio-5711990008-7ac2c",
  appId: "1:873103118314:web:a3329a68328d07aee56c93",
  apiKey: "AIzaSyCAJWBLJ1GTXtELpKFubBlENBq0eroUyCM",
  authDomain: "studio-5711990008-7ac2c.firebaseapp.com",
  messagingSenderId: "873103118314",
  storageBucket: "studio-5711990008-7ac2c.firebasestorage.app"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Received background message:', payload);

  const title = payload.notification?.title || payload.data?.title || 'SOL Theory';
  const body = payload.notification?.body || payload.data?.body || 'New message received';
  const icon = payload.notification?.icon || payload.data?.icon || 'https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440';
  const badge = payload.data?.badge || icon;
  const tag = payload.data?.tag || payload.data?.chatId || 'sol-message';

  const notificationOptions = {
    body,
    icon,
    badge,
    data: {
      url: payload.data?.url || '/portal/dashboard',
      chatId: payload.data?.chatId,
      type: payload.data?.type || 'message',
    },
    vibrate: [200, 100, 200, 100, 200],
    tag,
    renotify: true,
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open Chat',
      },
    ],
  };

  return self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/portal/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Look for an existing open tab/window of the app
      for (const client of windowClients) {
        if (client.url && client.url.includes('/portal') && 'focus' in client) {
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If no window is currently open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Fallback push event listener for standard Web Push payloads
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      if (!data.notification && data.title) {
        const title = data.title || 'SOL Theory';
        const options = {
          body: data.body || 'New message',
          icon: data.icon || 'https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440',
          badge: data.badge || data.icon,
          data: data.data || { url: data.url || '/portal/dashboard' },
          vibrate: [200, 100, 200],
          tag: data.tag || 'sol-push',
          renotify: true,
        };
        event.waitUntil(self.registration.showNotification(title, options));
      }
    } catch {
      // Ignored if handled by Firebase SDK
    }
  }
});
