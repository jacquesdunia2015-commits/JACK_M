import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DocumentFacture } from '@/components/Facture';
import { apiSafe } from '@/lib/api';
import { date, dateTime, money, quantity } from '@/lib/format';
import { MOYENS_PAIEMENT, statutFacture } from '@/lib/factures';

interface DetailFacture {
  invoice: {
    id: string; number: string; status: string; currency: string; issue_date: string;
    due_date: string | null; subtotal: string; discount_total: string; tax_total: string;
    total: string; amount_paid: string; balance: string; sale_id: string | null;
    sale_number: string | null; sold_at: string | null; sold_by_name: string | null;
    patient_name: string | null; prescriber_name: string | null; change_given: string | null;
  };
  customer: {
    id: string; code: string; name: string; phone: string | null; email: string | null;
    address: string | null; city: string | null; tax_id: string | null;
  } | null;
  lines: {
    description: string; quantity: string; unit_price: string; discount_percent: string;
    line_total: string; sku: string | null; lot_number: string | null; expiry_date: string | null;
  }[];
  payments: { method: string; provider: string | null; amount: string; reference: string | null }[];
}

/** Une facture client : son contenu et son PDF à imprimer ou partager. */
export default async function PageFacture({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await apiSafe<DetailFacture | null>(`/invoices/${id}`, null);
  if (!f) notFound();
  const { invoice: i, customer: c } = f;
  const statut = statutFacture(i.status);

  return (
    <>
      <div className="page-head">
        <p className="small"><Link href="/pharmacie/factures">← Factures</Link></p>
        <h1 className="mono">{i.number}</h1>
        <p>
          <span className={`tag ${statut.ton}`}>{statut.libelle}</span>{' '}
          Émise le {date(i.issue_date)}
          {i.sale_number && i.sale_id && <> · vente <Link href={`/pharmacie/ventes/${i.sale_id}`} className="mono">{i.sale_number}</Link></>}
          {i.sold_by_name ? ` · servie par ${i.sold_by_name}` : ''}
          {i.due_date ? ` · échéance le ${date(i.due_date)}` : ''}
        </p>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Imprimer ou envoyer</h2>
          <span className="hint">PDF au logo de votre pharmacie</span>
        </div>
        <DocumentFacture factureId={i.id} numero={i.number} total={i.total} devise={i.currency} client={c} />
        {!c && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            Facture au nom d&apos;un client comptant. Pour la mettre à son nom, établissez-la depuis la vente avec son nom et son téléphone.
          </p>
        )}
      </section>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head"><h2>Client</h2></div>
          {c ? (
            <>
              <p style={{ marginTop: 0 }}>
                <strong>{c.name}</strong> <span className="small muted mono">{c.code}</span>
              </p>
              <p className="small" style={{ marginBottom: 0 }}>
                {[c.phone, c.email, [c.address, c.city].filter(Boolean).join(', '), c.tax_id ? `N° impôt ${c.tax_id}` : null]
                  .filter(Boolean).join(' · ') || '—'}
              </p>
              <p className="small" style={{ marginBottom: 0 }}>
                <Link href={`/pharmacie/factures?client=${c.id}`}>Toutes ses factures</Link>
              </p>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Client comptant</p>
          )}
          {(i.patient_name || i.prescriber_name) && (
            <p className="small muted" style={{ marginBottom: 0 }}>
              Sur ordonnance{i.patient_name ? ` · patient : ${i.patient_name}` : ''}{i.prescriber_name ? ` · prescripteur : ${i.prescriber_name}` : ''}
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2>Montants</h2></div>
          <table>
            <tbody>
              {Number(i.discount_total) > 0 && (
                <>
                  <tr><td>Sous-total</td><td className="num">{money(i.subtotal, i.currency)}</td></tr>
                  <tr><td>Remise</td><td className="num">−{money(i.discount_total, i.currency)}</td></tr>
                </>
              )}
              <tr><td><strong>Total TTC</strong></td><td className="num"><strong>{money(i.total, i.currency)}</strong></td></tr>
              {Number(i.tax_total) > 0 && <tr><td>dont taxes</td><td className="num">{money(i.tax_total, i.currency)}</td></tr>}
              <tr><td>Payé</td><td className="num">{money(i.amount_paid, i.currency)}</td></tr>
              {Number(i.balance) > 0 && (
                <tr><td><strong>Reste à payer</strong></td><td className="num"><strong>{money(i.balance, i.currency)}</strong></td></tr>
              )}
            </tbody>
          </table>
          {f.payments.length > 0 && (
            <p className="small muted" style={{ marginBottom: 0 }}>
              {f.payments.map((p) => `${MOYENS_PAIEMENT[p.method] ?? p.method}${p.provider ? ` (${p.provider})` : ''} : ${money(p.amount, i.currency)}`)
                .concat(Number(i.change_given) > 0 ? [`monnaie rendue : ${money(i.change_given, i.currency)}`] : [])
                .join(' · ')}
            </p>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Articles</h2>
          <span className="hint">{i.sold_at ? dateTime(i.sold_at) : ''}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Désignation</th>
                <th className="num">Qté</th>
                <th className="num">Prix unitaire</th>
                <th className="num">Remise</th>
                <th className="num">Montant</th>
              </tr>
            </thead>
            <tbody>
              {f.lines.map((l, n) => (
                <tr key={n}>
                  <td>
                    <strong>{l.description}</strong>
                    {(l.lot_number || l.expiry_date) && (
                      <><br /><span className="small muted">{[l.lot_number ? `Lot ${l.lot_number}` : null, l.expiry_date ? `exp. ${date(l.expiry_date)}` : null].filter(Boolean).join(' · ')}</span></>
                    )}
                  </td>
                  <td className="num">{quantity(l.quantity)}</td>
                  <td className="num">{money(l.unit_price, i.currency)}</td>
                  <td className="num">{Number(l.discount_percent) > 0 ? `${quantity(l.discount_percent)} %` : '—'}</td>
                  <td className="num">{money(l.line_total, i.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
