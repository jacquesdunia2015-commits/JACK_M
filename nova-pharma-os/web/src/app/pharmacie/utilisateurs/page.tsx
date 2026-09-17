import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { dateTime } from '@/lib/format';

interface Utilisateur {
  id: string; email: string; full_name: string; phone: string | null;
  is_owner: boolean; is_active: boolean; last_login_at: string | null;
  default_branch_name: string | null; roles: string[]; branches: string[];
}

interface Role {
  id: string; code: string; name: string; description: string | null;
  is_system: boolean; permissions: string[]; users: string;
}

export default async function PageUtilisateurs() {
  const [utilisateurs, roles] = await Promise.all([
    apiSafe<Utilisateur[]>('/admin/users', []),
    apiSafe<Role[]>('/admin/roles', []),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Équipe</h1>
        <p>Comptes, rôles et permissions de la pharmacie.</p>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Utilisateurs</h2>
          <span className="hint">{utilisateurs.length} compte(s)</span>
        </div>
        {utilisateurs.length === 0 ? (
          <Vide message="Aucun utilisateur." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Adresse e-mail</th>
                  <th>Rôles</th>
                  <th>Branches</th>
                  <th>Statut</th>
                  <th className="num">Dernière connexion</th>
                </tr>
              </thead>
              <tbody>
                {utilisateurs.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.full_name}
                      {u.is_owner && (
                        <span className="tag ok" style={{ marginLeft: '0.4rem' }}>
                          Administrateur
                        </span>
                      )}
                    </td>
                    <td className="small">{u.email}</td>
                    <td className="small">
                      {u.roles.length > 0 ? u.roles.join(', ') : '—'}
                    </td>
                    <td className="small">{u.branches.join(', ') || '—'}</td>
                    <td>
                      <span className={`tag ${u.is_active ? 'ok' : 'danger'}`}>
                        {u.is_active ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="num small">{dateTime(u.last_login_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Rôles</h2>
          <span className="hint">Les rôles livrés couvrent l&apos;organisation courante d&apos;une officine</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rôle</th>
                <th>Description</th>
                <th className="num">Permissions</th>
                <th className="num">Utilisateurs</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.name}
                    <br />
                    <span className="small muted mono">{r.code}</span>
                  </td>
                  <td className="small">{r.description}</td>
                  <td className="num">{r.permissions.length}</td>
                  <td className="num">{r.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
