import Etiquette from '@/components/Etiquette';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date, daysUntil, money } from '@/lib/format';

interface Abonnement {
  subscription: {
    status: string; billing_cycle: string; currency: string; unit_price: string;
    discount_percent: string; trial_ends_at: string | null;
    current_period_end: string; renewal_at: string | null; auto_renew: boolean;
    max_users: number | null; max_branches: number | null;
    max_products: number | null; storage_quota_mb: number | null;
    modules: string[]; plan_code: string; plan_name: string; target_audience: string;
  } | null;
  addons: { code: string; name: string; quantity: number; unit_price: string; currency: string }[];
  invoices: {
    number: string; status: string; issue_date: string; due_date: string;
    currency: string; total: string; amount_paid: string; balance: string;
  }[];
}

interface Quota {
  kind: string; used: number; limit: number | null; remaining: number | null; exceeded: boolean;
}

const LIBELLES_QUOTA: Record<string, string> = {
  users: 'Utilisateurs',
  branches: 'Branches',
  products: 'Références produits',
  storage_mb: 'Stockage documentaire (Mo)',
};

export default async function PageAbonnement() {
  const [abo, quotas] = await Promise.all([
    apiSafe<Abonnement>('/account/subscription', {
      subscription: null,
      addons: [],
      invoices: [],
    }),
    apiSafe<Quota[]>('/account/usage', []),
  ]);

  const s = abo.subscription;
  const impayees = abo.invoices.filter((i) => Number(i.balance) > 0);

  return (
    <>
      <div className="page-head">
        <h1>Mon abonnement</h1>
        <p>Forfait souscrit, consommation des quotas et factures NOVA PHARMA OS.</p>
      </div>

      {impayees.length > 0 && (
        <div className="banner danger">
          <strong>
            {impayees.length} facture(s) en attente de règlement —{' '}
            {money(
              impayees.reduce((sum, i) => sum + Number(i.balance), 0),
              impayees[0].currency,
            )}
          </strong>
          Le règlement rétablit immédiatement l&apos;ensemble de vos accès.
        </div>
      )}

      {!s ? (
        <Vide message="Aucun abonnement rattaché à cette pharmacie." />
      ) : (
        <>
          <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
            <div className="stat">
              <div className="stat-label">Forfait</div>
              <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                {s.plan_name}
              </div>
              <div className="stat-note">{s.target_audience}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Statut</div>
              <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                <Etiquette statut={s.status} />
              </div>
              <div className="stat-note">
                {s.auto_renew ? 'Renouvellement automatique' : 'Sans reconduction'}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Montant</div>
              <div className="stat-value">{money(s.unit_price, s.currency)}</div>
              <div className="stat-note">
                {{ monthly: 'par mois', quarterly: 'par trimestre', annual: 'par an' }[
                  s.billing_cycle
                ] ?? s.billing_cycle}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">
                {s.status === 'trialing' ? 'Fin de l’essai' : 'Prochaine échéance'}
              </div>
              <div className="stat-value" style={{ fontSize: '1.1rem' }}>
                {date(s.trial_ends_at ?? s.current_period_end)}
              </div>
              <div className="stat-note">
                {daysUntil(s.trial_ends_at ?? s.current_period_end)}
              </div>
            </div>
          </div>

          <div className="grid grid-2">
            <section className="card">
              <div className="card-head">
                <h2>Consommation des quotas</h2>
              </div>
              {quotas.map((q) => {
                const part =
                  q.limit === null ? 0 : Math.min(100, (q.used / Math.max(q.limit, 1)) * 100);
                return (
                  <div key={q.kind} style={{ marginBottom: '0.9rem' }}>
                    <div className="row small" style={{ marginBottom: '0.25rem' }}>
                      <span>{LIBELLES_QUOTA[q.kind] ?? q.kind}</span>
                      <div className="spacer" />
                      <span className="mono">
                        {q.used} / {q.limit === null ? '∞' : q.limit}
                      </span>
                    </div>
                    <div
                      className={`bar${part >= 100 ? ' danger' : part >= 80 ? ' warn' : ''}`}
                    >
                      <span style={{ width: `${part}%` }} />
                    </div>
                  </div>
                );
              })}
              {quotas.length === 0 && <Vide message="Quotas indisponibles." />}
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Modules et options</h2>
                <span className="hint">{s.modules.length} modules actifs</span>
              </div>
              <div className="row" style={{ gap: '0.35rem', marginBottom: '1rem' }}>
                {s.modules.map((m) => (
                  <span key={m} className="tag ok">
                    {m}
                  </span>
                ))}
              </div>
              {abo.addons.length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
                    Options souscrites
                  </h3>
                  <table>
                    <tbody>
                      {abo.addons.map((a) => (
                        <tr key={a.code}>
                          <td>{a.name}</td>
                          <td className="num">×{a.quantity}</td>
                          <td className="num">{money(a.unit_price, a.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </section>
          </div>

          <section className="card">
            <div className="card-head">
              <h2>Factures d&apos;abonnement</h2>
            </div>
            {abo.invoices.length === 0 ? (
              <Vide message="Aucune facture émise." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Numéro</th>
                      <th>Statut</th>
                      <th className="num">Émise le</th>
                      <th className="num">Échéance</th>
                      <th className="num">Montant</th>
                      <th className="num">Réglé</th>
                      <th className="num">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abo.invoices.map((i) => (
                      <tr key={i.number}>
                        <td className="mono">{i.number}</td>
                        <td>
                          <Etiquette statut={i.status} />
                        </td>
                        <td className="num">{date(i.issue_date)}</td>
                        <td className="num">{date(i.due_date)}</td>
                        <td className="num">{money(i.total, i.currency)}</td>
                        <td className="num">{money(i.amount_paid, i.currency)}</td>
                        <td className="num">
                          {Number(i.balance) > 0 ? (
                            <strong className="tag danger">
                              {money(i.balance, i.currency)}
                            </strong>
                          ) : (
                            money(0, i.currency)
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
      )}
    </>
  );
}
