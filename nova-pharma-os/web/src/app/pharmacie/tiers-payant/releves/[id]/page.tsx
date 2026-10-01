import Link from 'next/link';
import { notFound } from 'next/navigation';
import AccesReserve from '@/components/AccesReserve';
import PartagePdf from '@/components/PartagePdf';
import { ActionsReleve } from '@/components/TiersPayant';
import { apiSafe } from '@/lib/api';
import { droits } from '@/lib/droits';
import { date, dateTime, money } from '@/lib/format';
import { traduire } from '@/lib/i18n';
import { STATUTS_RELEVE } from '@/lib/tiers-payant';

interface DetailReleve {
  claim: {
    id: string; number: string; payer_id: string; payer_name: string; payer_phone: string | null;
    payer_email: string | null; period_start: string; period_end: string; status: string; currency: string;
    total: string; amount_paid: string; balance: string; due_date: string | null; sent_at: string | null;
  };
  sales: {
    id: string; number: string; sold_at: string; total: string; payer_share: string; patient_share: string;
    coverage_percent: string; authorization_number: string | null; member_name: string | null;
    member_number: string | null; principal_name: string | null;
  }[];
  payments: { method: string; amount: string; reference: string | null; received_at: string }[];
}

const MOYENS: Record<string, string> = {
  bank_transfer: 'Virement', cash: 'Espèces', mobile_money: 'Mobile Money', bank_local: 'Banque', manual: 'Autre',
};

/** Relevé présenté à un payeur : ses ventes, son PDF, ses règlements. */
export default async function PageReleve({ params }: { params: Promise<{ id: string }> }) {
  const { peut } = await droits();
  if (!peut('customers.credit')) return <AccesReserve titre={(await traduire()).t('nav.tiers_payant')} />;
  const { id } = await params;
  const d = await apiSafe<DetailReleve | null>(`/payers/claims/${id}`, null);
  if (!d) notFound();
  const c = d.claim;
  const statut = STATUTS_RELEVE[c.status] ?? { libelle: c.status, ton: 'muted' };

  return (
    <>
      <div className="page-head">
        <p className="small"><Link href={`/pharmacie/tiers-payant/${c.payer_id}`}>← {c.payer_name}</Link></p>
        <h1 className="mono">{c.number}</h1>
        <p>
          <span className={`tag ${statut.ton}`}>{statut.libelle}</span>{' '}
          Relevé de <strong>{c.payer_name}</strong> du {date(c.period_start)} au {date(c.period_end)} ·{' '}
          <strong>{money(c.total, c.currency)}</strong>
          {Number(c.amount_paid) > 0 ? ` · réglé ${money(c.amount_paid, c.currency)} · reste ${money(c.balance, c.currency)}` : ''}
          {c.due_date ? ` · à régler avant le ${date(c.due_date)}` : ''}
        </p>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Document à présenter</h2>
          <span className="hint">Imprimez-le pour le visa de l’organisme, ou envoyez-le par WhatsApp ou e-mail</span>
        </div>
        <PartagePdf
          url={`/api/proxy/payers/claims/${c.id}/pdf`}
          nomFichier={`releve-${c.number}.pdf`}
          titre={`Relevé ${c.number}`}
          texte={`Bonjour,\nVeuillez trouver le relevé ${c.number} (${date(c.period_start)} – ${date(c.period_end)}) : ${d.sales.length} vente(s), ${money(c.total, c.currency)} à votre charge.\nMerci.`}
          telephone={c.payer_phone}
          email={c.payer_email}
        />
      </section>

      {c.status !== 'cancelled' && c.status !== 'paid' && (
        <section className="card">
          <div className="card-head"><h2>Suivi</h2></div>
          <ActionsReleve id={c.id} statut={c.status} reste={Number(c.balance)} />
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>Ventes</h2><span className="hint">{d.sales.length}</span></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Vente</th>
                <th>Bénéficiaire</th>
                <th>Bon</th>
                <th className="num">Montant</th>
                <th className="num">Taux</th>
                <th className="num">Part patient</th>
                <th className="num">Part organisme</th>
              </tr>
            </thead>
            <tbody>
              {d.sales.map((v) => (
                <tr key={v.id}>
                  <td className="small">{dateTime(v.sold_at)}</td>
                  <td><Link href={`/pharmacie/ventes/${v.id}`} className="mono">{v.number}</Link></td>
                  <td>
                    {v.member_name ?? '—'} <span className="small muted mono">{v.member_number}</span>
                    {v.principal_name && <><br /><span className="small muted">ayant droit de {v.principal_name}</span></>}
                  </td>
                  <td className="small">{v.authorization_number ?? '—'}</td>
                  <td className="num">{money(v.total, c.currency)}</td>
                  <td className="num">{Number(v.coverage_percent).toLocaleString('fr-FR')} %</td>
                  <td className="num">{money(v.patient_share, c.currency)}</td>
                  <td className="num"><strong>{money(v.payer_share, c.currency)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {d.payments.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Règlements reçus</h2></div>
          <ul style={{ margin: 0 }}>
            {d.payments.map((p, i) => (
              <li key={i}>
                {dateTime(p.received_at)} · {MOYENS[p.method] ?? p.method}{p.reference ? ` réf. ${p.reference}` : ''} ·{' '}
                <strong>{money(p.amount, c.currency)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
