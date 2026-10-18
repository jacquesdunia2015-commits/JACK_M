import Link from 'next/link';
import AccesReserve from '@/components/AccesReserve';
import Depliable from '@/components/Depliable';
import { AnnulerDepense, FormulaireDepense, ReglagesFiscaux } from '@/components/Depenses';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { CATEGORIES_DEPENSE, MOYENS_DEPENSE, decalerMois, nomMois } from '@/lib/depenses';
import { deviseSession } from '@/lib/devise';
import { droits } from '@/lib/droits';
import { date, money } from '@/lib/format';
import { traduire } from '@/lib/i18n';

interface Benefice {
  month: string; currency: string; vatRegistered: boolean; inProgress: boolean; from: string; to: string;
  sales: { count: number; revenue: number; vat: number; revenueExclVat: number; cost: number; grossMargin: number };
  loyaltyRedeemed: number;
  stockLosses: { total: number; byKind: Record<string, number> };
  expenses: { total: number; byCategory: { category: string; label: string; count: number; amount: number; vatDeductible: number; cost: number }[] };
  netProfit: number; netMarginPercent: number;
  vat: null | {
    collected: number; deductibleOnExpenses: number; balance: number;
    expensesWithoutNormalizedInvoice: { count: number; vat: number }; salesWithoutNormalizedReference: number;
  };
  previous: { month: string; netProfit: number; grossMargin: number; expenses: number };
  series: { month: string; revenue: number; grossMargin: number; expenses: number; netProfit: number }[];
}

interface Depense {
  id: string; number: string; expense_date: string; category: string; label: string; supplier_name: string | null;
  amount: string; currency: string; amount_base: string; vat_amount: string; normalized_invoice: boolean;
  normalized_reference: string | null; payment_method: string; cash_session_id: string | null; created_by_name: string | null;
}

const PERTES: Record<string, string> = {
  expiry_write_off: 'Péremptions', damage: 'Casse', adjustment_out: 'Régularisations (sorties)',
  adjustment_in: 'Régularisations (entrées)', inventory: 'Écarts d’inventaire',
};

/**
 * Dépenses du mois et bénéfice réel : ce que la pharmacie gagne vraiment,
 * une fois retirés pertes, remises de fidélité et dépenses.
 */
export default async function PageDepenses({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const { peut } = await droits();
  const t = (await traduire()).t;
  if (!peut('cash.read') && !peut('reporting.financial')) return <AccesReserve titre={t('nav.depenses')} />;
  const devise = await deviseSession();
  const { mois: m } = await searchParams;
  const moisDemande = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : undefined;
  const voirBenefice = peut('reporting.financial');
  const [b, reglages, caisse, taux] = await Promise.all([
    voirBenefice ? apiSafe<Benefice | null>(`/reports/profit${moisDemande ? `?month=${moisDemande}` : ''}`, null) : Promise.resolve(null),
    voirBenefice ? apiSafe<{ vatRegistered: boolean; defNumber: string | null }>('/finance/settings', { vatRegistered: false, defNumber: null }) : Promise.resolve({ vatRegistered: false, defNumber: null }),
    apiSafe<{ session: { id: string } | null }>('/cash/current', { session: null }),
    apiSafe<{ courant: { base_currency: string; quote_currency: string; rate: string } | null }>('/cash/rates', { courant: null }),
  ]);
  const mois = moisDemande ?? b?.month ?? new Date().toISOString().slice(0, 7);
  const debut = `${mois}-01`;
  const fin = `${decalerMois(mois, 1)}-01`;
  const depenses = peut('cash.read')
    ? (await apiSafe<Depense[]>(`/expenses?from=${debut}&includeCancelled=false`, [])).filter((d) => String(d.expense_date).slice(0, 10) < fin)
    : [];
  const evolution = b ? b.netProfit - b.previous.netProfit : 0;

  return (
    <>
      <div className="page-head">
        <h1>Dépenses et bénéfice</h1>
        <p>Loyer, salaires, SNEL, carburant du groupe… Notez chaque dépense : NOVA calcule ce que la pharmacie gagne vraiment chaque mois.</p>
      </div>

      <div className="row" style={{ alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
        <Link className="btn secondaire petit" href={`/pharmacie/depenses?mois=${decalerMois(mois, -1)}`}>← {nomMois(decalerMois(mois, -1))}</Link>
        <strong style={{ fontSize: '1.1rem', textTransform: 'capitalize' }}>{nomMois(mois)}</strong>
        {!b?.inProgress && <Link className="btn secondaire petit" href={`/pharmacie/depenses?mois=${decalerMois(mois, 1)}`}>{nomMois(decalerMois(mois, 1))} →</Link>}
      </div>

      {b && (
        <>
          <div className="grid grid-3" style={{ marginBottom: '1.25rem' }}>
            <div className="stat">
              <div className="stat-label">Bénéfice réel{b.inProgress ? ' (mois en cours)' : ''}</div>
              <div className="stat-value" style={{ color: b.netProfit < 0 ? 'var(--alerte)' : undefined }}>{money(b.netProfit, devise)}</div>
              <div className="stat-note">
                {b.netMarginPercent.toLocaleString('fr-FR')} % du chiffre d’affaires HT ·{' '}
                {evolution >= 0 ? '+' : '−'}{money(Math.abs(evolution), devise)} par rapport à {nomMois(b.previous.month)}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Marge sur les ventes (HT)</div>
              <div className="stat-value">{money(b.sales.grossMargin, devise)}</div>
              <div className="stat-note">{b.sales.count} vente(s) · {money(b.sales.revenue, devise)} TTC</div>
            </div>
            <div className="stat">
              <div className="stat-label">Dépenses</div>
              <div className="stat-value">{money(b.expenses.total, devise)}</div>
              <div className="stat-note">{depenses.length} dépense(s) notée(s){b.vatRegistered ? ' · hors TVA récupérable' : ''}</div>
            </div>
          </div>

          <section className="card">
            <div className="card-head"><h2>Compte du mois</h2><span className="hint">Du {date(b.from)} au {date(b.to)}</span></div>
            <div className="table-wrap">
              <table className="compte-resultat">
                <tbody>
                  <tr><td>Chiffre d’affaires TTC</td><td className="num">{money(b.sales.revenue, devise)}</td></tr>
                  {b.sales.vat > 0 && <tr className="muted"><td>— TVA collectée</td><td className="num">−{money(b.sales.vat, devise)}</td></tr>}
                  <tr><td>Chiffre d’affaires hors taxes</td><td className="num">{money(b.sales.revenueExclVat, devise)}</td></tr>
                  <tr className="muted"><td>— Coût d’achat des médicaments vendus</td><td className="num">−{money(b.sales.cost, devise)}</td></tr>
                  <tr className="sous-total"><td>Marge sur les ventes</td><td className="num">{money(b.sales.grossMargin, devise)}</td></tr>
                  {b.loyaltyRedeemed > 0 && <tr className="muted"><td>— Points de fidélité utilisés</td><td className="num">−{money(b.loyaltyRedeemed, devise)}</td></tr>}
                  {Object.entries(b.stockLosses.byKind).filter(([, v]) => v !== 0).map(([k, v]) => (
                    <tr key={k} className="muted"><td>— {PERTES[k] ?? k}</td><td className="num">{v > 0 ? '−' : '+'}{money(Math.abs(v), devise)}</td></tr>
                  ))}
                  {b.expenses.byCategory.map((d) => (
                    <tr key={d.category} className="muted">
                      <td>— {d.label} <span className="small">({d.count})</span>{d.vatDeductible > 0 ? <span className="small"> · TVA récupérable {money(d.vatDeductible, devise)}</span> : null}</td>
                      <td className="num">−{money(d.cost, devise)}</td>
                    </tr>
                  ))}
                  <tr className="total"><td>Bénéfice réel</td><td className="num">{money(b.netProfit, devise)}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ marginBottom: 0 }}>
              Avant impôt sur les bénéfices. Les achats de médicaments ne sont pas des dépenses : ils comptent au moment de la vente, par leur coût d’achat.
            </p>
          </section>

          {b.vat && (
            <section className="card">
              <div className="card-head"><h2>TVA du mois (indicatif)</h2><span className="hint">À vérifier avec votre déclaration</span></div>
              <div className="table-wrap">
                <table className="compte-resultat">
                  <tbody>
                    <tr><td>TVA collectée sur les ventes</td><td className="num">{money(b.vat.collected, devise)}</td></tr>
                    <tr className="muted"><td>— TVA récupérable sur les dépenses avec facture normalisée</td><td className="num">{b.vat.deductibleOnExpenses > 0 ? "−" : ""}{money(b.vat.deductibleOnExpenses, devise)}</td></tr>
                    <tr className="total"><td>Solde</td><td className="num">{money(b.vat.balance, devise)}</td></tr>
                  </tbody>
                </table>
              </div>
              {b.vat.expensesWithoutNormalizedInvoice.count > 0 && (
                <div className="banner warn" style={{ marginTop: '0.75rem' }}>
                  {b.vat.expensesWithoutNormalizedInvoice.count} dépense(s) portent {money(b.vat.expensesWithoutNormalizedInvoice.vat, devise)} de TVA sans facture normalisée :
                  cette TVA n’est pas récupérable. Demandez une facture normalisée à vos fournisseurs.
                </div>
              )}
              {b.vat.salesWithoutNormalizedReference > 0 && (
                <div className="banner warn">
                  {b.vat.salesWithoutNormalizedReference} vente(s) du mois sans référence de facture normalisée. Émettez-la avec votre dispositif fiscal (e-MCF),
                  puis notez sa référence sur la page de la vente.
                </div>
              )}
              <p className="small muted" style={{ marginBottom: 0 }}>
                La TVA payée sur les achats de médicaments n’est pas encore suivie ici : le solde réel peut être plus bas.
              </p>
            </section>
          )}

          <section className="card">
            <div className="card-head"><h2>Six derniers mois</h2></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Mois</th><th className="num">Chiffre d’affaires</th><th className="num">Marge</th><th className="num">Dépenses</th><th className="num">Bénéfice réel</th></tr></thead>
                <tbody>
                  {b.series.map((s) => (
                    <tr key={s.month}>
                      <td style={{ textTransform: 'capitalize' }}><Link href={`/pharmacie/depenses?mois=${s.month}`}>{nomMois(s.month)}</Link></td>
                      <td className="num">{money(s.revenue, devise)}</td>
                      <td className="num">{money(s.grossMargin, devise)}</td>
                      <td className="num">{money(s.expenses, devise)}</td>
                      <td className="num"><strong style={{ color: s.netProfit < 0 ? 'var(--alerte)' : undefined }}>{money(s.netProfit, devise)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {peut('cash.manage') && (
        <section className="card">
          <Depliable resume="Noter une dépense" ouvert={depenses.length === 0}>
            <FormulaireDepense devise={devise} assujetti={reglages.vatRegistered} caisseOuverte={Boolean(caisse.session)} taux={taux.courant} />
          </Depliable>
        </section>
      )}

      {peut('cash.read') && (
        <section className="card">
          <div className="card-head"><h2>Dépenses de {nomMois(mois)}</h2></div>
          {depenses.length === 0 ? (
            <Vide message="Aucune dépense notée ce mois-ci." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Dépense</th><th>Catégorie</th><th>Payée par</th><th className="num">Montant</th><th>Facture</th><th /></tr></thead>
                <tbody>
                  {depenses.map((d) => (
                    <tr key={d.id}>
                      <td className="small">{date(d.expense_date)}<div className="mono muted">{d.number}</div></td>
                      <td>{d.label}{d.supplier_name && <div className="small muted">{d.supplier_name}</div>}</td>
                      <td className="small">{CATEGORIES_DEPENSE[d.category] ?? d.category}</td>
                      <td className="small">{MOYENS_DEPENSE[d.payment_method] ?? d.payment_method}{d.cash_session_id ? ' · caisse' : ''}</td>
                      <td className="num">
                        {money(d.amount, d.currency)}
                        {d.currency !== devise && <div className="small muted">{money(d.amount_base, devise)}</div>}
                      </td>
                      <td className="small">
                        {d.normalized_invoice ? <span className="tag ok" title={d.normalized_reference ?? ''}>Normalisée</span> : <span className="muted">—</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>{peut('cash.manage') && <AnnulerDepense id={d.id} numero={d.number} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {peut('settings.write') && (
        <section className="card">
          <Depliable resume="Régime fiscal et facture normalisée" ouvert={false}>
            <p className="small" style={{ marginTop: 0 }}>
              Depuis le 1er décembre 2025, toute entreprise assujettie à la TVA doit délivrer des <strong>factures normalisées</strong>, émises par un
              système de facturation homologué par la DGI et relié à un dispositif électronique fiscal (MCF, ou e-MCF gratuit de la DGI). Les sanctions
              s’appliquent depuis le 15 mai 2026. NOVA n’est pas encore un système homologué : émettez la facture normalisée avec votre dispositif,
              puis notez sa référence sur la vente — NOVA la reporte sur la facture et le ticket. Une pharmacie non assujettie n’est pas concernée.
            </p>
            <ReglagesFiscaux assujetti={reglages.vatRegistered} numeroDef={reglages.defNumber} />
          </Depliable>
        </section>
      )}
    </>
  );
}
