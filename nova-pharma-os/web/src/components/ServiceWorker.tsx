'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker qui rend l'application installable sur un
 * téléphone. Il ne met en cache que la coquille : les données passent
 * toujours par le réseau (voir public/service-worker.js).
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // Un navigateur qui refuse l'enregistrement (mode privé, http sur
      // certains réglages) garde une application parfaitement
      // fonctionnelle : seule l'installation sur l'écran d'accueil est
      // perdue. Rien à signaler à l'utilisateur.
    });
  }, []);
  return null;
}
