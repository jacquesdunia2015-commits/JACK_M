import Link from 'next/link';
import { notFound } from 'next/navigation';
import AccesReserve from '@/components/AccesReserve';
import { ConvertirDevis } from '@/components/ActionsB2b';
import { apiSafe } from '@/lib/api';
import { statutCommande } from '@/lib/achats';
import { droits } from '@/lib/droits';
import { date, money, quantity } from '@/lib/format';
import { traduire } from '@/lib/i18n';

interface DetailDevis {
  quote: {
    id: string; number: string; status: string; currency: string; valid_until: string | null;
    total: string; notes: string | null; customer_name: string; customer_code: string;
    converted_order_id: string | null;
  };
  lines: { description: string; quantity: string; unit_price: string; discount_percent: string; line_total: string; sku: string }[];
}

/** Un devis professionnel, et sa transformation en commande. */
export default async function PageDevis({ params }: { params: Promise<{ id: string }> }) {
  const { peut } = await droits();
  if (!peut('b2b.read')) return <AccesReserve titre={(await traduire()).t('nav.b2b')} />;
  const { id } = await params;
  const d = await apiSafe<DetailDevis | null>(`/b2b/quotes/${id}`, null);
  if (!d) notFound();
  const q = d.quote;
  const statut = statutCommande(q.status);

  return (
    <>
      <div className="page-head">
        <p className="small"><Link href="/pharmacie/b2b">← Commandes B2B</Link></p>
        <h1 className="mono">Devis {q.number}</h1>
        <p>
          <span className={`tag ${statut.ton}`}>{statut.libelle}</span>{' '}
          {q.customer_name} <span className="small muted mono">{q.customer_code}</span>
          {q.valid_until ? ` · valable jusqu’au ${date(q.valid_until)}` : ''} · <strong>{money(q.total, q.currency)}</strong>
        </p>
      </div>

      <section className="card">
        {q.converted_order_id ? (
          <p style={{ margin: 0 }}>Ce devis est devenu une commande : <Link href={`/pharmacie/b2b/commandes/${q.converted_order_id}`}>l’ouvrir</Link>.</p>
        ) : peut('b2b.write') && !['rejected', 'expired', 'cancelled'].includes(q.status) ? (
          <ConvertirDevis devisId={q.id} />
        ) : (
          <p className="muted" style={{ margin: 0 }}>Ce devis ne peut plus être transformé.</p>
        )}
      </section>

      <section className="card">
        <div className="card-head"><h2>Produits proposés</h2></div>
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
                  <td className="num">{money(l.unit_price, q.currency)}</td>
                  <td className="num">{Number(l.discount_percent) > 0 ? `${quantity(l.discount_percent)} %` : '—'}</td>
                  <td className="num">{money(l.line_total, q.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {q.notes && <p className="small muted" style={{ marginBottom: 0 }}>Remarques : {q.notes}</p>}
      </section>
    </>
  );
}
