import AccesSupport, { Grant } from '@/components/AccesSupport';
import Etiquette from '@/components/Etiquette';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { dateTime } from '@/lib/format';

interface Ticket {
  id: string; reference: string; subject: string; category: string;
  priority: string; status: string; created_at: string;
  sla_due_at: string | null; messages: string; assigned_to: string | null;
}

interface Article {
  slug: string; title: string; category: string; kind: string; excerpt: string;
}

export default async function PageSupport() {
  const [tickets, grants, kb] = await Promise.all([
    apiSafe<Ticket[]>('/account/support/tickets', []),
    apiSafe<Grant[]>('/account/support-access', []),
    apiSafe<Article[]>('/account/support/knowledge-base', []),
  ]);

  const enAttente = grants.filter((g) => g.status === 'requested');

  return (
    <>
      <div className="page-head">
        <h1>Support</h1>
        <p>Tickets, base de connaissances et contrôle des accès de l&apos;éditeur.</p>
      </div>

      {enAttente.length > 0 && (
        <div className="banner warn">
          <strong>
            {enAttente.length} demande(s) d&apos;accès du support en attente de votre accord
          </strong>
          Aucun agent NOVA PHARMA OS ne peut consulter vos données sans votre
          autorisation. Chaque intervention est journalisée et révocable.
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Accès du support à vos données</h2>
          <span className="hint">Demandes, interventions en cours et historique</span>
        </div>
        <AccesSupport grants={grants} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Mes tickets</h2>
          <span className="hint">{tickets.length} ticket(s)</span>
        </div>
        {tickets.length === 0 ? (
          <Vide message="Aucun ticket ouvert." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Objet</th>
                  <th>Priorité</th>
                  <th>Statut</th>
                  <th>Assigné à</th>
                  <th className="num">Échéance SLA</th>
                  <th className="num">Messages</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td className="mono">{t.reference}</td>
                    <td>{t.subject}</td>
                    <td>
                      <span
                        className={`tag ${
                          t.priority === 'critical'
                            ? 'danger'
                            : t.priority === 'high'
                              ? 'warn'
                              : ''
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <Etiquette statut={t.status} />
                    </td>
                    <td className="small">{t.assigned_to ?? '—'}</td>
                    <td className="num small">{dateTime(t.sla_due_at)}</td>
                    <td className="num">{t.messages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Base de connaissances</h2>
        </div>
        {kb.length === 0 ? (
          <Vide message="Aucun article disponible." />
        ) : (
          <div className="grid grid-2">
            {kb.map((a) => (
              <div key={a.slug} style={{ padding: '0.75rem 0' }}>
                <span className="tag">{a.category}</span>
                <h3 style={{ marginTop: '0.4rem' }}>{a.title}</h3>
                <p className="small muted">{a.excerpt}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
