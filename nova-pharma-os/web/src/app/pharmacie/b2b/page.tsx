import Link from 'next/link';
import FormulaireB2b, { ProduitB2b } from '@/components/FormulaireB2b';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date, money } from '@/lib/format';
import AccesReserve from '@/components/AccesReserve';
import { droits } from '@/lib/droits';
import { traduire } from '@/lib/i18n';
import { statutCommande } from '@/lib/achats';
import Depliable from '@/components/Depliable';

interface Commande {
  id: string; number: string; status: string; currency: string;
  payment_terms: string; requested_date: string | null; total: string;
  amount_paid: string; balance_due: string; created_at: string;
  customer_name: string; customer_code: string; lines: string;
}

interface Devis {
  id: string; number: string; status: string; currency: string;
  valid_until: string | null; total: string; customer_name: string; lines: string;
}

export default async function PageB2b() {
  const { peut } = await droits();
  if (!peut('b2b.read')) return <AccesReserve titre={(await traduire()).t('nav.b2b')} />;
  const [commandes, devis, clients, catalogue] = await Promise.all([
    apiSafe<Commande[]>('/b2b/orders', []),
    apiSafe<Devis[]>('/b2b/quotes', []),
    apiSafe<{ id: string; name: string; code: string; kind: string; is_active: boolean }[]>('/customers?kind=professional', []),
    apiSafe<{ data: ProduitB2b[] }>('/catalog/products?pageSize=200', { data: [] }),
  ]);
  const Statut = ({ s }: { s: string }) => <span className={`tag ${statutCommande(s).ton}`}>{statutCommande(s).libelle}</span>;

  return (
    <>
      <div className="page-head">
        <h1>Commerce professionnel</h1>
        <p>
          Devis, commandes et facturation à destination des clients professionnels
          (B2B).
        </p>
      </div>

      {peut('b2b.write') && (
        <section className="card">
          <Depliable ouvert={commandes.length === 0 && devis.length === 0} resume={<>Nouvelle commande ou nouveau devis</>}>
            {clients.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Aucun client professionnel : ajoutez-en un dans <Link href="/pharmacie/clients">Clients</Link> (type « Professionnel »).
              </p>
            ) : (
              <FormulaireB2b clients={clients.filter((c) => c.is_active)} produits={catalogue.data} />
            )}
          </Depliable>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Commandes</h2>
          <span className="hint">{commandes.length} commande(s)</span>
        </div>
        {commandes.length === 0 ? (
          <Vide message="Aucune commande professionnelle." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Client</th>
                  <th>Statut</th>
                  <th>Règlement</th>
                  <th className="num">Lignes</th>
                  <th className="num">Total</th>
                  <th className="num">Reste dû</th>
                  <th className="num">Créée le</th>
                </tr>
              </thead>
              <tbody>
                {commandes.map((c) => (
                  <tr key={c.id}>
                    <td className="mono"><Link href={`/pharmacie/b2b/commandes/${c.id}`}>{c.number}</Link></td>
                    <td>
                      {c.customer_name}
                      <br />
                      <span className="small muted mono">{c.customer_code}</span>
                    </td>
                    <td>
                      <Statut s={c.status} />
                    </td>
                    <td className="small">
                      {c.payment_terms === 'credit' ? 'À crédit' : 'Comptant'}
                    </td>
                    <td className="num">{c.lines}</td>
                    <td className="num">{money(c.total, c.currency)}</td>
                    <td className="num">
                      {Number(c.balance_due) > 0 ? (
                        <span className="tag warn">{money(c.balance_due, c.currency)}</span>
                      ) : (
                        money(0, c.currency)
                      )}
                    </td>
                    <td className="num small">{date(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Devis</h2>
        </div>
        {devis.length === 0 ? (
          <Vide message="Aucun devis établi." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Client</th>
                  <th>Statut</th>
                  <th className="num">Valide jusqu&apos;au</th>
                  <th className="num">Lignes</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {devis.map((d) => (
                  <tr key={d.id}>
                    <td className="mono"><Link href={`/pharmacie/b2b/devis/${d.id}`}>{d.number}</Link></td>
                    <td>{d.customer_name}</td>
                    <td>
                      <Statut s={d.status} />
                    </td>
                    <td className="num">{date(d.valid_until)}</td>
                    <td className="num">{d.lines}</td>
                    <td className="num">{money(d.total, d.currency)}</td>
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
