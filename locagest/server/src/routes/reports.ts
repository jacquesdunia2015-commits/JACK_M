import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { currentUser, requireRole } from '../lib/auth.js';
import { addDays, addMonths, today } from '../lib/dates.js';
import { paymentState } from '../lib/alerts.js';
import { toCsv } from '../lib/csv.js';

/** Rapports de gestion (§3.7) : mensuel et annuel, en JSON ou en CSV pour Excel. */
export const reportsRouter = Router();
reportsRouter.use(requireRole('bailleur'));

const STATE_LABELS: Record<string, string> = {
  paye: 'Payé', partiel: 'Partiel', a_venir: 'À venir', en_retard: 'En retard', impaye: 'Impayé',
};
type Totals = Record<'USD' | 'CDF', { expected: number; collected: number; remaining: number }>;
const emptyTotals = (): Totals => ({
  USD: { expected: 0, collected: 0, remaining: 0 },
  CDF: { expected: 0, collected: 0, remaining: 0 },
});

async function monthly(ownerId: number, period: string) {
  const last = addDays(addMonths(period, 1), -1);
  const ref = today();
  const { rows: leases } = await query(
    `SELECT l.*, p.title AS property_title, t.first_name || ' ' || t.last_name AS tenant_name,
            COALESCE((SELECT SUM(amount) FROM payments pay WHERE pay.lease_id = l.id AND pay.period = $2), 0) AS paid
       FROM leases l JOIN properties p ON p.id = l.property_id JOIN tenants t ON t.id = l.tenant_id
      WHERE l.owner_id = $1 AND l.start_date <= $3 AND l.end_date >= $2
      ORDER BY p.title`,
    [ownerId, period, last],
  );
  const totals = emptyTotals();
  const lines = leases.map((l) => {
    const s = paymentState({ period, startDate: l.start_date, rent: l.monthly_rent, paid: l.paid, today: ref });
    const t = totals[l.currency as 'USD' | 'CDF'];
    t.expected += l.monthly_rent;
    t.collected += l.paid;
    // Arriérés : seulement les loyers déjà échus, pas les mois à venir
    if (s.state === 'en_retard' || s.state === 'impaye') t.remaining += s.remaining;
    return {
      leaseId: l.id, property: l.property_title, tenant: l.tenant_name, currency: l.currency,
      rent: l.monthly_rent, paid: l.paid, remaining: s.remaining, dueDate: s.dueDate, state: s.state, daysLate: s.daysLate,
    };
  });
  const { rows: props } = await query('SELECT COUNT(*) AS n FROM properties WHERE owner_id = $1', [ownerId]);
  const occupied = new Set(leases.map((l) => l.property_id)).size;
  const { rows: payments } = await query(
    `SELECT pay.*, p.title AS property_title, t.first_name || ' ' || t.last_name AS tenant_name, l.currency
       FROM payments pay JOIN leases l ON l.id = pay.lease_id
       JOIN properties p ON p.id = l.property_id JOIN tenants t ON t.id = l.tenant_id
      WHERE pay.owner_id = $1 AND pay.paid_on BETWEEN $2 AND $3 ORDER BY pay.paid_on, pay.id`,
    [ownerId, period, last],
  );
  return {
    month: period.slice(0, 7),
    lines,
    totals,
    occupancy: { properties: props[0].n, occupied, rate: props[0].n ? Math.round((occupied / props[0].n) * 100) : 0 },
    payments,
  };
}

const monthParam = z.string().regex(/^\d{4}-\d{2}$/, 'Mois attendu au format AAAA-MM');

reportsRouter.get('/monthly', async (req, res) => {
  const me = currentUser(req);
  const month = monthParam.parse(req.query.month ?? today().slice(0, 7));
  const r = await monthly(me.id, `${month}-01`);
  if (req.query.format === 'csv') {
    res
      .type('text/csv; charset=utf-8')
      .attachment(`locagest-rapport-${month}.csv`)
      .send(
        toCsv(
          ['Propriété', 'Locataire', 'Devise', 'Loyer', 'Payé', 'Reste dû', 'Échéance', 'Statut', 'Jours de retard'],
          r.lines.map((l) => [l.property, l.tenant, l.currency, l.rent, l.paid, l.remaining, l.dueDate, STATE_LABELS[l.state], l.daysLate]),
        ),
      );
    return;
  }
  res.json(r);
});

reportsRouter.get('/annual', async (req, res) => {
  const me = currentUser(req);
  const year = z.coerce.number().int().min(2000).max(2100).parse(req.query.year ?? today().slice(0, 4));
  const months = [];
  const totals = emptyTotals();
  for (let m = 0; m < 12; m++) {
    const period = `${year}-${String(m + 1).padStart(2, '0')}-01`;
    const r = await monthly(me.id, period);
    for (const cur of ['USD', 'CDF'] as const) {
      totals[cur].expected += r.totals[cur].expected;
      totals[cur].collected += r.totals[cur].collected;
      totals[cur].remaining += r.totals[cur].remaining;
    }
    months.push({ month: r.month, totals: r.totals, occupancyRate: r.occupancy.rate });
  }
  if (req.query.format === 'csv') {
    res
      .type('text/csv; charset=utf-8')
      .attachment(`locagest-rapport-${year}.csv`)
      .send(
        toCsv(
          ['Mois', 'Attendu USD', 'Encaissé USD', 'Arriérés USD', 'Attendu FC', 'Encaissé FC', 'Arriérés FC', "Taux d'occupation %"],
          months.map((m) => [
            m.month, m.totals.USD.expected, m.totals.USD.collected, m.totals.USD.remaining,
            m.totals.CDF.expected, m.totals.CDF.collected, m.totals.CDF.remaining, m.occupancyRate,
          ]),
        ),
      );
    return;
  }
  res.json({ year, months, totals });
});
