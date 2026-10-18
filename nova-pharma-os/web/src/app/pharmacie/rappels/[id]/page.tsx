import Link from 'next/link';
import { notFound } from 'next/navigation';
import AccesReserve from '@/components/AccesReserve';
import { ActionsRappel, PrevenirClient } from '@/components/Rappels';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { droits } from '@/lib/droits';
import { date, dateTime, designation, quantity } from '@/lib/format';
import { traduire } from '@/lib/i18n';
import { ACTIONS_RAPPEL, ISSUES_RAPPEL, SOURCES_RAPPEL, TYPES_RAPPEL } from '@/lib/rappels';

interface Detail {
  recall: {
    id: string; alert_id: string | null; kind: string; title: string; product_name: string; lot_numbers: string[];
    source: string; reference: string | null; description: string | null; action_required: string; status: string;
    resolution: string | null; resolution_note: string | null; customers_notified: number; created_at: string; closed_at: string | null;
  };
  lots: { lot_id: string; product_name: string; dosage: string | null; lot_number: string; expiry_date: string | null; is_quarantined: boolean; stock: string }[];
  customers: { customer_id: string; name: string; phone: string | null; quantity: string; last_sale_at: string; sales: string }[];
  anonymousSales: { quantity: number; sales: number };
}

/** Un rappel : lots concernés, clients qui les ont achetés, décisions. */
export default async function PageRappel({ params }: { params: Promise<{ id: string }> }) {
  const { peut } = await droits();
  if (!peut('inventory.read')) return <AccesReserve titre={(await traduire()).t('nav.rappels')} />;
  const { id } = await params;
  const d = await apiSafe<Detail | null>(`/recalls/${id}`, null);
  if (!d) notFound();
  const r = d.recall;
  const ouvert = r.status === 'open';
  const stock = d.lots.reduce((s, l) => s + Number(l.stock), 0);

  return (
    <>
      <div className="page-head">
        <p className="small"><Link href="/pharmacie/rappels">← Rappels de lots</Link></p>
        <h1>{r.title}</h1>
        <p>
          <span className={`tag ${TYPES_RAPPEL[r.kind]?.ton ?? 'warn'}`}>{TYPES_RAPPEL[r.kind]?.libelle ?? r.kind}</span>{' '}
          {r.product_name} · lots <span className="mono">{r.lot_numbers.length ? r.lot_numbers.join(', ') : 'tous'}</span> ·{' '}
          {SOURCES_RAPPEL[r.source] ?? r.source}{r.reference ? ` (${r.reference})` : ''} · {date(r.created_at)}
        </p>
      </div>

      {r.description && <div className="banner warn"><strong>Conduite demandée : {ACTIONS_RAPPEL[r.action_required] ?? r.action_required}.</strong> {r.description}</div>}
      {!ouvert && (
        <div className="banner info">
          Clos le {r.closed_at ? dateTime(r.closed_at) : ''} — {r.resolution ? ISSUES_RAPPEL[r.resolution] : ''}{r.resolution_note ? ` · ${r.resolution_note}` : ''}
        </div>
      )}

      <section className="card">
        <div className="card-head"><h2>Lots dans votre stock</h2><span className="hint">{quantity(stock)} unité(s)</span></div>
        {d.lots.length === 0 ? (
          <Vide message="Aucun lot correspondant dans votre stock : votre pharmacie n’est pas concernée." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Produit</th><th>Lot</th><th>Péremption</th><th className="num">En stock</th><th>État</th></tr></thead>
              <tbody>
                {d.lots.map((l) => (
                  <tr key={l.lot_id}>
                    <td>{designation(l.product_name, l.dosage)}</td>
                    <td className="mono">{l.lot_number}</td>
                    <td>{l.expiry_date ? date(l.expiry_date) : '—'}</td>
                    <td className="num">{quantity(l.stock)}</td>
                    <td>{l.is_quarantined ? <span className="tag muted">Quarantaine</span> : <span className="tag danger">En vente</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ouvert && peut('inventory.adjust') && (
          <div style={{ marginTop: '0.75rem' }}>
            <ActionsRappel id={r.id} lotsABloquer={d.lots.filter((l) => !l.is_quarantined).length} aDuStock={stock > 0} />
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Clients qui ont acheté ces lots</h2>
          <span className="hint">{r.customers_notified} message(s) préparé(s)</span>
        </div>
        {d.customers.length === 0 ? (
          <Vide message="Aucun client identifié n’a acheté ces lots." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Client</th><th>Téléphone</th><th className="num">Quantité</th><th>Dernier achat</th><th /></tr></thead>
              <tbody>
                {d.customers.map((c) => (
                  <tr key={c.customer_id}>
                    <td>{c.name}</td>
                    <td className="small">{c.phone ?? '—'}</td>
                    <td className="num">{quantity(c.quantity)}</td>
                    <td className="small">{dateTime(c.last_sale_at)}</td>
                    <td style={{ textAlign: 'right' }}>{peut('messaging.write') && <PrevenirClient rappelId={r.id} clientId={c.customer_id} telephone={c.phone} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d.anonymousSales.quantity > 0 && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            {quantity(d.anonymousSales.quantity)} unité(s) vendues en {d.anonymousSales.sales} vente(s) sans client identifié : affichez l’avis au comptoir.
          </p>
        )}
      </section>
    </>
  );
}
