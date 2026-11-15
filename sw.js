const CACHE = 'study-simulators-v7';
const BASE = self.registration.scope;
const APP_NAMES = [
  'simulador-CalSisSw',
  'simulador-SegSisSw',
  'simulador-API',
  'simulador-DBBDD',
  'simulador-REQ',
  'simulador-SIE',
  'simulador-ISO-2',
];
const APP_PATHS = APP_NAMES.map(name => new URL('./' + name + '/', BASE).pathname);
const CORE_PATH = new URL('./common/', BASE).pathname;
const API_SELECTOR_PATH = new URL('./simulador-API/api-question-selection.js', BASE).pathname;
const FIREBASE_SDK = '/firebasejs/13.3.0/';
const SHELL = [
  ...APP_PATHS.flatMap(APP => [
    APP, APP + 'index.html', APP + 'styles.css', APP + 'script.js', APP + 'preguntas.json',
    APP + 'manifest.webmanifest', APP + 'icon.svg'
  ]),
  API_SELECTOR_PATH,
  CORE_PATH + 'simulador-core.js',
  CORE_PATH + 'firebase/firebase-config.js',
  CORE_PATH + 'firebase/firebase-sync.js'
];
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key =>
      (key.startsWith('study-calsissw-') || key.startsWith('study-simulators-') || key.startsWith('segsissw-shell-')) && key !== CACHE
    ).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === 'https://www.gstatic.com' && url.pathname.startsWith(FIREBASE_SDK)) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => caches.match(request)));
    return;
  }
  if (url.origin !== self.location.origin) return;
  const inApp = APP_PATHS.some(path => url.pathname.startsWith(path));
  const inCommon = url.pathname.startsWith(CORE_PATH);
  if (!inApp && !inCommon) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
    return response;
  }).catch(() => caches.match(request)));
});
