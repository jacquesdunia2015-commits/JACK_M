import TourneeMobile, { Livraison } from '@/components/TourneeMobile';
import { apiSafe } from '@/lib/api';
import { traduire } from '@/lib/i18n';

export default async function PageTournee() {
  const { t } = await traduire();
  const livraisons = await apiSafe<Livraison[]>('/deliveries/my-route', []);

  return (
    <>
      <h1 className="mob-titre">{t('mobile.tournee')}</h1>
      <TourneeMobile
        livraisons={livraisons}
        libelles={{
          aucune: t('mobile.aucune_livraison'),
          prisEnCharge: t('mobile.pris_en_charge'),
          enRoute: t('mobile.en_route'),
          livre: t('mobile.livre'),
          echec: t('mobile.echec_livraison'),
          recuPar: t('mobile.recu_par'),
          montantEncaisse: t('mobile.montant_encaisse'),
          confirmer: t('mobile.confirmer'),
          appeler: t('mobile.appeler'),
        }}
      />
    </>
  );
}
