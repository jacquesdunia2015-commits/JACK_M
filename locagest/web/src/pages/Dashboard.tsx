import { Link } from 'react-router-dom';
import { useFetch } from '../lib/useFetch';
import { LEVELS, LEVEL_ORDER, date, money, month, type Level } from '../lib/format';
import { AlertBadge, Badge, Empty, ErrorBox, Loading, PageHeader, Stat } from '../components/ui';
import { PAYMENT_STATES } from '../lib/format';
import { useAuth } from '../lib/auth';

interface Dash {
  today: string;
  properties: { total: number; vacante: number; occupee: number; maintenance: number };
  occupancyRate: number;
  tenants: number;
  activeLeases: number;
  guaranteeLevels: Record<Level, number>;
  urgent: any[];
  revenue: { month: string; USD: number; CDF: number }[];
  revenueThisMonth: { USD: number; CDF: number };
  expectedMonthly: { USD: number; CDF: number };
  arrears: { USD: number; CDF: number };
  late: any[];
}

const both = (v: { USD: number; CDF: number }) =>
  v.CDF ? `${money(v.USD)} · ${money(v.CDF, 'CDF')}` : money(v.USD);

export function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading } = useFetch<Dash>('/dashboard');
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox error={error} />;

  const critical = data.guaranteeLevels.rouge + data.guaranteeLevels.orange;
  return (
    <>
      <PageHeader
        title={`Bonjour ${user?.fullName.split(' ')[0] ?? ''}`}
        subtitle={`Situation au ${date(data.today)}`}
        actions={
          <>
            <Link to="/proprietes/nouvelle" className="btn-secondary">+ Propriété</Link>
            <Link to="/baux/nouveau" className="btn-primary">+ Nouveau bail</Link>
          </>
        }
      />
      <ErrorBox error={error} />

      {critical > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 alert-pulse-slow">
          <p className="text-sm text-red-900">
            <strong>{critical} garantie(s)</strong> expirée(s) ou à moins de 30 jours de l'expiration : action requise.
          </p>
          <Link to="/baux?level=rouge" className="text-sm font-medium text-red-800 underline">Voir</Link>
        </div>
      )}

      {/* Code couleur des garanties */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {LEVEL_ORDER.map((lvl) => {
          const l = LEVELS[lvl];
          const n = data.guaranteeLevels[lvl];
          return (
            <Link
              key={lvl}
              to={`/baux?level=${lvl}`}
              className={`card block border-l-4 hover:shadow-md ${n && lvl !== 'vert' ? l.pulse : ''}`}
              style={{ borderLeftColor: { vert: '#10b981', jaune: '#facc15', orange: '#f97316', rouge: '#ef4444' }[lvl] }}
            >
              <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <span className={`h-2.5 w-2.5 rounded-full ${l.dot}`} aria-hidden /> {l.label}
              </p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{n}</p>
              <p className="text-xs text-slate-500">{l.range}</p>
            </Link>
          );
        })}
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Taux d'occupation" value={`${data.occupancyRate} %`} sub={`${data.properties.occupee} occupée(s) / ${data.properties.total}`} to="/proprietes" />
        <Stat label="Encaissé ce mois" value={both(data.revenueThisMonth)} sub={`Attendu : ${both(data.expectedMonthly)}`} />
        <Stat label="Arriérés de loyer" value={both(data.arrears)} sub={`${data.late.length} échéance(s) en retard`} className={data.arrears.USD || data.arrears.CDF ? 'border-orange-300' : ''} />
        <Stat label="Locataires" value={data.tenants} sub={`${data.activeLeases} bail(s) actif(s)`} to="/locataires" />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <h2 className="mb-4 font-semibold">Garanties à traiter</h2>
          {data.urgent.length === 0 ? (
            <Empty title="Aucune garantie à surveiller">Toutes les garanties sont à plus de 60 jours de leur expiration.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.urgent.map((l) => (
                <li key={l.id}>
                  <Link to={`/baux/${l.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{l.property_title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {l.first_name} {l.last_name} · expire le {date(l.guarantee_expires_on)} · {LEVELS[l.guarantee.level as Level].action}
                      </p>
                    </div>
                    <AlertBadge level={l.guarantee.level} days={l.guarantee.daysRemaining} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card lg:col-span-2">
          <h2 className="mb-4 font-semibold">Loyers en retard</h2>
          {data.late.length === 0 ? (
            <Empty title="Aucun retard de paiement" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.late.map((p) => (
                <li key={`${p.leaseId}-${p.period}`}>
                  <Link to={`/baux/${p.leaseId}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{p.tenant}</p>
                      <p className="truncate text-xs text-slate-500">
                        {month(p.period)} · reste {money(p.remaining, p.currency)} · {p.daysLate} j
                      </p>
                    </div>
                    <Badge className={PAYMENT_STATES[p.state].cls}>{PAYMENT_STATES[p.state].label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <RevenueChart revenue={data.revenue} />
    </>
  );
}

/** Revenus encaissés par mois (USD) ; les montants en francs sont listés à part (pas de double axe). */
function RevenueChart({ revenue }: { revenue: Dash['revenue'] }) {
  const max = Math.max(...revenue.map((r) => r.USD), 1);
  const total = revenue.reduce((a, r) => a + r.USD, 0);
  const cdf = revenue.filter((r) => r.CDF);
  return (
    <section className="card mt-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Revenus encaissés — 12 derniers mois (USD)</h2>
        <p className="text-sm text-slate-500">Total : <span className="font-medium text-slate-800">{money(total)}</span></p>
      </div>
      <div className="flex h-48 items-end gap-[2px] border-b border-slate-200" role="img" aria-label="Histogramme des revenus mensuels en dollars">
        {revenue.map((r) => (
          <div key={r.month} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-10 rounded-t bg-brand-600 transition group-hover:bg-brand-800"
              style={{ height: `${(r.USD / max) * 100}%`, minHeight: r.USD ? 2 : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
              {month(r.month)} : {money(r.USD)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px]">
        {revenue.map((r) => (
          <span key={r.month} className="flex-1 text-center text-[10px] text-slate-500">
            {new Date(r.month + '-01').toLocaleDateString('fr-FR', { month: 'short' })}
          </span>
        ))}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-slate-500">Voir le tableau</summary>
        <table className="mt-2 w-full">
          <thead><tr><th className="th">Mois</th><th className="th text-right">USD</th><th className="th text-right">FC</th></tr></thead>
          <tbody>
            {revenue.map((r) => (
              <tr key={r.month} className="border-t border-slate-100">
                <td className="td capitalize">{month(r.month)}</td>
                <td className="td text-right">{money(r.USD)}</td>
                <td className="td text-right">{money(r.CDF, 'CDF')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {cdf.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">Encaissements en francs congolais : {cdf.map((r) => `${month(r.month)} ${money(r.CDF, 'CDF')}`).join(' · ')}</p>
      )}
    </section>
  );
}
