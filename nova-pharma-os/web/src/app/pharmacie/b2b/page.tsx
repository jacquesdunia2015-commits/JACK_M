import Etiquette from '@/components/Etiquette';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date, money } from '@/lib/format';

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
  const [commandes, devis] = await Promise.all([
    apiSafe<Commande[]>('/b2b/orders', []),
    apiSafe<Devis[]>('/b2b/quotes', []),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Commerce professionnel</h1>
        <p>
          Devis, commandes et facturation à destination des clients professionnels
          (B2B).
        </p>
      </div>

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
                    <td className="mono">{c.number}</td>
                    <td>
                      {c.customer_name}
                      <br />
                      <span className="small muted mono">{c.customer_code}</span>
                    </td>
                    <td>
                      <Etiquette statut={c.status} />
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
                    <td className="mono">{d.number}</td>
                    <td>{d.customer_name}</td>
                    <td>
                      <Etiquette statut={d.status} />
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
