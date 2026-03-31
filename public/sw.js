/**
 * Shipyard Service Worker — Build 048: Mobile Chat-First
 *
 * Handles:
 *   - Web Push notifications (push event)
 *   - Notification click → deep-link to project chat thread
 *   - Minimal caching (network-first for API; cache-first for static assets)
 */

const CACHE_NAME = 'shipyard-v1';

// ── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// ── Fetch — network-first strategy ───────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  // Skip non-GET and Supabase API calls
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (url.includes('/rest/v1/') || url.includes('/functions/v1/')) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && res.status < 400) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request)),
  );
});

// ── Push ─────────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Shipyard', body: event.data?.text() ?? 'New update' };
  }

  const title   = data.title   ?? 'Shipyard';
  const body    = data.body    ?? 'Something needs your attention.';
  const url     = data.url     ?? '/mobile';
  const icon    = data.icon    ?? '/icons/icon-192.png';
  const badge   = data.badge   ?? '/icons/badge-72.png';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag:  url, // deduplicate by URL
      data: { url },
    }),
  );
});

// ── Notification click ────────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/mobile';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus an existing window on the same origin if possible
        for (const client of clients) {
          const clientUrl = new URL(client.url);
          const target    = new URL(targetUrl, self.location.origin);
          if (clientUrl.origin === target.origin && 'focus' in client) {
            client.focus();
            client.navigate(target.href);
            return;
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
