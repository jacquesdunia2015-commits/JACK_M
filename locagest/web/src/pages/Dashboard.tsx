import { Link } from 'react-router-dom';
import { useFetch } from '../lib/useFetch';
import { useState } from 'react';
import { LEVELS, LEVEL_ORDER, PAYMENT_STATE_CLS, date, money, moneyAll, month, shortMonth, type Level } from '../lib/format';
import { AlertBadge, Badge, Empty, ErrorBox, Loading, PageHeader, Stat } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useT } from '../i18n';

interface Dash {
  today: string;
  properties: { total: number; vacante: number; occupee: number; maintenance: number };
  occupancyRate: number;
  tenants: number;
  activeLeases: number;
  guaranteeLevels: Record<Level, number>;
  urgent: any[];
  revenue: { month: string; totals: Record<string, number> }[];
  revenueThisMonth: Record<string, number>;
  expectedMonthly: Record<string, number>;
  arrears: Record<string, number>;
  late: any[];
  currencies: string[];
}

export function Dashboard() {
  const { user } = useAuth();
  const t = useT();
  const { data, error, loading } = useFetch<Dash>('/dashboard');
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox error={error} />;

  const critical = data.guaranteeLevels.rouge + data.guaranteeLevels.orange;
  const cur = user?.currency ?? 'USD';
  const hasArrears = Object.values(data.arrears).some(Boolean);
  return (
    <>
      <PageHeader
        title={t('dash.hello', { name: user?.fullName.split(' ')[0] ?? '' })}
        subtitle={t('dash.asOf', { date: date(data.today) })}
        actions={
          <>
            <Link to="/proprietes/nouvelle" className="btn-secondary">+ {t('dash.addProperty')}</Link>
            <Link to="/baux/nouveau" className="btn-primary">+ {t('dash.newLease')}</Link>
          </>
        }
      />
      <ErrorBox error={error} />

      {critical > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 alert-pulse-slow">
          <p className="text-sm text-red-900">{t('dash.criticalBanner', { n: critical })}</p>
          <Link to="/baux?level=rouge" className="text-sm font-medium text-red-800 underline">{t('common.view')}</Link>
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
              className={`card block border-s-4 hover:shadow-md ${n && lvl !== 'vert' ? l.pulse : ''}`}
              style={{ borderInlineStartColor: l.color }}
            >
              <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <span className={`h-2.5 w-2.5 rounded-full ${l.dot}`} aria-hidden /> {t(`level.${lvl}`)}
              </p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{n}</p>
              <p className="text-xs text-slate-500">{t(`level.${lvl}.range`)}</p>
            </Link>
          );
        })}
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('dash.occupancy')} value={`${data.occupancyRate} %`} sub={t('dash.occupiedOf', { n: data.properties.occupee, total: data.properties.total })} to="/proprietes" />
        <Stat label={t('dash.collectedMonth')} value={moneyAll(data.revenueThisMonth, cur)} sub={t('dash.expected', { amount: moneyAll(data.expectedMonthly, cur) })} />
        <Stat label={t('dash.arrears')} value={moneyAll(data.arrears, cur)} sub={t('dash.lateCount', { n: data.late.length })} className={hasArrears ? 'border-orange-300' : ''} />
        <Stat label={t('nav.tenants')} value={data.tenants} sub={t('dash.activeLeases', { n: data.activeLeases })} to="/locataires" />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <h2 className="mb-4 font-semibold">{t('dash.toHandle')}</h2>
          {data.urgent.length === 0 ? (
            <Empty title={t('dash.noUrgent')}>{t('dash.noUrgentHint')}</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.urgent.map((l) => (
                <li key={l.id}>
                  <Link to={`/baux/${l.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{l.property_title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {l.first_name} {l.last_name} · {t('dash.expiresOn', { date: date(l.guarantee_expires_on) })} · {t(`level.${l.guarantee.level as Level}.action`)}
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
          <h2 className="mb-4 font-semibold">{t('dash.lateRents')}</h2>
          {data.late.length === 0 ? (
            <Empty title={t('dash.noLate')} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.late.map((p) => (
                <li key={`${p.leaseId}-${p.period}`}>
                  <Link to={`/baux/${p.leaseId}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{p.tenant}</p>
                      <p className="truncate text-xs text-slate-500">
                        {month(p.period)} · {t('dash.remaining', { amount: money(p.remaining, p.currency) })} · {t('alert.days', { n: p.daysLate })}
                      </p>
                    </div>
                    <Badge className={PAYMENT_STATE_CLS[p.state]}>{t(`payState.${p.state}` as any)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <RevenueChart revenue={data.revenue} currencies={data.currencies.length ? data.currencies : [cur]} preferred={cur} />
    </>
  );
}

/**
 * Revenus encaissés par mois, une monnaie à la fois (jamais deux échelles sur
 * le même graphique) ; un sélecteur apparaît si le bailleur en utilise plusieurs.
 */
function RevenueChart({ revenue, currencies, preferred }: { revenue: Dash['revenue']; currencies: string[]; preferred: string }) {
  const t = useT();
  const [cur, setCur] = useState(currencies.includes(preferred) ? preferred : currencies[0]);
  const values = revenue.map((r) => r.totals[cur] ?? 0);
  const max = Math.max(...values, 1);
  const total = values.reduce((a, v) => a + v, 0);
  return (
    <section className="card mt-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{t('dash.revenueTitle', { currency: cur })}</h2>
        <div className="flex items-center gap-3">
          {currencies.length > 1 && (
            <div className="flex rounded-lg border border-slate-300 p-0.5" role="group" aria-label={t('field.currency')}>
              {currencies.map((c) => (
                <button key={c} onClick={() => setCur(c)} className={`rounded-md px-2 py-0.5 text-xs font-medium ${c === cur ? 'bg-brand-700 text-white' : 'text-slate-600'}`}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <p className="text-sm text-slate-500">{t('common.totalValue', { amount: money(total, cur) })}</p>
        </div>
      </div>
      <div className="flex h-48 items-end gap-[2px] border-b border-slate-200" role="img" aria-label={t('dash.revenueAria', { currency: cur })}>
        {revenue.map((r, i) => (
          <div key={r.month} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-10 rounded-t bg-brand-600 transition group-hover:bg-brand-800"
              style={{ height: `${(values[i] / max) * 100}%`, minHeight: values[i] ? 2 : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
              {month(r.month)} : {money(values[i], cur)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px]">
        {revenue.map((r) => (
          <span key={r.month} className="flex-1 text-center text-[10px] text-slate-500">{shortMonth(r.month)}</span>
        ))}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-slate-500">{t('common.showTable')}</summary>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full">
            <thead>
              <tr>
                <th className="th">{t('common.month')}</th>
                {currencies.map((c) => <th key={c} className="th text-end">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {revenue.map((r) => (
                <tr key={r.month} className="border-t border-slate-100">
                  <td className="td capitalize">{month(r.month)}</td>
                  {currencies.map((c) => <td key={c} className="td whitespace-nowrap text-end">{money(r.totals[c] ?? 0, c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
