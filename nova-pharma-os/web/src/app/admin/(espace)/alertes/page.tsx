import Depliable from '@/components/Depliable';
import { BasculeAlerte, FormulaireAlerte } from '@/components/Rappels';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date } from '@/lib/format';
import { SOURCES_RAPPEL, TYPES_RAPPEL } from '@/lib/rappels';

interface Alerte {
  id: string; kind: string; title: string; product_name: string; match_terms: string | null; lot_numbers: string[];
  source: string; reference: string | null; country_code: string | null; is_active: boolean; published_at: string; created_by_name: string | null;
}

/** Back-office : alertes produits publiées à toutes les pharmacies. */
export default async function PageAlertes() {
  const alertes = await apiSafe<Alerte[] | null>('/platform/product-alerts', null);
  if (!alertes) {
    return (
      <div className="page-head">
        <h1>Alertes produits</h1>
        <p>Réservé aux super-administrateurs et au support.</p>
      </div>
    );
  }
  return (
    <>
      <div className="page-head">
        <h1>Alertes produits</h1>
        <p>
          Rappels de lots de l’ACOREP, alertes de l’OMS sur des produits falsifiés : publiez-les une fois, chaque pharmacie les reçoit avec
          ses lots concernés, les bloque et retrouve les clients qui les ont achetés.
        </p>
      </div>
      <section className="card">
        <Depliable resume="Publier une alerte" ouvert={alertes.length === 0}>
          <FormulaireAlerte />
        </Depliable>
      </section>
      <section className="card">
        <div className="card-head"><h2>Alertes publiées</h2></div>
        {alertes.length === 0 ? <Vide message="Aucune alerte publiée." /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Alerte</th><th>Produit et lots</th><th>Source</th><th>Pays</th><th>État</th><th /></tr></thead>
              <tbody>
                {alertes.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className={`tag ${TYPES_RAPPEL[a.kind]?.ton ?? 'warn'}`}>{TYPES_RAPPEL[a.kind]?.libelle ?? a.kind}</span>
                      <div><strong>{a.title}</strong></div>
                      <div className="small muted">{date(a.published_at)}{a.created_by_name ? ` · ${a.created_by_name}` : ''}</div>
                    </td>
                    <td>{a.product_name}<div className="small mono muted">{a.lot_numbers.length ? a.lot_numbers.join(', ') : `tous les lots (${a.match_terms})`}</div></td>
                    <td className="small">{SOURCES_RAPPEL[a.source] ?? a.source}{a.reference ? <div className="muted">{a.reference}</div> : null}</td>
                    <td className="small">{a.country_code ?? 'Tous'}</td>
                    <td><span className={`tag ${a.is_active ? 'ok' : 'muted'}`}>{a.is_active ? 'Publiée' : 'Retirée'}</span></td>
                    <td style={{ textAlign: 'right' }}><BasculeAlerte id={a.id} active={a.is_active} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
