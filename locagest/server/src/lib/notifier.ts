import { query } from '../db/pool.js';
import { ALERT_ACTIONS, guaranteeStatus, guaranteeThreshold, paymentState, paymentThreshold } from './alerts.js';
import { sendMail } from './mailer.js';
import { today as todayFn, firstOfMonth } from './dates.js';
import { config } from './config.js';
import { formatAddress } from './leases.js';
import { fmtMoney } from './contract.js';

const LEVEL_EMOJI = { vert: '🟢', jaune: '🟡', orange: '🟠', rouge: '🔴' } as const;

interface Recipient {
  type: 'bailleur' | 'locataire';
  email: string | null;
}

/**
 * Enregistre puis envoie une alerte. L'unicité (bail, type, palier, échéance,
 * destinataire) garantit qu'une même alerte n'est jamais envoyée deux fois,
 * même si la tâche tourne plusieurs fois par jour ou sur plusieurs serveurs.
 */
async function dispatch(a: {
  ownerId: number;
  leaseId: number;
  kind: 'garantie' | 'paiement';
  level: string;
  threshold: number;
  dueRef: string;
  recipient: Recipient;
  subject: string;
  text: string;
}) {
  if (!a.recipient.email) return false;
  const claimed = await query(
    `INSERT INTO alerts(owner_id, lease_id, kind, level, threshold, due_ref, recipient_type, recipient, status, message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'simule',$9)
     ON CONFLICT (lease_id, kind, threshold, due_ref, recipient_type) DO NOTHING RETURNING id`,
    [a.ownerId, a.leaseId, a.kind, a.level, a.threshold, a.dueRef, a.recipient.type, a.recipient.email, a.subject],
  );
  if (!claimed.rowCount) return false;
  const result = await sendMail({ to: a.recipient.email, subject: a.subject, text: a.text });
  await query('UPDATE alerts SET status = $2, error = $3 WHERE id = $1', [claimed.rows[0].id, result.status, result.error ?? null]);
  return true;
}

/** Parcourt les baux actifs et envoie les alertes de garantie et de retard de paiement dues. */
export async function runAlerts(ref = todayFn()) {
  const { rows: leases } = await query(
    `SELECT l.*, p.title, p.province, p.commune, p.quartier, p.avenue, p.numero,
            t.first_name, t.last_name, t.email AS tenant_email,
            u.email AS landlord_email, u.full_name AS landlord_name
       FROM leases l
       JOIN properties p ON p.id = l.property_id
       JOIN tenants t ON t.id = l.tenant_id
       JOIN users u ON u.id = l.owner_id
      WHERE l.status = 'actif' AND u.active`,
  );
  let sent = 0;
  for (const l of leases) {
    const tenantName = `${l.first_name} ${l.last_name}`;
    const place = `${l.title} (${formatAddress(l)})`;
    const recipients: Recipient[] = [
      { type: 'bailleur', email: l.landlord_email },
      { type: 'locataire', email: l.tenant_email },
    ];

    // 1. Garantie
    const g = guaranteeStatus(l.guarantee_expires_on, ref);
    const threshold = guaranteeThreshold(g.daysRemaining);
    if (threshold !== null) {
      const when =
        g.daysRemaining > 0
          ? `expire dans ${g.daysRemaining} jour(s), le ${l.guarantee_expires_on}`
          : g.daysRemaining === 0
            ? `expire aujourd'hui`
            : `a expiré depuis ${-g.daysRemaining} jour(s) (le ${l.guarantee_expires_on})`;
      for (const r of recipients) {
        const text =
          r.type === 'bailleur'
            ? `Bonjour ${l.landlord_name},\n\nLa garantie du bail de ${tenantName} pour ${place} ${when}.\n` +
              `Action recommandée : ${ALERT_ACTIONS[g.level]}.\n\nOuvrir le bail : ${config.appUrl}/baux/${l.id}\n\n— LocaGest`
            : `Bonjour ${tenantName},\n\nLa garantie de votre bail pour ${place} ${when}.\n` +
              `Merci de prendre contact avec votre bailleur (${l.landlord_name}) pour le renouvellement.\n\n— LocaGest`;
        if (
          await dispatch({
            ownerId: l.owner_id, leaseId: l.id, kind: 'garantie', level: g.level, threshold,
            dueRef: l.guarantee_expires_on, recipient: r,
            subject: `${LEVEL_EMOJI[g.level]} Garantie ${g.daysRemaining > 0 ? `à ${g.daysRemaining} j de l'expiration` : 'expirée'} — ${l.title}`,
            text,
          })
        ) sent++;
      }
    }

    // 2. Loyer du mois en cours
    const period = firstOfMonth(ref);
    if (period >= firstOfMonth(l.start_date) && period <= firstOfMonth(l.end_date)) {
      const { rows } = await query('SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE lease_id = $1 AND period = $2', [l.id, period]);
      const s = paymentState({ period, startDate: l.start_date, rent: l.monthly_rent, paid: rows[0].paid, today: ref });
      const pt = s.state === 'paye' ? null : paymentThreshold(s.daysLate);
      if (pt !== null) {
        const level = pt >= 15 ? 'rouge' : pt >= 10 ? 'orange' : 'jaune';
        const due = fmtMoney(s.remaining, l.currency);
        for (const r of recipients) {
          const text =
            r.type === 'bailleur'
              ? `Bonjour ${l.landlord_name},\n\nLe loyer de ${period.slice(0, 7)} de ${tenantName} (${place}) est en retard de ${s.daysLate} jours. Reste dû : ${due}.\n\n${config.appUrl}/baux/${l.id}\n\n— LocaGest`
              : `Bonjour ${tenantName},\n\nSauf erreur, le loyer de ${period.slice(0, 7)} pour ${place} n'a pas encore été réglé (${s.daysLate} jours de retard). Reste dû : ${due}.\nMerci de régulariser auprès de ${l.landlord_name}.\n\n— LocaGest`;
          if (
            await dispatch({
              ownerId: l.owner_id, leaseId: l.id, kind: 'paiement', level, threshold: pt, dueRef: period, recipient: r,
              subject: `${LEVEL_EMOJI[level]} Loyer en retard de ${s.daysLate} jours — ${l.title}`,
              text,
            })
          ) sent++;
        }
      }
    }
  }
  return { checked: leases.length, sent };
}

/** Lance la vérification au démarrage puis toutes les heures. */
export function startAlertScheduler(intervalMs = 60 * 60_000) {
  const tick = () => runAlerts().then(
    (r) => r.sent && console.log(`Alertes : ${r.sent} envoyée(s) sur ${r.checked} bail(s) actif(s)`),
    (e) => console.error('Tâche des alertes en échec', e),
  );
  void tick();
  return setInterval(tick, intervalMs);
}
