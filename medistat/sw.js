// medistat/sw.js
// Service worker : rend MediStat installable et pleinement utilisable HORS
// LIGNE une fois la première ouverture effectuée. C'est ce qui permet à un
// service dépourvu de connexion fiable de continuer à travailler.
//
// Aucune donnée de santé n'est mise en cache ici : les dossiers vivent dans
// IndexedDB, chiffrés, sur l'appareil de l'utilisateur. Le cache ne contient
// que la coquille applicative (code et styles).

const VERSION = "medistat-v1";

// Coquille applicative : tout ce qui est nécessaire pour ouvrir l'application
// sans réseau. Les modules de vue sont chargés à la demande, mais listés ici
// afin d'être disponibles hors ligne dès la première visite.
const COQUILLE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./assets/icone-192.png",
  "./assets/icone-512.png",
  "./assets/icone-maskable-512.png",

  "./js/app.js",
  "./js/core/model.js",
  "./js/core/crypto.js",
  "./js/core/store.js",
  "./js/core/auth.js",
  "./js/core/ui.js",
  "./js/core/charts.js",
  "./js/core/export.js",

  "./js/stats/distributions.js",
  "./js/stats/descriptive.js",
  "./js/stats/inferential.js",
  "./js/stats/regression.js",
  "./js/stats/survival.js",
  "./js/stats/diagnostic.js",
  "./js/stats/multivariate.js",
  "./js/stats/qualitative.js",

  "./js/modules/tableau-bord.js",
  "./js/modules/patients.js",
  "./js/modules/consultations.js",
  "./js/modules/laboratoire.js",
  "./js/modules/catalogue.js",
  "./js/modules/donnees.js",
  "./js/modules/statistiques.js",
  "./js/modules/qualitatif.js",
  "./js/modules/rapports.js",
  "./js/modules/administration.js",
  "./js/modules/aide.js",
  "./js/modules/demonstration.js",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSION)
      // addAll échoue en bloc dès qu'un fichier manque : on tolère les absences
      // pour qu'une ressource optionnelle ne rende pas l'installation impossible.
      .then(cache => Promise.allSettled(COQUILLE.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(cles => Promise.all(cles.filter(c => c !== VERSION).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const requete = event.request;
  if (requete.method !== "GET") return;

  const url = new URL(requete.url);
  if (url.origin !== location.origin) return;

  // Les appels à l'API du serveur ne sont jamais servis depuis le cache :
  // une donnée médicale périmée est plus dangereuse qu'une donnée absente.
  if (url.pathname.includes("/api/")) {
    event.respondWith(
      fetch(requete).catch(() => new Response(
        JSON.stringify({ erreur: "Hors ligne : la requête sera rejouée au retour du réseau." }),
        { status: 503, headers: { "content-type": "application/json; charset=utf-8" } }))
    );
    return;
  }

  // Coquille applicative : « réseau d'abord, cache en secours ».
  // L'utilisateur bénéficie toujours de la dernière version quand il a du
  // réseau, et l'application s'ouvre malgré tout sans connexion.
  event.respondWith(
    fetch(requete)
      .then(reponse => {
        if (reponse && reponse.status === 200 && reponse.type === "basic") {
          const copie = reponse.clone();
          caches.open(VERSION).then(cache => cache.put(requete, copie)).catch(() => {});
        }
        return reponse;
      })
      .catch(() => caches.match(requete).then(trouve =>
        trouve || caches.match("./index.html")))
  );
});

// Permet à la page de déclencher une mise à jour immédiate du service worker
self.addEventListener("message", event => {
  if (event.data === "MAJ_IMMEDIATE") self.skipWaiting();
});
