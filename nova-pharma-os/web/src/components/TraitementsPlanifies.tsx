'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const TRAITEMENTS = [
  {
    nom: 'billing-cycle',
    label: 'Facturer les périodes échues',
    detail: 'Émet la facture des abonnements arrivés à terme.',
  },
  {
    nom: 'dunning',
    label: 'Relancer les impayés',
    detail: 'Envoie les relances et suspend après le délai de grâce.',
  },
  {
    nom: 'trial-expiry',
    label: 'Clore les essais échus',
    detail: 'Bascule les essais terminés en attente de paiement.',
  },
  {
    nom: 'usage-metrics',
    label: "Agréger l'usage",
    detail: "Met à jour les compteurs d'activité des pharmacies.",
  },
];

/**
 * Déclenchement manuel des traitements périodiques.
 * Ils sont idempotents : un rejeu ne produit ni double facture ni
 * double relance, ce qui les rend sûrs à relancer après un incident.
 */
export default function TraitementsPlanifies() {
  const router = useRouter();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [resultat, setResultat] = useState<string | null>(null);

  async function lancer(nom: string) {
    setEnCours(nom);
    setResultat(null);
    try {
      const response = await fetch(`/api/proxy/platform/jobs/${nom}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await response.json();
      setResultat(
        response.ok
          ? `${body.job} : ${body.processed} élément(s) traité(s).`
          : (body.message ?? 'Traitement en échec.'),
      );
      router.refresh();
    } finally {
      setEnCours(null);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Traitements périodiques</h2>
        <span className="hint">
          Exécutés automatiquement chaque nuit ; relançables sans risque de doublon
        </span>
      </div>

      {resultat && <div className="banner info">{resultat}</div>}

      <div className="grid grid-4">
        {TRAITEMENTS.map((t) => (
          <div key={t.nom}>
            <button
              className="secondaire"
              style={{ width: '100%' }}
              disabled={enCours !== null}
              onClick={() => lancer(t.nom)}
            >
              {enCours === t.nom ? 'En cours…' : t.label}
            </button>
            <p className="small muted" style={{ marginTop: '0.35rem' }}>
              {t.detail}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
