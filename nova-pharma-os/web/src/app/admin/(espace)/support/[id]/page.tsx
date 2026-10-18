import Link from 'next/link';
import { notFound } from 'next/navigation';
import FilTicket, { DetailTicket } from '@/components/FilTicket';
import { ReponseTicket } from '@/components/Tickets';
import { STATUTS_TICKET } from '@/lib/tickets';
import { apiSafe } from '@/lib/api';
import { dateTime } from '@/lib/format';

/** Un ticket vu par l'équipe NOVA PHARMA OS : réponse, note interne, statut. */
export default async function PageTicketPlateforme({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await apiSafe<DetailTicket | null>(`/platform/support/tickets/${id}`, null);
  if (!d) notFound();
  const t = d.ticket;
  return (
    <>
      <div className="page-head">
        <p className="small"><Link href="/admin/support">← Support</Link></p>
        <h1>{t.subject}</h1>
        <p>
          <span className="tag">{STATUTS_TICKET[t.status] ?? t.status}</span>{' '}
          <span className="mono">{t.reference}</span> · {t.organization_name ?? ''} · priorité {t.priority} · ouvert le {dateTime(t.created_at)}
          {t.sla_due_at ? ` · échéance ${dateTime(t.sla_due_at)}` : ''}
        </p>
      </div>
      <section className="card">
        <FilTicket messages={d.messages} espace="plateforme" />
      </section>
      <section className="card">
        <ReponseTicket ticketId={t.id} espace="plateforme" statut={t.status} />
      </section>
    </>
  );
}
