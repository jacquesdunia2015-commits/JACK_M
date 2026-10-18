import Link from 'next/link';
import FormulaireCommande, { ProduitCommande } from '@/components/FormulaireCommande';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date, money, quantity } from '@/lib/format';
import AccesReserve from '@/components/AccesReserve';
import { droits } from '@/lib/droits';
import { traduire } from '@/lib/i18n';
import { statutCommande } from '@/lib/achats';
import Depliable from '@/components/Depliable';

interface Commande {
  id: string; number: string; status: string; currency: string;
  order_date: string; expected_date: string | null; total: string;
  supplier_name: string; lines: string; received_percent: string | null;
}

interface Suggestion {
  id: string; supplier_id: string | null;
  sku: string; name: string; unit: string; on_hand: string;
  daily_average: string; days_of_cover: string | null;
  suggested_quantity: string; supplier_name: string | null;
}

export default async function PageAchats({
  searchParams,
}: {
  searchParams: Promise<{ commande?: string }>;
}) {
  const { peut } = await droits();
  if (!peut('purchasing.read')) return <AccesReserve titre={(await traduire()).t('nav.achats')} />;
  const { commande } = await searchParams;
  const [commandes, suggestions, fournisseurs, catalogue] = await Promise.all([
    apiSafe<Commande[]>('/purchasing/orders', []),
    apiSafe<Suggestion[]>('/purchasing/replenishment', []),
    apiSafe<{ id: string; name: string; is_active: boolean }[]>('/purchasing/suppliers', []),
    apiSafe<{ data: ProduitCommande[] }>('/catalog/products?pageSize=200', { data: [] }),
  ]);
  // « Commander chez ce fournisseur » depuis les suggestions : la commande
  // s'ouvre avec ses produits et les quantités suggérées.
  const lignesSuggerees = commande
    ? suggestions.filter((s) => s.supplier_id === commande).map((s) => ({ productId: s.id, quantite: Number(s.suggested_quantity) }))
    : [];
  const parFournisseur = new Map<string, { nom: string; n: number }>();
  for (const s of suggestions) {
    if (!s.supplier_id || !s.supplier_name) continue;
    const g = parFournisseur.get(s.supplier_id) ?? { nom: s.supplier_name, n: 0 };
    g.n += 1;
    parFournisseur.set(s.supplier_id, g);
  }

  return (
    <>
      <div className="page-head">
        <h1>Achats</h1>
        <p>Commandes fournisseurs et propositions de réapprovisionnement.</p>
      </div>

      {peut('purchasing.write') && (
        <section className="card" id="nouvelle">
          <Depliable key={commande ?? "aucune"} ouvert={Boolean(commande)} resume={<>Nouvelle commande fournisseur</>}>
            <FormulaireCommande
              key={commande ?? 'vide'}
              fournisseurs={fournisseurs.filter((f) => f.is_active)}
              produits={catalogue.data}
              fournisseurInitial={commande}
              lignesInitiales={lignesSuggerees}
            />
          </Depliable>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>À réapprovisionner</h2>
          <span className="hint">
            Seuils, consommation des 30 derniers jours et délai fournisseur
          </span>
        </div>
        {peut('purchasing.write') && parFournisseur.size > 0 && (
          <div className="row" style={{ marginBottom: '0.75rem' }}>
            {[...parFournisseur.entries()].map(([id, g]) => (
              <Link key={id} className="btn secondaire petit" href={`/pharmacie/achats?commande=${id}#nouvelle`}>
                Commander chez {g.nom} ({g.n})
              </Link>
            ))}
          </div>
        )}
        {suggestions.length === 0 ? (
          <Vide message="Aucun produit ne nécessite de réapprovisionnement." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th className="num">En stock</th>
                  <th className="num">Vente / jour</th>
                  <th className="num">Couverture</th>
                  <th className="num">Quantité suggérée</th>
                  <th>Fournisseur</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.slice(0, 25).map((s) => {
                  const couverture = s.days_of_cover ? Number(s.days_of_cover) : null;
                  return (
                    <tr key={s.sku}>
                      <td>
                        {s.name}
                        <br />
                        <span className="small muted mono">{s.sku}</span>
                      </td>
                      <td className="num">{quantity(s.on_hand)}</td>
                      <td className="num">{Number(s.daily_average).toFixed(1)}</td>
                      <td className="num">
                        {couverture === null ? (
                          <span className="muted">—</span>
                        ) : (
                          <span className={couverture < 7 ? 'tag danger' : 'tag warn'}>
                            {couverture} j
                          </span>
                        )}
                      </td>
                      <td className="num">
                        <strong>{quantity(s.suggested_quantity)}</strong> {s.unit}
                      </td>
                      <td className="small">{s.supplier_name ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Commandes fournisseurs</h2>
        </div>
        {commandes.length === 0 ? (
          <Vide message="Aucune commande enregistrée." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Fournisseur</th>
                  <th>Statut</th>
                  <th className="num">Date</th>
                  <th className="num">Attendue</th>
                  <th className="num">Lignes</th>
                  <th className="num">Réception</th>
                  <th className="num">Montant</th>
                </tr>
              </thead>
              <tbody>
                {commandes.map((c) => (
                  <tr key={c.id}>
                    <td className="mono"><Link href={`/pharmacie/achats/${c.id}`}>{c.number}</Link></td>
                    <td>{c.supplier_name}</td>
                    <td>
                      <span className={`tag ${statutCommande(c.status).ton}`}>{statutCommande(c.status).libelle}</span>
                    </td>
                    <td className="num">{date(c.order_date)}</td>
                    <td className="num">{date(c.expected_date)}</td>
                    <td className="num">{c.lines}</td>
                    <td className="num">
                      {c.received_percent
                        ? `${Number(c.received_percent).toFixed(0)} %`
                        : '—'}
                    </td>
                    <td className="num">{money(c.total, c.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
