import { useState } from 'react';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { date } from '../lib/format';
import { countryName } from '../lib/geo';
import { findLanguage } from '../i18n/languages';
import { ErrorBox, Loading, PageHeader, Stat } from '../components/ui';
import { useI18n } from '../i18n';

export function Admin() {
  const { t, lang } = useI18n();
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
    setMsg(t('admin.alertsRun', { checked: r.checked, sent: r.sent }));
  };

  if (!stats.data || !users.data) return stats.error || users.error ? <ErrorBox error={stats.error ?? users.error} /> : <Loading />;
  const s = stats.data;
  const country = (c: string | null) => (c && c !== '??' ? countryName(c, lang.intl) : t('admin.unknownCountry'));

  return (
    <>
      <PageHeader title={t('nav.admin')} subtitle={t('admin.subtitle')} actions={<button className="btn-secondary" onClick={runAlerts}>{t('admin.runAlerts')}</button>} />
      {msg && <p className="mb-4 text-sm text-emerald-700">{msg}</p>}
      <ErrorBox error={error} />
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={t('admin.landlords')} value={s.landlords} sub={t('admin.active', { n: s.active_landlords })} />
        <Stat label={t('nav.properties')} value={s.properties} />
        <Stat label={t('nav.tenants')} value={s.tenants} />
        <Stat label={t('admin.activeLeases')} value={s.active_leases} />
        <Stat label={t('admin.alerts30')} value={s.alerts_30d} />
      </section>

      {s.countries?.length > 0 && (
        <section className="card mb-6">
          <h2 className="mb-3 font-semibold">{t('admin.byCountry')}</h2>
          <ul className="flex flex-wrap gap-2">
            {s.countries.map((c: any) => (
              <li key={c.country} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {country(c.country)} <strong>{c.n}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="th">{t('admin.landlord')}</th><th className="th">{t('geo.country')}</th><th className="th">{t('admin.registered')}</th>
              <th className="th">{t('nav.properties')}</th><th className="th">{t('nav.tenants')}</th><th className="th">{t('admin.plan')}</th><th className="th">{t('admin.account')}</th>
            </tr>
          </thead>
          <tbody>
            {users.data.users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="td"><p className="font-medium">{u.full_name}</p><p className="text-xs text-slate-500">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p></td>
                <td className="td">{country(u.country)}<p className="text-xs text-slate-500">{u.currency} · {findLanguage(u.locale)?.name ?? u.locale}</p></td>
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
                    {u.active ? t('admin.suspend') : t('admin.reactivate')}
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
