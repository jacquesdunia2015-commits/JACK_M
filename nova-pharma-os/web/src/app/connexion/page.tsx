import Link from 'next/link';
import FormulaireConnexion from '@/components/FormulaireConnexion';
import Logo from '@/components/Logo';
import SelecteurLangue from '@/components/SelecteurLangue';
import { libellesConnexion, traduire } from '@/lib/i18n';

export const metadata = { title: 'Connexion — NOVA PHARMA OS' };

export default async function Connexion() {
  const { t, langue } = await traduire();

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="auth-langue">
          <SelecteurLangue courante={langue.code} libelle={t('general.langue')} />
        </div>

        <div className="brand" style={{ marginBottom: '1.25rem', padding: 0 }}>
          <Logo taille={40} />
          <span>
            <span className="brand-name">{t('app.nom')}</span>
            <br />
            <span className="brand-sub">{t('app.espace_pharmacie')}</span>
          </span>
        </div>

        <h1>{t('connexion.titre')}</h1>
        <p className="sous-titre">{t('connexion.sous_titre')}</p>

        <FormulaireConnexion space="pharmacy" libelles={libellesConnexion(t)} />

        <p className="auth-switch">
          {t('connexion.vers_admin')}{' '}
          <Link href="/admin/connexion">{t('app.back_office')}</Link>
        </p>

        {!langue.revue && (
          <p className="small muted">{t('general.traduction_non_relue')}</p>
        )}
      </div>
    </main>
  );
}
