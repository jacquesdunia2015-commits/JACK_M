import Link from 'next/link';
import Stat from '@/components/Stat';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date, money, percent, quantity } from '@/lib/format';
import { readSession } from '@/lib/session';

interface Dashboard {
  today: { sales: number; revenue: number; margin: number; averageBasket: number; creditSales: number };
  month: { sales: number; revenue: number; margin: number; marginPercent: number };
  stock: { units: number; value: number; productsInStock: number; expiredUnits: number; valueExpiring90Days: number };
  alerts: { outOfStock: number; lowStock: number; expiring: number; expired: number };
  receivables: { total: number; customers: number };
  cashSession: { registerCode: string; expectedCash: number; openedAt: string } | null;
  topProducts: { sku: string; name: string; quantity: number; revenue: number; margin: number }[];
  expiringSoon: {
    sku: string; name: string; lot_number: string; expiry_date: string;
    quantity: string; days_left: number; value_at_risk: string;
  }[];
}

export default async function TableauDeBord() {
  const session = await readSession();
  const data = await apiSafe<Dashboard | null>('/reports/dashboard', null);

  if (!data) {
    return (
      <>
        <div className="page-head">
          <h1>Tableau de bord</h1>
        </div>
        <Vide message="Les indicateurs seront disponibles dès les premières opérations." />
      </>
    );
  }

  const alertesTotal =
    data.alerts.outOfStock + data.alerts.lowStock + data.alerts.expiring + data.alerts.expired;

  return (
    <>
      <div className="page-head">
        <h1>Tableau de bord</h1>
        <p>Activité du jour et santé du stock.</p>
      </div>

      {session?.readonly && (
        <div className="banner danger">
          <strong>Abonnement suspendu</strong>
          Vos données restent consultables, mais aucune modification n&apos;est possible.
          Réglez la facture en attente pour rétablir vos accès.
        </div>
      )}

      {alertesTotal > 0 && (
        <div className="banner warn">
          <strong>{alertesTotal} point(s) de vigilance sur le stock</strong>
          {data.alerts.outOfStock} rupture(s) · {data.alerts.lowStock} sous le seuil ·{' '}
          {data.alerts.expiring} péremption(s) proche(s) · {data.alerts.expired} lot(s) périmé(s).{' '}
          <Link href="/pharmacie/stock">Voir le détail</Link>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
        <Stat
          label="Ventes du jour"
          valeur={money(data.today.revenue)}
          note={`${data.today.sales} vente(s) · panier moyen ${money(data.today.averageBasket)}`}
        />
        <Stat
          label="Marge du jour"
          valeur={money(data.today.margin)}
          note={`Crédit accordé : ${money(data.today.creditSales)}`}
          ton="ok"
        />
        <Stat
          label="Chiffre d'affaires du mois"
          valeur={money(data.month.revenue)}
          note={`Marge ${percent(data.month.marginPercent)} · ${data.month.sales} ventes`}
        />
        <Stat
          label="Stock valorisé"
          valeur={money(data.stock.value)}
          note={`${quantity(data.stock.units)} unités · ${data.stock.productsInStock} références`}
        />
      </div>

      <div className="grid grid-3" style={{ marginBottom: '1.25rem' }}>
        <Stat
          label="Créances clients"
          valeur={money(data.receivables.total)}
          note={`${data.receivables.customers} client(s) débiteur(s)`}
          ton={data.receivables.total > 0 ? 'warn' : undefined}
        />
        <Stat
          label="Valeur menacée à 90 jours"
          valeur={money(data.stock.valueExpiring90Days)}
          note="Stock arrivant à péremption"
          ton={data.stock.valueExpiring90Days > 0 ? 'warn' : undefined}
        />
        <Stat
          label="Caisse"
          valeur={data.cashSession ? money(data.cashSession.expectedCash) : 'Fermée'}
          note={
            data.cashSession
              ? `${data.cashSession.registerCode} · ouverte le ${date(data.cashSession.openedAt)}`
              : 'Ouvrez la caisse pour encaisser'
          }
        />
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Meilleures ventes</h2>
            <span className="hint">30 derniers jours</span>
          </div>
          {data.topProducts.length === 0 ? (
            <Vide message="Aucune vente sur la période." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th className="num">Quantité</th>
                    <th className="num">Chiffre d&apos;affaires</th>
                    <th className="num">Marge</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((p) => (
                    <tr key={p.sku}>
                      <td>
                        {p.name}
                        <br />
                        <span className="small muted mono">{p.sku}</span>
                      </td>
                      <td className="num">{quantity(p.quantity)}</td>
                      <td className="num">{money(p.revenue)}</td>
                      <td className="num">{money(p.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Péremptions à surveiller</h2>
            <span className="hint">90 prochains jours</span>
          </div>
          {data.expiringSoon.length === 0 ? (
            <Vide message="Aucun lot ne périme dans les 90 jours." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Lot</th>
                    <th className="num">Quantité</th>
                    <th className="num">Échéance</th>
                    <th className="num">Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expiringSoon.map((l) => (
                    <tr key={`${l.sku}-${l.lot_number}`}>
                      <td>{l.name}</td>
                      <td className="mono small">{l.lot_number}</td>
                      <td className="num">{quantity(l.quantity)}</td>
                      <td className="num">
                        {date(l.expiry_date)}
                        <br />
                        <span
                          className={`small ${l.days_left < 30 ? 'tag danger' : 'muted'}`}
                        >
                          {l.days_left} j
                        </span>
                      </td>
                      <td className="num">{money(l.value_at_risk)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
