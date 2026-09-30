'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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

/**
 * Catalogue d'un fournisseur : ce qu'il propose, à quel prix, et si c'est
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
  const vide = { nom: '', presentation: '', prix: '', devise, minimum: '1' };
  const [champs, setChamps] = useState(vide);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [edition, setEdition] = useState<{ id: string; prix: string } | null>(null);

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

  async function enregistrerPrix(article: ArticleFournisseur) {
    if (!edition) return;
    const ok = await appeler(`/products/${article.id}`, 'PATCH', {
      price: Number(edition.prix.replace(',', '.')),
    });
    if (ok) setEdition(null);
  }

  return (
    <>
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}

      <form onSubmit={ajouter} className="catalogue-ajout">
        <div className="field">
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
          <label htmlFor="a-minimum">Quantité minimum</label>
          <input id="a-minimum" type="number" min={1} value={champs.minimum} onChange={changer('minimum')} />
        </div>
        <div className="field">
          <label aria-hidden="true">&nbsp;</label>
          <button type="submit" disabled={envoi}>{envoi ? 'Ajout…' : 'Ajouter'}</button>
        </div>
      </form>

      {articles.length === 0 ? (
        <p className="muted small">
          Aucun produit noté pour ce fournisseur. Ajoutez ce qu&apos;il propose et ses prix :
          vous pourrez ensuite comparer les dépôts.
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Présentation</th>
                <th className="num">Prix</th>
                <th className="num">Minimum</th>
                <th>Disponibilité</th>
                <th className="num">Prix du</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.name}
                    {a.sku && (
                      <>
                        <br />
                        <span className="small muted mono">{a.sku}</span>
                      </>
                    )}
                  </td>
                  <td className="small">{a.presentation ?? '—'}</td>
                  <td className="num">
                    {edition?.id === a.id ? (
                      <span className="row" style={{ justifyContent: 'flex-end', gap: '0.3rem' }}>
                        <input
                          aria-label={`Nouveau prix de ${a.name}`}
                          inputMode="decimal"
                          value={edition.prix}
                          onChange={(e) => setEdition({ id: a.id, prix: e.target.value })}
                          style={{ width: '6rem' }}
                          autoFocus
                        />
                        <button className="petit" onClick={() => enregistrerPrix(a)}>OK</button>
                      </span>
                    ) : (
                      <button
                        className="secondaire petit"
                        title="Modifier le prix"
                        onClick={() => setEdition({ id: a.id, prix: String(Number(a.price)) })}
                      >
                        {prix(a.price, a.currency)}
                      </button>
                    )}
                  </td>
                  <td className="num small">{Number(a.min_order_quantity)}</td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
