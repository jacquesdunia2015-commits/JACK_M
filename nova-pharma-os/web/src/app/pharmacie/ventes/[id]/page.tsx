import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmettreFacture } from '@/components/Facture';
import { apiSafe } from '@/lib/api';
import { date, dateTime, money, quantity } from '@/lib/format';
import { MOYENS_PAIEMENT } from '@/lib/factures';
import AccesReserve from '@/components/AccesReserve';
import { droits } from '@/lib/droits';
import { traduire } from '@/lib/i18n';

interface DetailVente {
  sale: {
    id: string; number: string; status: string; currency: string; total: string; sold_at: string;
    customer_id: string | null; customer_name: string | null; customer_code: string | null;
    customer_phone: string | null; sold_by_name: string | null; invoice_id: string | null;
    cancel_reason: string | null; change_currency: string | null; change_amount: string | null;
  };
  lines: {
    description: string; quantity: string; unit_price: string; line_total: string;
    lot_number: string | null; expiry_date: string | null;
  }[];
  payments: {
    method: string; provider: string | null; amount: string;
    tendered_currency: string | null; tendered_amount: string | null; exchange_rate: string | null;
  }[];
}

/** Une vente, et l'établissement de sa facture si le client la demande. */
export default async function PageVente({ params }: { params: Promise<{ id: string }> }) {
  if (!(await droits()).peut('sales.read')) return <AccesReserve titre={(await traduire()).t('nav.factures')} />;
  const { id } = await params;
  const v = await apiSafe<DetailVente | null>(`/sales/${id}`, null);
  if (!v) notFound();
  const s = v.sale;
  const annulee = s.status === 'cancelled';

  return (
    <>
      <div className="page-head">
        <p className="small"><Link href="/pharmacie/factures">← Factures</Link></p>
        <h1 className="mono">Vente {s.number}</h1>
        <p>
          {annulee && <><span className="tag muted">Annulée</span>{' '}</>}
          {dateTime(s.sold_at)}{s.sold_by_name ? ` · servie par ${s.sold_by_name}` : ''} · <strong>{money(s.total, s.currency)}</strong>
          {s.customer_name ? ` · ${s.customer_name}` : ''}
        </p>
      </div>

      <section className="card">
        <div className="card-head"><h2>Facture</h2></div>
        {annulee ? (
          <p className="muted" style={{ margin: 0 }}>Vente annulée{s.cancel_reason ? ` : ${s.cancel_reason}` : ''}. Elle ne peut plus être facturée.</p>
        ) : s.invoice_id ? (
          <p style={{ margin: 0 }}>
            Cette vente est déjà facturée : <Link href={`/pharmacie/factures/${s.invoice_id}`}>ouvrir la facture</Link>.
          </p>
        ) : s.customer_id ? (
          <>
            <p style={{ marginTop: 0 }}>Au nom de <strong>{s.customer_name}</strong> <span className="small muted mono">{s.customer_code}</span>.</p>
            <EmettreFacture venteId={s.id} clientConnu />
          </>
        ) : (
          <EmettreFacture venteId={s.id} />
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Articles</h2>
          <span className="hint">
            {v.payments.map((p) =>
              `${MOYENS_PAIEMENT[p.method] ?? p.method}${p.provider ? ` (${p.provider})` : ''} ` +
              (p.tendered_currency
                ? `${money(p.tendered_amount, p.tendered_currency)} (${money(p.amount, s.currency)} au taux de ${Number(p.exchange_rate).toLocaleString('fr-FR')})`
                : money(p.amount, s.currency)),
            ).join(' · ')}
            {s.change_amount && Number(s.change_amount) > 0 ? ` · monnaie rendue ${money(s.change_amount, s.change_currency ?? s.currency)}` : ''}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Désignation</th>
                <th className="num">Qté</th>
                <th className="num">Prix unitaire</th>
                <th className="num">Montant</th>
              </tr>
            </thead>
            <tbody>
              {v.lines.map((l, n) => (
                <tr key={n}>
                  <td>
                    <strong>{l.description}</strong>
                    {(l.lot_number || l.expiry_date) && (
                      <><br /><span className="small muted">{[l.lot_number ? `Lot ${l.lot_number}` : null, l.expiry_date ? `exp. ${date(l.expiry_date)}` : null].filter(Boolean).join(' · ')}</span></>
                    )}
                  </td>
                  <td className="num">{quantity(l.quantity)}</td>
                  <td className="num">{money(l.unit_price, s.currency)}</td>
                  <td className="num">{money(l.line_total, s.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
