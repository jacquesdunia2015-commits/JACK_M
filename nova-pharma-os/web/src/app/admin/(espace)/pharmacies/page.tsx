import Link from 'next/link';
import Etiquette from '@/components/Etiquette';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date, daysUntil, money } from '@/lib/format';

interface Pharmacie {
  id: string; slug: string; legal_name: string; trade_name: string | null;
  kind: string; country_code: string; currency: string; city: string | null;
  status: string; created_at: string;
  subscription_status: string | null; billing_cycle: string | null;
  current_period_end: string | null; trial_ends_at: string | null;
  plan_code: string | null; plan_name: string | null;
  users_count: string | null; branches_count: string | null;
  outstanding_balance: string;
}

export default async function PagePharmacies({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; planCode?: string }>;
}) {
  const { q, status, planCode } = await searchParams;
  const params = new URLSearchParams({ pageSize: '100' });
  if (q) params.set('search', q);
  if (status) params.set('status', status);
  if (planCode) params.set('planCode', planCode);

  const data = await apiSafe<{
    data: Pharmacie[];
    pagination: { total: number };
  }>(`/platform/organizations?${params}`, { data: [], pagination: { total: 0 } });

  return (
    <>
      <div className="page-head">
        <h1>Pharmacies clientes</h1>
        <p>{data.pagination.total} organisation(s) sur la plateforme.</p>
      </div>

      <section className="card">
        <form className="row" style={{ marginBottom: '1rem' }}>
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Nom ou identifiant…"
            style={{ maxWidth: 280 }}
          />
          <select name="status" defaultValue={status ?? ''} style={{ maxWidth: 200 }}>
            <option value="">Tous les statuts</option>
            <option value="trial">Essai gratuit</option>
            <option value="active">Actives</option>
            <option value="suspended">Suspendues</option>
            <option value="terminated">Résiliées</option>
          </select>
          <select name="planCode" defaultValue={planCode ?? ''} style={{ maxWidth: 200 }}>
            <option value="">Tous les forfaits</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="business">Business</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button type="submit" className="secondaire">
            Filtrer
          </button>
        </form>

        {data.data.length === 0 ? (
          <Vide message="Aucune pharmacie ne correspond." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pharmacie</th>
                  <th>Forfait</th>
                  <th>Statut</th>
                  <th>Abonnement</th>
                  <th className="num">Utilisateurs</th>
                  <th className="num">Branches</th>
                  <th className="num">Échéance</th>
                  <th className="num">Impayés</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => {
                  const echeance = p.trial_ends_at ?? p.current_period_end;
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/admin/pharmacies/${p.id}`}>
                          <strong>{p.trade_name ?? p.legal_name}</strong>
                        </Link>
                        <div className="small muted">
                          <span className="mono">{p.slug}</span>
                          {p.city ? ` · ${p.city}` : ''} · {p.country_code}
                        </div>
                      </td>
                      <td className="small">{p.plan_name ?? '—'}</td>
                      <td>
                        <Etiquette statut={p.status} />
                      </td>
                      <td>
                        <Etiquette statut={p.subscription_status} />
                      </td>
                      <td className="num">{p.users_count ?? 0}</td>
                      <td className="num">{p.branches_count ?? 0}</td>
                      <td className="num small">
                        {date(echeance)}
                        <br />
                        <span className="muted">{daysUntil(echeance)}</span>
                      </td>
                      <td className="num">
                        {Number(p.outstanding_balance) > 0 ? (
                          <span className="tag danger">
                            {money(p.outstanding_balance, p.currency)}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
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
