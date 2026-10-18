'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { dateCourte } from '@/lib/peremption';

export interface ProduitRequisition {
  id: string;
  name: string;
  sku: string;
  packaging: string | null;
}

export interface FournisseurRequisition {
  id: string;
  name: string;
}

interface Offre {
  id: string;
  supplier_id: string;
  supplier_name: string;
  price: string;
  currency: string | null;
  min_order_quantity: string;
  is_available: boolean;
  is_expired: boolean;
  is_cheapest: boolean;
  expiry_date: string | null;
  presentation: string | null;
}

interface Ligne {
  cle: number;
  produit: string;
  quantite: string;
  fournisseur: string;
  prix: string;
  offres: Offre[] | null;
}

const nouvelleCle = () => Date.now() + Math.random();
const prixFr = (valeur: string | number) => String(Number(valeur)).replace('.', ',');
const montant = (valeur: number, devise: string | null) =>
  `${valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${devise ? ` ${devise}` : ''}`;

/**
 * Nouvelle réquisition : pour chaque produit, la quantité voulue et le
 * fournisseur choisi. Les offres des fournisseurs s'affichent sous chaque
 * ligne, la moins chère parmi celles disponibles et non périmées en tête :
 * un clic la retient, avec son prix.
 */
export default function FormulaireRequisition({
  produits,
  fournisseurs,
  produitInitial,
}: {
  produits: ProduitRequisition[];
  fournisseurs: FournisseurRequisition[];
  produitInitial?: string;
}) {
  const router = useRouter();
  const initial = produits.find((p) => p.id === produitInitial);
  const ligneVide = (p?: ProduitRequisition): Ligne => ({
    cle: nouvelleCle(), produit: p?.name ?? '', quantite: '', fournisseur: '', prix: '', offres: null,
  });
  const [lignes, setLignes] = useState<Ligne[]>([ligneVide(initial)]);
  const [souhaiteeLe, setSouhaiteeLe] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const demandes = useRef(new Map<number, string>());

  const trouver = (nom: string) =>
    produits.find((p) => p.name.toLowerCase() === nom.trim().toLowerCase() || p.sku.toLowerCase() === nom.trim().toLowerCase());

  const modifier = (cle: number, changements: Partial<Ligne>) =>
    setLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, ...changements } : l)));

  // Les offres d'un produit se chargent dès qu'il est reconnu (ou, pour un
  // nom libre, dès trois lettres), puis la meilleure est proposée d'office.
  useEffect(() => {
    for (const l of lignes) {
      const p = trouver(l.produit);
      const cle = p ? `id:${p.id}` : l.produit.trim().length >= 3 ? `nom:${l.produit.trim().toLowerCase()}` : '';
      if (!cle || demandes.current.get(l.cle) === cle) continue;
      demandes.current.set(l.cle, cle);
      const url = p
        ? `/api/proxy/purchasing/suppliers/price-comparison?productId=${p.id}`
        : `/api/proxy/purchasing/suppliers/price-comparison?search=${encodeURIComponent(l.produit.trim())}`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : []))
        .then((offres: Offre[]) => {
          if (demandes.current.get(l.cle) !== cle) return;
          const utiles = p ? offres : offres.filter((o) => o.supplier_name && o.price !== undefined);
          setLignes((ls) =>
            ls.map((x) => {
              if (x.cle !== l.cle) return x;
              const meilleure = utiles.find((o) => o.is_cheapest);
              return {
                ...x,
                offres: utiles,
                ...(x.fournisseur || !meilleure
                  ? {}
                  : { fournisseur: meilleure.supplier_id, prix: prixFr(meilleure.price) }),
              };
            }),
          );
        })
        .catch(() => undefined);
    }
  }, [lignes]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = lignes.reduce(
    (s, l) => s + (Number(l.quantite.replace(',', '.')) || 0) * (Number(l.prix.replace(',', '.')) || 0),
    0,
  );

  async function soumettre(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setEnvoi(true);
    try {
      const response = await fetch('/api/proxy/purchasing/requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(souhaiteeLe ? { neededBy: souhaiteeLe } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          lines: lignes.map((l) => {
            const p = trouver(l.produit);
            return {
              ...(p ? { productId: p.id } : { productName: l.produit.trim() }),
              quantity: Number(l.quantite.replace(',', '.')),
              ...(l.fournisseur ? { supplierId: l.fournisseur } : {}),
              ...(l.prix.trim() ? { unitPrice: Number(l.prix.replace(',', '.')) } : {}),
            };
          }),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const texte = Array.isArray(body.message) ? body.message.join(' ') : body.message;
        setMessage({ ton: 'danger', texte: texte ?? 'Réquisition refusée.' });
        return;
      }
      router.push(`/pharmacie/requisitions/${body.id}`);
    } catch {
      setMessage({ ton: 'danger', texte: 'Service injoignable. Réessayez dans un instant.' });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre}>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}

      <datalist id="catalogue-requisition">
        {produits.map((p) => <option key={p.id} value={p.name}>{p.sku}</option>)}
      </datalist>

      <div className="lignes-achat">
        {lignes.map((l, i) => {
          const offreChoisie = l.offres?.find((o) => o.supplier_id === l.fournisseur);
          const quantite = Number(l.quantite.replace(',', '.')) || 0;
          const sousMinimum = offreChoisie && quantite > 0 && quantite < Number(offreChoisie.min_order_quantity);
          return (
            <fieldset key={l.cle} className="ligne-achat">
              <legend>Produit {i + 1}</legend>
              <div className="field ligne-achat-nom">
                <label htmlFor={`r-produit-${l.cle}`}>Produit ou médicament</label>
                <input id={`r-produit-${l.cle}`} list="catalogue-requisition" value={l.produit} required minLength={2}
                  autoComplete="off" placeholder="Nom ou référence"
                  onChange={(e) => modifier(l.cle, { produit: e.target.value, offres: null, fournisseur: '', prix: '' })} />
              </div>
              <div className="field">
                <label htmlFor={`r-quantite-${l.cle}`}>Quantité</label>
                <input id={`r-quantite-${l.cle}`} inputMode="decimal" value={l.quantite} required
                  pattern="[0-9]+([.,][0-9]+)?" onChange={(e) => modifier(l.cle, { quantite: e.target.value })} />
              </div>
              <div className="field ligne-achat-nom">
                <label htmlFor={`r-fournisseur-${l.cle}`}>Fournisseur</label>
                <select id={`r-fournisseur-${l.cle}`} value={l.fournisseur}
                  onChange={(e) => {
                    const offre = l.offres?.find((o) => o.supplier_id === e.target.value);
                    modifier(l.cle, { fournisseur: e.target.value, prix: offre ? prixFr(offre.price) : '' });
                  }}>
                  <option value="">À choisir plus tard</option>
                  {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`r-prix-${l.cle}`}>Prix unitaire</label>
                <input id={`r-prix-${l.cle}`} inputMode="decimal" value={l.prix} placeholder="Facultatif"
                  pattern="[0-9]+([.,][0-9]+)?" onChange={(e) => modifier(l.cle, { prix: e.target.value })} />
              </div>
              {lignes.length > 1 && (
                <div className="field">
                  <label aria-hidden="true">&nbsp;</label>
                  <button type="button" className="secondaire petit"
                    onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))}>Retirer</button>
                </div>
              )}

              {l.offres && (
                <div className="offres" style={{ gridColumn: '1 / -1' }}>
                  {l.offres.length === 0 ? (
                    <p className="small muted">
                      Aucun fournisseur n&apos;a encore ce produit à son catalogue : choisissez-en un dans la liste.
                    </p>
                  ) : (
                    <>
                      <p className="small muted" style={{ margin: '0 0 0.35rem' }}>
                        Comparer les prix : cliquez sur une offre pour la retenir.
                      </p>
                      <div className="offres-liste">
                        {l.offres.map((o) => {
                          const utilisable = o.is_available && !o.is_expired;
                          return (
                            <button
                              type="button"
                              key={o.id}
                              className={`offre${o.supplier_id === l.fournisseur ? ' choisie' : ''}${utilisable ? '' : ' indisponible'}`}
                              onClick={() => modifier(l.cle, { fournisseur: o.supplier_id, prix: prixFr(o.price) })}
                            >
                              <strong>{o.supplier_name}</strong>
                              <span className="mono">{montant(Number(o.price), o.currency)}</span>
                              <span className="small">
                                {Number(o.min_order_quantity) > 1 ? `min. ${Number(o.min_order_quantity)} · ` : ''}
                                {o.expiry_date ? `exp. ${dateCourte(o.expiry_date)}` : 'exp. non précisée'}
                              </span>
                              {o.is_cheapest && <span className="tag ok">Le moins cher</span>}
                              {!o.is_available && <span className="tag danger">En rupture</span>}
                              {o.is_expired && <span className="tag danger">Périmé</span>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {sousMinimum && (
                    <p className="small" style={{ color: 'var(--attention)', margin: '0.35rem 0 0' }}>
                      Ce fournisseur vend par {Number(offreChoisie?.min_order_quantity)} au minimum.
                    </p>
                  )}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>

      <div className="grid grid-3" style={{ gap: '0 1rem', marginTop: '0.75rem' }}>
        <div className="field">
          <label htmlFor="r-date">Livraison souhaitée (facultatif)</label>
          <input id="r-date" type="date" value={souhaiteeLe} min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setSouhaiteeLe(e.target.value)} />
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="r-notes">Remarques imprimées sur le document</label>
          <input id="r-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex. : livraison le matin, joindre les certificats d'analyse" />
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="secondaire" onClick={() => setLignes((ls) => [...ls, ligneVide()])}>
          Ajouter un produit
        </button>
        <span className="small muted">
          Total estimé : <strong className="mono">{montant(total, null)}</strong>
        </span>
        <button type="submit" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Créer la réquisition'}</button>
      </div>
    </form>
  );
}
