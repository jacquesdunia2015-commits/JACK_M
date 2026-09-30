import { redirect } from 'next/navigation';
import FormulaireCompte from '@/components/FormulaireCompte';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { readSession } from '@/lib/session';

interface UtilisateurInterne {
  id: string; email: string; full_name: string; phone: string | null;
  role: string; is_active: boolean; last_login_at: string | null;
}

const ROLES = [
  { code: 'support_admin', libelle: 'Administrateur support' },
  { code: 'commercial', libelle: 'Gestionnaire commercial' },
  { code: 'super_admin', libelle: 'Super administrateur' },
];

/**
 * Comptes internes NOVA PHARMA OS.
 *
 * Il n'existe pas d'inscription publique pour ces comptes : ils donnent
 * accès à toutes les pharmacies clientes, seul un super-administrateur
 * peut donc en créer. L'API applique la même règle ; la redirection
 * évite seulement d'afficher une page vide aux autres rôles.
 */
export default async function PageUtilisateursInternes() {
  const session = await readSession();
  if (session?.role !== 'super_admin') redirect('/admin');

  const utilisateurs = await apiSafe<UtilisateurInterne[]>('/platform/users', []);
  const libelle = (code: string) => ROLES.find((r) => r.code === code)?.libelle ?? code;

  return (
    <>
      <div className="page-head">
        <h1>Équipe NOVA PHARMA OS</h1>
        <p>Comptes internes du back-office : super-administrateurs, support et commerciaux.</p>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Créer un compte interne</h2>
          <span className="hint">Accès à toutes les pharmacies : à réserver aux personnes de confiance</span>
        </div>
        <FormulaireCompte destination="/api/proxy/platform/users" champRole="role" roles={ROLES} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Comptes internes</h2>
          <span className="hint">{utilisateurs.length} compte(s)</span>
        </div>
        {utilisateurs.length === 0 ? (
          <Vide message="Aucun compte interne." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Adresse e-mail</th>
                  <th>Téléphone</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th className="num">Dernière connexion</th>
                </tr>
              </thead>
              <tbody>
                {utilisateurs.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td className="small">{u.email}</td>
                    <td className="small mono">{u.phone ?? '—'}</td>
                    <td className="small">{libelle(u.role)}</td>
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
    </>
  );
}
