import Link from 'next/link';
import Stat from '@/components/Stat';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { money, percent } from '@/lib/format';

interface Dashboard {
  portfolio: {
    totalPharmacies: number; active: number; trial: number; suspended: number;
    terminated: number; pastDue: number; pendingPayment: number; newThisMonth: number;
  };
  revenue: {
    currency: string; mrr: number; arr: number; payingSubscriptions: number;
    averageRevenuePerAccount: number;
    byPlan: { planCode: string; planName: string; subscriptions: number; mrr: number }[];
  };
  conversion: { trialsStarted: number; converted: number; rate: number };
  churn: { cancelledLast12Months: number; rate: number };
  receivables: {
    outstanding: number; overdue: number; overdueInvoices: number; collectedThisMonth: number;
  };
  support: { openTickets: number; criticalTickets: number; slaBreached: number; averageSatisfaction: number };
  activity: {
    activeUsers: number; salesProcessed: number; salesValue: number;
    stockValue: number; stockUnits: number; productsManaged: number;
  };
  moduleAdoption: { module: string; entitled: number; using: number; rate: number }[];
  platform: { incidentsLast30Days: number; downtimeMinutes: number; availabilityPercent: number };
}

export default async function TableauDeBordSaaS() {
  const d = await apiSafe<Dashboard | null>('/platform/metrics/dashboard', null);
  if (!d) return <Vide message="Indicateurs indisponibles." />;

  return (
    <>
      <div className="page-head">
        <h1>Tableau de bord de la plateforme</h1>
        <p>Portefeuille de pharmacies, revenu récurrent et santé du service.</p>
      </div>

      {(d.portfolio.pastDue > 0 || d.receivables.overdue > 0) && (
        <div className="banner warn">
          <strong>
            {d.portfolio.pastDue} pharmacie(s) en retard de paiement —{' '}
            {money(d.receivables.overdue, d.revenue.currency)} échus sur{' '}
            {d.receivables.overdueInvoices} facture(s)
          </strong>
          <Link href="/admin/facturation">Ouvrir la facturation</Link>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
        <Stat
          label="Revenu mensuel récurrent"
          valeur={money(d.revenue.mrr, d.revenue.currency)}
          note={`${d.revenue.payingSubscriptions} abonnement(s) payant(s)`}
          ton="ok"
        />
        <Stat
          label="Revenu annuel estimé"
          valeur={money(d.revenue.arr, d.revenue.currency)}
          note={`Revenu moyen par compte : ${money(d.revenue.averageRevenuePerAccount, d.revenue.currency)}`}
        />
        <Stat
          label="Pharmacies inscrites"
          valeur={d.portfolio.totalPharmacies}
          note={`${d.portfolio.active} actives · ${d.portfolio.trial} en essai · ${d.portfolio.newThisMonth} ce mois`}
        />
        <Stat
          label="Impayés"
          valeur={money(d.receivables.outstanding, d.revenue.currency)}
          note={`Encaissé ce mois : ${money(d.receivables.collectedThisMonth, d.revenue.currency)}`}
          ton={d.receivables.outstanding > 0 ? 'warn' : undefined}
        />
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
        <Stat
          label="Conversion essai → abonnement"
          valeur={percent(d.conversion.rate)}
          note={`${d.conversion.converted} converties sur ${d.conversion.trialsStarted} essais`}
        />
        <Stat
          label="Taux de résiliation"
          valeur={percent(d.churn.rate)}
          note={`${d.churn.cancelledLast12Months} résiliation(s) sur 12 mois`}
          ton={d.churn.rate > 10 ? 'danger' : undefined}
        />
        <Stat
          label="Pharmacies suspendues"
          valeur={d.portfolio.suspended}
          note="Données conservées, accès en lecture seule"
          ton={d.portfolio.suspended > 0 ? 'danger' : undefined}
        />
        <Stat
          label="Disponibilité (30 j)"
          valeur={percent(d.platform.availabilityPercent)}
          note={`${d.platform.incidentsLast30Days} incident(s)`}
        />
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Revenu par forfait</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Forfait</th>
                  <th className="num">Abonnements</th>
                  <th className="num">Revenu mensuel</th>
                  <th className="num">Part</th>
                </tr>
              </thead>
              <tbody>
                {d.revenue.byPlan.map((p) => (
                  <tr key={p.planCode}>
                    <td>{p.planName}</td>
                    <td className="num">{p.subscriptions}</td>
                    <td className="num">{money(p.mrr, d.revenue.currency)}</td>
                    <td className="num">
                      {d.revenue.mrr > 0 ? percent((p.mrr / d.revenue.mrr) * 100) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Activité agrégée</h2>
            <span className="hint">
              Compteurs consolidés, sans accès aux données des pharmacies
            </span>
          </div>
          <div className="grid grid-2">
            <Stat label="Utilisateurs actifs" valeur={d.activity.activeUsers} />
            <Stat label="Ventes traitées" valeur={d.activity.salesProcessed} />
            <Stat
              label="Volume de ventes"
              valeur={money(d.activity.salesValue, d.revenue.currency)}
            />
            <Stat
              label="Stock géré"
              valeur={money(d.activity.stockValue, d.revenue.currency)}
              note={`${d.activity.productsManaged} références`}
            />
          </div>
        </section>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Adoption par module</h2>
            <span className="hint">Part des pharmacies éligibles qui l&apos;utilisent</span>
          </div>
          {d.moduleAdoption.filter((m) => m.entitled > 0).length === 0 ? (
            <Vide message="Pas encore de données d'usage." />
          ) : (
            <table>
              <tbody>
                {d.moduleAdoption
                  .filter((m) => m.entitled > 0)
                  .slice(0, 12)
                  .map((m) => (
                    <tr key={m.module}>
                      <td style={{ width: '35%' }}>{m.module}</td>
                      <td>
                        <div className="bar">
                          <span style={{ width: `${m.rate}%` }} />
                        </div>
                      </td>
                      <td className="num small" style={{ width: '22%' }}>
                        {m.using}/{m.entitled} · {percent(m.rate)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Support</h2>
          </div>
          <div className="grid grid-2">
            <Stat label="Tickets ouverts" valeur={d.support.openTickets} />
            <Stat
              label="Critiques"
              valeur={d.support.criticalTickets}
              ton={d.support.criticalTickets > 0 ? 'danger' : undefined}
            />
            <Stat
              label="SLA dépassés"
              valeur={d.support.slaBreached}
              ton={d.support.slaBreached > 0 ? 'warn' : undefined}
            />
            <Stat
              label="Satisfaction"
              valeur={d.support.averageSatisfaction || '—'}
              note="Note moyenne sur 5"
            />
          </div>
        </section>
      </div>
    </>
  );
}
