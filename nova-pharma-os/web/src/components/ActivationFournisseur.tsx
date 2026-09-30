'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Désactive un fournisseur avec qui l'on ne travaille plus, sans effacer
 * son historique de commandes ; ou le réactive.
 */
export default function ActivationFournisseur({
  id,
  actif,
  nom,
}: {
  id: string;
  actif: boolean;
  nom: string;
}) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);

  async function basculer() {
    if (actif && !window.confirm(`Désactiver ${nom} ? Son historique est conservé.`)) return;
    setEnvoi(true);
    try {
      const response = await fetch(`/api/proxy/purchasing/suppliers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !actif }),
      });
      if (response.ok) router.refresh();
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <button className="secondaire" disabled={envoi} onClick={basculer}>
      {actif ? 'Désactiver ce fournisseur' : 'Réactiver ce fournisseur'}
    </button>
  );
}
