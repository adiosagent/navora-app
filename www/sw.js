// Navora service worker — NETWORK-FIRST for the app shell (so updates show immediately), cache fallback when offline.
const CACHE = 'navora-v24';
const SHELL = ['./', './index.html', './style.css?v=24', './app.js?v=24', './i18n.js?v=24', './voice.js?v=24', './config.js?v=24', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return; // never touch APIs / TomTom
  e.respondWith(
    fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});
// Web push (FCM) — shows notification when app is in background
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { title: 'Navora', body: e.data && e.data.text() }; }
  const n = d.notification || d;
  e.waitUntil(self.registration.showNotification(n.title || 'Navora alert', { body: n.body || '', icon: 'icons/icon-192.png', vibrate: [200, 100, 200], data: d.data || {} }));
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(clients.openWindow('./')); });
