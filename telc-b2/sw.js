/* Keep each installed shell together, including on offline reloads. */
const scope = self.registration.scope;
const prefix = 'telc-b2-shell:' + new URL(scope).pathname + ':';
const cacheName = prefix + '5';
const index = new URL('index.html', scope).href;
const files = ['index.html', 'styles.css?v=5', 'data.js?v=5', 'weeks.js?v=5', 'extra.js?v=5',
  'progress-store.js?v=5', 'app.js?v=5', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];
const shell = new Set(files.map(file => new URL(file, scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([...shell])));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
      if (name === 'telc-b2-shell-v4') {
        const keys = await (await caches.open(name)).keys();
        if (keys.length && keys.every(request => request.url.startsWith(scope))) await caches.delete(name);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const path = url.origin + url.pathname;
  const isApp = request.mode === 'navigate' && (path === scope || path === index);
  if (!isApp && !shell.has(request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(isApp ? index : request) || fetch(request);
  })());
});
