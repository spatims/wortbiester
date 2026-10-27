// Service Worker: alles vorab in den Cache, damit die App offline läuft.
// Bei jeder neuen Version VERSION hochzählen, sonst bleibt der alte Stand auf dem Tablet.
const VERSION = 'wortbiester-v3';
const DATEIEN = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/app.js', './js/store.js', './js/sicherung.js', './js/audio.js',
  './js/core/parser.js', './js/core/srs.js', './js/core/hunt.js', './js/core/tasks.js', './js/core/biester.js',
  './js/render/biest.js',
  './js/ui/heute.js', './js/ui/jagd.js', './js/ui/rudel.js', './js/ui/laden.js', './js/ui/eltern.js', './js/ui/teile.js',
  './fonts/nunito-latin-wght.woff2', './fonts/fredoka-latin-wght.woff2',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './listen/orbit-1-smaragd-nebel.txt', './listen/orbit-2-magma-guertel.txt', './listen/orbit-3-tiefen-vakuum.txt',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Netz zuerst (damit Updates ankommen), sonst Cache. Nur eigene Dateien.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
