import Link from 'next/link';
import FormulaireInscription from '@/components/FormulaireInscription';
import Logo from '@/components/Logo';
import SelecteurLangue from '@/components/SelecteurLangue';
import { traduire } from '@/lib/i18n';

export const metadata = { title: 'Créer un compte — NOVA PHARMA OS' };

/**
 * Inscription publique d'une pharmacie.
 *
 * La personne crée son officine et son propre compte, dont elle devient
 * l'administratrice. Les comptes internes NOVA PHARMA OS ne se créent pas
 * ici : seul un super-administrateur peut en créer, depuis le back-office.
 */
export default async function Inscription() {
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

        <h1>{t('inscription.titre')}</h1>
        <p className="sous-titre">{t('inscription.sous_titre')}</p>

        <FormulaireInscription
          libelles={{
            officine: t('inscription.officine'),
            ville: t('inscription.ville'),
            nom: t('inscription.nom'),
            telephone: t('inscription.telephone'),
            aideTelephone: t('inscription.aide_telephone'),
            email: t('connexion.email'),
            motDePasse: t('connexion.mot_de_passe'),
            aideMotDePasse: t('inscription.aide_mot_de_passe'),
            confirmation: t('inscription.confirmation'),
            confirmationDifferente: t('inscription.confirmation_differente'),
            bouton: t('inscription.bouton'),
            enCours: t('inscription.en_cours'),
            echec: t('connexion.echec'),
            serviceInjoignable: t('connexion.service_injoignable'),
          }}
        />

        <p className="auth-switch">
          {t('inscription.deja_compte')}{' '}
          <Link href="/connexion">{t('inscription.vers_connexion')}</Link>
        </p>

        {!langue.revue && (
          <p className="small muted">{t('general.traduction_non_relue')}</p>
        )}
      </div>
    </main>
  );
}
