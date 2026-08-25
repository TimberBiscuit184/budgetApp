/* Budget app service worker — offline support */
const CACHE = 'budget-v1';
const PRECACHE = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never intercept Google sign-in / Drive API — these need the live network.
  if (/accounts\.google\.com|googleapis\.com|gstatic\.com/.test(url.href)) return;

  // Page navigations: network first, fall back to cached copy when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
        .catch(() => caches.match(req).then(m => m || caches.match('./')))
    );
    return;
  }

  // Everything else: serve from cache, otherwise fetch and cache it.
  e.respondWith(
    caches.match(req).then(m => m || fetch(req).then(r => {
      if (r && r.ok && (url.origin === self.location.origin || url.href.includes('cdn.jsdelivr.net'))) {
        const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp));
      }
      return r;
    }).catch(() => m))
  );
});
