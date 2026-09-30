import Link from 'next/link';
import { notFound } from 'next/navigation';
import FournisseursProduit, { OffreProduit } from '@/components/FournisseursProduit';
import Stat from '@/components/Stat';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { dateTime, quantity } from '@/lib/format';
import { dateCourte } from '@/lib/peremption';

interface Mouvement {
  id: string; kind: string; quantity: string; unit_cost: string; balance_after: string;
  reference_kind: string | null; reason: string | null; occurred_at: string;
  lot_number: string | null; expiry_date: string | null; user_name: string | null;
  supplier_id: string | null; supplier_name: string | null;
}

interface Fiche {
  id: string; sku: string; name: string; unit: string; sale_price: string; cost_price: string;
  totals: {
    purchased: string; sold: string; other: string;
    purchased_30_days: string; sold_30_days: string; on_hand: string;
  };
  movements: Mouvement[];
}

const LIBELLES: Record<string, string> = {
  reception: 'Achat',
  sale: 'Vente',
  sale_return: 'Retour client',
  purchase_return: 'Retour au fournisseur',
  adjustment_in: 'Correction (+)',
  adjustment_out: 'Correction (−)',
  transfer_in: 'Transfert reçu',
  transfer_out: 'Transfert envoyé',
  inventory: 'Écart d’inventaire',
  expiry_write_off: 'Périmé retiré',
  damage: 'Casse',
};

/**
 * Fiche de stock d'un produit : tout ce qui est entré et sorti. Le stock
 * affiché est la somme exacte de ces mouvements, ce qui permet de
 * l'expliquer ligne par ligne.
 */
export default async function PageFicheStock({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [fiche, offres, fournisseurs] = await Promise.all([
    apiSafe<Fiche | null>(`/inventory/products/${id}/history`, null),
    apiSafe<OffreProduit[]>(`/purchasing/suppliers/price-comparison?productId=${id}`, []),
    apiSafe<{ id: string; name: string; currency: string | null; is_active: boolean }[]>('/purchasing/suppliers', []),
  ]);
  if (!fiche) notFound();
  const t = fiche.totals;
  const chiffre = (valeur: string) => quantity(valeur);

  return (
    <>
      <div className="page-head">
        <p className="small"><Link href="/pharmacie/stock">← Stock et lots</Link></p>
        <h1>{fiche.name}</h1>
        <p className="mono small">{fiche.sku}</p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
        <Stat label="En stock" valeur={chiffre(t.on_hand)} note={fiche.unit === 'unit' ? 'unité(s)' : fiche.unit} />
        <Stat label="Acheté" valeur={`+${chiffre(t.purchased)}`} note={`dont ${chiffre(t.purchased_30_days)} ces 30 jours`} ton="ok" />
        <Stat label="Vendu" valeur={chiffre(t.sold)} note={`dont ${chiffre(t.sold_30_days)} ces 30 jours`} />
        <Stat
          label="Autres mouvements"
          valeur={`${Number(t.other) > 0 ? '+' : ''}${chiffre(t.other)}`}
          note="corrections, casse, périmés, inventaire"
        />
      </div>

      <div className="row" style={{ marginBottom: '1.25rem' }}>
        <Link className="btn" href={`/pharmacie/stock?achat=${fiche.id}#achat`}>Enregistrer un achat</Link>
        <Link className="btn secondaire" href="/pharmacie/caisse">Vendre à la caisse</Link>
        <Link className="btn secondaire" href={`/pharmacie/requisitions?produit=${fiche.id}#nouvelle`}>Réquisitionner</Link>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Fournisseurs de ce produit</h2>
          <span className="hint">Prix comparés : le moins cher disponible et non périmé est surligné</span>
        </div>
        <FournisseursProduit
          produitId={fiche.id}
          offres={offres}
          fournisseurs={fournisseurs.filter((f) => f.is_active)}
        />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Mouvements</h2>
          <span className="hint">Du plus récent au plus ancien</span>
        </div>
        {fiche.movements.length === 0 ? (
          <Vide message="Aucun mouvement : enregistrez un premier achat pour créer le stock." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mouvement</th>
                  <th className="num">Quantité</th>
                  <th className="num">Stock après</th>
                  <th>Fournisseur</th>
                  <th>Lot</th>
                  <th className="num">Péremption</th>
                  <th>Par</th>
                </tr>
              </thead>
              <tbody>
                {fiche.movements.map((m) => {
                  const q = Number(m.quantity);
                  return (
                    <tr key={m.id}>
                      <td className="small">{dateTime(m.occurred_at)}</td>
                      <td>
                        <span className={`tag ${q > 0 ? 'ok' : 'warn'}`}>{LIBELLES[m.kind] ?? m.kind}</span>
                        {m.reason && <><br /><span className="small muted">{m.reason}</span></>}
                      </td>
                      <td className="num"><strong>{q > 0 ? '+' : ''}{quantity(m.quantity)}</strong></td>
                      <td className="num">{quantity(m.balance_after)}</td>
                      <td className="small">
                        {m.supplier_id
                          ? <Link href={`/pharmacie/fournisseurs/${m.supplier_id}`}>{m.supplier_name}</Link>
                          : '—'}
                      </td>
                      <td className="mono small">{m.lot_number ?? '—'}</td>
                      <td className="num small">{dateCourte(m.expiry_date)}</td>
                      <td className="small">{m.user_name ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
