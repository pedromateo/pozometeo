const CACHE_NAME = 'pozo-bano-v3.11-static';
const DATA_CACHE_NAME = 'pozo-bano-v3-data';
const ASSETS = [
  './', 
  './index.html', 
  './app.js', 
  './style.css',
  './beach_rules.json',
  './ui_texts.json',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
          return caches.delete(key);
        }
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('api.open-meteo.com')) {
    // Estrategia Stale-While-Revalidate para la API
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const networkFetch = fetch(event.request).then(networkResponse => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(err => {
          console.warn('Falló la red al llamar a la API, usando caché local si existe', err);
          return cachedResponse; 
        });
        
        return cachedResponse || networkFetch;
      })
    );
  } else {
    // Estrategia Network-First para assets estáticos con fallback a caché (Offline)
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Si la red falla (Offline), sirve el recurso guardado en caché local
          return caches.match(event.request);
        })
    );
  }
});
