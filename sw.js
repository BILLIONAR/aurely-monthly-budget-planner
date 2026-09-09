const CACHE = 'aurely-monthly-budget-v41'
const SHELL = ['./', './index.html', './styles.css?v=41', './app.js?v=41', './finance.js?v=41', './finance-report.js?v=41', './finance-ui.js?v=41', './english-dates.js?v=41', './manifest.webmanifest', './assets/icon-192.png', './assets/icon-512.png', './assets/aurely-logo.svg?v=29']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('aurely-monthly-budget-') && key !== CACHE).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy))) }
    return response
  }).catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))))
})
