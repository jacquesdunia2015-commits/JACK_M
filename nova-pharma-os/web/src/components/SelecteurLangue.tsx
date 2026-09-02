'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { LANGUES } from '@/lib/i18n/langues';

/**
 * Sélecteur de langue.
 *
 * Le choix part vers le serveur pour être posé en cookie, puis la page
 * est rafraîchie : le rendu se fait côté serveur, donc rien ne change à
 * l'écran tant que le cookie n'est pas écrit.
 */
export default function SelecteurLangue({
  courante,
  libelle,
}: {
  courante: string;
  libelle: string;
}) {
  const router = useRouter();
  const [choix, setChoix] = useState(courante);
  const [enCours, demarrer] = useTransition();

  async function changer(code: string) {
    setChoix(code);
    await fetch('/api/langue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    demarrer(() => router.refresh());
  }

  return (
    <label className="selecteur-langue">
      <span className="sr-only">{libelle}</span>
      <select
        aria-label={libelle}
        value={choix}
        disabled={enCours}
        onChange={(e) => void changer(e.target.value)}
      >
        {LANGUES.map((langue) => (
          <option key={langue.code} value={langue.code}>
            {langue.nomLocal}
          </option>
        ))}
      </select>
    </label>
  );
}
