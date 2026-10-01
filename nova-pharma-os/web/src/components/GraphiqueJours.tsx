'use client';

import { useState } from 'react';
import { money } from '@/lib/format';

/**
 * Chiffre d'affaires jour par jour : une barre par jour, une seule série
 * (pas de légende, le titre la nomme), le détail au survol ou au toucher.
 * Le tableau des ventes par jour, juste en dessous, donne les valeurs.
 */
export default function GraphiqueJours({
  jours,
  devise,
}: {
  jours: { jour: string; ca: number; ventes: number; marge: number }[];
  devise: string;
}) {
  const [survol, setSurvol] = useState<number | null>(null);
  const max = Math.max(...jours.map((j) => j.ca), 0);
  if (max <= 0) return <p className="muted" style={{ margin: 0 }}>Aucune vente sur la période.</p>;
  const H = 160;
  const gradu = [0, 0.5, 1].map((f) => f * max);
  const actif = survol !== null ? jours[survol] : null;
  const libelleJour = (j: string) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const pas = Math.ceil(jours.length / 8);

  return (
    <div className="graphique-jours">
      <div className="gj-infobulle" aria-live="polite">
        {actif
          ? <><strong>{libelleJour(actif.jour)}</strong> · {money(actif.ca, devise)} · {actif.ventes} vente(s) · marge {money(actif.marge, devise)}</>
          : <span className="muted">Survolez ou touchez une barre pour le détail du jour.</span>}
      </div>
      <div className="gj-zone">
        <div className="gj-axe" aria-hidden="true">
          {gradu.slice().reverse().map((g) => <span key={g}>{money(g, devise)}</span>)}
        </div>
        <div className="gj-barres" style={{ height: H }} role="img" aria-label={`Chiffre d’affaires par jour, maximum ${money(max, devise)}`}>
          {gradu.map((g) => <div key={g} className="gj-grille" style={{ bottom: `${(g / max) * 100}%` }} />)}
          {jours.map((j, i) => (
            <button
              type="button"
              key={j.jour}
              className={`gj-colonne${survol === i ? ' actif' : ''}`}
              onMouseEnter={() => setSurvol(i)}
              onMouseLeave={() => setSurvol(null)}
              onFocus={() => setSurvol(i)}
              onBlur={() => setSurvol(null)}
              onClick={() => setSurvol(i)}
              aria-label={`${libelleJour(j.jour)} : ${money(j.ca, devise)}, ${j.ventes} vente(s)`}
            >
              <span className="gj-barre" style={{ height: `${(j.ca / max) * 100}%` }} />
            </button>
          ))}
        </div>
        <span aria-hidden="true" />
        <div className="gj-dates" aria-hidden="true">
          {jours.map((j, i) => <span key={j.jour}>{i % pas === 0 ? libelleJour(j.jour) : ''}</span>)}
        </div>
      </div>
    </div>
  );
}
