import { redirect } from 'next/navigation';
import BoutonDeconnexion from '@/components/BoutonDeconnexion';
import Navigation, { LienNav } from '@/components/Navigation';
import SelecteurLangue from '@/components/SelecteurLangue';
import { traduire } from '@/lib/i18n';
import { readSession } from '@/lib/session';

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

  const { t, langue } = await traduire();

  const liens: LienNav[] = [
    { href: '/admin', label: t('nav.tableau_de_bord'), icone: '▤', groupe: t('nav.pilotage') },
    { href: '/admin/pharmacies', label: t('nav.pharmacies'), icone: '▥', groupe: t('nav.clients_menu') },
    { href: '/admin/facturation', label: t('nav.facturation'), icone: '▦', groupe: t('nav.commerce') },
    { href: '/admin/forfaits', label: t('nav.forfaits'), icone: '▧', groupe: t('nav.commerce') },
    { href: '/admin/support', label: t('nav.support'), icone: '▷', groupe: t('nav.exploitation') },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">NP</span>
          <span>
            <span className="brand-name">{t('app.nom')}</span>
            <br />
            <span className="brand-sub">{t('app.back_office')}</span>
          </span>
        </div>
        <Navigation liens={liens} />
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-context">
            <strong>{session.name}</strong>
            <span className="muted"> · {ROLES[session.role ?? ''] ?? session.role}</span>
          </div>
          <div className="topbar-actions">
            <SelecteurLangue courante={langue.code} libelle={t('general.langue')} />
            <BoutonDeconnexion libelle={t('connexion.deconnexion')} />
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
