import Etiquette from '@/components/Etiquette';
import Stat from '@/components/Stat';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { dateTime } from '@/lib/format';

interface Ticket {
  id: string; reference: string; subject: string; category: string;
  priority: string; status: string; sla_due_at: string | null;
  first_response_at: string | null; created_at: string;
  organization_name: string; organization_slug: string;
  assigned_to: string | null; messages: string;
}

interface Grant {
  id: string; reason: string; mode: string; status: string;
  agent_name: string | null; agent_email: string | null;
  requested_at: string; expires_at: string; actions: string;
}

export default async function PageSupportAdmin() {
  const [tickets, grants] = await Promise.all([
    apiSafe<Ticket[]>('/platform/support/tickets', []),
    apiSafe<Grant[]>('/platform/support/access-grants', []),
  ]);

  const ouverts = tickets.filter((t) => !['resolved', 'closed'].includes(t.status));
  const critiques = ouverts.filter((t) => t.priority === 'critical');
  const horsDelai = ouverts.filter(
    (t) => t.sla_due_at && new Date(t.sla_due_at) < new Date(),
  );
  const accesActifs = grants.filter((g) => g.status === 'active');

  return (
    <>
      <div className="page-head">
        <h1>Support</h1>
        <p>Tickets clients et accès temporaires aux données des pharmacies.</p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
        <Stat label="Tickets ouverts" valeur={ouverts.length} />
        <Stat
          label="Critiques"
          valeur={critiques.length}
          ton={critiques.length > 0 ? 'danger' : undefined}
        />
        <Stat
          label="Hors délai SLA"
          valeur={horsDelai.length}
          ton={horsDelai.length > 0 ? 'warn' : undefined}
        />
        <Stat label="Accès support actifs" valeur={accesActifs.length} />
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Tickets</h2>
          <span className="hint">Classés par priorité</span>
        </div>
        {tickets.length === 0 ? (
          <Vide message="Aucun ticket." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Pharmacie</th>
                  <th>Objet</th>
                  <th>Priorité</th>
                  <th>Statut</th>
                  <th>Assigné à</th>
                  <th className="num">Échéance SLA</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const depasse =
                    t.sla_due_at &&
                    new Date(t.sla_due_at) < new Date() &&
                    !['resolved', 'closed'].includes(t.status);
                  return (
                    <tr key={t.id}>
                      <td className="mono">{t.reference}</td>
                      <td className="small">{t.organization_name}</td>
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
                      <td className="small">{t.assigned_to ?? 'Non assigné'}</td>
                      <td className="num small">
                        {depasse ? (
                          <span className="tag danger">{dateTime(t.sla_due_at)}</span>
                        ) : (
                          dateTime(t.sla_due_at)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Accès aux données des pharmacies</h2>
          <span className="hint">
            Motivés, limités dans le temps, validés par le client et journalisés
          </span>
        </div>
        {grants.length === 0 ? (
          <Vide message="Aucun accès demandé." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Motif</th>
                  <th>Portée</th>
                  <th>Statut</th>
                  <th className="num">Demandé le</th>
                  <th className="num">Expire</th>
                  <th className="num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {grants.map((g) => (
                  <tr key={g.id}>
                    <td className="small">
                      {g.agent_name}
                      <br />
                      <span className="muted">{g.agent_email}</span>
                    </td>
                    <td className="small" style={{ maxWidth: 300 }}>
                      {g.reason}
                    </td>
                    <td>
                      <span className={`tag ${g.mode === 'read_only' ? '' : 'warn'}`}>
                        {g.mode === 'read_only' ? 'Lecture seule' : 'Lecture et écriture'}
                      </span>
                    </td>
                    <td>
                      <Etiquette statut={g.status} />
                    </td>
                    <td className="num small">{dateTime(g.requested_at)}</td>
                    <td className="num small">{dateTime(g.expires_at)}</td>
                    <td className="num">{g.actions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
