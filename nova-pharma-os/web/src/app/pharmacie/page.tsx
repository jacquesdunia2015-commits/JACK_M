import Link from 'next/link';
import Peremption from '@/components/Peremption';
import Stat from '@/components/Stat';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { droits } from '@/lib/droits';
import { date, money, percent, quantity } from '@/lib/format';
import { traduire } from '@/lib/i18n';
import { CLE_PEREMPTION, NIVEAUX_PEREMPTION, NiveauPeremption } from '@/lib/peremption';
import { readSession } from '@/lib/session';
import { deviseSession } from '@/lib/devise';

interface Dashboard {
  today: { sales: number; revenue: number; margin: number; averageBasket: number; creditSales: number };
  month: { sales: number; revenue: number; margin: number; marginPercent: number };
  stock: { units: number; value: number; productsInStock: number; expiredUnits: number; valueExpiring90Days: number };
  alerts: { outOfStock: number; lowStock: number; expiring: number; expired: number };
  receivables: { total: number; customers: number };
  cashSession: { registerCode: string; expectedCash: number; openedAt: string } | null;
  topProducts: { sku: string; name: string; quantity: number; revenue: number; margin: number }[];
  expiringSoon: {
    sku: string; name: string; lot_number: string; expiry_date: string;
    quantity: string; days_left: number; value_at_risk: string;
    expiry_level: NiveauPeremption | null;
  }[];
}

export default async function TableauDeBord() {
  const devise = await deviseSession();
  const session = await readSession();
  const { t } = await traduire();
  const [data, rappels] = await Promise.all([
    apiSafe<Dashboard | null>('/reports/dashboard', null),
    apiSafe<{ open: number; withStock: number; notQuarantined: number } | null>('/recalls/summary', null),
  ]);
  const libellesPeremption = Object.fromEntries(
    NIVEAUX_PEREMPTION.map((n) => [n, t(CLE_PEREMPTION[n])]),
  ) as Record<NiveauPeremption, string>;

  if (!data) {
    // Sans accès aux rapports (vendeur, caissier, livreur…), le tableau de
    // bord mène droit aux gestes du rôle.
    const { peut } = await droits();
    const raccourcis = [
      { href: '/pharmacie/caisse', label: t('nav.caisse'), droit: ['sales.create'] },
      { href: '/mobile/vente', label: `${t('nav.caisse')} · mobile`, droit: ['sales.create'] },
      { href: '/pharmacie/stock', label: t('nav.stock'), droit: ['inventory.read'] },
      { href: '/pharmacie/catalogue', label: t('nav.catalogue'), droit: ['catalog.read'] },
      { href: '/pharmacie/factures', label: t('nav.factures'), droit: ['sales.read'] },
      { href: '/pharmacie/clients', label: t('nav.clients'), droit: ['customers.read'] },
      { href: '/mobile/tournee', label: 'Tournée · mobile', droit: ['delivery.read'] },
      { href: '/pharmacie/documentation', label: t('nav.documents'), droit: [] },
    ].filter((r) => r.droit.length === 0 || peut(...r.droit));
    return (
      <>
        <div className="page-head">
          <h1>{t('bord.titre')}</h1>
          <p>{session?.name ? `${session.name} — ` : ''}{t('bord.raccourcis_role')}</p>
        </div>
        {raccourcis.length > 1 ? (
          <div className="grid grid-3">
            {raccourcis.map((r) => (
              <Link key={r.href} href={r.href} className="card raccourci">
                <strong>{r.label}</strong>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <Vide message={t('general.aucune_donnee')} />
        )}
      </>
    );
  }

  const alertesTotal =
    data.alerts.outOfStock + data.alerts.lowStock + data.alerts.expiring + data.alerts.expired;

  return (
    <>
      <div className="page-head">
        <h1>{t('bord.titre')}</h1>
        <p>{t('bord.sous_titre')}</p>
      </div>

      {session?.readonly && (
        <div className="banner danger">
          <strong>{t('general.abonnement_suspendu')}</strong>
          {t('general.message_suspension')}
        </div>
      )}

      {rappels && rappels.withStock > 0 && (
        <div className="banner danger">
          <strong>{rappels.withStock} {t('bord.rappels_en_cours')}</strong>{' '}
          <Link href="/pharmacie/rappels">{t('action.voir_detail')}</Link>
        </div>
      )}

      {alertesTotal > 0 && (
        <div className="banner warn">
          <strong>
            {alertesTotal} {t('bord.vigilance')}
          </strong>
          {data.alerts.outOfStock} {t('stock.rupture')} · {data.alerts.lowStock}{' '}
          {t('stock.stock_bas')} · {data.alerts.expiring} {t('stock.expire')} ·{' '}
          {data.alerts.expired} {t('stock.perime')}.{' '}
          <Link href="/pharmacie/stock">{t('action.voir_detail')}</Link>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
        <Stat
          label={t('bord.ventes_jour')}
          valeur={money(data.today.revenue, devise)}
          note={`${data.today.sales} ${t('bord.ventes')} · ${t('bord.panier_moyen')} ${money(data.today.averageBasket, devise)}`}
        />
        <Stat
          label={t('bord.marge_jour')}
          valeur={money(data.today.margin, devise)}
          note={`${t('bord.credit_accorde')} : ${money(data.today.creditSales, devise)}`}
          ton="ok"
        />
        <Stat
          label={t('bord.ca_mois')}
          valeur={money(data.month.revenue, devise)}
          note={`${t('catalogue.marge')} ${percent(data.month.marginPercent)} · ${data.month.sales} ${t('bord.ventes')}`}
        />
        <Stat
          label={t('bord.stock_valorise')}
          valeur={money(data.stock.value, devise)}
          note={`${quantity(data.stock.units)} ${t('bord.unites')} · ${data.stock.productsInStock} ${t('bord.references')}`}
        />
      </div>

      <div className="grid grid-3" style={{ marginBottom: '1.25rem' }}>
        <Stat
          label={t('bord.creances')}
          valeur={money(data.receivables.total, devise)}
          note={`${data.receivables.customers} ${t('bord.clients_debiteurs')}`}
          ton={data.receivables.total > 0 ? 'warn' : undefined}
        />
        <Stat
          label={t('bord.valeur_menacee')}
          valeur={money(data.stock.valueExpiring90Days, devise)}
          note={t('stock.expire')}
          ton={data.stock.valueExpiring90Days > 0 ? 'warn' : undefined}
        />
        <Stat
          label={t('bord.caisse')}
          valeur={data.cashSession ? money(data.cashSession.expectedCash, devise) : t('caisse.aucune_ouverte')}
          note={
            data.cashSession
              ? `${data.cashSession.registerCode} · ${t('caisse.ouverte_depuis')} ${date(data.cashSession.openedAt)}`
              : t('caisse.ouvrir_avant')
          }
        />
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head">
            <h2>{t('bord.meilleures_ventes')}</h2>
            <span className="hint">{t('bord.30_jours')}</span>
          </div>
          {data.topProducts.length === 0 ? (
            <Vide message={t('general.aucune_donnee')} />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('catalogue.produit')}</th>
                    <th className="num">{t('general.quantite')}</th>
                    <th className="num">{t('general.chiffre_affaires')}</th>
                    <th className="num">{t('catalogue.marge')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((p) => (
                    <tr key={p.sku}>
                      <td>
                        {p.name}
                        <br />
                        <span className="small muted mono">{p.sku}</span>
                      </td>
                      <td className="num">{quantity(p.quantity)}</td>
                      <td className="num">{money(p.revenue, devise)}</td>
                      <td className="num">{money(p.margin, devise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>{t('bord.peremptions')}</h2>
            <span className="hint">{t('bord.90_jours')}</span>
          </div>
          {data.expiringSoon.length === 0 ? (
            <Vide message={t('general.aucune_donnee')} />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('catalogue.produit')}</th>
                    <th>{t('general.lot')}</th>
                    <th className="num">{t('general.quantite')}</th>
                    <th className="num">{t('general.echeance')}</th>
                    <th className="num">{t('general.valeur')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expiringSoon.map((l) => (
                    <tr key={`${l.sku}-${l.lot_number}`}>
                      <td>{l.name}</td>
                      <td className="mono small">{l.lot_number}</td>
                      <td className="num">{quantity(l.quantity)}</td>
                      <td className="num">
                        <Peremption
                          date={l.expiry_date}
                          niveau={l.expiry_level}
                          jours={l.days_left}
                          libelles={libellesPeremption}
                          suffixeJours={t('stock.jours_abrege')}
                        />
                      </td>
                      <td className="num">{money(l.value_at_risk, devise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
