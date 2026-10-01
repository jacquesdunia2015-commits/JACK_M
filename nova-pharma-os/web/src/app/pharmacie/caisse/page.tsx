import Caisse from '@/components/Caisse';
import OuvertureCaisse from '@/components/OuvertureCaisse';
import TauxDuJour from '@/components/TauxDuJour';
import { TauxDuJour as Taux, autreDevise } from '@/lib/devises';
import { apiSafe } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { traduire } from '@/lib/i18n';
import { readSession } from '@/lib/session';
import AccesReserve from '@/components/AccesReserve';
import { droits } from '@/lib/droits';
import { deviseSession } from '@/lib/devise';

interface EtatCaisse {
  session: {
    id: string; register_code: string; expected_cash: string;
    opening_float: string; currency: string; opened_at: string;
    opened_by_name: string | null;
  } | null;
  summary: {
    sales: string; refunds: string; cash_in: string; cash_out: string; movements: string;
  } | null;
  currencies?: {
    currency: string; opening_float: string; expected_cash: string;
    summary: { sales: string; cash_out: string };
  }[];
}

export default async function PageCaisse() {
  const devise = await deviseSession();
  if (!(await droits()).peut('sales.create')) return <AccesReserve titre={(await traduire()).t('nav.caisse')} />;
  const session = await readSession();
  const { t } = await traduire();
  const { peut } = await droits();
  const [etat, taux] = await Promise.all([
    apiSafe<EtatCaisse>('/cash/current', { session: null, summary: null }),
    apiSafe<{ courant: Taux | null }>('/cash/rates', { courant: null }),
  ]);
  const autre = autreDevise(taux.courant, devise);

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
            <div className="stat-value">{money(etat.session.expected_cash, devise)}</div>
            {(etat.currencies ?? []).map((c) => (
              <div key={c.currency} className="stat-value" style={{ fontSize: '1.05rem' }}>
                + {money(c.expected_cash, c.currency)}
              </div>
            ))}
            <div className="stat-note">
              {t('caisse.fonds_initial')} {money(etat.session.opening_float, devise)}
              {(etat.currencies ?? []).map((c) => ` + ${money(c.opening_float, c.currency)}`).join('')}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">{t('caisse.ventes_encaissees')}</div>
            <div className="stat-value">{money(etat.summary?.sales, devise)}</div>
            {(etat.currencies ?? []).map((c) => (
              <div key={c.currency} className="stat-value" style={{ fontSize: '1.05rem' }}>
                + {money(c.summary.sales, c.currency)}
              </div>
            ))}
            <div className="stat-note">{etat.summary?.movements ?? 0} mouvement(s)</div>
          </div>
          <div className="stat">
            <div className="stat-label">{t('caisse.sorties')}</div>
            <div className="stat-value">{money(etat.summary?.cash_out, devise)}</div>
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

      <TauxDuJour devise={devise} taux={taux.courant} modifiable={peut('cash.manage') && !session?.readonly} />

      <OuvertureCaisse
        devise={devise}
        autre={autre}
        autresDevises={etat.currencies ?? []}
        sessionOuverte={etat.session}
        lectureSeule={Boolean(session?.readonly)}
      />

      <Caisse sessionCaisse={etat.session} lectureSeule={Boolean(session?.readonly)} devise={devise} taux={taux.courant} />
    </>
  );
}
