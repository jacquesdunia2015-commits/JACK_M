import { redirect } from 'next/navigation';
import BoutonDeconnexion from '@/components/BoutonDeconnexion';
import Navigation, { LienNav } from '@/components/Navigation';
import { apiSafe } from '@/lib/api';
import { readSession } from '@/lib/session';

const LIENS: LienNav[] = [
  { href: '/pharmacie', label: 'Tableau de bord', icone: '▤', groupe: 'Exploitation' },
  { href: '/pharmacie/caisse', label: 'Caisse', icone: '▦', groupe: 'Exploitation' },
  { href: '/pharmacie/stock', label: 'Stock et lots', icone: '▥', groupe: 'Exploitation' },
  { href: '/pharmacie/catalogue', label: 'Catalogue', icone: '▧', groupe: 'Exploitation' },
  { href: '/pharmacie/achats', label: 'Achats', icone: '▨', groupe: 'Approvisionnement' },
  { href: '/pharmacie/clients', label: 'Clients', icone: '▩', groupe: 'Commerce' },
  { href: '/pharmacie/b2b', label: 'Commandes B2B', icone: '▤', groupe: 'Commerce' },
  { href: '/pharmacie/utilisateurs', label: 'Équipe', icone: '▣', groupe: 'Administration' },
  { href: '/pharmacie/abonnement', label: 'Mon abonnement', icone: '▢', groupe: 'Administration' },
  { href: '/pharmacie/support', label: 'Support', icone: '▷', groupe: 'Administration' },
];

interface Onboarding {
  progressPercent: number;
  completed: number;
  total: number;
  nextStep: string | null;
}

export default async function LayoutPharmacie({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session) redirect('/connexion');
  if (session.space !== 'pharmacy') redirect('/admin');

  const onboarding = await apiSafe<Onboarding | null>('/onboarding', null);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">NP</span>
          <span>
            <span className="brand-name">NOVA PHARMA OS</span>
            <br />
            <span className="brand-sub">{session.organizationSlug}</span>
          </span>
        </div>
        <Navigation liens={LIENS} />
        {onboarding && onboarding.progressPercent < 100 && (
          <div className="small" style={{ marginTop: 'auto', padding: '0 0.4rem' }}>
            <div className="muted" style={{ marginBottom: '0.3rem' }}>
              Mise en route — {onboarding.completed}/{onboarding.total} étapes
            </div>
            <div className="bar">
              <span style={{ width: `${onboarding.progressPercent}%` }} />
            </div>
          </div>
        )}
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-context">
            <strong>{session.name}</strong>
            <span className="muted"> · {session.email}</span>
          </div>
          <div className="topbar-actions">
            {session.readonly && (
              <span className="tag danger">Compte en lecture seule</span>
            )}
            <BoutonDeconnexion />
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
