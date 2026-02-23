// Capy Inventory Service Worker v3
// Auto-updates without requiring manual cache clear

const CACHE_NAME = 'capy-inventory-v3';
const OFFLINE_URL = '/capy-inventory/';

// Only cache static assets, not the HTML (so updates show immediately)
const STATIC_ASSETS = [
  '/capy-inventory/manifest.json',
  '/capy-inventory/icon-192.png',
  '/capy-inventory/icon-512.png'
];

// Install - cache static assets only
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v3...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Take over immediately
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v3...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('capy-inventory-') && key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch - Network first for HTML/JS, cache for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET
  if (event.request.method !== 'GET') return;
  
  // Skip API calls
  if (url.hostname.includes('supabase.co')) return;
  
  // For navigation (HTML) - always network first, no cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }
  
  // For JS/CSS with hash in filename - cache forever (immutable)
  if (url.pathname.match(/\.[a-f0-9]{8}\.(js|css)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
  
  // For everything else - network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && STATIC_ASSETS.some(a => url.pathname.endsWith(a.replace('/capy-inventory', '')))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Listen for skip waiting message from app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
