const CACHE_VERSION = 'diario-online-v7-roster-restore';
const STATIC_CACHE = CACHE_VERSION + '-static';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('diario-online-') && key !== STATIC_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Nunca intercepta comunicação com Google Apps Script ou outros domínios.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navegação: network-first com fallback para o shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() =>
          caches.match('./index.html')
            .then(cached => cached || caches.match('./'))
        )
    );
    return;
  }

  // Assets locais: cache-first.
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) return cached;

        return fetch(request)
          .then(response => {
            if (!response || response.status !== 200 || response.type === 'opaque') {
              return response;
            }

            const copy = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
            return response;
          });
      })
  );
});
