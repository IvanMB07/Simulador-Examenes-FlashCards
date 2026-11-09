const CACHE_NAME = 'segsissw-shell-v3';
const APP_SHELL = ['./', './index.html', './styles.css', './script.js', './cloud-config.js', './cloud-sync.js', './manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // La configuración cloud debe leerse siempre desde red para que una clave recién añadida no quede obsoleta.
  if (url.origin === self.location.origin && url.pathname.endsWith('/cloud-config.js')) {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => caches.match(request)));
    return;
  }
  // El JSON de preguntas se cachea tras una carga correcta; el resto del shell usa cache-first.
  if (url.pathname.endsWith('/preguntas.json') || url.pathname.endsWith('preguntas.json')) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, copy)); }
      return response;
    }).catch(() => caches.match(request)));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, copy)); }
      return response;
    })));
  }
});
