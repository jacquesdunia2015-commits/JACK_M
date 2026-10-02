'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export interface ProduitCommande {
  id: string;
  name: string;
  sku: string;
  cost_price: string;
}

export interface LigneInitiale {
  productId: string;
  quantite: number;
}

interface Ligne {
  cle: number;
  produit: string;
  quantite: string;
  prix: string;
  /** Prix repris du catalogue du fournisseur, ou du prix d'achat habituel. */
  origine: string | null;
}

const cle = () => Date.now() + Math.random();
const enChamp = (v: string | number) => String(Number(v)).replace('.', ',');
const nombre = (v: string) => Number(v.replace(',', '.'));

/**
 * Nouvelle commande fournisseur : le fournisseur, puis les produits et
 * leurs quantités. Le prix unitaire est repris du catalogue du fournisseur
 * quand il y figure, sinon du prix d'achat habituel du produit.
 */
export default function FormulaireCommande({
  fournisseurs,
  produits,
  fournisseurInitial,
  lignesInitiales = [],
}: {
  fournisseurs: { id: string; name: string }[];
  produits: ProduitCommande[];
  fournisseurInitial?: string;
  lignesInitiales?: LigneInitiale[];
}) {
  const router = useRouter();
  const parId = new Map(produits.map((p) => [p.id, p]));
  const [fournisseur, setFournisseur] = useState(fournisseurInitial ?? '');
  const [lignes, setLignes] = useState<Ligne[]>(() => {
    const depart = lignesInitiales
      .map((l) => parId.get(l.productId) && ({
        cle: cle(), produit: (parId.get(l.productId) as ProduitCommande).name,
        quantite: enChamp(Math.ceil(l.quantite)), prix: '', origine: null,
      }))
      .filter(Boolean) as Ligne[];
    return depart.length ? depart : [{ cle: cle(), produit: '', quantite: '', prix: '', origine: null }];
  });
  const [attendue, setAttendue] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const demandes = useRef(new Map<number, string>());

  const trouver = (nom: string) => {
    const t = nom.trim().toLowerCase();
    return produits.find((p) => p.name.toLowerCase() === t || p.sku.toLowerCase() === t);
  };
  const modifier = (c: number, changements: Partial<Ligne>) =>
    setLignes((ls) => ls.map((l) => (l.cle === c ? { ...l, ...changements } : l)));

  // Prix du fournisseur choisi, pour chaque produit reconnu et encore sans prix.
  useEffect(() => {
    if (!fournisseur) return;
    for (const l of lignes) {
      const p = trouver(l.produit);
      const marque = p ? `${fournisseur}:${p.id}` : '';
      if (!p || l.prix || demandes.current.get(l.cle) === marque) continue;
      demandes.current.set(l.cle, marque);
      fetch(`/api/proxy/purchasing/suppliers/price-comparison?productId=${p.id}`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [])
        .then((offres: { supplier_id: string; price: string }[]) => {
          const offre = offres.find((o) => o.supplier_id === fournisseur);
          setLignes((ls) => ls.map((x) => {
            if (x.cle !== l.cle || x.prix) return x;
            if (offre) return { ...x, prix: enChamp(offre.price), origine: 'catalogue du fournisseur' };
            if (Number(p.cost_price) > 0) return { ...x, prix: enChamp(p.cost_price), origine: 'prix d’achat habituel' };
            return x;
          }));
        });
    }
  }, [lignes, fournisseur]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = lignes.reduce((s, l) => s + (nombre(l.quantite) || 0) * (nombre(l.prix) || 0), 0);

  async function soumettre(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const inconnus = lignes.filter((l) => !trouver(l.produit)).map((l) => l.produit || '(vide)');
    if (inconnus.length) {
      setMessage(`Produit absent du catalogue : ${inconnus.join(', ')}. Ajoutez-le d’abord dans Catalogue.`);
      return;
    }
    setEnvoi(true);
    try {
      const response = await fetch('/api/proxy/purchasing/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: fournisseur,
          ...(attendue ? { expectedDate: attendue } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          lines: lignes.map((l) => ({
            productId: (trouver(l.produit) as ProduitCommande).id,
            quantity: nombre(l.quantite),
            unitCost: nombre(l.prix) || 0,
          })),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage((Array.isArray(body.message) ? body.message.join(' ') : body.message) ?? 'Commande refusée.');
        return;
      }
      router.push(`/pharmacie/achats/${body.order?.id ?? body.id}`);
    } catch {
      setMessage('Service injoignable. Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre}>
      {message && <div className="banner danger">{message}</div>}
      <datalist id="catalogue-commande">
        {produits.map((p) => <option key={p.id} value={p.name}>{p.sku}</option>)}
      </datalist>
      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="cmd-fournisseur">Fournisseur</label>
          <select id="cmd-fournisseur" value={fournisseur} required
            onChange={(e) => { setFournisseur(e.target.value); setLignes((ls) => ls.map((l) => ({ ...l, prix: '', origine: null }))); demandes.current.clear(); }}>
            <option value="">Choisir…</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cmd-attendue">Livraison attendue (facultatif)</label>
          <input id="cmd-attendue" type="date" value={attendue} onChange={(e) => setAttendue(e.target.value)}
            min={new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="field">
          <label htmlFor="cmd-notes">Remarques</label>
          <input id="cmd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="lignes-achat">
        {lignes.map((l, i) => (
          <fieldset key={l.cle} className="ligne-achat">
            <legend>Produit {i + 1}</legend>
            <div className="field ligne-achat-nom">
              <label htmlFor={`cmd-produit-${l.cle}`}>Produit</label>
              <input id={`cmd-produit-${l.cle}`} list="catalogue-commande" value={l.produit} required autoComplete="off"
                onChange={(e) => modifier(l.cle, { produit: e.target.value, prix: '', origine: null })} placeholder="Nom ou référence" />
            </div>
            <div className="field">
              <label htmlFor={`cmd-quantite-${l.cle}`}>Quantité</label>
              <input id={`cmd-quantite-${l.cle}`} inputMode="decimal" value={l.quantite} required pattern="[0-9]+([.,][0-9]+)?"
                onChange={(e) => modifier(l.cle, { quantite: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`cmd-prix-${l.cle}`}>Prix unitaire</label>
              <input id={`cmd-prix-${l.cle}`} inputMode="decimal" value={l.prix} pattern="[0-9]+([.,][0-9]+)?"
                onChange={(e) => modifier(l.cle, { prix: e.target.value, origine: null })} />
              {l.origine && <span className="small muted">{l.origine}</span>}
            </div>
            {lignes.length > 1 && (
              <div className="field">
                <label aria-hidden="true">&nbsp;</label>
                <button type="button" className="secondaire petit" onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))}>Retirer</button>
              </div>
            )}
          </fieldset>
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: '0.75rem' }}>
        <button type="button" className="secondaire"
          onClick={() => setLignes((ls) => [...ls, { cle: cle(), produit: '', quantite: '', prix: '', origine: null }])}>
          Ajouter un produit
        </button>
        <span className="small muted">Total : <strong className="mono">{total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
        <button type="submit" disabled={envoi || !fournisseur}>{envoi ? 'Enregistrement…' : 'Créer la commande'}</button>
      </div>
    </form>
  );
}
