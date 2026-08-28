// Service worker de QualiCode : rend l'application installable sur téléphone
// (Android / iOS) et pleinement utilisable HORS LIGNE une fois ouverte une
// première fois. Aucune donnée de recherche n'est mise en cache ici : les
// projets vivent dans IndexedDB, sur l'appareil de l'utilisateur uniquement.

const CACHE = "qualicode-v1";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./assets/logo/qualicode-icon-192.png",
  "./assets/logo/qualicode-icon-512.png",
  "./js/langs.js", "./js/i18n.js", "./js/state.js", "./js/analysis.js",
  "./js/docx.js", "./js/docxout.js", "./js/crypto.js", "./js/applock.js",
  "./js/payments.js", "./js/license.js", "./js/merge.js", "./js/sample.js",
  "./js/export.js", "./js/helpdocs.js", "./js/pdf.js", "./js/refi.js",
  "./js/conceptmap.js", "./js/audio.js", "./js/social.js", "./js/ai.js",
  "./js/sync.js", "./js/imagecode.js", "./js/ocr.js", "./js/biblio.js",
  "./js/stats.js", "./js/realtime.js", "./js/mobile.js", "./js/app.js",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll échoue en bloc si un fichier manque : on tolère les absences
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stratégie « réseau d'abord, cache en secours » : l'utilisateur a toujours la
// dernière version quand il a du réseau, et l'application s'ouvre quand même
// sans connexion (cas courant sur le terrain).
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
  );
});
