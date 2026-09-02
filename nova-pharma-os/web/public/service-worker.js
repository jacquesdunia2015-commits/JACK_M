/*
 * Service worker de NOVA PHARMA OS.
 *
 * Il ne met en cache que la coquille de l'application — les fichiers
 * statiques et une page de repli. **Jamais les données** : un vendeur
 * qui verrait un stock d'hier passerait une vente sur un lot déjà
 * écoulé. En cas de coupure, l'application le dit franchement plutôt
 * que d'afficher des chiffres périmés.
 */
const CACHE = 'nova-coquille-v1';
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

  // Navigation : réseau d'abord, page « hors ligne » en dernier recours.
  if (requete.mode === 'navigate') {
    evenement.respondWith(fetch(requete).catch(() => caches.match(REPLI)));
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
