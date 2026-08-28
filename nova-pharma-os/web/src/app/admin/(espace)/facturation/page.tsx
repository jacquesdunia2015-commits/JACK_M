import Etiquette from '@/components/Etiquette';
import Stat from '@/components/Stat';
import TraitementsPlanifies from '@/components/TraitementsPlanifies';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date, money } from '@/lib/format';
import { readSession } from '@/lib/session';

interface Facture {
  id: string; number: string; kind: string; status: string; currency: string;
  issue_date: string; due_date: string; period_start: string | null;
  period_end: string | null; total: string; amount_paid: string; balance: string;
  organization_slug: string; organization_name: string;
}

export default async function PageFacturation({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const session = await readSession();
  const params = new URLSearchParams({ pageSize: '100' });
  if (status) params.set('status', status);

  const data = await apiSafe<{ data: Facture[]; pagination: { total: number } }>(
    `/platform/billing/invoices?${params}`,
    { data: [], pagination: { total: 0 } },
  );

  const emises = data.data.filter((f) => f.kind === 'invoice');
  const echues = emises.filter((f) => f.status === 'overdue');
  const impayes = emises.reduce((sum, f) => sum + Number(f.balance), 0);
  const encaisse = emises.reduce((sum, f) => sum + Number(f.amount_paid), 0);

  return (
    <>
      <div className="page-head">
        <h1>Facturation SaaS</h1>
        <p>Factures d&apos;abonnement, règlements et relances d&apos;impayé.</p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
        <Stat label="Factures émises" valeur={emises.length} />
        <Stat label="Encaissé" valeur={money(encaisse)} ton="ok" />
        <Stat
          label="Restant dû"
          valeur={money(impayes)}
          ton={impayes > 0 ? 'warn' : undefined}
        />
        <Stat
          label="Factures échues"
          valeur={echues.length}
          ton={echues.length > 0 ? 'danger' : undefined}
        />
      </div>

      {session?.role === 'super_admin' && <TraitementsPlanifies />}

      <section className="card">
        <div className="card-head">
          <h2>Factures</h2>
          <span className="hint">{data.pagination.total} document(s)</span>
        </div>

        <form className="row" style={{ marginBottom: '1rem' }}>
          <select name="status" defaultValue={status ?? ''} style={{ maxWidth: 240 }}>
            <option value="">Tous les statuts</option>
            <option value="issued">Émises</option>
            <option value="overdue">En retard</option>
            <option value="partially_paid">Partiellement réglées</option>
            <option value="paid">Réglées</option>
          </select>
          <button type="submit" className="secondaire">
            Filtrer
          </button>
        </form>

        {data.data.length === 0 ? (
          <Vide message="Aucune facture." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Pharmacie</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th className="num">Période</th>
                  <th className="num">Échéance</th>
                  <th className="num">Total</th>
                  <th className="num">Solde</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((f) => (
                  <tr key={f.id}>
                    <td className="mono">{f.number}</td>
                    <td>
                      {f.organization_name}
                      <br />
                      <span className="small muted mono">{f.organization_slug}</span>
                    </td>
                    <td className="small">
                      {{ invoice: 'Facture', quote: 'Devis', credit_note: 'Avoir' }[f.kind] ??
                        f.kind}
                    </td>
                    <td>
                      <Etiquette statut={f.status} />
                    </td>
                    <td className="num small">
                      {f.period_start ? (
                        <>
                          {date(f.period_start)}
                          <br />
                          {date(f.period_end)}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="num small">{date(f.due_date)}</td>
                    <td className="num">{money(f.total, f.currency)}</td>
                    <td className="num">
                      {Number(f.balance) > 0 ? (
                        <span className="tag danger">{money(f.balance, f.currency)}</span>
                      ) : (
                        <span className="muted">réglée</span>
                      )}
                    </td>
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
