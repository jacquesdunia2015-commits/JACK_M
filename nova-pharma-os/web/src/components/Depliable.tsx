'use client';

import { useState } from 'react';

/**
 * Section repliable. `ouvert` ne fixe que l'état de départ : la section
 * reste ensuite comme la personne l'a laissée, même quand la page se
 * rafraîchit après un enregistrement (sinon un formulaire se refermait,
 * avec son message de confirmation, dès le premier élément ajouté).
 */
export default function Depliable({
  ouvert = false,
  resume,
  children,
}: {
  ouvert?: boolean;
  resume: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(ouvert);
  return (
    <details className="depliable" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{resume}</summary>
      {children}
    </details>
  );
}
