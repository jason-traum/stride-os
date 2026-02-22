const CACHE_NAME = 'dreamy-v2';
const STATIC_ASSETS = [
  '/',
  '/today',
  '/log',
  '/history',
  '/coach',
  '/analytics',
  '/plan',
  '/races',
  '/settings',
  '/shoes',
  '/wardrobe',
  '/pace-calculator',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ==================== Push Notification Handlers ====================

// Push event - display notification when server sends a push message
self.addEventListener('push', function(event) {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || 'New update from Dreamy',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    tag: data.tag || 'dreamy-notification',
    renotify: !!data.tag, // Only renotify if there's a specific tag
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Dreamy', options)
  );
});

// Notification click - focus existing window or open new one
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Check if there's already a window/tab open with the app
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // If no existing window, open a new one
      return clients.openWindow(url);
    })
  );
});

// Notification close - for future analytics
self.addEventListener('notificationclose', function(event) {
  // Future: track notification dismissals for engagement metrics
});

// ==================== Fetch/Cache Handlers ====================

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and API calls
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response before caching
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request).then((response) => {
          if (response) return response;
          // For navigation requests, return the cached home page
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
