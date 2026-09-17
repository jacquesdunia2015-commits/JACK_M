import { redirect } from 'next/navigation';
import BoutonDeconnexion from '@/components/BoutonDeconnexion';
import Logo from '@/components/Logo';
import Navigation, { LienNav } from '@/components/Navigation';
import SelecteurLangue from '@/components/SelecteurLangue';
import { apiSafe } from '@/lib/api';
import { traduire } from '@/lib/i18n';
import { readSession } from '@/lib/session';

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

  const { t, langue } = await traduire();
  const onboarding = await apiSafe<Onboarding | null>('/onboarding', null);

  const liens: LienNav[] = [
    { href: '/pharmacie', label: t('nav.tableau_de_bord'), icone: '▤', groupe: t('nav.exploitation') },
    { href: '/pharmacie/caisse', label: t('nav.caisse'), icone: '▦', groupe: t('nav.exploitation') },
    { href: '/pharmacie/stock', label: t('nav.stock'), icone: '▥', groupe: t('nav.exploitation') },
    { href: '/pharmacie/catalogue', label: t('nav.catalogue'), icone: '▧', groupe: t('nav.exploitation') },
    { href: '/pharmacie/achats', label: t('nav.achats'), icone: '▨', groupe: t('nav.approvisionnement') },
    { href: '/pharmacie/clients', label: t('nav.clients'), icone: '▩', groupe: t('nav.commerce') },
    { href: '/pharmacie/b2b', label: t('nav.b2b'), icone: '▤', groupe: t('nav.commerce') },
    { href: '/pharmacie/utilisateurs', label: t('nav.equipe'), icone: '▣', groupe: t('nav.administration') },
    { href: '/pharmacie/abonnement', label: t('nav.abonnement'), icone: '▢', groupe: t('nav.administration') },
    { href: '/pharmacie/support', label: t('nav.support'), icone: '▷', groupe: t('nav.administration') },
    { href: '/pharmacie/documentation', label: t('nav.documents'), icone: '▢', groupe: t('nav.administration') },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <span>
            <span className="brand-name">{t('app.nom')}</span>
            <br />
            <span className="brand-sub">{session.organizationSlug}</span>
          </span>
        </div>
        <Navigation liens={liens} />
        {onboarding && onboarding.progressPercent < 100 && (
          <div className="small" style={{ marginTop: 'auto', padding: '0 0.4rem' }}>
            <div className="muted" style={{ marginBottom: '0.3rem' }}>
              {t('general.mise_en_route')} — {onboarding.completed}/{onboarding.total}{' '}
              {t('general.etapes')}
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
              <span className="tag danger">{t('general.lecture_seule')}</span>
            )}
            <SelecteurLangue courante={langue.code} libelle={t('general.langue')} />
            <BoutonDeconnexion libelle={t('connexion.deconnexion')} />
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
