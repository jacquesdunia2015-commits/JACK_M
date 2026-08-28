import Link from 'next/link';
import { apiSafe } from '@/lib/api';
import { money } from '@/lib/format';
import { traduire } from '@/lib/i18n';

interface Dashboard {
  today: { sales: number; revenue: number; averageBasket: number };
  alerts: { outOfStock: number; lowStock: number; expiring: number; expired: number };
  cashSession: { registerCode: string; expectedCash: number } | null;
}

interface Livraison {
  id: string;
  number: string;
  status: string;
  contact_name: string | null;
  address: string | null;
}

export default async function AccueilMobile() {
  const { t } = await traduire();
  const [bord, tournee] = await Promise.all([
    apiSafe<Dashboard | null>('/reports/dashboard', null),
    apiSafe<Livraison[]>('/deliveries/my-route', []),
  ]);

  const alertes = bord
    ? bord.alerts.outOfStock + bord.alerts.lowStock + bord.alerts.expiring + bord.alerts.expired
    : 0;

  return (
    <>
      <h1 className="mob-titre">{t('mobile.aujourdhui')}</h1>

      <div className="mob-chiffres">
        <div className="mob-chiffre">
          <span className="mob-chiffre-valeur">{money(bord?.today.revenue ?? 0)}</span>
          <span className="mob-chiffre-note">{t('bord.ventes_jour')}</span>
        </div>
        <div className="mob-chiffre">
          <span className="mob-chiffre-valeur">{bord?.today.sales ?? 0}</span>
          <span className="mob-chiffre-note">{t('bord.ventes')}</span>
        </div>
        <div className="mob-chiffre">
          <span className="mob-chiffre-valeur">
            {bord?.cashSession ? money(bord.cashSession.expectedCash) : '—'}
          </span>
          <span className="mob-chiffre-note">{t('bord.caisse')}</span>
        </div>
        <div className={`mob-chiffre${alertes > 0 ? ' alerte' : ''}`}>
          <span className="mob-chiffre-valeur">{alertes}</span>
          <span className="mob-chiffre-note">{t('stock.alertes_ouvertes')}</span>
        </div>
      </div>

      <Link className="mob-bouton" href="/mobile/vente">
        {t('mobile.vendre')}
      </Link>

      <h2 className="mob-sous-titre">{t('mobile.tournee')}</h2>
      {tournee.length === 0 ? (
        <p className="mob-vide">{t('mobile.aucune_livraison')}</p>
      ) : (
        <ul className="mob-liste">
          {tournee.slice(0, 5).map((l) => (
            <li key={l.id}>
              <Link href="/mobile/tournee">
                <strong>{l.contact_name ?? l.number}</strong>
                <span className="mob-note">{l.address ?? l.number}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
