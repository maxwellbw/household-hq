// Household HQ service worker (feature 010). Hand-written, no Workbox — the shell is
// small enough that runtime caching covers it (see specs/010-pwa-and-push/research.md R3).
// Three jobs: cache the app shell for offline/installed launches, receive Web Push events,
// and route a notification tap back into the app (deep-linking to the related task).

var CACHE_VERSION = 'hq-shell-v1';

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_VERSION; }).map(function (n) { return caches.delete(n); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

var OFFLINE_SHELL_HTML =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<title>Household HQ</title>' +
  '<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;' +
  'background:#FAF6F0;color:#3E6E68;font-family:system-ui,sans-serif;text-align:center;padding:24px;' +
  'box-sizing:border-box}</style></head><body>' +
  '<div><p>Household HQ is offline right now.</p><p>Reconnect and reopen the app.</p></div>' +
  '</body></html>';

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never intercept the Apps Script API or GSI

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(request, copy); });
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (cached) {
            return cached || caches.match(self.registration.scope).then(function (shellCached) {
              return shellCached || new Response(OFFLINE_SHELL_HTML, { headers: { 'Content-Type': 'text/html' } });
            });
          });
        })
    );
    return;
  }

  if (url.pathname.indexOf('/assets/') !== -1) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          var copy = response.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(request, copy); });
          return response;
        });
      })
    );
  }
});

self.addEventListener('push', function (event) {
  var data = { title: 'Household HQ', body: '', url: self.registration.scope, tag: 'household-hq' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) {
    // Defensive: a malformed payload still shows a generic notification (iOS penalizes
    // a push event that shows nothing).
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      data: { url: data.url },
      icon: 'icon-192.png',
      badge: 'icon-192.png'
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  var absoluteUrl = new URL(url, self.registration.scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.registration.scope) === 0) {
          client.postMessage({ type: 'deeplink', url: absoluteUrl });
          return client.focus();
        }
      }
      return self.clients.openWindow(absoluteUrl);
    })
  );
});
