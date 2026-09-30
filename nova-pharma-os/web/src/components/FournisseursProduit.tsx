'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Peremption from '@/components/Peremption';
import { dateCourte, NiveauPeremption } from '@/lib/peremption';
import { DEVISES } from '@/lib/pays';

export interface OffreProduit {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_city: string | null;
  supplier_phone: string | null;
  presentation: string | null;
  price: string;
  currency: string | null;
  min_order_quantity: string;
  is_available: boolean;
  is_cheapest: boolean;
  is_expired: boolean;
  manufacture_date: string | null;
  expiry_date: string | null;
  expiry_level: NiveauPeremption | null;
  days_to_expiry: number | null;
  price_updated_at: string;
}

const montant = (valeur: string, devise: string | null) =>
  `${Number(valeur).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}${devise ? ` ${devise}` : ''}`;

/**
 * Les fournisseurs d'un produit, leurs prix comparés, et l'ajout d'un
 * nouveau fournisseur pour ce produit. Le moins cher parmi les offres
 * disponibles et non périmées est surligné.
 */
export default function FournisseursProduit({
  produitId,
  offres,
  fournisseurs,
}: {
  produitId: string;
  offres: OffreProduit[];
  fournisseurs: { id: string; name: string; currency: string | null }[];
}) {
  const router = useRouter();
  const vide = { fournisseur: '', prix: '', devise: '', minimum: '1', fabrication: '', expiration: '' };
  const [champs, setChamps] = useState(vide);
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const changer = (cle: keyof typeof champs) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setChamps((c) => ({ ...c, [cle]: e.target.value }));

  async function ajouter(event: React.FormEvent) {
    event.preventDefault();
    setEnvoi(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/proxy/purchasing/suppliers/${champs.fournisseur}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: produitId,
          price: Number(champs.prix.replace(',', '.')),
          ...(champs.devise ? { currency: champs.devise } : {}),
          minOrderQuantity: Number(champs.minimum) || 1,
          ...(champs.fabrication ? { manufactureDate: champs.fabrication } : {}),
          ...(champs.expiration ? { expiryDate: champs.expiration } : {}),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const texte = Array.isArray(body.message) ? body.message.join(' ') : body.message;
        setMessage({ ton: 'danger', texte: texte ?? 'Ajout refusé.' });
        return;
      }
      setMessage({ ton: 'info', texte: 'Fournisseur enregistré pour ce produit.' });
      setChamps(vide);
      router.refresh();
    } catch {
      setMessage({ ton: 'danger', texte: 'Service injoignable. Réessayez dans un instant.' });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      {offres.length === 0 ? (
        <p className="muted small">Aucun fournisseur enregistré pour ce produit. Ajoutez-en un ci-dessous.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fournisseur</th>
                <th className="num">Prix</th>
                <th className="num">Minimum</th>
                <th className="num">Fabrication</th>
                <th className="num">Expiration</th>
                <th>Disponibilité</th>
                <th className="num">Prix du</th>
              </tr>
            </thead>
            <tbody>
              {offres.map((o) => (
                <tr key={o.id} className={o.is_cheapest ? 'offre-meilleure' : ''}>
                  <td>
                    <Link href={`/pharmacie/fournisseurs/${o.supplier_id}`}><strong>{o.supplier_name}</strong></Link>
                    <br />
                    <span className="small muted">{[o.supplier_city, o.supplier_phone, o.presentation].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td className="num">
                    <strong>{montant(o.price, o.currency)}</strong>
                    {o.is_cheapest && <><br /><span className="tag ok">Le moins cher</span></>}
                  </td>
                  <td className="num">{Number(o.min_order_quantity)}</td>
                  <td className="num small">{dateCourte(o.manufacture_date)}</td>
                  <td className="num small"><Peremption date={o.expiry_date} niveau={o.expiry_level} jours={o.days_to_expiry} /></td>
                  <td><span className={`tag ${o.is_available ? 'ok' : 'danger'}`}>{o.is_available ? 'Disponible' : 'En rupture'}</span></td>
                  <td className="num small">{new Date(o.price_updated_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={ajouter} style={{ marginTop: '1rem' }}>
        {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
        <div className="catalogue-ajout">
          <div className="field catalogue-ajout-nom">
            <label htmlFor="fp-fournisseur">Ajouter un fournisseur pour ce produit</label>
            <select id="fp-fournisseur" value={champs.fournisseur} onChange={changer('fournisseur')} required>
              <option value="">Choisir…</option>
              {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fp-prix">Son prix</label>
            <input id="fp-prix" inputMode="decimal" value={champs.prix} onChange={changer('prix')} required
              pattern="[0-9]+([.,][0-9]+)?" placeholder="4,50" />
          </div>
          <div className="field">
            <label htmlFor="fp-devise">Devise</label>
            <select id="fp-devise" value={champs.devise} onChange={changer('devise')}>
              <option value="">Celle du fournisseur</option>
              {DEVISES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fp-minimum">Quantité min.</label>
            <input id="fp-minimum" type="number" min={1} value={champs.minimum} onChange={changer('minimum')} />
          </div>
          <div className="field">
            <label htmlFor="fp-fabrication">Fabrication</label>
            <input id="fp-fabrication" type="date" value={champs.fabrication} onChange={changer('fabrication')}
              max={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="field">
            <label htmlFor="fp-expiration">Expiration</label>
            <input id="fp-expiration" type="date" value={champs.expiration} onChange={changer('expiration')}
              min={champs.fabrication || undefined} />
          </div>
          <div className="field">
            <label aria-hidden="true">&nbsp;</label>
            <button type="submit" disabled={envoi}>{envoi ? 'Ajout…' : 'Enregistrer'}</button>
          </div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Un fournisseur déjà listé voit son prix mis à jour. Absent de la liste ?{' '}
          <Link href="/pharmacie/fournisseurs">Enregistrez-le d&apos;abord</Link>.
        </p>
      </form>
    </>
  );
}
