import Link from 'next/link';
import AccesReserve from '@/components/AccesReserve';
import Depliable from '@/components/Depliable';
import { FormulairePayeur } from '@/components/TiersPayant';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { deviseSession } from '@/lib/devise';
import { droits } from '@/lib/droits';
import { money } from '@/lib/format';
import { traduire } from '@/lib/i18n';
import { STATUTS_RELEVE, TYPES_PAYEUR } from '@/lib/tiers-payant';

interface LignePayeur {
  id: string; code: string; name: string; kind: string; coverage_percent: string;
  per_sale_ceiling: string | null; phone: string | null; is_active: boolean;
  members: string; unclaimed: string; claimed_due: string;
}

interface Releve {
  id: string; number: string; payer_name: string; period_start: string; period_end: string;
  status: string; total: string; balance: string; sales: string;
}

/**
 * Tiers payant : assurances, mutuelles, employeurs et ONG qui prennent en
 * charge une partie des médicaments, ce que chacun doit, et les relevés.
 */
export default async function PageTiersPayant() {
  const { peut } = await droits();
  if (!peut('customers.read')) return <AccesReserve titre={(await traduire()).t('nav.tiers_payant')} />;
  const devise = await deviseSession();
  const [payeurs, releves] = await Promise.all([
    apiSafe<LignePayeur[]>('/payers', []),
    peut('customers.credit') ? apiSafe<Releve[]>('/payers/claims', []) : Promise.resolve([] as Releve[]),
  ]);
  const aPresenter = payeurs.reduce((s, p) => s + Number(p.unclaimed), 0);
  const presente = payeurs.reduce((s, p) => s + Number(p.claimed_due), 0);

  return (
    <>
      <div className="page-head">
        <h1>Tiers payant</h1>
        <p>Assurances, mutuelles, conventions d’entreprise et ONG : leur part de chaque vente, et ce qu’elles vous doivent.</p>
      </div>

      <div className="grid grid-3" style={{ marginBottom: '1.25rem' }}>
        <div className="stat">
          <div className="stat-label">À présenter</div>
          <div className="stat-value">{money(aPresenter, devise)}</div>
          <div className="stat-note">ventes prises en charge pas encore sur un relevé</div>
        </div>
        <div className="stat">
          <div className="stat-label">Relevés en attente de règlement</div>
          <div className="stat-value">{money(presente, devise)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Organismes actifs</div>
          <div className="stat-value">{payeurs.filter((p) => p.is_active).length}</div>
          <div className="stat-note">{payeurs.reduce((s, p) => s + Number(p.members), 0)} bénéficiaire(s)</div>
        </div>
      </div>

      {peut('customers.write') && (
        <section className="card">
          <Depliable resume="Ajouter un organisme payeur" ouvert={payeurs.length === 0}>
            <FormulairePayeur />
          </Depliable>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Organismes</h2>
          <span className="hint">À la caisse, choisissez « Tiers payant » puis le bénéficiaire</span>
        </div>
        {payeurs.length === 0 ? (
          <Vide message="Aucun organisme : ajoutez la mutuelle, l’assurance ou l’entreprise dont vous servez les membres." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Organisme</th>
                  <th>Type</th>
                  <th className="num">Prise en charge</th>
                  <th className="num">Bénéficiaires</th>
                  <th className="num">À présenter</th>
                  <th className="num">Relevés dus</th>
                </tr>
              </thead>
              <tbody>
                {payeurs.map((p) => (
                  <tr key={p.id} className={p.is_active ? '' : 'muted'}>
                    <td>
                      <Link href={`/pharmacie/tiers-payant/${p.id}`}><strong>{p.name}</strong></Link>
                      <br /><span className="small muted mono">{p.code}{p.phone ? ` · ${p.phone}` : ''}</span>
                      {!p.is_active && <> <span className="tag muted">inactif</span></>}
                    </td>
                    <td>{TYPES_PAYEUR[p.kind] ?? p.kind}</td>
                    <td className="num">
                      {Number(p.coverage_percent).toLocaleString('fr-FR')} %
                      {p.per_sale_ceiling && <><br /><span className="small muted">max. {money(p.per_sale_ceiling, devise)} par vente</span></>}
                    </td>
                    <td className="num">{p.members}</td>
                    <td className="num">{money(p.unclaimed, devise)}</td>
                    <td className="num">{money(p.claimed_due, devise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {releves.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Derniers relevés</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Relevé</th>
                  <th>Organisme</th>
                  <th>Période</th>
                  <th className="num">Ventes</th>
                  <th className="num">Total</th>
                  <th className="num">Reste dû</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {releves.slice(0, 20).map((r) => {
                  const s = STATUTS_RELEVE[r.status] ?? { libelle: r.status, ton: 'muted' };
                  return (
                    <tr key={r.id}>
                      <td><Link href={`/pharmacie/tiers-payant/releves/${r.id}`} className="mono">{r.number}</Link></td>
                      <td>{r.payer_name}</td>
                      <td className="small">{new Date(r.period_start).toLocaleDateString('fr-FR')} → {new Date(r.period_end).toLocaleDateString('fr-FR')}</td>
                      <td className="num">{r.sales}</td>
                      <td className="num">{money(r.total, devise)}</td>
                      <td className="num">{money(r.balance, devise)}</td>
                      <td><span className={`tag ${s.ton}`}>{s.libelle}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
