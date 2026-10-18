'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface LigneCommande {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  quantity: string;
  received_quantity: string;
  unit_cost: string;
  has_expiry: boolean;
}

const enChamp = (v: string | number) => String(Number(v)).replace('.', ',');
const nombre = (v: string) => Number(v.replace(',', '.'));
const message = (body: { message?: unknown }, repli: string) =>
  (Array.isArray(body.message) ? body.message.join(' ') : (body.message as string)) ?? repli;

/** Transmettre au fournisseur une commande encore en brouillon. */
export function TransmettreCommande({ commandeId }: { commandeId: string }) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <div className="row" style={{ alignItems: 'center' }}>
      <button type="button" disabled={envoi} onClick={async () => {
        setEnvoi(true);
        setErreur(null);
        const r = await fetch(`/api/proxy/purchasing/orders/${commandeId}/submit`, { method: 'POST' });
        setEnvoi(false);
        if (!r.ok) { setErreur(message(await r.json().catch(() => ({})), 'Transmission refusée.')); return; }
        router.refresh();
      }}>
        {envoi ? 'Transmission…' : 'Marquer comme transmise au fournisseur'}
      </button>
      {erreur && <span className="small" style={{ color: 'var(--alerte)' }}>{erreur}</span>}
    </div>
  );
}

/**
 * Réceptionner une livraison : pour chaque ligne, la quantité reçue (le
 * reste à recevoir par défaut), le lot et sa date de péremption. La
 * marchandise entre aussitôt en stock ; la commande passe « reçue en
 * partie » ou « reçue ».
 */
export function ReceptionCommande({
  commandeId,
  fournisseurId,
  lignes,
}: {
  commandeId: string;
  fournisseurId: string;
  lignes: LigneCommande[];
}) {
  const router = useRouter();
  const restantes = lignes.filter((l) => Number(l.received_quantity) < Number(l.quantity));
  const [saisie, setSaisie] = useState(() =>
    Object.fromEntries(restantes.map((l) => [l.id, {
      quantite: enChamp(Number(l.quantity) - Number(l.received_quantity)),
      prix: enChamp(l.unit_cost), lot: '', peremption: '',
    }])),
  );
  const [facture, setFacture] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [cleOperation] = useState(() => `reception-${commandeId}-${Date.now()}`);

  const changer = (id: string, champ: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSaisie((s) => ({ ...s, [id]: { ...s[id], [champ]: e.target.value } }));

  async function receptionner(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);
    const lignesRecues = restantes.filter((l) => nombre(saisie[l.id].quantite) > 0);
    if (lignesRecues.length === 0) { setErreur('Indiquez au moins une quantité reçue.'); return; }
    setEnvoi(true);
    try {
      const r = await fetch('/api/proxy/purchasing/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseOrderId: commandeId,
          supplierId: fournisseurId,
          ...(facture.trim() ? { supplierInvoiceNumber: facture.trim() } : {}),
          idempotencyKey: cleOperation,
          lines: lignesRecues.map((l) => ({
            productId: l.product_id,
            purchaseOrderLineId: l.id,
            quantity: nombre(saisie[l.id].quantite),
            unitCost: nombre(saisie[l.id].prix) || 0,
            ...(saisie[l.id].lot.trim() ? { lotNumber: saisie[l.id].lot.trim() } : {}),
            ...(saisie[l.id].peremption ? { expiryDate: saisie[l.id].peremption } : {}),
          })),
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(message(body, 'Réception refusée.')); return; }
      router.refresh();
    } catch {
      setErreur('Service injoignable. Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  }

  if (restantes.length === 0) return <p className="muted" style={{ margin: 0 }}>Toute la commande est reçue.</p>;

  return (
    <form onSubmit={receptionner}>
      {erreur && <div className="banner danger">{erreur}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th className="num">Reçu</th>
              <th>Lot</th>
              <th>Péremption</th>
              <th className="num">Prix unitaire</th>
            </tr>
          </thead>
          <tbody>
            {restantes.map((l) => (
              <tr key={l.id}>
                <td>
                  <strong>{l.name}</strong>
                  <br />
                  <span className="small muted">reste {enChamp(Number(l.quantity) - Number(l.received_quantity))} sur {enChamp(l.quantity)}</span>
                </td>
                <td className="num">
                  <input aria-label={`Quantité reçue de ${l.name}`} className="prix" inputMode="decimal" value={saisie[l.id].quantite}
                    onChange={changer(l.id, 'quantite')} pattern="[0-9]+([.,][0-9]+)?" style={{ width: '6rem' }} />
                </td>
                <td>
                  <input aria-label={`Lot de ${l.name}`} value={saisie[l.id].lot} onChange={changer(l.id, 'lot')}
                    required={l.has_expiry && nombre(saisie[l.id].quantite) > 0} style={{ minWidth: '7rem' }} />
                </td>
                <td>
                  <input aria-label={`Péremption de ${l.name}`} type="date" value={saisie[l.id].peremption} onChange={changer(l.id, 'peremption')}
                    required={l.has_expiry && nombre(saisie[l.id].quantite) > 0} min={new Date().toISOString().slice(0, 10)} />
                </td>
                <td className="num">
                  <input aria-label={`Prix de ${l.name}`} inputMode="decimal" value={saisie[l.id].prix} onChange={changer(l.id, 'prix')}
                    pattern="[0-9]+([.,][0-9]+)?" style={{ width: '6rem' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'end', marginTop: '0.75rem' }}>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="rec-facture">N° de facture du fournisseur (facultatif)</label>
          <input id="rec-facture" value={facture} onChange={(e) => setFacture(e.target.value)} />
        </div>
        <button type="submit" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer la réception (entrée en stock)'}</button>
      </div>
    </form>
  );
}
