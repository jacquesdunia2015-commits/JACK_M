import Caisse from '@/components/Caisse';
import OuvertureCaisse from '@/components/OuvertureCaisse';
import { apiSafe } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { traduire } from '@/lib/i18n';
import { readSession } from '@/lib/session';

interface EtatCaisse {
  session: {
    id: string; register_code: string; expected_cash: string;
    opening_float: string; currency: string; opened_at: string;
    opened_by_name: string | null;
  } | null;
  summary: {
    sales: string; refunds: string; cash_in: string; cash_out: string; movements: string;
  } | null;
}

export default async function PageCaisse() {
  const session = await readSession();
  const { t } = await traduire();
  const etat = await apiSafe<EtatCaisse>('/cash/current', { session: null, summary: null });

  return (
    <>
      <div className="page-head">
        <h1>{t('caisse.titre')}</h1>
        <p>{t('caisse.sous_titre')}</p>
      </div>

      {etat.session ? (
        <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
          <div className="stat">
            <div className="stat-label">{t('caisse.attendu')}</div>
            <div className="stat-value">{money(etat.session.expected_cash)}</div>
            <div className="stat-note">
              {t('caisse.fonds_initial')} {money(etat.session.opening_float)}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">{t('caisse.ventes_encaissees')}</div>
            <div className="stat-value">{money(etat.summary?.sales)}</div>
            <div className="stat-note">{etat.summary?.movements ?? 0} mouvement(s)</div>
          </div>
          <div className="stat">
            <div className="stat-label">{t('caisse.sorties')}</div>
            <div className="stat-value">{money(etat.summary?.cash_out)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">{t('caisse.ouverte_depuis')}</div>
            <div className="stat-value" style={{ fontSize: '1rem' }}>
              {dateTime(etat.session.opened_at)}
            </div>
            <div className="stat-note">{etat.session.opened_by_name ?? '—'}</div>
          </div>
        </div>
      ) : null}

      <OuvertureCaisse
        sessionOuverte={etat.session}
        lectureSeule={Boolean(session?.readonly)}
      />

      <Caisse sessionCaisse={etat.session} lectureSeule={Boolean(session?.readonly)} />
    </>
  );
}
