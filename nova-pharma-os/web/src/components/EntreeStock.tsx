'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface ProduitAchat {
  id: string;
  name: string;
  sku: string;
  has_expiry: boolean;
  cost_price: string;
}

export interface FournisseurAchat {
  id: string;
  name: string;
}

interface Ligne {
  cle: number;
  produit: string;
  quantite: string;
  prix: string;
  lot: string;
  peremption: string;
}

const nouvelleCle = () => Date.now() + Math.random();
/** 0.3 → « 0,3 » : la virgule décimale, comme on l'écrit à Bukavu. */
const prixFr = (valeur: string) => String(Number(valeur)).replace('.', ',');
const cleIdempotence = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `achat-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Enregistrer un achat : chaque produit reçu, sa quantité, son prix
 * d'achat, et pour un produit périssable son lot et sa date de péremption.
 * Le stock augmente aussitôt. Une facture fournisseur se saisit en une
 * fois, ligne par ligne, comme on la lit.
 */
export default function EntreeStock({
  produits,
  fournisseurs,
  produitInitial,
}: {
  produits: ProduitAchat[];
  fournisseurs: FournisseurAchat[];
  produitInitial?: string;
}) {
  const router = useRouter();
  const initial = produits.find((p) => p.id === produitInitial);
  const ligneVide = (p?: ProduitAchat): Ligne => ({
    cle: nouvelleCle(),
    produit: p?.name ?? '',
    quantite: '',
    prix: p && Number(p.cost_price) > 0 ? prixFr(p.cost_price) : '',
    lot: '',
    peremption: '',
  });
  const [lignes, setLignes] = useState<Ligne[]>([ligneVide(initial)]);
  const [fournisseur, setFournisseur] = useState('');
  const [facture, setFacture] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cle, setCle] = useState(cleIdempotence);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const trouver = (nom: string) =>
    produits.find(
      (p) => p.name.toLowerCase() === nom.trim().toLowerCase() || p.sku.toLowerCase() === nom.trim().toLowerCase(),
    );

  const modifier = (cleLigne: number, champ: keyof Ligne, valeur: string) =>
    setLignes((ls) =>
      ls.map((l) => {
        if (l.cle !== cleLigne) return l;
        const suivante = { ...l, [champ]: valeur };
        // Le prix d'achat habituel se propose dès que le produit est reconnu.
        if (champ === 'produit' && !l.prix) {
          const p = trouver(valeur);
          if (p && Number(p.cost_price) > 0) suivante.prix = prixFr(p.cost_price);
        }
        return suivante;
      }),
    );

  const total = lignes.reduce(
    (s, l) => s + (Number(l.quantite.replace(',', '.')) || 0) * (Number(l.prix.replace(',', '.')) || 0),
    0,
  );

  async function soumettre(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const inconnus = lignes.filter((l) => !trouver(l.produit)).map((l) => l.produit || '(vide)');
    if (inconnus.length > 0) {
      setMessage({
        ton: 'danger',
        texte: `Produit absent du catalogue : ${inconnus.join(', ')}. Ajoutez-le d'abord dans Catalogue.`,
      });
      return;
    }
    setEnvoi(true);
    try {
      const response = await fetch('/api/proxy/inventory/receptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: cle,
          ...(fournisseur ? { supplierId: fournisseur } : {}),
          ...(facture.trim() ? { supplierInvoiceNumber: facture.trim() } : {}),
          receivedDate: date,
          lines: lignes.map((l) => {
            const p = trouver(l.produit) as ProduitAchat;
            return {
              productId: p.id,
              quantity: Number(l.quantite.replace(',', '.')),
              unitCost: Number(l.prix.replace(',', '.')) || 0,
              ...(l.lot.trim() ? { lotNumber: l.lot.trim() } : {}),
              ...(l.peremption ? { expiryDate: l.peremption } : {}),
            };
          }),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const texte = Array.isArray(body.message) ? body.message.join(' ') : body.message;
        setMessage({ ton: 'danger', texte: texte ?? 'Achat refusé.' });
        return;
      }
      setMessage({
        ton: 'info',
        texte: body.duplicate
          ? 'Cet achat était déjà enregistré : le stock n’a pas été compté deux fois.'
          : `Achat enregistré (${body.receipt?.number ?? ''}) : ${lignes.length} produit(s) ajouté(s) au stock.`,
      });
      setLignes([ligneVide()]);
      setFacture('');
      setCle(cleIdempotence());
      router.refresh();
    } catch {
      setMessage({ ton: 'danger', texte: 'Service injoignable. Réessayez dans un instant.' });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}

      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="e-fournisseur">Fournisseur</label>
          <select id="e-fournisseur" value={fournisseur} onChange={(e) => setFournisseur(e.target.value)}>
            <option value="">Sans fournisseur (achats divers)</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="e-facture">N° de facture ou de bon (facultatif)</label>
          <input id="e-facture" value={facture} onChange={(e) => setFacture(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="e-date">Date de l&apos;achat</label>
          <input id="e-date" type="date" value={date} max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <datalist id="catalogue-achat">
        {produits.map((p) => <option key={p.id} value={p.name}>{p.sku}</option>)}
      </datalist>

      <div className="lignes-achat">
        {lignes.map((l, i) => {
          const p = trouver(l.produit);
          const perissable = p?.has_expiry ?? false;
          return (
            <fieldset key={l.cle} className="ligne-achat">
              <legend>Produit {i + 1}</legend>
              <div className="field ligne-achat-nom">
                <label htmlFor={`e-produit-${l.cle}`}>Produit</label>
                <input id={`e-produit-${l.cle}`} list="catalogue-achat" value={l.produit} required
                  autoComplete="off" placeholder="Nom ou référence"
                  onChange={(e) => modifier(l.cle, 'produit', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={`e-quantite-${l.cle}`}>Quantité achetée</label>
                <input id={`e-quantite-${l.cle}`} inputMode="decimal" value={l.quantite} required
                  pattern="[0-9]+([.,][0-9]+)?" onChange={(e) => modifier(l.cle, 'quantite', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={`e-prix-${l.cle}`}>Prix d&apos;achat unitaire</label>
                <input id={`e-prix-${l.cle}`} inputMode="decimal" value={l.prix} required
                  pattern="[0-9]+([.,][0-9]+)?" onChange={(e) => modifier(l.cle, 'prix', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={`e-lot-${l.cle}`}>N° de lot</label>
                <input id={`e-lot-${l.cle}`} value={l.lot} placeholder={perissable ? 'Sur la boîte' : 'Facultatif'}
                  onChange={(e) => modifier(l.cle, 'lot', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={`e-peremption-${l.cle}`}>
                  Péremption{perissable ? '' : ' (facultatif)'}
                </label>
                <input id={`e-peremption-${l.cle}`} type="date" value={l.peremption} required={perissable}
                  onChange={(e) => modifier(l.cle, 'peremption', e.target.value)} />
              </div>
              {lignes.length > 1 && (
                <div className="field">
                  <label aria-hidden="true">&nbsp;</label>
                  <button type="button" className="secondaire petit"
                    onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))}>
                    Retirer
                  </button>
                </div>
              )}
            </fieldset>
          );
        })}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}>
        <button type="button" className="secondaire" onClick={() => setLignes((ls) => [...ls, ligneVide()])}>
          Ajouter un produit à cet achat
        </button>
        <span className="small muted">
          Total de l&apos;achat : <strong className="mono">{total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </span>
        <button type="submit" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer l’achat'}</button>
      </div>
    </form>
  );
}
