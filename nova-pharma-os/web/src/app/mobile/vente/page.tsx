import VenteMobile from '@/components/VenteMobile';
import { traduire } from '@/lib/i18n';
import { readSession } from '@/lib/session';

export default async function PageVenteMobile() {
  const session = await readSession();
  const { t } = await traduire();

  return (
    <>
      <h1 className="mob-titre">{t('mobile.vendre')}</h1>
      <VenteMobile
        lectureSeule={Boolean(session?.readonly)}
        libelles={{
          rechercher: t('caisse.rechercher_produit'),
          aide: t('caisse.aide_recherche'),
          ticket: t('caisse.ticket'),
          ticketVide: t('caisse.ticket_vide'),
          total: t('caisse.total'),
          moyen: t('caisse.moyen_paiement'),
          especes: t('paiement.especes'),
          mobileMoney: t('paiement.mobile_money'),
          credit: t('paiement.credit'),
          encaisser: t('action.encaisser'),
          enregistrement: t('caisse.enregistrement'),
          aucunProduit: t('caisse.aucun_produit'),
          venteEnregistree: t('mobile.vente_enregistree'),
          patient: t('caisse.patient'),
          prescripteur: t('caisse.prescripteur'),
          ordonnanceRequise: t('caisse.ordonnance_requise'),
          encaisserMm: t('mobile.encaisser_mm'),
          referenceOperateur: t('mobile.reference_operateur'),
          confirmer: t('mobile.confirmer'),
          envoyerRecu: t('mobile.envoyer_recu'),
          ouvrirWhatsapp: t('mobile.ouvrir_whatsapp'),
          telephone: t('general.telephone'),
          lectureSeule: t('general.message_suspension'),
        }}
      />
    </>
  );
}
