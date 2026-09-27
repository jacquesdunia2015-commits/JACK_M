import { Link } from 'react-router-dom';
import { useFetch } from '../lib/useFetch';
import { LEVELS, type Level } from '../lib/format';
import { Badge, Empty, ErrorBox, Loading, PageHeader } from '../components/ui';
import { useAuth } from '../lib/auth';

const STATUS: Record<string, { label: string; cls: string }> = {
  envoye: { label: 'Envoyé', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  simule: { label: 'Simulé', cls: 'bg-slate-100 text-slate-700 ring-slate-300' },
  echec: { label: 'Échec', cls: 'bg-red-50 text-red-800 ring-red-300' },
};

/** Historique des alertes générées, conservé pour audit (§3.4). */
export function AlertsHistory() {
  const { user } = useAuth();
  const { data, error, loading } = useFetch<any[]>('/alerts');
  return (
    <>
      <PageHeader
        title="Historique des alertes"
        subtitle="Emails de garantie (30, 14, 7 jours, échéance) et de retard de loyer (5, 10, 15 jours)"
      />
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : !data?.length ? (
        <Empty title="Aucune alerte envoyée pour l'instant">La vérification tourne automatiquement toutes les heures.</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="th">Date</th><th className="th">Niveau</th><th className="th">Objet</th>
                <th className="th">Destinataire</th><th className="th">Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="td whitespace-nowrap">{new Date(a.created_at).toLocaleString('fr-FR')}</td>
                  <td className="td">{LEVELS[a.level as Level].emoji} {a.kind === 'garantie' ? 'Garantie' : 'Loyer'}</td>
                  <td className="td">
                    {user?.role === 'bailleur' ? <Link className="text-brand-700 hover:underline" to={`/baux/${a.lease_id}`}>{a.message}</Link> : a.message}
                    <div className="text-xs text-slate-500">{a.tenant_name}</div>
                  </td>
                  <td className="td">{a.recipient}<div className="text-xs text-slate-500">{a.recipient_type}</div></td>
                  <td className="td"><Badge className={STATUS[a.status].cls}>{STATUS[a.status].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
