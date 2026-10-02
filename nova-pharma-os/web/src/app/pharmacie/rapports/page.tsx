import Link from 'next/link';
import AccesReserve from '@/components/AccesReserve';
import GraphiqueJours from '@/components/GraphiqueJours';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { deviseSession } from '@/lib/devise';
import { droits } from '@/lib/droits';
import { money, percent, quantity } from '@/lib/format';
import { traduire } from '@/lib/i18n';
import { joursEntre, periodes, valide } from '@/lib/periodes';

interface Synthese {
  sales: number; revenue: number; tax: number; cost: number; margin: number; marginPercent: number;
  averageBasket: number; payerShare: number; discounts: number; offlineSales: number;
  cancelled: { count: number; total: number }; currency: string;
}
interface LigneVentes {
  dimension: string; sales: string; quantity: string; revenue: string; tax: string; cost: string;
  margin: string; margin_percent: string;
}
interface LignePaiement { method: string; currency: string; payments: string; tendered: string; amount: string }
interface LigneStock {
  category: string; products: string; units: string; cost_value: string; retail_value: string;
  potential_margin: string; at_risk_90d: string | null;
}
interface LigneRotation {
  sku: string; name: string; on_hand: string; tied_up_capital: string; sold: string;
  rotation: string | null; classification: string;
}
interface Peremptions {
  writtenOff: { occurred_at: string; sku: string; name: string; lot_number: string | null; quantity: string; value: string; reason: string | null }[];
  writtenOffValue: number;
  atRisk: { sku: string; name: string; lot_number: string; expiry_date: string; quantity: string; value: string; days_left: number }[];
  expiredValue: number; expiring30Value: number; expiring90Value: number;
}

const MOYENS: Record<string, string> = {
  cash: 'Espèces', mobile_money: 'Mobile Money', card: 'Carte', bank_transfer: 'Virement',
  bank_local: 'Banque', credit: 'Crédit client', insurance: 'Tiers payant', loyalty: 'Points fidélité', manual: 'Autre',
};

const VUES = [
  { code: 'synthese', libelle: 'Synthèse' },
  { code: 'produits', libelle: 'Par produit' },
  { code: 'categories', libelle: 'Par catégorie' },
  { code: 'vendeurs', libelle: 'Par vendeur' },
  { code: 'clients', libelle: 'Par client' },
  { code: 'stock', libelle: 'Valeur du stock' },
  { code: 'dormants', libelle: 'Ne se vendent pas' },
  { code: 'peremptions', libelle: 'Péremptions et pertes' },
];
const REGROUPEMENT: Record<string, string> = {
  produits: 'product', categories: 'category', vendeurs: 'seller', clients: 'customer',
};

/** Rapports de la pharmacie sur une période, et leur export Excel. */
export default async function PageRapports({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; a?: string; vue?: string }>;
}) {
  const { peut } = await droits();
  if (!peut('reporting.read')) return <AccesReserve titre={(await traduire()).t('nav.rapports')} />;
  const sp = await searchParams;
  const liste = periodes();
  const de = valide(sp.de) ?? liste[3].de;
  const a = valide(sp.a) ?? liste[3].a;
  const vue = VUES.some((v) => v.code === sp.vue) ? (sp.vue as string) : 'synthese';
  const financier = peut('reporting.financial');
  const devise = await deviseSession();
  const qs = `from=${de}&to=${a}`;
  const lien = (v: string, d = de, f = a) => `/pharmacie/rapports?vue=${v}&de=${d}&a=${f}`;

  const [syn, parJour, paiements, regroupe, stock, rotation, per] = await Promise.all([
    apiSafe<Synthese | null>(`/reports/summary?${qs}`, null),
    vue === 'synthese' ? apiSafe<LigneVentes[]>(`/reports/sales?groupBy=day&${qs}`, []) : Promise.resolve([] as LigneVentes[]),
    vue === 'synthese' ? apiSafe<LignePaiement[]>(`/reports/payments?${qs}`, []) : Promise.resolve([] as LignePaiement[]),
    REGROUPEMENT[vue] ? apiSafe<LigneVentes[]>(`/reports/sales?groupBy=${REGROUPEMENT[vue]}&${qs}`, []) : Promise.resolve([] as LigneVentes[]),
    vue === 'stock' && financier ? apiSafe<LigneStock[]>('/reports/stock-valuation', []) : Promise.resolve([] as LigneStock[]),
    vue === 'dormants' ? apiSafe<LigneRotation[]>('/reports/stock-rotation?days=90', []) : Promise.resolve([] as LigneRotation[]),
    vue === 'peremptions' || vue === 'synthese' ? apiSafe<Peremptions | null>(`/reports/expiry?${qs}`, null) : Promise.resolve(null),
  ]);
  const periodeActive = liste.find((p) => p.de === de && p.a === a)?.code;
  const parJourIndex = new Map(parJour.map((l) => [l.dimension, l]));
  const jours = joursEntre(de, a).map((j) => ({
    jour: j,
    ca: Number(parJourIndex.get(j)?.revenue ?? 0),
    ventes: Number(parJourIndex.get(j)?.sales ?? 0),
    marge: Number(parJourIndex.get(j)?.margin ?? 0),
  }));

  return (
    <>
      <div className="page-head">
        <h1>Rapports</h1>
        <p>Ventes, marges, encaissements, stock et pertes, du {new Date(`${de}T12:00:00Z`).toLocaleDateString('fr-FR')} au {new Date(`${a}T12:00:00Z`).toLocaleDateString('fr-FR')}.</p>
      </div>

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'end', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <nav className="periodes" aria-label="Période">
              {liste.map((p) => (
                <Link key={p.code} href={lien(vue, p.de, p.a)} className={periodeActive === p.code ? 'actif' : ''}>{p.libelle}</Link>
              ))}
            </nav>
            <form className="row" style={{ alignItems: 'end' }}>
              <input type="hidden" name="vue" value={vue} />
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="r-de">Du</label>
                <input id="r-de" type="date" name="de" defaultValue={de} required />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="r-a">au</label>
                <input id="r-a" type="date" name="a" defaultValue={a} required />
              </div>
              <button type="submit" className="secondaire">Afficher</button>
            </form>
          </div>
          {financier && (
            <a className="btn" href={`/api/proxy/reports/workbook?${qs}`} download>Exporter en Excel</a>
          )}
        </div>
      </section>

      <nav className="onglets" aria-label="Rapports">
        {VUES.map((v) => <Link key={v.code} href={lien(v.code)} className={vue === v.code ? 'actif' : ''}>{v.libelle}</Link>)}
      </nav>

      {vue === 'synthese' && syn && (
        <>
          <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
            <div className="stat">
              <div className="stat-label">Chiffre d’affaires</div>
              <div className="stat-value">{money(syn.revenue, devise)}</div>
              <div className="stat-note">{syn.sales} vente(s) · panier moyen {money(syn.averageBasket, devise)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Marge hors taxes</div>
              <div className="stat-value">{money(syn.margin, devise)}</div>
              <div className="stat-note">{percent(syn.marginPercent)} du chiffre hors taxes{syn.tax > 0 ? ` · taxes ${money(syn.tax, devise)}` : ''}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Payé par les tiers payants</div>
              <div className="stat-value">{money(syn.payerShare, devise)}</div>
              <div className="stat-note">remises accordées {money(syn.discounts, devise)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Annulations et pertes</div>
              <div className="stat-value">{money(syn.cancelled.total, devise)}</div>
              <div className="stat-note">
                {syn.cancelled.count} vente(s) annulée(s){per ? ` · ${money(per.writtenOffValue, devise)} retiré pour péremption` : ''}
              </div>
            </div>
          </div>

          <section className="card">
            <div className="card-head">
              <h2>Chiffre d’affaires par jour</h2>
              {syn.offlineSales > 0 && <span className="hint">dont {syn.offlineSales} vente(s) faite(s) hors connexion</span>}
            </div>
            <GraphiqueJours jours={jours} devise={devise} />
          </section>

          <div className="grid grid-2">
            <section className="card">
              <div className="card-head"><h2>Encaissements</h2><span className="hint">par moyen et par devise remise</span></div>
              {paiements.length === 0 ? <Vide message="Aucun encaissement sur la période." /> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Moyen</th><th className="num">Paiements</th><th className="num">Montant remis</th><th className="num">Contre-valeur</th></tr></thead>
                    <tbody>
                      {paiements.map((l) => (
                        <tr key={`${l.method}-${l.currency}`}>
                          <td>{MOYENS[l.method] ?? l.method}{l.currency !== devise ? ` en ${l.currency === 'CDF' ? 'francs' : l.currency}` : ''}</td>
                          <td className="num">{l.payments}</td>
                          <td className="num">{money(l.tendered, l.currency)}</td>
                          <td className="num">{money(l.amount, devise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="card">
              <div className="card-head"><h2>Ventes par jour</h2></div>
              {parJour.length === 0 ? <Vide message="Aucune vente sur la période." /> : (
                <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                  <table>
                    <thead><tr><th>Jour</th><th className="num">Ventes</th><th className="num">Chiffre d’affaires</th><th className="num">Marge HT</th></tr></thead>
                    <tbody>
                      {parJour.map((l) => (
                        <tr key={l.dimension}>
                          <td>{new Date(`${l.dimension}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                          <td className="num">{l.sales}</td>
                          <td className="num">{money(l.revenue, devise)}</td>
                          <td className="num">{money(l.margin, devise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {REGROUPEMENT[vue] && (
        <section className="card">
          <div className="card-head">
            <h2>{VUES.find((v) => v.code === vue)?.libelle}</h2>
            <span className="hint">du plus gros chiffre d’affaires au plus petit · marge hors taxes</span>
          </div>
          {regroupe.length === 0 ? <Vide message="Aucune vente sur la période." /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{{ produits: 'Produit', categories: 'Catégorie', vendeurs: 'Vendeur', clients: 'Client' }[vue]}</th>
                    <th className="num">Ventes</th><th className="num">Quantité</th><th className="num">Chiffre d’affaires</th>
                    <th className="num">Coût d’achat</th><th className="num">Marge HT</th><th className="num">Marge %</th>
                  </tr>
                </thead>
                <tbody>
                  {regroupe.map((l) => (
                    <tr key={l.dimension}>
                      <td>{l.dimension}</td>
                      <td className="num">{l.sales}</td>
                      <td className="num">{quantity(l.quantity)}</td>
                      <td className="num">{money(l.revenue, devise)}</td>
                      <td className="num">{money(l.cost, devise)}</td>
                      <td className="num">{money(l.margin, devise)}</td>
                      <td className="num">
                        <span className={`tag ${Number(l.margin_percent) < 10 ? 'danger' : Number(l.margin_percent) < 20 ? 'warn' : 'ok'}`}>{percent(l.margin_percent)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {vue === 'stock' && (
        <section className="card">
          <div className="card-head"><h2>Valeur du stock aujourd’hui</h2><span className="hint">par catégorie</span></div>
          {!financier ? <Vide message="Rapport réservé aux comptes qui voient les chiffres financiers." />
            : stock.length === 0 ? <Vide message="Aucun stock." /> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Catégorie</th><th className="num">Produits</th><th className="num">Unités</th><th className="num">Valeur d’achat</th>
                      <th className="num">Valeur de vente</th><th className="num">Marge potentielle</th><th className="num">Péremption sous 90 j</th></tr>
                  </thead>
                  <tbody>
                    {stock.map((l) => (
                      <tr key={l.category}>
                        <td>{l.category}</td><td className="num">{l.products}</td><td className="num">{quantity(l.units)}</td>
                        <td className="num">{money(l.cost_value, devise)}</td><td className="num">{money(l.retail_value, devise)}</td>
                        <td className="num">{money(l.potential_margin, devise)}</td>
                        <td className="num">{Number(l.at_risk_90d ?? 0) > 0 ? <span className="tag warn">{money(l.at_risk_90d, devise)}</span> : '—'}</td>
                      </tr>
                    ))}
                    <tr>
                      <td><strong>Total</strong></td>
                      <td className="num">{stock.reduce((s, l) => s + Number(l.products), 0)}</td>
                      <td className="num">{quantity(stock.reduce((s, l) => s + Number(l.units), 0))}</td>
                      <td className="num"><strong>{money(stock.reduce((s, l) => s + Number(l.cost_value), 0), devise)}</strong></td>
                      <td className="num"><strong>{money(stock.reduce((s, l) => s + Number(l.retail_value), 0), devise)}</strong></td>
                      <td className="num">{money(stock.reduce((s, l) => s + Number(l.potential_margin), 0), devise)}</td>
                      <td className="num">{money(stock.reduce((s, l) => s + Number(l.at_risk_90d ?? 0), 0), devise)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
        </section>
      )}

      {vue === 'dormants' && (() => {
        const enStock = rotation.filter((l) => Number(l.on_hand) > 0);
        const dormants = enStock.filter((l) => l.classification === 'dormant');
        const capital = dormants.reduce((s, l) => s + Number(l.tied_up_capital), 0);
        return (
          <section className="card">
            <div className="card-head">
              <h2>Produits qui ne se vendent pas</h2>
              <span className="hint">{dormants.length} produit(s) en stock sans aucune vente en 90 jours · {money(capital, devise)} immobilisés</span>
            </div>
            {enStock.length === 0 ? <Vide message="Aucun stock." /> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Produit</th><th className="num">En stock</th><th className="num">Capital immobilisé</th><th className="num">Vendu (90 j)</th><th>Rotation</th></tr></thead>
                  <tbody>
                    {[...dormants, ...enStock.filter((l) => l.classification !== 'dormant')].map((l) => (
                      <tr key={l.sku}>
                        <td><strong>{l.name}</strong><br /><span className="small muted mono">{l.sku}</span></td>
                        <td className="num">{quantity(l.on_hand)}</td>
                        <td className="num">{money(l.tied_up_capital, devise)}</td>
                        <td className="num">{quantity(l.sold)}</td>
                        <td>
                          <span className={`tag ${l.classification === 'dormant' ? 'danger' : l.classification === 'rapide' ? 'ok' : 'muted'}`}>
                            {l.classification === 'dormant' ? 'Ne se vend pas' : l.classification === 'rapide' ? 'Rapide' : 'Normale'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })()}

      {vue === 'peremptions' && per && (
        <>
          <div className="grid grid-4" style={{ marginBottom: '1.25rem' }}>
            <div className="stat"><div className="stat-label">Retiré pour péremption</div><div className="stat-value">{money(per.writtenOffValue, devise)}</div><div className="stat-note">sur la période</div></div>
            <div className="stat"><div className="stat-label">Périmé encore en stock</div><div className="stat-value">{money(per.expiredValue, devise)}</div><div className="stat-note">à retirer du rayon</div></div>
            <div className="stat"><div className="stat-label">Périme sous 30 jours</div><div className="stat-value">{money(per.expiring30Value, devise)}</div><div className="stat-note">à vendre en priorité</div></div>
            <div className="stat"><div className="stat-label">Périme sous 90 jours</div><div className="stat-value">{money(per.expiring90Value, devise)}</div></div>
          </div>
          <section className="card">
            <div className="card-head"><h2>Lots périmés ou qui périment sous 90 jours</h2></div>
            {per.atRisk.length === 0 ? <Vide message="Aucun lot à risque." /> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Produit</th><th>Lot</th><th>Péremption</th><th className="num">Quantité</th><th className="num">Valeur d’achat</th></tr></thead>
                  <tbody>
                    {per.atRisk.map((l) => (
                      <tr key={`${l.sku}-${l.lot_number}`}>
                        <td><strong>{l.name}</strong></td>
                        <td className="mono small">{l.lot_number}</td>
                        <td>
                          <span className={`tag ${l.days_left < 0 ? 'danger' : l.days_left <= 30 ? 'warn' : 'muted'}`}>
                            {new Date(l.expiry_date).toLocaleDateString('fr-FR')} · {l.days_left < 0 ? `périmé depuis ${-l.days_left} j` : `dans ${l.days_left} j`}
                          </span>
                        </td>
                        <td className="num">{quantity(l.quantity)}</td>
                        <td className="num">{money(l.value, devise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="card">
            <div className="card-head"><h2>Retirés pour péremption sur la période</h2></div>
            {per.writtenOff.length === 0 ? <Vide message="Rien n’a été retiré sur la période." /> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Produit</th><th>Lot</th><th className="num">Quantité</th><th className="num">Valeur d’achat</th><th>Motif</th></tr></thead>
                  <tbody>
                    {per.writtenOff.map((l, i) => (
                      <tr key={i}>
                        <td className="small">{new Date(l.occurred_at).toLocaleDateString('fr-FR')}</td>
                        <td>{l.name}</td><td className="mono small">{l.lot_number ?? '—'}</td>
                        <td className="num">{quantity(l.quantity)}</td><td className="num">{money(l.value, devise)}</td>
                        <td className="small">{l.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
