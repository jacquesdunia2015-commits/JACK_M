import ActionsPharmacie from '@/components/ActionsPharmacie';
import Etiquette from '@/components/Etiquette';
import Stat from '@/components/Stat';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date, daysUntil, dateTime, money } from '@/lib/format';

interface Fiche {
  organization: {
    id: string; slug: string; legal_name: string; trade_name: string | null;
    kind: string; country_code: string; currency: string; locale: string;
    timezone: string; city: string | null; address: string | null;
    phone: string | null; email: string | null; tax_id: string | null;
    license_number: string | null; status: string; created_at: string;
    activated_at: string | null; suspended_at: string | null;
    terminated_at: string | null; data_retention_until: string | null;
    onboarding_step: string; onboarding_completed_at: string | null;
  };
  subscription: {
    status: string; billing_cycle: string; currency: string; unit_price: string;
    trial_ends_at: string | null; current_period_end: string;
    max_users: number | null; max_branches: number | null;
    max_products: number | null; storage_quota_mb: number | null;
    modules: string[]; plan_code: string; plan_name: string;
  } | null;
  addons: { id: string; code: string; name: string; quantity: number; unit_price: string; currency: string }[];
  usage: {
    users: number; branches: number; products: number; storageMb: number;
    limits: { maxUsers: number | null; maxBranches: number | null;
              maxProducts: number | null; storageQuotaMb: number | null } | null;
  };
  invoices: {
    id: string; number: string; status: string; issue_date: string;
    due_date: string; currency: string; total: string; amount_paid: string; balance: string;
  }[];
  planChanges: {
    changed_at: string; reason: string | null; to_status: string;
    from_plan: string | null; to_plan: string;
  }[];
}

interface Grant {
  id: string; reason: string; mode: string; status: string;
  agent_name: string | null; requested_at: string; expires_at: string; actions: string;
}

export default async function FichePharmacie({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fiche = await apiSafe<Fiche | null>(`/platform/organizations/${id}`, null);
  const grants = await apiSafe<Grant[]>(
    `/platform/organizations/${id}/support-access`,
    [],
  );

  if (!fiche) return <Vide message="Pharmacie introuvable." />;

  const o = fiche.organization;
  const s = fiche.subscription;
  const impayes = fiche.invoices.reduce((sum, i) => sum + Number(i.balance), 0);

  const quotas = [
    { label: 'Utilisateurs', used: fiche.usage.users, limit: fiche.usage.limits?.maxUsers },
    { label: 'Branches', used: fiche.usage.branches, limit: fiche.usage.limits?.maxBranches },
    { label: 'Références', used: fiche.usage.products, limit: fiche.usage.limits?.maxProducts },
    {
      label: 'Stockage (Mo)',
      used: fiche.usage.storageMb,
      limit: fiche.usage.limits?.storageQuotaMb,
    },
  ];

  return (
    <>
      <div className="page-head">
        <h1>{o.trade_name ?? o.legal_name}</h1>
        <p>
          <span className="mono">{o.slug}</span> · {o.city ?? '—'}, {o.country_code} ·
          créée le {date(o.created_at)}
        </p>
      </div>

      {o.status === 'suspended' && (
        <div className="banner danger">
          <strong>Pharmacie suspendue le {date(o.suspended_at)}</strong>
          Les données sont conservées et restent consultables en lecture seule.
        </div>
      )}
      {o.status === 'terminated' && (
        <div className="banner warn">
          <strong>Abonnement résilié le {date(o.terminated_at)}</strong>
          Données conservées jusqu&apos;au {date(o.data_retention_until)}, puis archivées.
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
        <Stat
          label="Forfait"
          valeur={s?.plan_name ?? '—'}
          note={s ? money(s.unit_price, s.currency) : ''}
        />
        <Stat label="Statut" valeur={<Etiquette statut={o.status} /> as unknown as string} />
        <Stat
          label="Échéance"
          valeur={date(s?.trial_ends_at ?? s?.current_period_end)}
          note={daysUntil(s?.trial_ends_at ?? s?.current_period_end)}
        />
        <Stat
          label="Impayés"
          valeur={money(impayes, o.currency)}
          ton={impayes > 0 ? 'danger' : undefined}
        />
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Consommation des quotas</h2>
            <span className="hint">Compteurs, sans accès aux données métier</span>
          </div>
          {quotas.map((q) => {
            const part =
              q.limit == null ? 0 : Math.min(100, (q.used / Math.max(q.limit, 1)) * 100);
            return (
              <div key={q.label} style={{ marginBottom: '0.85rem' }}>
                <div className="row small" style={{ marginBottom: '0.25rem' }}>
                  <span>{q.label}</span>
                  <div className="spacer" />
                  <span className="mono">
                    {q.used} / {q.limit ?? '∞'}
                  </span>
                </div>
                <div className={`bar${part >= 100 ? ' danger' : part >= 80 ? ' warn' : ''}`}>
                  <span style={{ width: `${part}%` }} />
                </div>
              </div>
            );
          })}

          {s && (
            <>
              <h3 style={{ fontSize: '0.85rem', marginTop: '1.2rem' }}>Modules actifs</h3>
              <div className="row" style={{ gap: '0.3rem' }}>
                {s.modules.map((m) => (
                  <span key={m} className="tag ok">
                    {m}
                  </span>
                ))}
              </div>
            </>
          )}

          {fiche.addons.length > 0 && (
            <>
              <h3 style={{ fontSize: '0.85rem', marginTop: '1.2rem' }}>
                Options souscrites
              </h3>
              <table>
                <tbody>
                  {fiche.addons.map((a) => (
                    <tr key={a.id}>
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

        <section className="card">
          <div className="card-head">
            <h2>Cycle de vie de l&apos;abonnement</h2>
          </div>
          <ActionsPharmacie organizationId={o.id} statut={o.status} />
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Factures d&apos;abonnement</h2>
        </div>
        {fiche.invoices.length === 0 ? (
          <Vide message="Aucune facture émise." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Statut</th>
                  <th className="num">Émise</th>
                  <th className="num">Échéance</th>
                  <th className="num">Total</th>
                  <th className="num">Réglé</th>
                  <th className="num">Solde</th>
                </tr>
              </thead>
              <tbody>
                {fiche.invoices.map((i) => (
                  <tr key={i.id}>
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
                        <span className="tag danger">{money(i.balance, i.currency)}</span>
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

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Historique des forfaits</h2>
          </div>
          {fiche.planChanges.length === 0 ? (
            <Vide message="Aucun changement." />
          ) : (
            <table>
              <tbody>
                {fiche.planChanges.map((c, index) => (
                  <tr key={index}>
                    <td className="small">{dateTime(c.changed_at)}</td>
                    <td className="small">
                      {c.from_plan ? `${c.from_plan} → ` : ''}
                      <strong>{c.to_plan}</strong> ·{' '}
                      <Etiquette statut={c.to_status} />
                    </td>
                    <td className="small muted">{c.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Accès support à cette pharmacie</h2>
            <span className="hint">Demandes, validations et actions tracées</span>
          </div>
          {grants.length === 0 ? (
            <Vide message="Aucun accès demandé." />
          ) : (
            <table>
              <tbody>
                {grants.map((g) => (
                  <tr key={g.id}>
                    <td className="small">{dateTime(g.requested_at)}</td>
                    <td className="small">
                      {g.agent_name}
                      <br />
                      <span className="muted">{g.reason}</span>
                    </td>
                    <td>
                      <Etiquette statut={g.status} />
                    </td>
                    <td className="num small">{g.actions} action(s)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
