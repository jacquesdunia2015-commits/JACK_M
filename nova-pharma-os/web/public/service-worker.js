/*
 * Service worker de NOVA PHARMA OS.
 *
 * Il met en cache la coquille de l'application — les fichiers statiques et
 * une page de repli — et la dernière version de la page Caisse, pour qu'un
 * poste rechargé pendant une coupure puisse continuer d'encaisser. Il ne
 * sert **jamais** de données de l'API depuis son cache : pendant une
 * coupure, la caisse vend sur le catalogue que le poste a gardé lui-même
 * (lots non périmés, ventes en attente déduites, voir lib/hors-ligne.ts),
 * et tout repasse par l'API au retour du réseau.
 */
const CACHE = 'nova-coquille-v2';
// Pages gardées pour un rechargement sans réseau.
const PAGES_HORS_LIGNE = ['/pharmacie/caisse'];
const REPLI = '/hors-ligne.html';
const COQUILLE = [REPLI, '/icone-192.png', '/icone-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(COQUILLE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  if (requete.method !== 'GET') return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  // Les appels d'API partent toujours sur le réseau : pas de données
  // servies depuis le cache, jamais.
  if (url.pathname.startsWith('/api/')) return;

  // Navigation : réseau d'abord ; la caisse retombe sur sa dernière
  // version, les autres pages sur la page « hors ligne ».
  if (requete.mode === 'navigate') {
    const gardee = PAGES_HORS_LIGNE.includes(url.pathname);
    evenement.respondWith(
      fetch(requete)
        .then((reponse) => {
          if (gardee && reponse.ok && !reponse.redirected) {
            const copie = reponse.clone();
            caches.open(CACHE).then((cache) => cache.put(url.pathname, copie));
          }
          return reponse;
        })
        .catch(() => (gardee ? caches.match(url.pathname) : Promise.resolve(undefined))
          .then((page) => page || caches.match(REPLI))),
    );
    return;
  }

  // Fichiers statiques : cache d'abord, réseau ensuite.
  evenement.respondWith(
    caches.match(requete).then(
      (enCache) =>
        enCache ||
        fetch(requete).then((reponse) => {
          if (reponse.ok && url.pathname.startsWith('/_next/static/')) {
            const copie = reponse.clone();
            caches.open(CACHE).then((cache) => cache.put(requete, copie));
          }
          return reponse;
        }),
    ),
  );
});
