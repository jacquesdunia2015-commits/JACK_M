import { notFound, redirect } from 'next/navigation';
import { CommandesTicket } from '@/components/ImpressionTicket';
import { apiSafe } from '@/lib/api';
import { money } from '@/lib/format';
import { readSession } from '@/lib/session';

interface Recu {
  organization: {
    legal_name: string; trade_name: string | null; address: string | null; city: string | null;
    phone: string | null; tax_id: string | null; license_number: string | null;
  };
  branch: { name: string; address: string | null; city: string | null; phone: string | null };
  coverage: { payer_name: string; member_name: string | null; member_number: string | null } | null;
  loyalty: { earned: number; redeemed: number; balance: number | null } | null;
  sale: {
    number: string; status: string; currency: string; sold_at: string; subtotal: string; discount_total: string;
    tax_total: string; total: string; change_given: string; change_amount: string | null; change_currency: string | null;
    payer_share: string; patient_share: string | null; customer_name: string | null; sold_by_name: string | null;
    authorization_number: string | null; created_at: string;
  };
  lines: { description: string; quantity: string; unit_price: string; discount_percent: string; line_total: string }[];
  payments: {
    method: string; provider: string | null; amount: string; reference: string | null;
    tendered_currency: string | null; tendered_amount: string | null; exchange_rate: string | null;
  }[];
}

const MOYENS: Record<string, string> = {
  cash: 'Espèces', mobile_money: 'Mobile Money', card: 'Carte', bank_transfer: 'Virement',
  bank_local: 'Banque', credit: 'À crédit', insurance: 'Tiers payant', loyalty: 'Points fidélité', manual: 'Autre',
};

/**
 * Ticket de caisse pour imprimante thermique (58 ou 80 mm) : en-tête de la
 * pharmacie, articles, total, règlements dans leur devise, monnaie rendue,
 * part du tiers payant.
 */
export default async function PageTicket({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ largeur?: string; imprimer?: string }>;
}) {
  if (!(await readSession())) redirect('/connexion');
  const { id } = await params;
  const { largeur: l, imprimer } = await searchParams;
  const largeur = l === '58' ? '58' : '80';
  const r = await apiSafe<Recu | null>(`/sales/${id}/receipt`, null);
  if (!r) notFound();
  const s = r.sale;
  const o = r.organization;
  const d = s.currency;
  // Une ligne par produit et par prix, même si la vente a puisé dans plusieurs lots.
  const lignes = Object.values(r.lines.reduce<Record<string, { libelle: string; qte: number; pu: number; total: number }>>((acc, x) => {
    const cle = `${x.description}|${x.unit_price}|${x.discount_percent}`;
    acc[cle] ??= { libelle: x.description, qte: 0, pu: Number(x.unit_price), total: 0 };
    acc[cle].qte += Number(x.quantity);
    acc[cle].total += Number(x.line_total);
    return acc;
  }, {}));
  const quand = new Date(s.sold_at);

  return (
    <>
      <div className="page-ticket">
      <CommandesTicket largeur={largeur} auto={imprimer === '1'} />
      <div className={`zone-impression ticket-thermique ticket-${largeur}`}>
        <div className="t-centre">
          <div className="t-titre">{o.trade_name || o.legal_name}</div>
          {[r.branch.address ?? o.address, r.branch.city ?? o.city].filter(Boolean).join(', ') && (
            <div>{[r.branch.address ?? o.address, r.branch.city ?? o.city].filter(Boolean).join(', ')}</div>
          )}
          {(r.branch.phone ?? o.phone) && <div>Tél. {r.branch.phone ?? o.phone}</div>}
          {o.tax_id && <div>N° impôt : {o.tax_id}</div>}
          {o.license_number && <div>Autorisation : {o.license_number}</div>}
        </div>
        <div className="t-trait" />
        <div className="t-ligne"><span>Ticket {s.number}</span></div>
        <div className="t-ligne">
          <span>{quand.toLocaleDateString('fr-FR')} {quand.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          {s.sold_by_name && <span>{s.sold_by_name}</span>}
        </div>
        {s.customer_name && <div>Client : {s.customer_name}</div>}
        {s.status === 'cancelled' && <div className="t-centre t-gras">*** VENTE ANNULÉE ***</div>}
        <div className="t-trait" />
        {lignes.map((x, i) => (
          <div key={i} className="t-article">
            <div>{x.libelle}</div>
            <div className="t-ligne">
              <span>{x.qte.toLocaleString('fr-FR')} × {money(x.pu, d)}</span>
              <span>{money(x.total, d)}</span>
            </div>
          </div>
        ))}
        <div className="t-trait" />
        {Number(s.discount_total) > 0 && <div className="t-ligne"><span>Remise</span><span>-{money(s.discount_total, d)}</span></div>}
        <div className="t-ligne t-total"><span>TOTAL</span><span>{money(s.total, d)}</span></div>
        {Number(s.tax_total) > 0 && <div className="t-ligne t-petit"><span>dont taxes</span><span>{money(s.tax_total, d)}</span></div>}
        {r.coverage && Number(s.payer_share) > 0 && (
          <>
            <div className="t-ligne"><span>Part {r.coverage.payer_name}</span><span>{money(s.payer_share, d)}</span></div>
            <div className="t-ligne t-gras"><span>Part patient</span><span>{money(s.patient_share, d)}</span></div>
            {r.coverage.member_name && (
              <div className="t-petit">Bénéficiaire : {r.coverage.member_name} ({r.coverage.member_number}){s.authorization_number ? ` · bon ${s.authorization_number}` : ''}</div>
            )}
          </>
        )}
        <div className="t-trait" />
        {r.payments.filter((p) => p.method !== 'insurance').map((p, i) => (
          <div key={i} className="t-ligne">
            <span>{MOYENS[p.method] ?? p.method}{p.reference ? ` ${p.reference}` : ''}</span>
            <span>{p.tendered_currency ? money(p.tendered_amount, p.tendered_currency) : money(p.amount, d)}</span>
          </div>
        ))}
        {r.payments.some((p) => p.tendered_currency) && (
          <div className="t-petit">Taux : 1 USD = {Number(r.payments.find((p) => p.exchange_rate)?.exchange_rate).toLocaleString('fr-FR')} FC</div>
        )}
        {Number(s.change_given) > 0 && (
          <div className="t-ligne t-gras"><span>Monnaie rendue</span><span>{money(s.change_amount ?? s.change_given, s.change_currency ?? d)}</span></div>
        )}
        {r.loyalty && (
          <>
            <div className="t-trait" />
            <div className="t-centre t-gras">Fidélité{s.customer_name ? ` — ${s.customer_name}` : ''}</div>
            {r.loyalty.redeemed > 0 && <div className="t-ligne"><span>Points utilisés</span><span>-{r.loyalty.redeemed}</span></div>}
            {r.loyalty.earned > 0 && <div className="t-ligne"><span>Points gagnés</span><span>+{r.loyalty.earned}</span></div>}
            {r.loyalty.balance !== null && <div className="t-ligne t-gras"><span>Votre solde</span><span>{r.loyalty.balance} points</span></div>}
          </>
        )}
        <div className="t-trait" />
        <div className="t-centre">Merci de votre confiance.</div>
        <div className="t-centre t-petit">Conservez ce ticket : il vous sera demandé pour tout échange.</div>
        {new Date(s.created_at).getTime() - quand.getTime() > 60_000 && (
          <div className="t-centre t-petit">Vente enregistrée hors connexion.</div>
        )}
      </div>
      </div>
    </>
  );
}
