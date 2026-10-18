'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface ProduitModifiable {
  id: string;
  name: string;
  dosage: string | null;
  dosage_form: string | null;
  packaging: string | null;
  sale_price: string;
  cost_price: string;
  reorder_point: string;
  expiry_alert_days: number;
  requires_prescription: boolean;
  is_active: boolean;
}

const enChamp = (v: string | number | null) => (v === null || v === undefined ? '' : String(Number(v)).replace('.', ','));
const nombre = (texte: string) => Number(texte.replace(',', '.'));

/**
 * Modifier un produit du catalogue — prix surtout, après un import aux
 * prix indicatifs — ou l'archiver. Un produit archivé disparaît de la
 * caisse et du catalogue ; son historique reste intact.
 */
export default function ModifierProduit({
  produit,
  peutArchiver,
}: {
  produit: ProduitModifiable;
  peutArchiver: boolean;
}) {
  const router = useRouter();
  const [champs, setChamps] = useState({
    name: produit.name,
    dosage: produit.dosage ?? '',
    packaging: produit.packaging ?? '',
    salePrice: enChamp(produit.sale_price),
    costPrice: enChamp(produit.cost_price),
    reorderPoint: enChamp(produit.reorder_point),
    expiryAlertDays: String(produit.expiry_alert_days ?? 90),
    requiresPrescription: produit.requires_prescription,
    isActive: produit.is_active,
  });
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const changer = (cle: keyof typeof champs) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const valeur = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setChamps((c) => ({ ...c, [cle]: valeur }));
  };

  async function envoyer(methode: 'PATCH' | 'DELETE', corps?: unknown) {
    setEnvoi(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/proxy/catalog/products/${produit.id}`, {
        method: methode,
        headers: { 'Content-Type': 'application/json' },
        body: corps ? JSON.stringify(corps) : undefined,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ ton: 'danger', texte: (Array.isArray(body.message) ? body.message.join(' ') : body.message) ?? 'Modification refusée.' });
        return false;
      }
      return true;
    } catch {
      setMessage({ ton: 'danger', texte: 'Service injoignable. Réessayez dans un instant.' });
      return false;
    } finally {
      setEnvoi(false);
    }
  }

  async function enregistrer(event: React.FormEvent) {
    event.preventDefault();
    const ok = await envoyer('PATCH', {
      name: champs.name.trim(),
      dosage: champs.dosage.trim() || null,
      packaging: champs.packaging.trim() || null,
      salePrice: nombre(champs.salePrice),
      costPrice: champs.costPrice.trim() ? nombre(champs.costPrice) : 0,
      reorderPoint: champs.reorderPoint.trim() ? nombre(champs.reorderPoint) : 0,
      expiryAlertDays: Math.max(0, Math.round(Number(champs.expiryAlertDays) || 0)),
      requiresPrescription: champs.requiresPrescription,
      isActive: champs.isActive,
    });
    if (ok) {
      setMessage({ ton: 'info', texte: 'Produit mis à jour.' });
      router.refresh();
    }
  }

  async function archiver() {
    if (!window.confirm(`Archiver « ${produit.name} » ? Il disparaîtra de la caisse et du catalogue ; son historique est conservé.`)) return;
    if (await envoyer('DELETE')) router.push('/pharmacie/catalogue');
  }

  return (
    <form onSubmit={enregistrer}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="m-nom">Nom</label>
          <input id="m-nom" value={champs.name} onChange={changer('name')} required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor="m-dosage">Dosage</label>
          <input id="m-dosage" value={champs.dosage} onChange={changer('dosage')} placeholder="Ex. : 500 mg" />
        </div>
        <div className="field">
          <label htmlFor="m-conditionnement">Conditionnement</label>
          <input id="m-conditionnement" value={champs.packaging} onChange={changer('packaging')} placeholder="Ex. : plaquette de 10" />
        </div>
        <div className="field">
          <label htmlFor="m-vente">Prix de vente</label>
          <input id="m-vente" inputMode="decimal" value={champs.salePrice} onChange={changer('salePrice')} required pattern="[0-9]+([.,][0-9]+)?" />
        </div>
        <div className="field">
          <label htmlFor="m-achat">Prix d&apos;achat</label>
          <input id="m-achat" inputMode="decimal" value={champs.costPrice} onChange={changer('costPrice')} pattern="[0-9]+([.,][0-9]+)?" />
        </div>
        <div className="field">
          <label htmlFor="m-seuil">Seuil de réapprovisionnement</label>
          <input id="m-seuil" inputMode="decimal" value={champs.reorderPoint} onChange={changer('reorderPoint')} pattern="[0-9]+([.,][0-9]+)?" />
        </div>
        <div className="field">
          <label htmlFor="m-alerte">Alerte de péremption (jours avant)</label>
          <input id="m-alerte" type="number" min={0} value={champs.expiryAlertDays} onChange={changer('expiryAlertDays')} />
        </div>
      </div>
      <div className="row" style={{ marginBottom: '0.75rem' }}>
        <label className="case">
          <input type="checkbox" checked={champs.requiresPrescription} onChange={changer('requiresPrescription')} /> Délivré sur ordonnance
        </label>
        <label className="case">
          <input type="checkbox" checked={champs.isActive} onChange={changer('isActive')} /> En vente
        </label>
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="submit" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer les modifications'}</button>
        {peutArchiver && (
          <button type="button" className="secondaire" disabled={envoi} onClick={archiver}>Archiver le produit</button>
        )}
      </div>
    </form>
  );
}
