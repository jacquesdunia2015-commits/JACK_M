import { Link } from 'react-router-dom';
import { useFetch } from '../lib/useFetch';
import { LEVELS, dateTime, type Level } from '../lib/format';
import { Badge, Empty, ErrorBox, Loading, PageHeader } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useT } from '../i18n';

const STATUS_CLS: Record<string, string> = {
  envoye: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  simule: 'bg-slate-100 text-slate-700 ring-slate-300',
  echec: 'bg-red-50 text-red-800 ring-red-300',
};

/** Historique des alertes générées, conservé pour audit (§3.4). */
export function AlertsHistory() {
  const t = useT();
  const { user } = useAuth();
  const { data, error, loading } = useFetch<any[]>('/alerts');
  return (
    <>
      <PageHeader title={t('nav.alerts')} subtitle={t('alerts.subtitle')} />
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : !data?.length ? (
        <Empty title={t('alerts.none')}>{t('alerts.noneHint')}</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">{t('common.date')}</th><th className="th">{t('alerts.level')}</th><th className="th">{t('alerts.subject')}</th>
                <th className="th">{t('alerts.recipient')}</th><th className="th">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="td whitespace-nowrap">{dateTime(a.created_at)}</td>
                  <td className="td">{LEVELS[a.level as Level].emoji} {a.kind === 'garantie' ? t('lease.guarantee') : t('field.rent')}</td>
                  <td className="td">
                    {user?.role === 'bailleur' ? <Link className="text-brand-700 hover:underline" to={`/baux/${a.lease_id}`}>{a.message}</Link> : a.message}
                    <div className="text-xs text-slate-500">{a.tenant_name}</div>
                  </td>
                  <td className="td">{a.recipient}<div className="text-xs text-slate-500">{t(`recipient.${a.recipient_type as 'bailleur'}`)}</div></td>
                  <td className="td"><Badge className={STATUS_CLS[a.status]}>{t(`sendStatus.${a.status as 'envoye'}`)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
