'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Peremption from '@/components/Peremption';
import { dateCourte, NiveauPeremption } from '@/lib/peremption';
import { DEVISES } from '@/lib/pays';

export interface ArticleFournisseur {
  id: string;
  product_id: string | null;
  sku: string | null;
  name: string;
  presentation: string | null;
  price: string;
  currency: string | null;
  min_order_quantity: string;
  is_available: boolean;
  price_updated_at: string;
  manufacture_date: string | null;
  expiry_date: string | null;
  expiry_level: NiveauPeremption | null;
  days_to_expiry: number | null;
}

export interface ProduitCatalogue {
  id: string;
  name: string;
  sku: string;
}

const prix = (valeur: string | number, devise: string | null) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: devise ?? 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(valeur));

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Catalogue d'un fournisseur : ce qu'il propose, à quel prix, avec les
 * dates de fabrication et d'expiration du lot annoncé, et si c'est
 * disponible. Un article se choisit dans le catalogue de la pharmacie ou
 * se saisit librement, pour un produit qu'elle ne vend pas encore.
 */
export default function CatalogueFournisseur({
  fournisseurId,
  articles,
  produits,
  devise,
}: {
  fournisseurId: string;
  articles: ArticleFournisseur[];
  produits: ProduitCatalogue[];
  devise: string;
}) {
  const router = useRouter();
  const vide = {
    nom: '', presentation: '', prix: '', devise, minimum: '1', fabrication: '', expiration: '',
  };
  const [champs, setChamps] = useState(vide);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [edition, setEdition] = useState<{
    id: string; prix: string; fabrication: string; expiration: string;
  } | null>(null);

  const changer =
    (cle: keyof typeof champs) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setChamps((c) => ({ ...c, [cle]: e.target.value }));

  async function appeler(chemin: string, methode: string, corps?: unknown) {
    setMessage(null);
    const response = await fetch(`/api/proxy/purchasing/suppliers/${fournisseurId}${chemin}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json' },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const texte = Array.isArray(body.message) ? body.message.join(' ') : body.message;
      setMessage({ ton: 'danger', texte: texte ?? 'Opération refusée.' });
      return false;
    }
    router.refresh();
    return true;
  }

  async function ajouter(event: React.FormEvent) {
    event.preventDefault();
    setEnvoi(true);
    try {
      // Un nom identique à un produit de la pharmacie s'y rattache : les
      // prix se compareront alors avec ceux des autres dépôts.
      const produit = produits.find(
        (p) => p.name.toLowerCase() === champs.nom.trim().toLowerCase() || p.sku === champs.nom.trim(),
      );
      const ok = await appeler('/products', 'POST', {
        ...(produit ? { productId: produit.id } : { productName: champs.nom.trim() }),
        ...(champs.presentation.trim() ? { presentation: champs.presentation.trim() } : {}),
        price: Number(champs.prix.replace(',', '.')),
        currency: champs.devise,
        minOrderQuantity: Number(champs.minimum) || 1,
        ...(champs.fabrication ? { manufactureDate: champs.fabrication } : {}),
        ...(champs.expiration ? { expiryDate: champs.expiration } : {}),
      });
      if (ok) {
        setChamps(vide);
        setMessage({ ton: 'info', texte: 'Produit ajouté au catalogue du fournisseur.' });
      }
    } catch {
      setMessage({ ton: 'danger', texte: 'Service injoignable. Réessayez dans un instant.' });
    } finally {
      setEnvoi(false);
    }
  }

  async function enregistrer(article: ArticleFournisseur) {
    if (!edition) return;
    // Une date effacée est vidée explicitement ; une date inchangée n'est
    // pas renvoyée.
    const corps: Record<string, unknown> = { price: Number(edition.prix.replace(',', '.')) };
    if (edition.fabrication !== (article.manufacture_date ?? '')) {
      if (edition.fabrication) corps.manufactureDate = edition.fabrication;
      else corps.clearManufactureDate = true;
    }
    if (edition.expiration !== (article.expiry_date ?? '')) {
      if (edition.expiration) corps.expiryDate = edition.expiration;
      else corps.clearExpiryDate = true;
    }
    const ok = await appeler(`/products/${article.id}`, 'PATCH', corps);
    if (ok) setEdition(null);
  }

  return (
    <>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}

      <form onSubmit={ajouter} className="catalogue-ajout">
        <div className="field catalogue-ajout-nom">
          <label htmlFor="a-nom">Produit ou médicament</label>
          <input id="a-nom" list="produits-pharmacie" value={champs.nom} onChange={changer('nom')}
            required minLength={2} placeholder="Ex. : Amoxicilline 500 mg" autoComplete="off" />
          <datalist id="produits-pharmacie">
            {produits.map((p) => (
              <option key={p.id} value={p.name}>{p.sku}</option>
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="a-presentation">Présentation</label>
          <input id="a-presentation" value={champs.presentation} onChange={changer('presentation')}
            placeholder="Ex. : boîte de 100" />
        </div>
        <div className="field">
          <label htmlFor="a-prix">Prix</label>
          <input id="a-prix" inputMode="decimal" value={champs.prix} onChange={changer('prix')}
            required pattern="[0-9]+([.,][0-9]+)?" placeholder="4,50" />
        </div>
        <div className="field">
          <label htmlFor="a-devise">Devise</label>
          <select id="a-devise" value={champs.devise} onChange={changer('devise')}>
            {DEVISES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="a-minimum">Quantité min.</label>
          <input id="a-minimum" type="number" min={1} value={champs.minimum} onChange={changer('minimum')} />
        </div>
        <div className="field">
          <label htmlFor="a-fabrication">Date de fabrication</label>
          <input id="a-fabrication" type="date" max={aujourdhui()} value={champs.fabrication}
            onChange={changer('fabrication')} />
        </div>
        <div className="field">
          <label htmlFor="a-expiration">Date d&apos;expiration</label>
          <input id="a-expiration" type="date" min={champs.fabrication || undefined}
            value={champs.expiration} onChange={changer('expiration')} />
        </div>
        <div className="field">
          <label aria-hidden="true">&nbsp;</label>
          <button type="submit" disabled={envoi}>{envoi ? 'Ajout…' : 'Ajouter'}</button>
        </div>
      </form>

      {articles.length === 0 ? (
        <p className="muted small">
          Aucun produit noté pour ce fournisseur. Ajoutez ce qu&apos;il propose, ses prix et
          ses dates : vous pourrez ensuite comparer les dépôts.
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th className="num">Prix</th>
                <th className="num">Fabrication</th>
                <th className="num">Expiration</th>
                <th>Disponibilité</th>
                <th className="num">Prix du</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {articles.map((a) =>
                edition?.id === a.id ? (
                  <tr key={a.id}>
                    <td>
                      {a.name}
                      {a.presentation && <><br /><span className="small muted">{a.presentation}</span></>}
                    </td>
                    <td className="num">
                      <input aria-label={`Prix de ${a.name}`} inputMode="decimal" value={edition.prix}
                        onChange={(e) => setEdition({ ...edition, prix: e.target.value })}
                        style={{ width: '6rem' }} autoFocus />
                    </td>
                    <td className="num">
                      <input aria-label={`Date de fabrication de ${a.name}`} type="date" max={aujourdhui()}
                        value={edition.fabrication}
                        onChange={(e) => setEdition({ ...edition, fabrication: e.target.value })} />
                    </td>
                    <td className="num">
                      <input aria-label={`Date d'expiration de ${a.name}`} type="date"
                        min={edition.fabrication || undefined} value={edition.expiration}
                        onChange={(e) => setEdition({ ...edition, expiration: e.target.value })} />
                    </td>
                    <td colSpan={2} />
                    <td>
                      <div className="row" style={{ gap: '0.3rem', flexWrap: 'nowrap' }}>
                        <button className="petit" onClick={() => enregistrer(a)}>Enregistrer</button>
                        <button className="secondaire petit" onClick={() => setEdition(null)}>Annuler</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={a.id}>
                    <td>
                      {a.name}
                      {a.presentation && <><br /><span className="small muted">{a.presentation}</span></>}
                      {a.sku && <><br /><span className="small muted mono">{a.sku}</span></>}
                    </td>
                    <td className="num">
                      <strong>{prix(a.price, a.currency)}</strong>
                      {Number(a.min_order_quantity) > 1 && (
                        <><br /><span className="small muted">min. {Number(a.min_order_quantity)}</span></>
                      )}
                    </td>
                    <td className="num small">{dateCourte(a.manufacture_date)}</td>
                    <td className="num small">
                      <Peremption date={a.expiry_date} niveau={a.expiry_level} jours={a.days_to_expiry} />
                    </td>
                    <td>
                      <button
                        className="secondaire petit"
                        title="Changer la disponibilité"
                        onClick={() => appeler(`/products/${a.id}`, 'PATCH', { isAvailable: !a.is_available })}
                      >
                        <span className={`tag ${a.is_available ? 'ok' : 'danger'}`}>
                          {a.is_available ? 'Disponible' : 'En rupture'}
                        </span>
                      </button>
                    </td>
                    <td className="num small">
                      {new Date(a.price_updated_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td>
                      <div className="row" style={{ gap: '0.3rem', flexWrap: 'nowrap' }}>
                        <button
                          className="secondaire petit"
                          onClick={() => setEdition({
                            id: a.id,
                            prix: String(Number(a.price)),
                            fabrication: a.manufacture_date ?? '',
                            expiration: a.expiry_date ?? '',
                          })}
                        >
                          Modifier
                        </button>
                        <button
                          className="secondaire petit"
                          onClick={() => {
                            if (window.confirm(`Retirer « ${a.name} » du catalogue de ce fournisseur ?`)) {
                              appeler(`/products/${a.id}`, 'DELETE');
                            }
                          }}
                        >
                          Retirer
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
