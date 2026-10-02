import Link from 'next/link';
import { notFound } from 'next/navigation';
import AccesReserve from '@/components/AccesReserve';
import { ActionsCommandeB2b } from '@/components/ActionsB2b';
import { apiSafe } from '@/lib/api';
import { statutCommande } from '@/lib/achats';
import { droits } from '@/lib/droits';
import { date, money, quantity } from '@/lib/format';
import { traduire } from '@/lib/i18n';

interface DetailB2b {
  order: {
    id: string; number: string; status: string; currency: string; payment_terms: string;
    requested_date: string | null; total: string; amount_paid: string; notes: string | null;
    created_at: string; invoice_id: string | null; sale_id: string | null;
    customer_id: string; customer_name: string; customer_code: string; customer_phone: string | null;
  };
  lines: { description: string; quantity: string; unit_price: string; discount_percent: string; line_total: string; sku: string }[];
}

/** Une commande professionnelle : son avancement, sa livraison et sa facture. */
export default async function PageCommandeB2b({ params }: { params: Promise<{ id: string }> }) {
  const { peut } = await droits();
  if (!peut('b2b.read')) return <AccesReserve titre={(await traduire()).t('nav.b2b')} />;
  const { id } = await params;
  const d = await apiSafe<DetailB2b | null>(`/b2b/orders/${id}`, null);
  if (!d) notFound();
  const o = d.order;
  const statut = statutCommande(o.status);
  const close = ['delivered', 'invoiced', 'cancelled'].includes(o.status);

  return (
    <>
      <div className="page-head">
        <p className="small"><Link href="/pharmacie/b2b">← Commandes B2B</Link></p>
        <h1 className="mono">{o.number}</h1>
        <p>
          <span className={`tag ${statut.ton}`}>{statut.libelle}</span>{' '}
          {o.customer_name} <span className="small muted mono">{o.customer_code}</span>
          {o.customer_phone ? ` · ${o.customer_phone}` : ''} · {o.payment_terms === 'credit' ? 'à crédit' : 'comptant'}
          {o.requested_date ? ` · souhaitée le ${date(o.requested_date)}` : ''} · <strong>{money(o.total, o.currency)}</strong>
        </p>
      </div>

      {o.invoice_id && (
        <section className="card">
          <p style={{ margin: 0 }}>
            Livrée et facturée : <Link href={`/pharmacie/factures/${o.invoice_id}`}>ouvrir la facture</Link> (PDF, WhatsApp, e-mail, règlement).
          </p>
        </section>
      )}

      {!close && peut('b2b.write') && (
        <section className="card">
          <div className="card-head">
            <h2>Avancement</h2>
            <span className="hint">La livraison sort le stock (lot qui périme le premier) et émet la facture</span>
          </div>
          <ActionsCommandeB2b commandeId={o.id} statut={o.status} conditions={o.payment_terms} total={Number(o.total)} />
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>Produits</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th className="num">Quantité</th>
                <th className="num">Prix unitaire</th>
                <th className="num">Remise</th>
                <th className="num">Montant</th>
              </tr>
            </thead>
            <tbody>
              {d.lines.map((l, n) => (
                <tr key={n}>
                  <td><strong>{l.description}</strong><br /><span className="small muted mono">{l.sku}</span></td>
                  <td className="num">{quantity(l.quantity)}</td>
                  <td className="num">{money(l.unit_price, o.currency)}</td>
                  <td className="num">{Number(l.discount_percent) > 0 ? `${quantity(l.discount_percent)} %` : '—'}</td>
                  <td className="num">{money(l.line_total, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {o.notes && <p className="small muted" style={{ marginBottom: 0 }}>Remarques : {o.notes}</p>}
      </section>
    </>
  );
}
