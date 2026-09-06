const CACHE = 'aurely-monthly-budget-v34'
const SHELL = ['./', './index.html', './styles.css?v=34', './app.js?v=34', './finance.js?v=29', './finance-report.js?v=29', './finance-ui.js?v=34', './english-dates.js?v=29', './manifest.webmanifest', './assets/aurely-logo.svg?v=29']

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
