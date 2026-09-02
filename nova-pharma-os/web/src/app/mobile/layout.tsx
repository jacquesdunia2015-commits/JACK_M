import Link from 'next/link';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import ServiceWorker from '@/components/ServiceWorker';
import { traduire } from '@/lib/i18n';
import { readSession } from '@/lib/session';

/**
 * Enveloppe de l'application mobile — celle qu'un vendeur ou un livreur
 * installe sur son téléphone.
 *
 * Ce n'est pas l'écran de bureau rétréci : les vendeurs travaillent
 * debout, d'une main, souvent sous le soleil. Les cibles sont larges,
 * les écrans font une chose à la fois, et la navigation tient en bas de
 * l'écran, là où le pouce arrive.
 */
export default async function LayoutMobile({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session) redirect('/connexion');
  if (session.space !== 'pharmacy') redirect('/admin');

  const { t } = await traduire();

  return (
    <div className="mob">
      <ServiceWorker />
      <header className="mob-entete">
        <span className="mob-marque">
          <Logo taille={26} />
          NOVA
        </span>
        <span className="mob-qui">{session.name}</span>
      </header>

      <main className="mob-contenu">{children}</main>

      <nav className="mob-nav">
        <Link href="/mobile">
          <span aria-hidden>▤</span>
          {t('bord.titre')}
        </Link>
        <Link href="/mobile/vente">
          <span aria-hidden>▦</span>
          {t('nav.caisse')}
        </Link>
        <Link href="/mobile/stock">
          <span aria-hidden>▥</span>
          {t('nav.stock')}
        </Link>
        <Link href="/mobile/tournee">
          <span aria-hidden>▷</span>
          {t('mobile.tournee')}
        </Link>
      </nav>
    </div>
  );
}
