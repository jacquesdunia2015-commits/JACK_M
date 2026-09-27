import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { download } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { PAYMENT_STATE_CLS, date, money, month, todayISO } from '../lib/format';
import { Badge, Empty, ErrorBox, Loading, PageHeader, Stat } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useT } from '../i18n';

type Totals = Record<string, { expected: number; collected: number; remaining: number }>;

const rate = (x: { expected: number; collected: number }) => (x.expected ? Math.round((x.collected / x.expected) * 100) : 0);

/** Rapports mensuel et annuel, exportables en CSV (Excel) et imprimables en PDF. */
export function Reports() {
  const t = useT();
  const [tab, setTab] = useState<'mois' | 'annee'>('mois');
  return (
    <>
      <PageHeader
        title={t('nav.reports')}
        subtitle={t('rep.subtitle')}
        actions={
          <div className="no-print flex rounded-lg border border-slate-300 bg-white p-1">
            {(['mois', 'annee'] as const).map((x) => (
              <button key={x} onClick={() => setTab(x)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === x ? 'bg-brand-700 text-white' : 'text-slate-600'}`}>
                {x === 'mois' ? t('rep.monthly') : t('rep.annual')}
              </button>
            ))}
          </div>
        }
      />
      {tab === 'mois' ? <Monthly /> : <Annual />}
    </>
  );
}

function Toolbar({ children, onCsv }: { children: React.ReactNode; onCsv: () => Promise<void> }) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-end gap-2">
        {children}
        <div className="ms-auto flex gap-2">
          <button className="btn-secondary" onClick={() => onCsv().catch((e) => setError(e.message))}>⬇ {t('rep.excel')}</button>
          <button className="btn-secondary" onClick={() => window.print()}>🖨 {t('rep.print')}</button>
        </div>
      </div>
      <ErrorBox error={error} />
    </>
  );
}

/** Tuiles « encaissé » et « arriérés », une par monnaie en jeu. */
function TotalsTiles({ totals, collectedLabel, arrearsLabel }: { totals: Totals; collectedLabel: string; arrearsLabel: string }) {
  const t = useT();
  const { user } = useAuth();
  const curs = Object.keys(totals).sort();
  if (!curs.length) return <Stat label={collectedLabel} value={money(0, user?.currency)} />;
  return (
    <>
      {curs.map((c) => (
        <Stat key={c} label={`${collectedLabel} (${c})`} value={money(totals[c].collected, c)} sub={t('rep.ofExpected', { amount: money(totals[c].expected, c), rate: rate(totals[c]) })} />
      ))}
      {curs.map((c) => (
        <Stat key={`r${c}`} label={`${arrearsLabel} (${c})`} value={money(totals[c].remaining, c)} className={totals[c].remaining ? 'border-orange-300' : ''} />
      ))}
    </>
  );
}

function Monthly() {
  const t = useT();
  const [m, setM] = useState(todayISO().slice(0, 7));
  const { data, error, loading } = useFetch<any>(`/reports/monthly?month=${m}`);
  return (
    <>
      <Toolbar onCsv={() => download(`/reports/monthly?month=${m}&format=csv`, `locagest-rapport-${m}.csv`)}>
        <label className="text-sm">
          <span className="label">{t('common.month')}</span>
          <input className="input" type="month" value={m} onChange={(e) => e.target.value && setM(e.target.value)} />
        </label>
      </Toolbar>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : data && (
        <>
          <h2 className="mb-3 hidden text-lg font-semibold print:block">{t('rep.monthlyTitle', { month: month(data.month) })}</h2>
          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TotalsTiles totals={data.totals} collectedLabel={t('rep.collected')} arrearsLabel={t('dash.arrears')} />
            <Stat label={t('dash.occupancy')} value={`${data.occupancy.rate} %`} sub={t('dash.occupiedOf', { n: data.occupancy.occupied, total: data.occupancy.properties })} />
          </section>

          <section className="card mb-6 overflow-x-auto p-0">
            <h3 className="px-5 pt-4 font-semibold">{t('rep.rentsOfMonth')}</h3>
            {data.lines.length === 0 ? <div className="p-5"><Empty title={t('rep.noLeases')} /></div> : (
              <table className="mt-2 w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="th">{t('field.property')}</th><th className="th">{t('field.tenant')}</th><th className="th text-end">{t('field.rent')}</th>
                    <th className="th text-end">{t('rep.paid')}</th><th className="th text-end">{t('rep.remaining')}</th><th className="th">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l: any) => (
                    <tr key={l.leaseId} className="border-b border-slate-100">
                      <td className="td"><Link className="text-brand-700 hover:underline" to={`/baux/${l.leaseId}`}>{l.property}</Link></td>
                      <td className="td">{l.tenant}</td>
                      <td className="td whitespace-nowrap text-end">{money(l.rent, l.currency)}</td>
                      <td className="td whitespace-nowrap text-end">{money(l.paid, l.currency)}</td>
                      <td className="td whitespace-nowrap text-end font-medium">{money(l.remaining, l.currency)}</td>
                      <td className="td">
                        <Badge className={PAYMENT_STATE_CLS[l.state]}>
                          {t(`payState.${l.state as 'paye'}`)}{l.daysLate && l.state !== 'paye' ? ` · ${t('alert.days', { n: l.daysLate })}` : ''}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card overflow-x-auto p-0">
            <h3 className="px-5 pt-4 font-semibold">{t('rep.paymentsOfMonth')}</h3>
            {data.payments.length === 0 ? <p className="p-5 text-sm text-slate-500">{t('rep.noPayments')}</p> : (
              <table className="mt-2 w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="th">{t('common.date')}</th><th className="th">{t('field.tenant')}</th><th className="th">{t('rep.monthCovered')}</th>
                    <th className="th">{t('pay.method')}</th><th className="th text-end">{t('pay.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p: any) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="td">{date(p.paid_on)}</td>
                      <td className="td">{p.tenant_name}<div className="text-xs text-slate-500">{p.property_title}</div></td>
                      <td className="td capitalize">{month(p.period)}</td>
                      <td className="td">{t(`payMethod.${p.method as 'especes'}`)}{p.reference ? ` · ${p.reference}` : ''}</td>
                      <td className="td whitespace-nowrap text-end font-medium">{money(p.amount, p.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </>
  );
}

function Annual() {
  const t = useT();
  const { user } = useAuth();
  const [y, setY] = useState(Number(todayISO().slice(0, 4)));
  const { data, error, loading } = useFetch<any>(`/reports/annual?year=${y}`);
  const curs: string[] = data?.currencies?.length ? data.currencies : [user?.currency ?? 'USD'];
  return (
    <>
      <Toolbar onCsv={() => download(`/reports/annual?year=${y}&format=csv`, `locagest-rapport-${y}.csv`)}>
        <label className="text-sm">
          <span className="label">{t('rep.year')}</span>
          <select className="input" value={y} onChange={(e) => setY(Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => Number(todayISO().slice(0, 4)) + 1 - i).map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
      </Toolbar>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : data && (
        <>
          <h2 className="mb-3 hidden text-lg font-semibold print:block">{t('rep.annualTitle', { year: data.year })}</h2>
          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TotalsTiles totals={data.totals} collectedLabel={t('rep.turnover', { year: data.year })} arrearsLabel={t('rep.arrearsYear', { year: data.year })} />
          </section>
          <section className="card overflow-x-auto p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="th">{t('common.month')}</th>
                  {curs.map((c) => (
                    <Fragment key={c}>
                      <th className="th text-end">{t('rep.expected')} {c}</th>
                      <th className="th text-end">{t('rep.collected')} {c}</th>
                      <th className="th text-end">{t('dash.arrears')} {c}</th>
                    </Fragment>
                  ))}
                  <th className="th text-end">{t('dash.occupancy')}</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m: any) => (
                  <tr key={m.month} className="border-b border-slate-100">
                    <td className="td capitalize">{month(m.month)}</td>
                    {curs.map((c) => {
                      const v = m.totals[c] ?? { expected: 0, collected: 0, remaining: 0 };
                      return (
                        <Fragment key={c}>
                          <td className="td whitespace-nowrap text-end text-slate-500">{money(v.expected, c)}</td>
                          <td className="td whitespace-nowrap text-end font-medium">{money(v.collected, c)}</td>
                          <td className={`td whitespace-nowrap text-end ${v.remaining ? 'text-orange-700' : 'text-slate-400'}`}>{money(v.remaining, c)}</td>
                        </Fragment>
                      );
                    })}
                    <td className="td whitespace-nowrap text-end">{m.occupancyRate} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
