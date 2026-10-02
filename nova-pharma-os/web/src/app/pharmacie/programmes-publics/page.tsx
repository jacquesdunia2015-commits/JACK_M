import AccesReserve from '@/components/AccesReserve';
import { FormCorrespondance, FormReglagesProgrammes, ImportCorrespondances } from '@/components/ProgrammesPublics';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { droits } from '@/lib/droits';
import { designation, quantity } from '@/lib/format';
import { traduire } from '@/lib/i18n';
import { RUBRIQUES_RAPPORT, type CorrespondanceDhis2, type LigneRapportPublic, type ReglagesProgrammes } from '@/lib/programmes-publics';

interface Rapport {
  month: string;
  period: { start: string; end: string; partial: boolean };
  facility: { name: string; branch: string | null; code: string | null };
  settings: ReglagesProgrammes;
  rows: LigneRapportPublic[];
}
interface Correspondance { product_id: string; sku: string; name: string; dosage: string | null; national_code: string | null; dhis2: CorrespondanceDhis2 }

const moisPrecedent = () => {
  const d = new Date();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
};

/**
 * Rapport mensuel de gestion des stocks pour les programmes publics :
 * LOGIMEV (OpenLMIS) et le SNIS (DHIS2) reposent sur les mêmes rubriques.
 */
export default async function PageProgrammesPublics({ searchParams }: { searchParams: Promise<{ mois?: string; relies?: string }> }) {
  const { peut } = await droits();
  if (!peut('reporting.read')) return <AccesReserve titre={(await traduire()).t('nav.programmesPublics')} />;
  const q = await searchParams;
  const mois = q.mois && /^\d{4}-\d{2}$/.test(q.mois) ? q.mois : moisPrecedent();
  const params = new URLSearchParams({ month: mois, ...(q.relies ? { mappedOnly: 'true' } : {}) });
  const [r, correspondances] = await Promise.all([
    apiSafe<Rapport | null>(`/reports/public-programs?${params}`, null),
    apiSafe<Correspondance[]>('/reports/public-programs/mappings', []),
  ]);
  if (!r) return <Vide message="Rapport indisponible pour le moment." />;
  const reliesDhis2 = r.rows.filter((l) => Object.keys(l.dhis2).length > 0).length;
  const gerer = peut('settings.write');
  const produits = new Map<string, { id: string; libelle: string; nationalCode: string | null; dhis2: CorrespondanceDhis2 }>();
  for (const c of correspondances) produits.set(c.product_id, { id: c.product_id, libelle: designation(c.name, c.dosage), nationalCode: c.national_code, dhis2: c.dhis2 });
  for (const l of r.rows) if (!produits.has(l.productId)) produits.set(l.productId, { id: l.productId, libelle: l.product, nationalCode: l.nationalCode, dhis2: l.dhis2 });
  const listeProduits = [...produits.values()].sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));

  return (
    <>
      <div className="page-head">
        <h1>Programmes publics</h1>
        <p>
          Le rapport mensuel de gestion des stocks demandé par les programmes de santé : stock initial, reçu, consommé, pertes,
          stock final, jours de rupture et quantité à commander, calculé depuis vos mouvements de stock. Il sert pour LOGIMEV
          (système national de gestion logistique, bâti sur OpenLMIS) comme pour le SNIS (DHIS2).
        </p>
      </div>

      <section className="card">
        <form className="row" style={{ alignItems: 'end', gap: '0.75rem' }} method="get">
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="pp-mois">Mois</label>
            <input id="pp-mois" name="mois" type="month" defaultValue={mois} />
          </div>
          <label className="case small" style={{ marginBottom: '0.6rem' }}>
            <input type="checkbox" name="relies" value="1" defaultChecked={!!q.relies} /> Produits reliés au programme seulement
          </label>
          <button type="submit" className="secondaire">Afficher</button>
          <span style={{ flex: 1 }} />
          <a className="btn secondaire" href={`/api/proxy/reports/public-programs/workbook?${params}`}>Excel</a>
          {r.settings.dhis2OrgUnit && reliesDhis2 > 0
            ? <a className="btn" href={`/api/proxy/reports/public-programs/dhis2?month=${mois}&download=1`}>Fichier DHIS2</a>
            : <span className="small muted">Fichier DHIS2 : renseignez vos codes ci-dessous.</span>}
        </form>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Du {r.period.start} au {r.period.end}{r.period.partial ? ' — mois en cours, chiffres provisoires' : ''}
          {r.facility.code ? ` · structure ${r.facility.code}` : ''} · stock maximum {quantity(r.settings.maxMonths)} mois de consommation.
        </p>
      </section>

      <section className="card">
        {r.rows.length === 0 ? <p className="muted">Aucun mouvement de stock sur cette période.</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code national</th><th>Produit</th>
                  {RUBRIQUES_RAPPORT.map((c) => <th key={c.cle} className="num" title={c.libelle}>{c.court}</th>)}
                </tr>
              </thead>
              <tbody>
                {r.rows.map((l) => (
                  <tr key={l.productId}>
                    <td className="mono small">{l.nationalCode ?? <span className="muted">—</span>}</td>
                    <td style={{ minWidth: '9rem' }}>{l.product}</td>
                    {RUBRIQUES_RAPPORT.map((c) => {
                      const v = (l as unknown as Record<string, number>)[c.cle];
                      const alerte = (c.cle === 'stockoutDays' && v > 0) || (c.cle === 'closing' && v <= 0);
                      return <td key={c.cle} className="num">{alerte ? <span className="tag danger">{quantity(v)}</span> : quantity(c.cle === 'amc' ? Math.round(v * 10) / 10 : v)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Envoyer le rapport</h2>
        <ol className="small" style={{ paddingLeft: '1.2rem' }}>
          <li><strong>DHIS2 (SNIS)</strong> : téléchargez le fichier DHIS2, puis dans DHIS2 ouvrez <em>Import/Export → Importation de données</em>,
            choisissez le fichier (format JSON) et lancez d’abord un essai (« dry run »). Gratuit, sans abonnement.</li>
          <li><strong>LOGIMEV</strong> : l’accès est attribué par le ministère de la Santé (phase pilote : Kinshasa et Maniema, programmes nationaux).
            Le classeur Excel reprend les rubriques de la réquisition OpenLMIS pour la saisie ; l’envoi automatique sera branché quand le
            ministère ouvrira l’accès et publiera ses codes produits.</li>
          <li><strong>Sur papier</strong> : le classeur Excel s’imprime tel quel pour le bureau de la zone de santé.</li>
        </ol>
      </section>

      {gerer && (
        <>
          <details className="card">
            <summary>Codes de la structure</summary>
            <FormReglagesProgrammes reglages={r.settings} />
          </details>
          <details className="card">
            <summary>Relier un produit ({correspondances.length} relié{correspondances.length > 1 ? 's' : ''})</summary>
            <FormCorrespondance produits={listeProduits} />
          </details>
          <details className="card">
            <summary>Importer les correspondances (CSV)</summary>
            <ImportCorrespondances />
          </details>
        </>
      )}
    </>
  );
}
