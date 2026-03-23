// ─── FrontStock Service Worker ───────────────────────────────────────────────
const CACHE_VERSION = 'v4';
const CACHE_STATIC  = `frontstock-static-${CACHE_VERSION}`;
const CACHE_PAGES   = `frontstock-pages-${CACHE_VERSION}`;
const CACHE_API     = `frontstock-api-${CACHE_VERSION}`;

const APP_SHELL = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/logo.png',
];

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![CACHE_STATIC, CACHE_PAGES, CACHE_API].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── MESSAGES ─────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});

// ─── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // ── Supabase / API: network only ──────────────────────────────────────────
  if (url.pathname.startsWith('/api') || url.hostname.includes('supabase.co')) {
    return; // Let it fall through to network
  }

  // ── Next.js static assets: cache-first ───────────────────────────────────
  if (
    url.pathname.startsWith('/_next/static/') ||
    /\.(js|css|woff2?|webp|png|jpg|jpeg|svg|ico|webmanifest)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // ── Page navigations: network-first, cache fallback ──────────────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_PAGES);
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { cacheName: CACHE_PAGES });
          if (cached) return cached;
          return caches.match('/offline.html');
        })
    );
    return;
  }
});

// ─── PUSH NOTIFICATIONS ──────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'FrontStock', body: event.data.text() }; }

  const title = data.title || 'FrontStock';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: data.tag || 'frontstock',
    renotify: true,
    data: { url: data.url || '/' },
    actions: data.actions || [],
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── NOTIFICATION CLICK ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ─── BACKGROUND SYNC ─────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-actions') {
    event.waitUntil(syncPendingActions());
  }
});

async function syncPendingActions() {
  // Placeholder for background sync of any offline-queued actions
  const cache = await caches.open('frontstock-sync');
  const requests = await cache.keys();
  for (const req of requests) {
    try {
      await fetch(req.clone());
      await cache.delete(req);
    } catch {
      // Will retry on next sync
    }
  }
}
