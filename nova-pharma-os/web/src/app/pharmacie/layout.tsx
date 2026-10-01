import { redirect } from 'next/navigation';
import BoutonDeconnexion from '@/components/BoutonDeconnexion';
import Logo from '@/components/Logo';
import Navigation, { LienNav } from '@/components/Navigation';
import SelecteurLangue from '@/components/SelecteurLangue';
import ServiceWorker from '@/components/ServiceWorker';
import { apiSafe } from '@/lib/api';
import { droits } from '@/lib/droits';
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

  const { peut, aModule } = await droits();
  // Chaque entrée n'apparaît qu'à qui peut s'en servir : son rôle et le
  // forfait de la pharmacie.
  const entrees: (LienNav & { droit?: string[]; module?: string })[] = [
    { href: '/pharmacie', label: t('nav.tableau_de_bord'), icone: '▤', groupe: t('nav.exploitation') },
    { href: '/pharmacie/caisse', label: t('nav.caisse'), icone: '▦', groupe: t('nav.exploitation'), droit: ['sales.create', 'cash.read'] },
    { href: '/pharmacie/stock', label: t('nav.stock'), icone: '▥', groupe: t('nav.exploitation'), droit: ['inventory.read'] },
    { href: '/pharmacie/catalogue', label: t('nav.catalogue'), icone: '▧', groupe: t('nav.exploitation'), droit: ['catalog.read'] },
    { href: '/pharmacie/rappels', label: t('nav.rappels'), icone: '▲', groupe: t('nav.exploitation'), droit: ['inventory.read'] },
    { href: '/pharmacie/rapports', label: t('nav.rapports'), icone: '▥', groupe: t('nav.exploitation'), droit: ['reporting.read'] },
    { href: '/pharmacie/depenses', label: t('nav.depenses'), icone: '▤', groupe: t('nav.exploitation'), droit: ['cash.read', 'reporting.financial'] },
    { href: '/pharmacie/achats', label: t('nav.achats'), icone: '▨', groupe: t('nav.approvisionnement'), droit: ['purchasing.read'], module: 'purchasing' },
    { href: '/pharmacie/fournisseurs', label: t('nav.fournisseurs'), icone: '▦', groupe: t('nav.approvisionnement'), droit: ['suppliers.read'] },
    { href: '/pharmacie/requisitions', label: t('nav.requisitions'), icone: '▤', groupe: t('nav.approvisionnement'), droit: ['suppliers.read'] },
    { href: '/pharmacie/factures', label: t('nav.factures'), icone: '▤', groupe: t('nav.commerce'), droit: ['sales.read'] },
    { href: '/pharmacie/reservations', label: t('nav.reservations'), icone: '▦', groupe: t('nav.commerce'), droit: ['sales.read'] },
    { href: '/pharmacie/clients', label: t('nav.clients'), icone: '▩', groupe: t('nav.commerce'), droit: ['customers.read'] },
    { href: '/pharmacie/tiers-payant', label: t('nav.tiers_payant'), icone: '▧', groupe: t('nav.commerce'), droit: ['customers.read'] },
    { href: '/pharmacie/traitements', label: t('nav.traitements'), icone: '▣', groupe: t('nav.commerce'), droit: ['customers.read'], module: 'customers' },
    { href: '/pharmacie/fidelite', label: t('nav.fidelite'), icone: '▤', groupe: t('nav.commerce'), droit: ['customers.read'], module: 'customers' },
    { href: '/pharmacie/b2b', label: t('nav.b2b'), icone: '▤', groupe: t('nav.commerce'), droit: ['b2b.read'], module: 'b2b' },
    { href: '/pharmacie/utilisateurs', label: t('nav.equipe'), icone: '▣', groupe: t('nav.administration'), droit: ['users.read'] },
    { href: '/pharmacie/abonnement', label: t('nav.abonnement'), icone: '▢', groupe: t('nav.administration'), droit: ['billing.read'] },
    { href: '/pharmacie/support', label: t('nav.support'), icone: '▷', groupe: t('nav.administration'), droit: ['support.read'] },
    { href: '/pharmacie/documentation', label: t('nav.documents'), icone: '▢', groupe: t('nav.administration') },
  ];
  const liens: LienNav[] = entrees
    .filter((e) => (!e.droit || peut(...e.droit)) && (!e.module || aModule(e.module)))
    .map(({ droit, module, ...lien }) => lien);


  return (
    <div className="shell">
      <ServiceWorker />
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
            {' '}<a href="/pharmacie/compte" className="small lien-compte">Mon compte</a>
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
