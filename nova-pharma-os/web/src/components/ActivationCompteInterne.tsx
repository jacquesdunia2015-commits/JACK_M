'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Désactive ou réactive un compte interne.
 *
 * Premier usage attendu : une fois son propre compte de
 * super-administrateur créé, désactiver le compte livré à l'installation,
 * dont le mot de passe par défaut est public. L'API ferme aussitôt ses
 * sessions et refuse qu'on désactive son propre compte.
 */
export default function ActivationCompteInterne({
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
  const [erreur, setErreur] = useState<string | null>(null);

  async function basculer() {
    if (actif && !window.confirm(`Désactiver le compte de ${nom} ? Ses sessions seront fermées.`)) {
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const response = await fetch(`/api/proxy/platform/users/${id}/activation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !actif }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setErreur(body.message ?? 'Opération refusée.');
        return;
      }
      router.refresh();
    } catch {
      setErreur('Service injoignable.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <button className="secondaire petit" disabled={envoi} onClick={basculer}>
        {actif ? 'Désactiver' : 'Réactiver'}
      </button>
      {erreur && <div className="small" style={{ color: 'var(--alerte)' }}>{erreur}</div>}
    </>
  );
}
