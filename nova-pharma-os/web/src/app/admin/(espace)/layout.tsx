import { redirect } from 'next/navigation';
import BoutonDeconnexion from '@/components/BoutonDeconnexion';
import Navigation, { LienNav } from '@/components/Navigation';
import { readSession } from '@/lib/session';

const LIENS: LienNav[] = [
  { href: '/admin', label: 'Tableau de bord', icone: '▤', groupe: 'Pilotage' },
  { href: '/admin/pharmacies', label: 'Pharmacies clientes', icone: '▥', groupe: 'Clients' },
  { href: '/admin/facturation', label: 'Facturation', icone: '▦', groupe: 'Commerce' },
  { href: '/admin/forfaits', label: 'Forfaits et options', icone: '▧', groupe: 'Commerce' },
  { href: '/admin/support', label: 'Support', icone: '▷', groupe: 'Exploitation' },
];

const ROLES: Record<string, string> = {
  super_admin: 'Super administrateur',
  support_admin: 'Administrateur support',
  commercial: 'Gestionnaire commercial',
};

/**
 * Enveloppe du back-office SaaS.
 *
 * Elle vit dans le groupe de routes `(espace)` — sans segment d'URL — pour
 * que la page de connexion, qui reste en dehors, ne soit pas soumise à ce
 * garde. Sans cette séparation, un visiteur non connecté serait renvoyé
 * vers `/admin/connexion`, qui déclencherait à nouveau le garde : une
 * boucle de redirection sans fin.
 */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect('/admin/connexion');
  if (session.space !== 'platform') redirect('/pharmacie');

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">NP</span>
          <span>
            <span className="brand-name">NOVA PHARMA OS</span>
            <br />
            <span className="brand-sub">Back-office SaaS</span>
          </span>
        </div>
        <Navigation liens={LIENS} />
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-context">
            <strong>{session.name}</strong>
            <span className="muted"> · {ROLES[session.role ?? ''] ?? session.role}</span>
          </div>
          <div className="topbar-actions">
            <BoutonDeconnexion />
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
