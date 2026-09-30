import Link from 'next/link';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { date, dateTime, money } from '@/lib/format';
import { statutFacture } from '@/lib/factures';

interface Facture {
  id: string; number: string; status: string; currency: string; issue_date: string;
  total: string; amount_paid: string; balance: string; sale_number: string | null;
  customer_id: string | null; customer_name: string | null; customer_phone: string | null;
}

interface Vente {
  id: string; number: string; status: string; currency: string; total: string; sold_at: string;
  customer_name: string | null; lines: string; invoice_id: string | null; invoice_number: string | null;
}

/**
 * Factures des clients, et ventes récentes pour en établir une à la
 * demande : le client qui revient chercher sa facture la retrouve ici.
 */
export default async function PageFactures({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; client?: string }>;
}) {
  const { q, client } = await searchParams;
  const params = new URLSearchParams();
  if (q) params.set('search', q);
  if (client) params.set('customerId', client);

  const [factures, ventes] = await Promise.all([
    apiSafe<Facture[]>(`/invoices?${params}`, []),
    client || q
      ? Promise.resolve({ data: [] as Vente[] })
      : apiSafe<{ data: Vente[] }>('/sales?pageSize=30', { data: [] }),
  ]);
  const nomClient = client ? factures[0]?.customer_name : null;

  return (
    <>
      <div className="page-head">
        <h1>Factures</h1>
        <p>
          {nomClient
            ? <>Factures de <strong>{nomClient}</strong> · <Link href="/pharmacie/factures">toutes les factures</Link></>
            : 'La facture de chaque client, à imprimer ou à partager en PDF au logo de votre pharmacie.'}
        </p>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Factures émises</h2>
          <span className="hint">{factures.length} facture(s)</span>
        </div>
        <form className="row" style={{ marginBottom: '1rem' }}>
          <input name="q" defaultValue={q ?? ''} placeholder="N° de facture, nom ou téléphone du client…" style={{ maxWidth: 360 }} />
          <button type="submit" className="secondaire">Rechercher</button>
        </form>
        {factures.length === 0 ? (
          <Vide message={q || client ? 'Aucune facture ne correspond.' : 'Aucune facture pour l’instant : établissez-en une depuis la caisse ou depuis une vente ci-dessous.'} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Facture</th>
                  <th>Client</th>
                  <th className="num">Total</th>
                  <th className="num">Reste dû</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {factures.map((f) => {
                  const statut = statutFacture(f.status);
                  return (
                    <tr key={f.id}>
                      <td>
                        <Link href={`/pharmacie/factures/${f.id}`}><strong className="mono">{f.number}</strong></Link>
                        <br />
                        <span className="small muted">{date(f.issue_date)}{f.sale_number ? ` · vente ${f.sale_number}` : ''}</span>
                      </td>
                      <td>
                        {f.customer_id ? (
                          <Link href={`/pharmacie/factures?client=${f.customer_id}`}>{f.customer_name}</Link>
                        ) : (
                          <span className="muted">Client comptant</span>
                        )}
                        {f.customer_phone && <><br /><span className="small muted">{f.customer_phone}</span></>}
                      </td>
                      <td className="num"><strong>{money(f.total, f.currency)}</strong></td>
                      <td className="num">{Number(f.balance) > 0 ? money(f.balance, f.currency) : '—'}</td>
                      <td><span className={`tag ${statut.ton}`}>{statut.libelle}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {ventes.data.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Ventes récentes</h2>
            <span className="hint">Établir la facture d&apos;une vente passée</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vente</th>
                  <th>Client</th>
                  <th className="num">Total</th>
                  <th>Facture</th>
                </tr>
              </thead>
              <tbody>
                {ventes.data.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/pharmacie/ventes/${v.id}`}><span className="mono">{v.number}</span></Link>
                      <br />
                      <span className="small muted">{dateTime(v.sold_at)} · {v.lines} ligne(s)</span>
                    </td>
                    <td>{v.customer_name ?? <span className="muted">—</span>}</td>
                    <td className="num">{money(v.total, v.currency)}</td>
                    <td>
                      {v.status === 'cancelled' ? (
                        <span className="tag muted">Vente annulée</span>
                      ) : v.invoice_id ? (
                        <Link href={`/pharmacie/factures/${v.invoice_id}`} className="mono">{v.invoice_number}</Link>
                      ) : (
                        <Link href={`/pharmacie/ventes/${v.id}`} className="btn secondaire petit">Établir la facture</Link>
                      )}
                    </td>
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
