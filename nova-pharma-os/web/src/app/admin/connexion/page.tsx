import Link from 'next/link';
import FormulaireConnexion from '@/components/FormulaireConnexion';
import SelecteurLangue from '@/components/SelecteurLangue';
import { libellesConnexion, traduire } from '@/lib/i18n';

export const metadata = { title: 'Back-office — NOVA PHARMA OS' };

export default async function ConnexionAdmin() {
  const { t, langue } = await traduire();

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="auth-langue">
          <SelecteurLangue courante={langue.code} libelle={t('general.langue')} />
        </div>

        <div className="brand" style={{ marginBottom: '1.25rem', padding: 0 }}>
          <span className="brand-mark">NP</span>
          <span>
            <span className="brand-name">{t('app.nom')}</span>
            <br />
            <span className="brand-sub">{t('app.back_office')}</span>
          </span>
        </div>

        <h1>{t('connexion.titre_admin')}</h1>
        <p className="sous-titre">{t('connexion.sous_titre_admin')}</p>

        <FormulaireConnexion space="platform" libelles={libellesConnexion(t)} />

        <p className="auth-switch">
          {t('connexion.vers_pharmacie')}{' '}
          <Link href="/connexion">{t('app.espace_pharmacie')}</Link>
        </p>

        {!langue.revue && (
          <p className="small muted">{t('general.traduction_non_relue')}</p>
        )}
      </div>
    </main>
  );
}
