import AccesReserve from '@/components/AccesReserve';
import Depliable from '@/components/Depliable';
import { ConfirmerVersement, LienTransfertSms, NouvelleDemande, SmsEnAttente, type Attente, type Operateur } from '@/components/MobileMoney';
import Vide from '@/components/Vide';
import { apiSafe } from '@/lib/api';
import { droits } from '@/lib/droits';
import { dateTime, money } from '@/lib/format';
import { traduire } from '@/lib/i18n';

interface Collecte extends Attente {
  payer_name: string | null; status: string; operator_reference: string | null; requested_at: string;
  confirmed_at: string | null; sale_number: string | null; customer_name: string | null; operator_label: string | null;
}
interface Sms { id: string; body: string; amount: string | null; currency: string | null; payer_phone: string | null; transaction_id: string | null; note: string | null; received_at: string; operator_code: string | null }

const STATUTS: Record<string, { libelle: string; ton: string }> = {
  requested: { libelle: 'En attente', ton: 'warn' }, confirmed: { libelle: 'Confirmé', ton: 'ok' },
  failed: { libelle: 'Échoué', ton: 'danger' }, cancelled: { libelle: 'Annulé', ton: 'muted' },
};

/** Encaissements Mobile Money : demandes, confirmation par SMS, transfert automatique. */
export default async function PageMobileMoney() {
  const { peut } = await droits();
  if (!peut('payments.read')) return <AccesReserve titre={(await traduire()).t('nav.mobile_money')} />;
  const [collectes, operateurs, lien, sms] = await Promise.all([
    apiSafe<Collecte[]>('/payments/mobile-money', []),
    apiSafe<Operateur[]>('/payments/mobile-money/operators', []),
    apiSafe<{ token_hint: string; is_active: boolean; last_received_at: string | null } | null>('/payments/mobile-money/sms-link', null),
    apiSafe<Sms[]>('/payments/mobile-money/sms?status=unmatched', []),
  ]);
  const attentes = collectes.filter((c) => c.status === 'requested');
  const ecrire = peut('payments.write');

  return (
    <>
      <div className="page-head">
        <h1>Mobile Money</h1>
        <p>
          M-Pesa, Orange Money, Airtel Money : le client paie sur le numéro marchand de la pharmacie, et la preuve est le SMS de
          l’opérateur. Collez-le, ou laissez le téléphone marchand le transférer tout seul : NOVA vérifie le montant et
          ne compte jamais deux fois la même transaction. Aucun contrat ni frais NOVA.
        </p>
      </div>

      {ecrire && (
        <section className="card">
          <Depliable resume="Demander un versement" ouvert={false}>
            <NouvelleDemande operateurs={operateurs} />
          </Depliable>
        </section>
      )}

      {sms.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>SMS à examiner ({sms.length})</h2><span className="hint">Reçus sans correspondance certaine</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Reçu</th><th>SMS</th><th>Lu par NOVA</th><th /></tr></thead>
              <tbody>
                {sms.map((s) => (
                  <tr key={s.id}>
                    <td className="small">{dateTime(s.received_at)}</td>
                    <td className="small" style={{ maxWidth: 360 }}>{s.body}</td>
                    <td className="small">
                      {s.amount ? money(s.amount, s.currency ?? 'USD') : '—'}{s.payer_phone ? ` · ${s.payer_phone}` : ''}
                      {s.transaction_id ? <div className="mono">{s.transaction_id}</div> : null}
                      {s.note && <div className="muted">{s.note}</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {ecrire && <SmsEnAttente id={s.id} attentes={attentes.filter((a) => !s.amount || Math.abs(Number(a.amount) - Number(s.amount)) < 0.005)} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>Encaissements</h2><span className="hint">{attentes.length} en attente</span></div>
        {collectes.length === 0 ? (
          <Vide message="Aucun encaissement Mobile Money pour l’instant." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Référence</th><th>Client</th><th>Opérateur</th><th className="num">Montant</th><th>État</th><th /></tr></thead>
              <tbody>
                {collectes.map((c) => (
                  <tr key={c.id}>
                    <td><span className="mono">{c.reference}</span><div className="small muted">{dateTime(c.requested_at)}{c.sale_number ? ` · vente ${c.sale_number}` : ''}</div></td>
                    <td className="small">{c.customer_name ?? c.payer_name ?? '—'}<div className="muted">{c.payer_phone}</div></td>
                    <td className="small">{c.operator_label ?? c.operator_code}</td>
                    <td className="num">{money(c.amount, c.currency)}</td>
                    <td>
                      <span className={`tag ${STATUTS[c.status]?.ton ?? 'muted'}`}>{STATUTS[c.status]?.libelle ?? c.status}</span>
                      {c.operator_reference && <div className="small mono muted">{c.operator_reference}</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>{ecrire && c.status === 'requested' && <ConfirmerVersement id={c.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <Depliable resume="Confirmation automatique par le téléphone marchand" ouvert={!lien?.is_active}>
          <LienTransfertSms etat={lien} peutRegler={peut('settings.write')} />
        </Depliable>
      </section>
    </>
  );
}
