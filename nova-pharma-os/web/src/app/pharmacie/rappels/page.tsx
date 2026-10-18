import Link from 'next/link';
import AccesReserve from '@/components/AccesReserve';
import Depliable from '@/components/Depliable';
import { FormulaireRappel } from '@/components/Rappels';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { droits } from '@/lib/droits';
import { date, quantity } from '@/lib/format';
import { traduire } from '@/lib/i18n';
import { ISSUES_RAPPEL, SOURCES_RAPPEL, TYPES_RAPPEL } from '@/lib/rappels';

interface Rappel {
  id: string; alert_id: string | null; kind: string; title: string; product_name: string; lot_numbers: string[];
  source: string; reference: string | null; status: string; resolution: string | null; created_at: string; closed_at: string | null;
  matchedLots: number; stockUnits: number; quarantinedLots: number;
}

/**
 * Rappels de lots et alertes produits falsifiés : ceux publiés par NOVA
 * PHARMA OS pour tout le pays, et ceux reçus par la pharmacie elle-même.
 */
export default async function PageRappels() {
  const { peut } = await droits();
  if (!peut('inventory.read')) return <AccesReserve titre={(await traduire()).t('nav.rappels')} />;
  const rappels = await apiSafe<Rappel[]>('/recalls', []);
  const ouverts = rappels.filter((r) => r.status === 'open');
  const concernes = ouverts.filter((r) => r.matchedLots > 0);
  const clos = rappels.filter((r) => r.status === 'closed');

  return (
    <>
      <div className="page-head">
        <h1>Rappels de lots et produits falsifiés</h1>
        <p>
          Les alertes de l’ACOREP, de l’OMS, des fabricants et des grossistes : NOVA cherche le lot dans votre stock, le bloque à la vente
          et retrouve les clients qui l’ont acheté. Un lot rappelé ne peut plus être réceptionné.
        </p>
      </div>

      {concernes.length > 0 && (
        <div className="banner danger">
          <strong>{concernes.length} alerte(s) concernent votre stock.</strong>
          {concernes.some((r) => r.matchedLots > r.quarantinedLots) ? ' Des lots ne sont pas encore en quarantaine : ouvrez l’alerte.' : ' Les lots sont en quarantaine : décidez de leur sort.'}
        </div>
      )}

      {peut('inventory.adjust') && (
        <section className="card">
          <Depliable resume="Enregistrer un rappel reçu (grossiste, fabricant…)" ouvert={false}>
            <FormulaireRappel />
          </Depliable>
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>En cours</h2><span className="hint">{ouverts.length} alerte(s)</span></div>
        {ouverts.length === 0 ? (
          <Vide message="Aucun rappel en cours." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Alerte</th><th>Produit et lots</th><th>Source</th><th>Votre stock</th><th /></tr></thead>
              <tbody>
                {ouverts.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className={`tag ${TYPES_RAPPEL[r.kind]?.ton ?? 'warn'}`}>{TYPES_RAPPEL[r.kind]?.libelle ?? r.kind}</span>
                      <div><Link href={`/pharmacie/rappels/${r.id}`}><strong>{r.title}</strong></Link></div>
                      <div className="small muted">{date(r.created_at)}{r.alert_id ? ' · publiée par NOVA PHARMA OS' : ''}</div>
                    </td>
                    <td>{r.product_name}<div className="small mono muted">{r.lot_numbers.length ? r.lot_numbers.join(', ') : 'tous les lots'}</div></td>
                    <td className="small">{SOURCES_RAPPEL[r.source] ?? r.source}{r.reference ? <div className="muted">{r.reference}</div> : null}</td>
                    <td>
                      {r.matchedLots === 0 ? <span className="tag ok">Non concerné</span> : (
                        <>
                          <strong>{quantity(r.stockUnits)}</strong> unité(s) · {r.matchedLots} lot(s)
                          <div>{r.quarantinedLots === r.matchedLots ? <span className="tag muted">En quarantaine</span> : <span className="tag danger">À bloquer</span>}</div>
                        </>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}><Link className="btn secondaire petit" href={`/pharmacie/rappels/${r.id}`}>Ouvrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {clos.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Traités</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Alerte</th><th>Produit</th><th>Issue</th><th>Clos le</th></tr></thead>
              <tbody>
                {clos.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/pharmacie/rappels/${r.id}`}>{r.title}</Link></td>
                    <td className="small">{r.product_name}</td>
                    <td className="small">{r.resolution ? ISSUES_RAPPEL[r.resolution] ?? r.resolution : '—'}</td>
                    <td className="small">{r.closed_at ? date(r.closed_at) : '—'}</td>
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
