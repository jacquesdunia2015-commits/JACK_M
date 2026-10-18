'use client';

import { useEffect, useState } from 'react';

const CLE = 'nova-largeur-ticket';

export const lireLargeur = (): '58' | '80' => {
  try {
    return localStorage.getItem(CLE) === '58' ? '58' : '80';
  } catch {
    return '80';
  }
};

/**
 * Bouton « Imprimer le ticket » : ouvre le ticket de la vente au format de
 * l'imprimante du comptoir (58 ou 80 mm, retenu sur ce poste) et lance
 * l'impression.
 */
export function BoutonTicket({ venteId, className = 'secondaire' }: { venteId: string; className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.open(`/ticket/${venteId}?largeur=${lireLargeur()}&imprimer=1`, 'ticket', 'width=420,height=720')}
    >
      Imprimer le ticket
    </button>
  );
}

/** Sur la page du ticket : choix de la largeur, impression, et impression automatique. */
export function CommandesTicket({ largeur, auto }: { largeur: '58' | '80'; auto: boolean }) {
  const [pret, setPret] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(CLE, largeur); } catch { /* sans stockage, le format reste celui de l'adresse */ }
    // Page exactement à la taille du ticket : le rouleau n'avance que de ce
    // qui est imprimé (une hauteur « auto » n'est pas comprise des navigateurs).
    const ticket = document.querySelector<HTMLElement>('.ticket-thermique');
    const hauteurMm = ticket ? Math.ceil((ticket.scrollHeight * 25.4) / 96) + 4 : 200;
    let style = document.getElementById('page-ticket');
    if (!style) {
      style = document.createElement('style');
      style.id = 'page-ticket';
      document.head.appendChild(style);
    }
    style.textContent = `@media print { @page { size: ${largeur}mm ${hauteurMm}mm; margin: 0; } }`;
    setPret(true);
    if (auto) {
      const m = setTimeout(() => window.print(), 300);
      return () => clearTimeout(m);
    }
  }, [largeur, auto]);
  return (
    <div className="no-print commandes-ticket">
      <span className="small muted">Imprimante :</span>
      {(['58', '80'] as const).map((l) => (
        <a key={l} className={`btn petit ${l === largeur ? '' : 'secondaire'}`} href={`?largeur=${l}`}>{l} mm</a>
      ))}
      <button type="button" className="petit" disabled={!pret} onClick={() => window.print()}>Imprimer</button>
    </div>
  );
}
