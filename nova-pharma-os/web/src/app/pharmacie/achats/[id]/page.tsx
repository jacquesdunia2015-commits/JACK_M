import Link from 'next/link';
import { notFound } from 'next/navigation';
import AccesReserve from '@/components/AccesReserve';
import { LigneCommande, ReceptionCommande, TransmettreCommande } from '@/components/ActionsCommande';
import { apiSafe } from '@/lib/api';
import { statutCommande } from '@/lib/achats';
import { droits } from '@/lib/droits';
import { date, money, quantity } from '@/lib/format';
import { traduire } from '@/lib/i18n';

interface DetailCommande {
  order: {
    id: string; number: string; status: string; currency: string; order_date: string;
    expected_date: string | null; total: string; notes: string | null;
    supplier_id: string; supplier_name: string; supplier_phone: string | null; contact_name: string | null;
  };
  lines: (LigneCommande & { line_total: string; unit: string })[];
  receipts: { id: string; number: string; status: string; received_date: string; supplier_invoice_number: string | null }[];
}

/** Une commande fournisseur : ses lignes, sa transmission, ses réceptions. */
export default async function PageCommande({ params }: { params: Promise<{ id: string }> }) {
  const { peut } = await droits();
  if (!peut('purchasing.read')) return <AccesReserve titre={(await traduire()).t('nav.achats')} />;
  const { id } = await params;
  const d = await apiSafe<DetailCommande | null>(`/purchasing/orders/${id}`, null);
  if (!d) notFound();
  const o = d.order;
  const statut = statutCommande(o.status);
  const aRecevoir = ['submitted', 'partially_received'].includes(o.status);

  return (
    <>
      <div className="page-head">
        <p className="small"><Link href="/pharmacie/achats">← Achats</Link></p>
        <h1 className="mono">{o.number}</h1>
        <p>
          <span className={`tag ${statut.ton}`}>{statut.libelle}</span>{' '}
          <Link href={`/pharmacie/fournisseurs/${o.supplier_id}`}>{o.supplier_name}</Link>
          {o.supplier_phone ? ` · ${o.supplier_phone}` : ''} · commandée le {date(o.order_date)}
          {o.expected_date ? ` · attendue le ${date(o.expected_date)}` : ''} · <strong>{money(o.total, o.currency)}</strong>
        </p>
      </div>

      {o.status === 'draft' && peut('purchasing.write') && (
        <section className="card">
          <div className="card-head">
            <h2>Transmettre</h2>
            <span className="hint">Envoyez la commande au fournisseur (téléphone, WhatsApp, réquisition PDF), puis marquez-la transmise</span>
          </div>
          <TransmettreCommande commandeId={o.id} />
        </section>
      )}

      {aRecevoir && peut('purchasing.receive') && (
        <section className="card">
          <div className="card-head">
            <h2>Réceptionner la livraison</h2>
            <span className="hint">Ce qui est reçu entre aussitôt en stock</span>
          </div>
          {/* Une nouvelle réception repart d'un formulaire neuf : restes à jour,
              nouvelle clé anti-double-clic. */}
          <ReceptionCommande key={d.lines.map((l) => l.received_quantity).join('|')}
            commandeId={o.id} fournisseurId={o.supplier_id} lignes={d.lines} />
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>Produits commandés</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th className="num">Commandé</th>
                <th className="num">Reçu</th>
                <th className="num">Prix unitaire</th>
                <th className="num">Montant</th>
              </tr>
            </thead>
            <tbody>
              {d.lines.map((l) => {
                const complet = Number(l.received_quantity) >= Number(l.quantity);
                return (
                  <tr key={l.id}>
                    <td><strong>{l.name}</strong><br /><span className="small muted mono">{l.sku}</span></td>
                    <td className="num">{quantity(l.quantity)}</td>
                    <td className="num">
                      <span className={`tag ${complet ? 'ok' : Number(l.received_quantity) > 0 ? 'warn' : 'muted'}`}>{quantity(l.received_quantity)}</span>
                    </td>
                    <td className="num">{money(l.unit_cost, o.currency)}</td>
                    <td className="num">{money(l.line_total, o.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {o.notes && <p className="small muted" style={{ marginBottom: 0 }}>Remarques : {o.notes}</p>}
      </section>

      {d.receipts.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Réceptions</h2></div>
          <ul style={{ margin: 0 }}>
            {d.receipts.map((r) => (
              <li key={r.id}>
                <span className="mono">{r.number}</span> · {date(r.received_date)}
                {r.supplier_invoice_number ? ` · facture fournisseur ${r.supplier_invoice_number}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
