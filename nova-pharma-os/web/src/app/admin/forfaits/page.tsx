import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { money } from '@/lib/format';

interface Forfait {
  code: string; name: string; target_audience: string; description: string;
  currency: string; price_monthly: string; price_quarterly: string;
  price_annual: string; trial_days: number;
  max_users: number | null; max_branches: number | null;
  max_products: number | null; storage_quota_mb: number | null;
  sms_quota: number; modules: string[]; is_custom: boolean;
}

interface Option {
  code: string; name: string; description: string; unit: string;
  currency: string; unit_price: string; billing_cycle: string;
  grants_modules: string[]; grants_users: number; grants_branches: number;
  grants_storage_mb: number; grants_sms: number;
}

export default async function PageForfaits() {
  const data = await apiSafe<{ plans: Forfait[]; addons: Option[] }>('/plans', {
    plans: [],
    addons: [],
  });

  return (
    <>
      <div className="page-head">
        <h1>Forfaits et options</h1>
        <p>Grille commercialisée auprès des pharmacies, cliniques et distributeurs.</p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        {data.plans.map((p) => (
          <section className="card" key={p.code} style={{ marginBottom: 0 }}>
            <div className="stat-label">{p.target_audience}</div>
            <h2 style={{ marginTop: '0.25rem' }}>{p.name}</h2>
            <div className="stat-value" style={{ margin: '0.5rem 0' }}>
              {p.is_custom ? 'Sur devis' : money(p.price_monthly, p.currency)}
              {!p.is_custom && (
                <span className="small muted" style={{ fontWeight: 400 }}>
                  {' '}
                  / mois
                </span>
              )}
            </div>
            <p className="small muted">{p.description}</p>
            <table style={{ marginTop: '0.75rem' }}>
              <tbody>
                <tr>
                  <td className="small">Utilisateurs</td>
                  <td className="num small">{p.max_users ?? 'Sur mesure'}</td>
                </tr>
                <tr>
                  <td className="small">Branches</td>
                  <td className="num small">{p.max_branches ?? 'Sur mesure'}</td>
                </tr>
                <tr>
                  <td className="small">Références</td>
                  <td className="num small">
                    {p.max_products?.toLocaleString('fr-FR') ?? 'Sur mesure'}
                  </td>
                </tr>
                <tr>
                  <td className="small">Essai gratuit</td>
                  <td className="num small">{p.trial_days} jours</td>
                </tr>
                <tr>
                  <td className="small">Annuel</td>
                  <td className="num small">
                    {p.is_custom ? '—' : money(p.price_annual, p.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="row" style={{ gap: '0.25rem', marginTop: '0.75rem' }}>
              {p.modules.slice(0, 8).map((m) => (
                <span key={m} className="tag">
                  {m}
                </span>
              ))}
              {p.modules.length > 8 && (
                <span className="tag">+{p.modules.length - 8}</span>
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Options commercialisables</h2>
          <span className="hint">{data.addons.length} option(s)</span>
        </div>
        {data.addons.length === 0 ? (
          <Vide message="Aucune option." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Option</th>
                  <th>Description</th>
                  <th className="num">Prix</th>
                  <th>Ce qu&apos;elle ajoute</th>
                </tr>
              </thead>
              <tbody>
                {data.addons.map((a) => {
                  const apports: string[] = [];
                  if (a.grants_users) apports.push(`+${a.grants_users} utilisateur(s)`);
                  if (a.grants_branches) apports.push(`+${a.grants_branches} branche(s)`);
                  if (a.grants_storage_mb)
                    apports.push(`+${a.grants_storage_mb} Mo de stockage`);
                  if (a.grants_sms) apports.push(`+${a.grants_sms} SMS`);
                  a.grants_modules.forEach((m) => apports.push(`module ${m}`));
                  return (
                    <tr key={a.code}>
                      <td>
                        <strong>{a.name}</strong>
                        <br />
                        <span className="small muted mono">{a.code}</span>
                      </td>
                      <td className="small">{a.description}</td>
                      <td className="num">
                        {money(a.unit_price, a.currency)}
                        <br />
                        <span className="small muted">par {a.unit}</span>
                      </td>
                      <td className="small">{apports.join(' · ') || '—'}</td>
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
