import AccesReserve from '@/components/AccesReserve';
import { MiniHistorique, PreparerRequisition } from '@/components/Previsions';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { droits } from '@/lib/droits';
import { quantity } from '@/lib/format';
import { traduire } from '@/lib/i18n';

interface Prevision {
  horizon: number; coverDays: number; safetyPercent: number; targetLabel: string; historyLabels: string[]; toOrder: number;
  products: {
    productId: string; product: string; category: string; stock: number; onOrder: number; dailyRate: number;
    seasonalIndex: number; forecast: number; daysOfCover: number | null; suggestedOrder: number; confidence: string; history: number[];
  }[];
  seasons: { category: string; months: { month: string; label: string; index: number | null }[] }[];
}

const FIABILITE: Record<string, { libelle: string; ton: string }> = {
  bonne: { libelle: 'Bonne', ton: 'ok' }, moyenne: { libelle: 'Moyenne', ton: 'warn' }, faible: { libelle: 'Faible', ton: 'muted' },
};

/**
 * Prévisions saisonnières : ce qui va se vendre, et combien commander,
 * d'après l'historique de la pharmacie (rythme récent corrigé de la saison).
 */
export default async function PagePrevisions({ searchParams }: { searchParams: Promise<{ horizon?: string; couverture?: string; securite?: string; tout?: string }> }) {
  const { peut } = await droits();
  if (!peut('reporting.read')) return <AccesReserve titre={(await traduire()).t('nav.previsions')} />;
  const q = await searchParams;
  const params = new URLSearchParams({ horizon: q.horizon ?? '30', coverDays: q.couverture ?? '45', safetyPercent: q.securite ?? '20' });
  const r = await apiSafe<Prevision | null>(`/reports/forecast?${params}`, null);
  if (!r) return <Vide message="Prévisions indisponibles pour le moment." />;
  const aCommander = r.products.filter((p) => p.suggestedOrder > 0);
  const affiches = q.tout ? r.products : aCommander;

  return (
    <>
      <div className="page-head">
        <h1>Prévisions et commandes</h1>
        <p>
          Ce que vous allez vendre ces {r.horizon} prochains jours ({r.targetLabel}) et combien commander, d’après vos propres ventes :
          le rythme des trois derniers mois, corrigé de la saison observée l’an dernier (paludisme, rentrée, saison des pluies…).
        </p>
      </div>

      <section className="card">
        <form className="row" style={{ alignItems: 'end', gap: '0.75rem' }} method="get">
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="pv-horizon">Prévoir sur (jours)</label>
            <input id="pv-horizon" name="horizon" type="number" min={7} max={120} defaultValue={r.horizon} style={{ width: '7rem' }} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="pv-couv">Commander pour (jours de stock)</label>
            <input id="pv-couv" name="couverture" type="number" min={7} max={180} defaultValue={r.coverDays} style={{ width: '7rem' }} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="pv-secu">Stock de sécurité (%)</label>
            <input id="pv-secu" name="securite" type="number" min={0} max={100} defaultValue={r.safetyPercent} style={{ width: '7rem' }} />
          </div>
          <button type="submit" className="secondaire">Recalculer</button>
          <a className="btn secondaire" href={`/api/proxy/reports/forecast/workbook?${params}`}>Excel</a>
        </form>
        <p className="small muted" style={{ marginBottom: 0 }}>
          La couverture comprend le délai de livraison de vos fournisseurs. Les produits en commande chez un fournisseur sont déduits.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{q.tout ? 'Tous les produits vendus cette année' : `À commander (${aCommander.length})`}</h2>
          <a className="hint" href={`/pharmacie/previsions?${params}${q.tout ? '' : '&tout=1'}`}>{q.tout ? 'Seulement les produits à commander' : 'Voir tous les produits'}</a>
        </div>
        {affiches.length === 0 ? (
          <Vide message={q.tout ? 'Aucune vente enregistrée ces 12 derniers mois.' : 'Rien à commander : votre stock couvre la période demandée.'} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 190 }}>Produit</th><th>Ventes 12 mois</th><th className="num">Stock</th><th className="num">En commande</th>
                  <th className="num">Par jour</th><th className="num">Saison</th><th className="num">Prévision</th>
                  <th className="num">Jours couverts</th><th className="num">À commander</th><th>Fiabilité</th>
                </tr>
              </thead>
              <tbody>
                {affiches.map((p) => (
                  <tr key={p.productId}>
                    <td>{p.product}<div className="small muted">{p.category}</div></td>
                    <td><MiniHistorique valeurs={p.history} mois={r.historyLabels} /></td>
                    <td className="num">{quantity(p.stock)}</td>
                    <td className="num">{p.onOrder > 0 ? quantity(p.onOrder) : '—'}</td>
                    <td className="num">{p.dailyRate.toLocaleString('fr-FR')}</td>
                    <td className="num">
                      {p.seasonalIndex >= 1.15 ? <span className="tag warn">×{p.seasonalIndex.toLocaleString('fr-FR')} ↑</span>
                        : p.seasonalIndex <= 0.85 ? <span className="tag muted">×{p.seasonalIndex.toLocaleString('fr-FR')} ↓</span>
                        : <span className="muted">×{p.seasonalIndex.toLocaleString('fr-FR')}</span>}
                    </td>
                    <td className="num">{quantity(p.forecast)}</td>
                    <td className="num">
                      {p.daysOfCover === null ? '—' : p.daysOfCover < 7 ? <span className="tag danger">{p.daysOfCover} j</span> : `${p.daysOfCover} j`}
                    </td>
                    <td className="num"><strong>{p.suggestedOrder > 0 ? quantity(p.suggestedOrder) : '—'}</strong></td>
                    <td><span className={`tag ${FIABILITE[p.confidence]?.ton ?? 'muted'}`}>{FIABILITE[p.confidence]?.libelle ?? p.confidence}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {peut('suppliers.write') && (
          <div style={{ marginTop: '0.75rem' }}>
            <PreparerRequisition lignes={aCommander.map((p) => ({ productId: p.productId, product: p.product, quantity: p.suggestedOrder }))} />
          </div>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>
          Fiabilité : bonne avec plus d’un an de ventes (la saison est connue), moyenne entre 6 et 12 mois, faible en dessous.
          « Saison » : ventes attendues comparées au rythme récent (×1,5 = 50 % de plus).
        </p>
      </section>

      {r.seasons.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Saisons de vos ventes, par catégorie</h2><span className="hint">12 prochains mois — 1 = mois moyen</span></div>
          <div className="table-wrap">
            <table className="saisons">
              <thead><tr><th>Catégorie</th>{r.seasons[0].months.map((m) => <th key={m.month} className="num">{m.label}</th>)}</tr></thead>
              <tbody>
                {r.seasons.map((s) => (
                  <tr key={s.category}>
                    <td>{s.category}</td>
                    {s.months.map((m) => (
                      <td key={m.month} className="num">
                        {m.index === null ? <span className="muted">—</span>
                          : m.index >= 1.2 ? <strong title="Haute saison">{m.index.toLocaleString('fr-FR')} ↑</strong>
                          : m.index <= 0.8 ? <span className="muted" title="Basse saison">{m.index.toLocaleString('fr-FR')} ↓</span>
                          : m.index.toLocaleString('fr-FR')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
