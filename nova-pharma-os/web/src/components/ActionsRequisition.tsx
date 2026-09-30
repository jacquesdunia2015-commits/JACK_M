'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Documents d'une réquisition, pour un fournisseur ou pour tous : ouvrir le
 * PDF (pour l'imprimer), le partager depuis le téléphone (WhatsApp, e-mail…),
 * ou écrire directement au fournisseur avec le détail de la demande.
 */
export function DocumentFournisseur({
  requisitionId,
  numero,
  fournisseur,
  resume,
}: {
  requisitionId: string;
  numero: string;
  fournisseur: { id: string; nom: string; telephone: string | null; email: string | null } | null;
  resume: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const url = `/api/proxy/purchasing/requisitions/${requisitionId}/pdf${fournisseur ? `?supplierId=${fournisseur.id}` : ''}`;
  const nomFichier = `${numero}${fournisseur ? `-${fournisseur.nom.normalize('NFD').replace(/[^\w]+/g, '-')}` : ''}.pdf`;
  const chiffres = fournisseur?.telephone?.replace(/\D/g, '');
  const texte = `Bonjour${fournisseur ? ` ${fournisseur.nom}` : ''},\nVoici notre réquisition ${numero} :\n${resume}\nMerci de nous confirmer la disponibilité et le délai.`;

  async function partager() {
    setMessage(null);
    try {
      const reponse = await fetch(url);
      if (!reponse.ok) throw new Error();
      const blob = await reponse.blob();
      const fichier = new File([blob], nomFichier, { type: 'application/pdf' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [fichier] })) {
        await nav.share({ files: [fichier], title: `Réquisition ${numero}`, text: texte });
        return;
      }
      // Sans partage de fichiers (ordinateur), on enregistre le PDF : il
      // reste à le joindre au message WhatsApp ou à l'e-mail.
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(blob);
      lien.download = nomFichier;
      lien.click();
      URL.revokeObjectURL(lien.href);
      setMessage('PDF enregistré : joignez-le à votre message.');
    } catch (erreur) {
      if ((erreur as Error)?.name !== 'AbortError') setMessage('Partage impossible pour le moment.');
    }
  }

  return (
    <div className="row" style={{ gap: '0.4rem' }}>
      <a className="btn secondaire petit" href={url} target="_blank" rel="noreferrer">Ouvrir le PDF / imprimer</a>
      <button type="button" className="secondaire petit" onClick={partager}>Partager le PDF</button>
      {chiffres && (
        <a className="btn secondaire petit" href={`https://wa.me/${chiffres}?text=${encodeURIComponent(texte)}`}
          target="_blank" rel="noreferrer">WhatsApp</a>
      )}
      {fournisseur?.email && (
        <a className="btn secondaire petit"
          href={`mailto:${fournisseur.email}?subject=${encodeURIComponent(`Réquisition ${numero}`)}&body=${encodeURIComponent(texte)}`}>
          E-mail
        </a>
      )}
      {message && <span className="small muted">{message}</span>}
    </div>
  );
}

const SUIVANTS: Record<string, { statut: string; libelle: string; secondaire?: boolean }[]> = {
  brouillon: [{ statut: 'envoyee', libelle: 'Marquer comme envoyée' }, { statut: 'annulee', libelle: 'Annuler', secondaire: true }],
  envoyee: [
    { statut: 'recue', libelle: 'Marquer comme reçue' },
    { statut: 'brouillon', libelle: 'Repasser en brouillon', secondaire: true },
    { statut: 'annulee', libelle: 'Annuler', secondaire: true },
  ],
  annulee: [{ statut: 'brouillon', libelle: 'Rouvrir en brouillon', secondaire: true }],
  recue: [],
};

/** Boutons de changement de statut. */
export function StatutRequisition({ requisitionId, statut }: { requisitionId: string; statut: string }) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function changer(nouveau: string) {
    setEnvoi(true);
    setErreur(null);
    try {
      const response = await fetch(`/api/proxy/purchasing/requisitions/${requisitionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nouveau }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setErreur(body.message ?? 'Changement refusé.');
        return;
      }
      router.refresh();
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="row" style={{ gap: '0.4rem' }}>
      {(SUIVANTS[statut] ?? []).map((s) => (
        <button key={s.statut} type="button" className={s.secondaire ? 'secondaire' : ''} disabled={envoi}
          onClick={() => changer(s.statut)}>
          {s.libelle}
        </button>
      ))}
      {erreur && <span className="small" style={{ color: 'var(--alerte)' }}>{erreur}</span>}
    </div>
  );
}

export interface LigneAAttribuer {
  id: string;
  product_id: string | null;
  product_name: string;
  presentation: string | null;
  quantity: string;
  supplier_id: string | null;
  unit_price: string | null;
  currency: string | null;
  notes: string | null;
}

/**
 * Attribuer un fournisseur aux produits qui n'en ont pas encore, tant que
 * la réquisition est en brouillon. Le prix est repris du catalogue du
 * fournisseur choisi.
 */
export function AttribuerFournisseur({
  requisitionId,
  lignes,
  ligneId,
  fournisseurs,
}: {
  requisitionId: string;
  lignes: LigneAAttribuer[];
  ligneId: string;
  fournisseurs: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function attribuer(fournisseurId: string) {
    if (!fournisseurId) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const response = await fetch(`/api/proxy/purchasing/requisitions/${requisitionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: lignes.map((l) => ({
            ...(l.product_id ? { productId: l.product_id } : { productName: l.product_name }),
            ...(l.presentation ? { presentation: l.presentation } : {}),
            quantity: Number(l.quantity),
            ...(l.id === ligneId
              ? { supplierId: fournisseurId }
              : {
                  ...(l.supplier_id ? { supplierId: l.supplier_id } : {}),
                  ...(l.unit_price !== null ? { unitPrice: Number(l.unit_price) } : {}),
                  ...(l.currency ? { currency: l.currency } : {}),
                }),
            ...(l.notes ? { notes: l.notes } : {}),
          })),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setErreur(body.message ?? 'Attribution refusée.');
        return;
      }
      router.refresh();
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <select aria-label="Choisir le fournisseur" disabled={envoi} defaultValue=""
        onChange={(e) => attribuer(e.target.value)} style={{ minWidth: '12rem' }}>
        <option value="">Choisir le fournisseur…</option>
        {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      {erreur && <span className="small" style={{ color: 'var(--alerte)' }}> {erreur}</span>}
    </>
  );
}
