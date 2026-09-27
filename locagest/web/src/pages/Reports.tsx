import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { download } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { PAYMENT_METHODS, PAYMENT_STATES, date, money, month, todayISO } from '../lib/format';
import { Badge, Empty, ErrorBox, Loading, PageHeader, Stat } from '../components/ui';

type Cur = 'USD' | 'CDF';
type Totals = Record<Cur, { expected: number; collected: number; remaining: number }>;

const rate = (t: { expected: number; collected: number }) => (t.expected ? Math.round((t.collected / t.expected) * 100) : 0);
const currencies = (totals: Totals) => (['USD', 'CDF'] as Cur[]).filter((c) => totals[c].expected || totals[c].collected);

/** Rapports mensuel et annuel, exportables en CSV (Excel) et imprimables en PDF. */
export function Reports() {
  const [tab, setTab] = useState<'mois' | 'annee'>('mois');
  return (
    <>
      <PageHeader
        title="Rapports"
        subtitle="Revenus, arriérés et taux d'occupation"
        actions={
          <div className="no-print flex rounded-lg border border-slate-300 bg-white p-1">
            {(['mois', 'annee'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t ? 'bg-brand-700 text-white' : 'text-slate-600'}`}>
                {t === 'mois' ? 'Mensuel' : 'Annuel'}
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
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-end gap-2">
        {children}
        <div className="ml-auto flex gap-2">
          <button className="btn-secondary" onClick={() => onCsv().catch((e) => setError(e.message))}>⬇ Excel (CSV)</button>
          <button className="btn-secondary" onClick={() => window.print()}>🖨 Imprimer / PDF</button>
        </div>
      </div>
      <ErrorBox error={error} />
    </>
  );
}

function Monthly() {
  const [m, setM] = useState(todayISO().slice(0, 7));
  const { data, error, loading } = useFetch<any>(`/reports/monthly?month=${m}`);
  return (
    <>
      <Toolbar onCsv={() => download(`/reports/monthly?month=${m}&format=csv`, `locagest-rapport-${m}.csv`)}>
        <label className="text-sm">
          <span className="label">Mois</span>
          <input className="input" type="month" value={m} onChange={(e) => e.target.value && setM(e.target.value)} />
        </label>
      </Toolbar>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : data && (
        <>
          <h2 className="mb-3 hidden text-lg font-semibold capitalize print:block">Rapport de {month(data.month)}</h2>
          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {currencies(data.totals).length === 0 && <Stat label="Loyers attendus" value={money(0)} />}
            {currencies(data.totals).map((c) => (
              <Stat key={c} label={`Encaissé (${c === 'CDF' ? 'FC' : 'USD'})`} value={money(data.totals[c].collected, c)} sub={`sur ${money(data.totals[c].expected, c)} attendus · ${rate(data.totals[c])} %`} />
            ))}
            {currencies(data.totals).map((c) => (
              <Stat key={`r${c}`} label={`Arriérés (${c === 'CDF' ? 'FC' : 'USD'})`} value={money(data.totals[c].remaining, c)} className={data.totals[c].remaining ? 'border-orange-300' : ''} />
            ))}
            <Stat label="Taux d'occupation" value={`${data.occupancy.rate} %`} sub={`${data.occupancy.occupied} / ${data.occupancy.properties} propriété(s)`} />
          </section>

          <section className="card mb-6 overflow-x-auto p-0">
            <h3 className="px-5 pt-4 font-semibold">Loyers du mois</h3>
            {data.lines.length === 0 ? <div className="p-5"><Empty title="Aucun bail en cours ce mois-ci" /></div> : (
              <table className="mt-2 w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="th">Propriété</th><th className="th">Locataire</th><th className="th text-right">Loyer</th>
                    <th className="th text-right">Payé</th><th className="th text-right">Reste dû</th><th className="th">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l: any) => (
                    <tr key={l.leaseId} className="border-b border-slate-100">
                      <td className="td"><Link className="text-brand-700 hover:underline" to={`/baux/${l.leaseId}`}>{l.property}</Link></td>
                      <td className="td">{l.tenant}</td>
                      <td className="td whitespace-nowrap text-right">{money(l.rent, l.currency)}</td>
                      <td className="td whitespace-nowrap text-right">{money(l.paid, l.currency)}</td>
                      <td className="td whitespace-nowrap text-right font-medium">{money(l.remaining, l.currency)}</td>
                      <td className="td"><Badge className={PAYMENT_STATES[l.state].cls}>{PAYMENT_STATES[l.state].label}{l.daysLate && l.state !== 'paye' ? ` · ${l.daysLate} j` : ''}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card overflow-x-auto p-0">
            <h3 className="px-5 pt-4 font-semibold">Paiements reçus dans le mois</h3>
            {data.payments.length === 0 ? <p className="p-5 text-sm text-slate-500">Aucun paiement reçu.</p> : (
              <table className="mt-2 w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="th">Date</th><th className="th">Locataire</th><th className="th">Mois couvert</th>
                    <th className="th">Moyen</th><th className="th text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p: any) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="td">{date(p.paid_on)}</td>
                      <td className="td">{p.tenant_name}<div className="text-xs text-slate-500">{p.property_title}</div></td>
                      <td className="td capitalize">{month(p.period)}</td>
                      <td className="td">{PAYMENT_METHODS[p.method]}{p.reference ? ` · ${p.reference}` : ''}</td>
                      <td className="td whitespace-nowrap text-right font-medium">{money(p.amount, p.currency)}</td>
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
  const [y, setY] = useState(Number(todayISO().slice(0, 4)));
  const { data, error, loading } = useFetch<any>(`/reports/annual?year=${y}`);
  const curs: Cur[] = data ? currencies(data.totals) : [];
  return (
    <>
      <Toolbar onCsv={() => download(`/reports/annual?year=${y}&format=csv`, `locagest-rapport-${y}.csv`)}>
        <label className="text-sm">
          <span className="label">Année</span>
          <select className="input" value={y} onChange={(e) => setY(Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => Number(todayISO().slice(0, 4)) + 1 - i).map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
      </Toolbar>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : data && (
        <>
          <h2 className="mb-3 hidden text-lg font-semibold print:block">Rapport annuel {data.year}</h2>
          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {curs.length === 0 && <Stat label="Chiffre d'affaires" value={money(0)} />}
            {curs.map((c) => (
              <Stat key={c} label={`Chiffre d'affaires ${data.year} (${c === 'CDF' ? 'FC' : 'USD'})`} value={money(data.totals[c].collected, c)} sub={`${rate(data.totals[c])} % des ${money(data.totals[c].expected, c)} attendus`} />
            ))}
            {curs.map((c) => (
              <Stat key={`r${c}`} label={`Arriérés ${data.year} (${c === 'CDF' ? 'FC' : 'USD'})`} value={money(data.totals[c].remaining, c)} />
            ))}
          </section>
          <section className="card overflow-x-auto p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="th">Mois</th>
                  {(curs.length ? curs : (['USD'] as Cur[])).map((c) => (
                    <Fragment key={c}>
                      <th className="th text-right">Attendu {c === 'CDF' ? 'FC' : '$'}</th>
                      <th className="th text-right">Encaissé {c === 'CDF' ? 'FC' : '$'}</th>
                      <th className="th text-right">Arriérés {c === 'CDF' ? 'FC' : '$'}</th>
                    </Fragment>
                  ))}
                  <th className="th text-right">Occupation</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m: any) => (
                  <tr key={m.month} className="border-b border-slate-100">
                    <td className="td capitalize">{month(m.month)}</td>
                    {(curs.length ? curs : (['USD'] as Cur[])).map((c) => (
                      <Fragment key={c}>
                        <td className="td whitespace-nowrap text-right text-slate-500">{money(m.totals[c].expected, c)}</td>
                        <td className="td whitespace-nowrap text-right font-medium">{money(m.totals[c].collected, c)}</td>
                        <td className={`td whitespace-nowrap text-right ${m.totals[c].remaining ? 'text-orange-700' : 'text-slate-400'}`}>{money(m.totals[c].remaining, c)}</td>
                      </Fragment>
                    ))}
                    <td className="td whitespace-nowrap text-right">{m.occupancyRate} %</td>
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
