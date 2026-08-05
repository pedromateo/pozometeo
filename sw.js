const CACHE_NAME = 'pozo-bano-v3.2-static';
const DATA_CACHE_NAME = 'pozo-bano-v3-data';
const ASSETS = [
  './', 
  './index.html', 
  './app.js', 
  './style.css',
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
    // Estrategia Cache-First para los assets estáticos
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});
