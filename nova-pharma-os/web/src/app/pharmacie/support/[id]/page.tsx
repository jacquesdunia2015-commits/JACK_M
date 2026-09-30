import Link from 'next/link';
import { notFound } from 'next/navigation';
import AccesReserve from '@/components/AccesReserve';
import FilTicket, { DetailTicket } from '@/components/FilTicket';
import { ReponseTicket } from '@/components/Tickets';
import { STATUTS_TICKET } from '@/lib/tickets';
import { apiSafe } from '@/lib/api';
import { droits } from '@/lib/droits';
import { dateTime } from '@/lib/format';
import { traduire } from '@/lib/i18n';

/** Un ticket de support : les échanges avec l'équipe NOVA PHARMA OS. */
export default async function PageTicket({ params }: { params: Promise<{ id: string }> }) {
  const { peut } = await droits();
  if (!peut('support.read')) return <AccesReserve titre={(await traduire()).t('nav.support')} />;
  const { id } = await params;
  const d = await apiSafe<DetailTicket | null>(`/account/support/tickets/${id}`, null);
  if (!d) notFound();
  const t = d.ticket;
  const clos = ['resolved', 'closed'].includes(t.status);
  return (
    <>
      <div className="page-head">
        <p className="small"><Link href="/pharmacie/support">← Support</Link></p>
        <h1>{t.subject}</h1>
        <p>
          <span className={`tag ${clos ? 'ok' : 'warn'}`}>{STATUTS_TICKET[t.status] ?? t.status}</span>{' '}
          <span className="mono">{t.reference}</span> · ouvert le {dateTime(t.created_at)}
          {t.sla_due_at && !clos ? ` · réponse attendue avant le ${dateTime(t.sla_due_at)}` : ''}
        </p>
      </div>
      <section className="card">
        <FilTicket messages={d.messages} espace="pharmacie" />
      </section>
      {peut('support.write') && t.status !== 'closed' && (
        <section className="card">
          <ReponseTicket ticketId={t.id} espace="pharmacie" statut={t.status} />
        </section>
      )}
    </>
  );
}
