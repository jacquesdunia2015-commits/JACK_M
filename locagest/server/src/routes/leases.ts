import { Router } from 'express';
import { z } from 'zod';
import { one, query, transaction } from '../db/pool.js';
import { currentUser, idParam, requireRole } from '../lib/auth.js';
import { HttpError, notFound } from '../lib/errors.js';
import { currency, dateStr, money, optText } from '../lib/validation.js';
import { audit } from '../lib/audit.js';
import { LEASE_SELECT, withGuarantee } from '../lib/leases.js';
import { addDays, addMonths, daysBetween, today } from '../lib/dates.js';
import { leasePeriods, paymentState } from '../lib/alerts.js';
import { renderContract, renderReceipt } from '../lib/contract.js';

export const leasesRouter = Router();
leasesRouter.use(requireRole('bailleur'));

const baseSchema = z.object({
  startDate: dateStr,
  endDate: dateStr,
  guaranteeExpiresOn: dateStr.nullish().or(z.literal('').transform(() => null)),
  monthlyRent: money,
  currency: currency.optional(),
  guaranteeAmount: money.default(0),
  terms: optText,
  autoRenew: z.boolean().default(false),
});
const checkDates = (d: { startDate: string; endDate: string }) => d.endDate > d.startDate;
const datesMsg = { message: 'La date de fin doit être postérieure à la date de début', path: ['endDate'] };

const createSchema = baseSchema
  .extend({
    propertyId: z.coerce.number().int().positive(),
    tenantId: z.coerce.number().int().positive(),
    acceptBlacklisted: z.boolean().default(false),
  })
  .refine(checkDates, datesMsg);
const updateSchema = baseSchema.refine(checkDates, datesMsg);

async function ownedLease(ownerId: number, id: number) {
  const l = await one(`${LEASE_SELECT} WHERE l.id = $1 AND l.owner_id = $2`, [id, ownerId]);
  if (!l) throw notFound('lease');
  return l;
}

/** Échéancier : statut du loyer pour chaque mois du bail écoulé. */
async function schedule(lease: any, ref = today()) {
  const { rows } = await query(
    'SELECT period, SUM(amount) AS paid FROM payments WHERE lease_id = $1 GROUP BY period',
    [lease.id],
  );
  const paid = new Map(rows.map((r) => [r.period, r.paid]));
  const until = lease.status === 'actif' ? ref : lease.end_date;
  return leasePeriods(lease.start_date, lease.end_date, until).map((period) => ({
    period,
    rent: lease.monthly_rent,
    paid: paid.get(period) ?? 0,
    ...paymentState({ period, startDate: lease.start_date, rent: lease.monthly_rent, paid: paid.get(period) ?? 0, today: ref }),
  }));
}

leasesRouter.get('/', async (req, res) => {
  const me = currentUser(req);
  const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : null;
  const level = typeof req.query.level === 'string' && req.query.level ? req.query.level : null;
  const { rows } = await query(
    `${LEASE_SELECT} WHERE l.owner_id = $1 AND ($2::text IS NULL OR l.status = $2)
      ORDER BY (l.status = 'actif') DESC, l.guarantee_expires_on ASC`,
    [me.id, status],
  );
  const leases = rows.map((l) => withGuarantee(l));
  res.json(level ? leases.filter((l) => l.guarantee.level === level) : leases);
});

leasesRouter.get('/:id', async (req, res) => {
  const me = currentUser(req);
  const lease = await ownedLease(me.id, idParam(req));
  const payments = await query('SELECT * FROM payments WHERE lease_id = $1 ORDER BY period DESC, paid_on DESC', [lease.id]);
  const alerts = await query('SELECT * FROM alerts WHERE lease_id = $1 ORDER BY created_at DESC', [lease.id]);
  const history = await query(
    `${LEASE_SELECT} WHERE l.property_id = $1 AND l.tenant_id = $2 AND l.id <> $3 ORDER BY l.start_date DESC`,
    [lease.property_id, lease.tenant_id, lease.id],
  );
  res.json({
    ...withGuarantee(lease),
    payments: payments.rows,
    schedule: await schedule(lease),
    alerts: alerts.rows,
    history: history.rows.map((l) => withGuarantee(l)),
  });
});

leasesRouter.post('/', async (req, res) => {
  const me = currentUser(req);
  const d = createSchema.parse(req.body);
  const property = await one('SELECT * FROM properties WHERE id = $1 AND owner_id = $2', [d.propertyId, me.id]);
  if (!property) throw notFound('property');
  const tenant = await one('SELECT * FROM tenants WHERE id = $1 AND owner_id = $2', [d.tenantId, me.id]);
  if (!tenant) throw notFound('tenant');
  if (tenant.blacklisted && !d.acceptBlacklisted) {
    throw new HttpError(409, `Attention : ce locataire est sur la liste noire (${tenant.blacklist_reason}). Confirmez pour continuer.`, 'tenant_blacklisted', { reason: tenant.blacklist_reason });
  }
  const active = await one("SELECT id FROM leases WHERE property_id = $1 AND status = 'actif'", [property.id]);
  if (active) throw new HttpError(409, 'Cette propriété a déjà un bail actif. Clôturez-le ou renouvelez-le.', 'property_has_active_lease');
  const lease = await transaction(async (c) => {
    const r = await c.query(
      `INSERT INTO leases(owner_id, property_id, tenant_id, start_date, end_date, guarantee_expires_on, monthly_rent,
         currency, guarantee_amount, terms, auto_renew)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [me.id, property.id, tenant.id, d.startDate, d.endDate, d.guaranteeExpiresOn ?? d.endDate, d.monthlyRent,
        d.currency ?? property.currency, d.guaranteeAmount, d.terms, d.autoRenew],
    );
    await c.query("UPDATE properties SET status = 'occupee', updated_at = now() WHERE id = $1", [property.id]);
    return r.rows[0];
  });
  await audit(me.id, 'create', 'lease', lease.id);
  res.status(201).json(withGuarantee(await ownedLease(me.id, lease.id)));
});

leasesRouter.put('/:id', async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req);
  const lease = await ownedLease(me.id, id);
  if (lease.status !== 'actif') throw new HttpError(409, 'Un bail archivé ne peut plus être modifié', 'lease_archived');
  const d = updateSchema.parse(req.body);
  await query(
    `UPDATE leases SET start_date=$2, end_date=$3, guarantee_expires_on=$4, monthly_rent=$5, currency=$6,
       guarantee_amount=$7, terms=$8, auto_renew=$9, updated_at=now() WHERE id=$1`,
    [id, d.startDate, d.endDate, d.guaranteeExpiresOn ?? d.endDate, d.monthlyRent, d.currency ?? lease.currency, d.guaranteeAmount,
      d.terms, d.autoRenew],
  );
  await audit(me.id, 'update', 'lease', id);
  res.json(withGuarantee(await ownedLease(me.id, id)));
});

/**
 * Renouvellement : l'ancien bail est archivé (statut « renouvelé ») et un
 * nouveau bail démarre le lendemain de sa fin, pour la même durée par défaut.
 */
leasesRouter.post('/:id/renew', async (req, res) => {
  const me = currentUser(req);
  const old = await ownedLease(me.id, idParam(req));
  if (old.status !== 'actif') throw new HttpError(409, 'Seul un bail actif peut être renouvelé', 'lease_not_active');
  const months = Math.max(1, Math.round(daysBetween(old.start_date, old.end_date) / 30.44));
  const startDate = addDays(old.end_date, 1);
  const defaults = {
    startDate,
    endDate: addDays(addMonths(startDate, months), -1),
    monthlyRent: old.monthly_rent,
    currency: old.currency,
    guaranteeAmount: old.guarantee_amount,
    terms: old.terms,
    autoRenew: old.auto_renew,
  };
  const d = updateSchema.parse({ ...defaults, ...req.body });
  const lease = await transaction(async (c) => {
    await c.query("UPDATE leases SET status = 'renouvele', updated_at = now() WHERE id = $1", [old.id]);
    const r = await c.query(
      `INSERT INTO leases(owner_id, property_id, tenant_id, start_date, end_date, guarantee_expires_on, monthly_rent,
         currency, guarantee_amount, terms, auto_renew, previous_lease_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [me.id, old.property_id, old.tenant_id, d.startDate, d.endDate, d.guaranteeExpiresOn ?? d.endDate, d.monthlyRent,
        d.currency ?? old.currency, d.guaranteeAmount, d.terms, d.autoRenew, old.id],
    );
    return r.rows[0];
  });
  await audit(me.id, 'renew', 'lease', lease.id, { previous: old.id });
  res.status(201).json(withGuarantee(await ownedLease(me.id, lease.id)));
});

/** Fin de bail : le bail est archivé et la propriété redevient vacante. */
leasesRouter.post('/:id/terminate', async (req, res) => {
  const me = currentUser(req);
  const lease = await ownedLease(me.id, idParam(req));
  if (lease.status !== 'actif') throw new HttpError(409, 'Ce bail est déjà clôturé', 'lease_closed');
  await transaction(async (c) => {
    await c.query("UPDATE leases SET status = 'termine', updated_at = now() WHERE id = $1", [lease.id]);
    await c.query("UPDATE properties SET status = 'vacante', updated_at = now() WHERE id = $1", [lease.property_id]);
  });
  await audit(me.id, 'terminate', 'lease', lease.id);
  res.json(withGuarantee(await ownedLease(me.id, lease.id)));
});

/** Contrat de bail imprimable (le navigateur l'enregistre en PDF). */
leasesRouter.get('/:id/contract', async (req, res) => {
  const me = currentUser(req);
  const lease = await ownedLease(me.id, idParam(req));
  const landlord = await one('SELECT full_name, email, phone FROM users WHERE id = $1', [me.id]);
  const tenant = await one('SELECT * FROM tenants WHERE id = $1', [lease.tenant_id]);
  const property = await one('SELECT * FROM properties WHERE id = $1', [lease.property_id]);
  res.type('html').send(renderContract({ lease, landlord, tenant, property }));
});

// --- Paiements ---------------------------------------------------------------
const paymentSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Mois attendu au format AAAA-MM')
    .transform((v) => v.slice(0, 7) + '-01'),
  amount: z.coerce.number().positive('Montant positif attendu').max(1e12),
  paidOn: dateStr,
  method: z.enum(['especes', 'mobile_money', 'virement', 'autre']).default('especes'),
  reference: optText,
  note: optText,
});

leasesRouter.post('/:id/payments', async (req, res) => {
  const me = currentUser(req);
  const lease = await ownedLease(me.id, idParam(req));
  const d = paymentSchema.parse(req.body);
  const p = await one(
    `INSERT INTO payments(owner_id, lease_id, period, amount, paid_on, method, reference, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [me.id, lease.id, d.period, d.amount, d.paidOn, d.method, d.reference, d.note],
  );
  await audit(me.id, 'create', 'payment', p.id, { lease: lease.id, amount: d.amount });
  res.status(201).json(p);
});

leasesRouter.delete('/:id/payments/:paymentId', async (req, res) => {
  const me = currentUser(req);
  const lease = await ownedLease(me.id, idParam(req));
  const r = await one('DELETE FROM payments WHERE id = $1 AND lease_id = $2 RETURNING id', [
    idParam(req, 'paymentId'),
    lease.id,
  ]);
  if (!r) throw notFound('payment');
  await audit(me.id, 'delete', 'payment', r.id);
  res.status(204).end();
});

/** Reçu imprimable d'un paiement. */
leasesRouter.get('/:id/payments/:paymentId/receipt', async (req, res) => {
  const me = currentUser(req);
  const lease = await ownedLease(me.id, idParam(req));
  const payment = await one('SELECT * FROM payments WHERE id = $1 AND lease_id = $2', [idParam(req, 'paymentId'), lease.id]);
  if (!payment) throw notFound('payment');
  const landlord = await one('SELECT full_name FROM users WHERE id = $1', [me.id]);
  const tenant = await one('SELECT * FROM tenants WHERE id = $1', [lease.tenant_id]);
  const property = await one('SELECT * FROM properties WHERE id = $1', [lease.property_id]);
  res.type('html').send(renderReceipt({ payment, lease, landlord, tenant, property }));
});

export { schedule as leaseSchedule };
