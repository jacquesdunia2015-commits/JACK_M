'use client';

import { useState } from 'react';
import { money } from '@/lib/format';

export interface Livraison {
  id: string;
  number: string;
  status: string;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  scheduled_at: string | null;
  amount_due?: string | null;
}

export interface LibellesTournee {
  aucune: string;
  prisEnCharge: string;
  enRoute: string;
  livre: string;
  echec: string;
  recuPar: string;
  montantEncaisse: string;
  confirmer: string;
  appeler: string;
}

/** Étapes possibles, dans l'ordre où un livreur les franchit. */
const SUITE: Record<string, string | null> = {
  assigned: 'picked_up',
  picked_up: 'in_transit',
  in_transit: 'delivered',
};

/**
 * Tournée du livreur.
 *
 * Un livreur tient son téléphone d'une main, souvent sur une moto à
 * l'arrêt : chaque livraison n'expose qu'un seul bouton — l'étape
 * suivante — et le formulaire de preuve ne s'ouvre qu'au dernier
 * moment, à la remise du colis.
 */
export default function TourneeMobile({
  livraisons: initiales,
  libelles,
}: {
  livraisons: Livraison[];
  libelles: LibellesTournee;
}) {
  const [livraisons, setLivraisons] = useState(initiales);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [recu, setRecu] = useState('');
  const [encaisse, setEncaisse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const etiquette: Record<string, string> = {
    picked_up: libelles.prisEnCharge,
    in_transit: libelles.enRoute,
    delivered: libelles.livre,
    failed: libelles.echec,
  };

  async function avancer(livraison: Livraison, statut: string, preuve?: boolean) {
    setErreur(null);
    const corps: Record<string, unknown> = { status: statut };
    if (preuve) {
      corps.recipientName = recu || undefined;
      if (encaisse) corps.amountCollected = Number(encaisse);
    }

    const reponse = await fetch(`/api/proxy/deliveries/${livraison.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const resultat = await reponse.json();
    if (!reponse.ok) {
      setErreur(resultat.message ?? 'Changement refusé.');
      return;
    }
    setLivraisons((liste) =>
      liste.map((l) => (l.id === livraison.id ? { ...l, status: statut } : l)),
    );
    setOuverte(null);
    setRecu('');
    setEncaisse('');
  }

  if (livraisons.length === 0) {
    return <p className="mob-vide">{libelles.aucune}</p>;
  }

  return (
    <>
      {erreur && <div className="mob-message danger">{erreur}</div>}
      <ul className="mob-livraisons">
        {livraisons.map((l) => {
          const suivant = SUITE[l.status] ?? null;
          return (
            <li key={l.id}>
              <div className="mob-livraison-tete">
                <strong>{l.contact_name ?? l.number}</strong>
                <span className={`mob-etat ${l.status}`}>
                  {etiquette[l.status] ?? l.status}
                </span>
              </div>
              {l.address && (
                <p className="mob-note">
                  {l.address}
                  {l.city ? `, ${l.city}` : ''}
                </p>
              )}
              {l.amount_due && Number(l.amount_due) > 0 && (
                <p className="mob-note">{money(l.amount_due)}</p>
              )}

              <div className="mob-actions">
                {l.contact_phone && (
                  <a className="mob-bouton secondaire" href={`tel:${l.contact_phone}`}>
                    {libelles.appeler}
                  </a>
                )}
                {suivant === 'delivered' ? (
                  <button
                    className="mob-bouton"
                    onClick={() => setOuverte(ouverte === l.id ? null : l.id)}
                  >
                    {libelles.livre}
                  </button>
                ) : (
                  suivant && (
                    <button className="mob-bouton" onClick={() => avancer(l, suivant)}>
                      {etiquette[suivant]}
                    </button>
                  )
                )}
              </div>

              {ouverte === l.id && (
                <div className="mob-preuve">
                  {/* La confirmation exige un nom : sans preuve de remise,
                      un colis « livré » ne prouve rien en cas de litige. */}
                  <input
                    value={recu}
                    onChange={(e) => setRecu(e.target.value)}
                    placeholder={libelles.recuPar}
                  />
                  <input
                    value={encaisse}
                    onChange={(e) => setEncaisse(e.target.value)}
                    placeholder={libelles.montantEncaisse}
                    inputMode="decimal"
                  />
                  <button
                    className="mob-bouton"
                    disabled={!recu.trim()}
                    onClick={() => avancer(l, 'delivered', true)}
                  >
                    {libelles.confirmer}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
