import Etiquette from '@/components/Etiquette';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date, money, quantity } from '@/lib/format';

interface LigneStock {
  product_id: string; sku: string; name: string; unit: string;
  reorder_point: string; on_hand: string; available: string;
  stock_value: string; lots: string; nearest_expiry: string | null;
  expired_quantity: string;
}

interface Alerte {
  id: string; kind: string; severity: string; message: string;
  sku: string; product_name: string; lot_number: string | null;
  expiry_date: string | null; created_at: string;
}

export default async function PageStock({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const requete = q ? `?search=${encodeURIComponent(q)}` : '';

  const [stock, alertes] = await Promise.all([
    apiSafe<LigneStock[]>(`/inventory/stock${requete}`, []),
    apiSafe<Alerte[]>('/inventory/alerts', []),
  ]);

  const valeurTotale = stock.reduce((s, l) => s + Number(l.stock_value), 0);

  return (
    <>
      <div className="page-head">
        <h1>Stock et lots</h1>
        <p>
          Positions par produit, valorisation et surveillance des péremptions.
          Les sorties suivent la règle FEFO.
        </p>
      </div>

      {alertes.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Alertes ouvertes</h2>
            <span className="hint">{alertes.length} à traiter</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nature</th>
                  <th>Produit</th>
                  <th>Lot</th>
                  <th>Message</th>
                  <th className="num">Échéance</th>
                </tr>
              </thead>
              <tbody>
                {alertes.slice(0, 20).map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Etiquette statut={a.kind} />
                    </td>
                    <td>
                      {a.product_name}
                      <br />
                      <span className="small muted mono">{a.sku}</span>
                    </td>
                    <td className="mono small">{a.lot_number ?? '—'}</td>
                    <td className="small">{a.message}</td>
                    <td className="num small">{date(a.expiry_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Positions de stock</h2>
          <span className="hint">Valeur totale : {money(valeurTotale)}</span>
        </div>

        <form style={{ marginBottom: '1rem', maxWidth: 360 }}>
          <input name="q" defaultValue={q ?? ''} placeholder="Rechercher un produit…" />
        </form>

        {stock.length === 0 ? (
          <Vide message="Aucune position de stock." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th className="num">En stock</th>
                  <th className="num">Disponible</th>
                  <th className="num">Seuil</th>
                  <th className="num">Lots</th>
                  <th className="num">Péremption la plus proche</th>
                  <th className="num">Valeur</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((l) => {
                  const enStock = Number(l.on_hand);
                  const seuil = Number(l.reorder_point);
                  const sousSeuil = seuil > 0 && enStock <= seuil;
                  return (
                    <tr key={l.product_id}>
                      <td>
                        {l.name}
                        <br />
                        <span className="small muted mono">{l.sku}</span>
                      </td>
                      <td className="num">
                        {enStock <= 0 ? (
                          <span className="tag danger">Rupture</span>
                        ) : (
                          <span className={sousSeuil ? 'tag warn' : ''}>
                            {quantity(l.on_hand)} {l.unit}
                          </span>
                        )}
                      </td>
                      <td className="num">{quantity(l.available)}</td>
                      <td className="num muted">{quantity(l.reorder_point)}</td>
                      <td className="num">{l.lots}</td>
                      <td className="num">{date(l.nearest_expiry)}</td>
                      <td className="num">{money(l.stock_value)}</td>
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
