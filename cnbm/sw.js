// Service worker de l'application de recensement CNBM-RDC.
// Met l'application en cache pour qu'elle s'ouvre SANS INTERNET après une
// première visite. Les fiches ne passent jamais par ici : elles restent dans
// la mémoire du navigateur (IndexedDB) de l'appareil.
const CACHE = "cnbm-recensement-v11";
const FICHIERS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./carte-rdc.svg", "./carte-rdc-mini.svg", "./carte-rdc-territoires.svg", "./carte-rdc-territoires-mini.svg", "./geo-rdc.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.allSettled(FICHIERS.map(f => c.add(f))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(n => n.startsWith("cnbm-") && n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Réseau d'abord (pour recevoir les mises à jour), cache si pas de connexion.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && new URL(e.request.url).origin === location.origin) {
        const copie = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copie));
      }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })
      .then(r => r || caches.match("./index.html")))
  );
});
