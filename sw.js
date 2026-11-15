const CACHE='study-calsissw-v4';
const BASE=self.registration.scope;
const APP=new URL('./simulador-CalSisSw/',BASE).pathname;
const CORE=new URL('./common/simulador-core.js',BASE).pathname;
const SHELL=[APP,APP+'index.html',APP+'styles.css',APP+'script.js',APP+'preguntas.json',APP+'manifest.webmanifest',APP+'icon.svg',CORE,CORE.replace('/common/simulador-core.js','/common/firebase/firebase-config.js'),CORE.replace('/common/simulador-core.js','/common/firebase/firebase-sync.js')];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('study-calsissw-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin)return;
 if(!url.pathname.startsWith(APP)&&url.pathname!==CORE)return;
 event.respondWith(fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response;}).catch(()=>caches.match(request)));
});
