/* Capibario TPV Service Worker - Deploy Update Fix */
const CACHE_NAME = 'capibario-cache-v3';

// Instalación: self.skipWaiting() permite que el nuevo Service Worker tome el control de inmediato
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Solo precacheamos la ruta raíz de forma segura
      return cache.addAll(['/']);
    })
  );
});

// Activación: clients.claim() hace que el SW empiece a controlar las pestañas abiertas sin esperar a un segundo refresco
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-First para navegación (HTML) y Stale-While-Revalidate para assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Navegación (HTML principal): Network-First para asegurar el último build
  if (request.mode === 'navigate' || (url.origin === self.location.origin && url.pathname === '/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 2. Assets estáticos (JS, CSS, Imágenes): Stale-While-Revalidate
  // Como Vite usa hashes, las URLs de los assets cambian en cada build, evitando colisiones
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const networkFetch = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        }).catch(() => {});

        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // 3. Peticiones externas (CDNs): Cache-First con Network Fallback
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request);
    })
  );
});