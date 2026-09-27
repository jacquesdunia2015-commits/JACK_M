import { useState } from 'react';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { date } from '../lib/format';
import { ErrorBox, Loading, PageHeader, Stat } from '../components/ui';

export function Admin() {
  const stats = useFetch<any>('/admin/stats');
  const users = useFetch<{ users: any[]; plans: Record<string, { label: string; price: string }> }>('/admin/users');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = async (id: number, body: object) => {
    setError(null);
    try {
      await api(`/admin/users/${id}`, { method: 'PATCH', body });
      await Promise.all([users.reload(), stats.reload()]);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const runAlerts = async () => {
    const r = await api('/alerts/run', { method: 'POST' });
    setMsg(`${r.checked} bail(s) vérifié(s), ${r.sent} alerte(s) envoyée(s).`);
  };

  if (!stats.data || !users.data) return stats.error || users.error ? <ErrorBox error={stats.error ?? users.error} /> : <Loading />;
  const s = stats.data;

  return (
    <>
      <PageHeader title="Administration" subtitle="Comptes bailleurs, offres et supervision" actions={<button className="btn-secondary" onClick={runAlerts}>Lancer la vérification des alertes</button>} />
      {msg && <p className="mb-4 text-sm text-emerald-700">{msg}</p>}
      <ErrorBox error={error} />
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Bailleurs" value={s.landlords} sub={`${s.active_landlords} actif(s)`} />
        <Stat label="Propriétés" value={s.properties} />
        <Stat label="Locataires" value={s.tenants} />
        <Stat label="Baux actifs" value={s.active_leases} />
        <Stat label="Alertes (30 j)" value={s.alerts_30d} />
      </section>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="th">Bailleur</th><th className="th">Inscrit le</th><th className="th">Propriétés</th>
              <th className="th">Locataires</th><th className="th">Offre</th><th className="th">Compte</th>
            </tr>
          </thead>
          <tbody>
            {users.data.users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="td"><p className="font-medium">{u.full_name}</p><p className="text-xs text-slate-500">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p></td>
                <td className="td">{date(u.created_at)}</td>
                <td className="td">{u.properties}</td>
                <td className="td">{u.tenants}</td>
                <td className="td">
                  <select className="input py-1" value={u.plan} onChange={(e) => update(u.id, { plan: e.target.value })}>
                    {Object.entries(users.data!.plans).map(([k, p]) => <option key={k} value={k}>{p.label} ({p.price})</option>)}
                  </select>
                </td>
                <td className="td">
                  <button className={u.active ? 'btn-danger py-1' : 'btn-secondary py-1'} onClick={() => update(u.id, { active: !u.active })}>
                    {u.active ? 'Suspendre' : 'Réactiver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
