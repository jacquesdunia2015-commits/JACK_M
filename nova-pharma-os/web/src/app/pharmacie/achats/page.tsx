import Etiquette from '@/components/Etiquette';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date, money, quantity } from '@/lib/format';

interface Commande {
  id: string; number: string; status: string; currency: string;
  order_date: string; expected_date: string | null; total: string;
  supplier_name: string; lines: string; received_percent: string | null;
}

interface Suggestion {
  sku: string; name: string; unit: string; on_hand: string;
  daily_average: string; days_of_cover: string | null;
  suggested_quantity: string; supplier_name: string | null;
}

export default async function PageAchats() {
  const [commandes, suggestions] = await Promise.all([
    apiSafe<Commande[]>('/purchasing/orders', []),
    apiSafe<Suggestion[]>('/purchasing/replenishment', []),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Achats</h1>
        <p>Commandes fournisseurs et propositions de réapprovisionnement.</p>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>À réapprovisionner</h2>
          <span className="hint">
            Seuils, consommation des 30 derniers jours et délai fournisseur
          </span>
        </div>
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
                    <td className="mono">{c.number}</td>
                    <td>{c.supplier_name}</td>
                    <td>
                      <Etiquette statut={c.status} />
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
