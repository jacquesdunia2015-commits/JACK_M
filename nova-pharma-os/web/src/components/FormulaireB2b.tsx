'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface ProduitB2b {
  id: string;
  name: string;
  sku: string;
  sale_price: string;
  wholesale_price: string;
}

interface Ligne {
  cle: number;
  produit: string;
  quantite: string;
  prix: string;
  remise: string;
}

const cle = () => Date.now() + Math.random();
const nombre = (v: string) => Number(v.replace(',', '.'));
const enChamp = (v: string | number) => String(Number(v)).replace('.', ',');

/**
 * Devis ou commande d'un client professionnel (clinique, ONG, autre
 * pharmacie). Le prix proposé est le prix de gros du produit, ou à défaut
 * son prix de vente ; il reste modifiable, avec une remise par ligne.
 */
export default function FormulaireB2b({
  clients,
  produits,
}: {
  clients: { id: string; name: string; code: string }[];
  produits: ProduitB2b[];
}) {
  const router = useRouter();
  const [type, setType] = useState<'commande' | 'devis'>('commande');
  const [client, setClient] = useState('');
  const [conditions, setConditions] = useState<'cash' | 'credit'>('cash');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lignes, setLignes] = useState<Ligne[]>([{ cle: cle(), produit: '', quantite: '', prix: '', remise: '' }]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const trouver = (nom: string) => {
    const t = nom.trim().toLowerCase();
    return produits.find((p) => p.name.toLowerCase() === t || p.sku.toLowerCase() === t);
  };
  const modifier = (c: number, changements: Partial<Ligne>) =>
    setLignes((ls) => ls.map((l) => (l.cle === c ? { ...l, ...changements } : l)));
  const prixDeGros = (p: ProduitB2b) => (Number(p.wholesale_price) > 0 ? p.wholesale_price : p.sale_price);

  const total = lignes.reduce((s, l) => {
    const brut = (nombre(l.quantite) || 0) * (nombre(l.prix) || 0);
    return s + brut * (1 - (nombre(l.remise) || 0) / 100);
  }, 0);

  async function soumettre(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);
    const inconnus = lignes.filter((l) => !trouver(l.produit)).map((l) => l.produit || '(vide)');
    if (inconnus.length) {
      setErreur(`Produit absent du catalogue : ${inconnus.join(', ')}.`);
      return;
    }
    setEnvoi(true);
    try {
      const corpsLignes = lignes.map((l) => ({
        productId: (trouver(l.produit) as ProduitB2b).id,
        quantity: nombre(l.quantite),
        ...(l.prix.trim() ? { unitPrice: nombre(l.prix) } : {}),
        ...(l.remise.trim() ? { discountPercent: nombre(l.remise) } : {}),
      }));
      const reponse = await fetch(type === 'devis' ? '/api/proxy/b2b/quotes' : '/api/proxy/b2b/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(type === 'devis'
          ? { customerId: client, ...(date ? { validUntil: date } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}), lines: corpsLignes }
          : {
              customerId: client, paymentTerms: conditions, ...(date ? { requestedDate: date } : {}),
              ...(notes.trim() ? { notes: notes.trim() } : {}), lines: corpsLignes,
              clientOperationId: `b2b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            }),
      });
      const body = await reponse.json().catch(() => ({}));
      if (!reponse.ok) {
        setErreur((Array.isArray(body.message) ? body.message.join(' ') : body.message) ?? 'Enregistrement refusé.');
        return;
      }
      const id = type === 'devis' ? body.quote?.id ?? body.id : body.order?.id ?? body.id;
      router.push(type === 'devis' ? `/pharmacie/b2b/devis/${id}` : `/pharmacie/b2b/commandes/${id}`);
    } catch {
      setErreur('Service injoignable. Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre}>
      {erreur && <div className="banner danger">{erreur}</div>}
      <datalist id="catalogue-b2b">
        {produits.map((p) => <option key={p.id} value={p.name}>{p.sku}</option>)}
      </datalist>
      <div className="grid grid-3" style={{ gap: '0 1rem' }}>
        <div className="field">
          <label htmlFor="b2b-type">Document</label>
          <select id="b2b-type" value={type} onChange={(e) => setType(e.target.value as 'commande' | 'devis')}>
            <option value="commande">Commande ferme</option>
            <option value="devis">Devis (proposition de prix)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="b2b-client">Client professionnel</label>
          <select id="b2b-client" value={client} onChange={(e) => setClient(e.target.value)} required>
            <option value="">Choisir…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </select>
        </div>
        {type === 'commande' ? (
          <div className="field">
            <label htmlFor="b2b-conditions">Règlement</label>
            <select id="b2b-conditions" value={conditions} onChange={(e) => setConditions(e.target.value as 'cash' | 'credit')}>
              <option value="cash">Comptant, à la livraison</option>
              <option value="credit">À crédit (délai du client)</option>
            </select>
          </div>
        ) : <div />}
        <div className="field">
          <label htmlFor="b2b-date">{type === 'devis' ? 'Valable jusqu’au' : 'Livraison souhaitée'}</label>
          <input id="b2b-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="b2b-notes">Remarques</label>
          <input id="b2b-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="lignes-achat">
        {lignes.map((l, i) => (
          <fieldset key={l.cle} className="ligne-achat">
            <legend>Produit {i + 1}</legend>
            <div className="field ligne-achat-nom">
              <label htmlFor={`b2b-produit-${l.cle}`}>Produit</label>
              <input id={`b2b-produit-${l.cle}`} list="catalogue-b2b" value={l.produit} required autoComplete="off" placeholder="Nom ou référence"
                onChange={(e) => {
                  const p = trouver(e.target.value);
                  modifier(l.cle, { produit: e.target.value, ...(p && !l.prix ? { prix: enChamp(prixDeGros(p)) } : {}) });
                }} />
            </div>
            <div className="field">
              <label htmlFor={`b2b-quantite-${l.cle}`}>Quantité</label>
              <input id={`b2b-quantite-${l.cle}`} inputMode="decimal" value={l.quantite} required pattern="[0-9]+([.,][0-9]+)?"
                onChange={(e) => modifier(l.cle, { quantite: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`b2b-prix-${l.cle}`}>Prix unitaire</label>
              <input id={`b2b-prix-${l.cle}`} inputMode="decimal" value={l.prix} pattern="[0-9]+([.,][0-9]+)?" placeholder="prix de gros"
                onChange={(e) => modifier(l.cle, { prix: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`b2b-remise-${l.cle}`}>Remise %</label>
              <input id={`b2b-remise-${l.cle}`} inputMode="decimal" value={l.remise} pattern="[0-9]+([.,][0-9]+)?" placeholder="0"
                onChange={(e) => modifier(l.cle, { remise: e.target.value })} />
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
        <button type="button" className="secondaire" onClick={() => setLignes((ls) => [...ls, { cle: cle(), produit: '', quantite: '', prix: '', remise: '' }])}>
          Ajouter un produit
        </button>
        <span className="small muted">Total estimé : <strong className="mono">{total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
        <button type="submit" disabled={envoi || !client}>{envoi ? 'Enregistrement…' : type === 'devis' ? 'Établir le devis' : 'Enregistrer la commande'}</button>
      </div>
    </form>
  );
}
