/* Capibario TPV Service Worker - Deploy Update Fix v4 */
const CACHE_NAME = 'capibario-cache-v4';

// Archivos básicos para funcionamiento offline mínimo
const INITIAL_CACHED_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalación: Forzar que el SW se instale y salte la espera
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(INITIAL_CACHED_RESOURCES);
    })
  );
});

// Activación: Limpiar caches viejas y tomar el control de los clientes inmediatamente
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

// Fetch: Lógica diferenciada para evitar el "stale" index.html
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. ESTRATEGIA: NETWORK-FIRST para Navegación (HTML principal)
  // Esto asegura que al recargar (F5) o navegar, siempre se busque la última versión en red.
  if (
    request.mode === 'navigate' || 
    url.pathname === '/' || 
    url.pathname.endsWith('index.html')
  ) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Si la red responde, guardamos copia en caché y devolvemos
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Si la red falla (offline), intentamos servir desde caché
          return caches.match(request);
        })
    );
    return;
  }

  // 2. ESTRATEGIA: STALE-WHILE-REVALIDATE para assets del mismo origen (JS, CSS, Imágenes)
  // Como Vite genera nombres con hash, los archivos nuevos tendrán URLs diferentes.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. ESTRATEGIA: CACHE-FIRST para peticiones externas (CDNs de fuentes/iconos/react)
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request);
    })
  );
});