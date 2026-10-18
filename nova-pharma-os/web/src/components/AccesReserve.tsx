import Link from 'next/link';
import { traduire } from '@/lib/i18n';

/** Page ouverte sans le droit nécessaire : on le dit, plutôt qu'une liste vide. */
export default async function AccesReserve({ titre }: { titre: string }) {
  const { t } = await traduire();
  return (
    <>
      <div className="page-head">
        <h1>{titre}</h1>
      </div>
      <div className="banner warn">
        <strong>{t('general.acces_reserve')}</strong>
        {t('general.acces_reserve_detail')}
      </div>
      <p><Link href="/pharmacie">← {t('nav.tableau_de_bord')}</Link></p>
    </>
  );
}
