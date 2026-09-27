import { Router } from 'express';
import { query } from '../db/pool.js';
import { currentUser, requireRole } from '../lib/auth.js';
import { LEASE_SELECT, withGuarantee } from '../lib/leases.js';
import { addMonths, firstOfMonth, today } from '../lib/dates.js';
import { leasePeriods, paymentState } from '../lib/alerts.js';
import { runAlerts } from '../lib/notifier.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireRole('bailleur'));

/** Vue d'ensemble temps réel : garanties par couleur, occupation, revenus, retards. */
dashboardRouter.get('/', async (req, res) => {
  const me = currentUser(req);
  const ref = today();

  const props = await query('SELECT status, COUNT(*) AS n FROM properties WHERE owner_id = $1 GROUP BY status', [me.id]);
  const byStatus = { vacante: 0, occupee: 0, maintenance: 0 } as Record<string, number>;
  for (const r of props.rows) byStatus[r.status] = r.n;
  const totalProperties = Object.values(byStatus).reduce((a, b) => a + b, 0);

  const { rows: tenantCount } = await query('SELECT COUNT(*) AS n FROM tenants WHERE owner_id = $1', [me.id]);

  const { rows: active } = await query(`${LEASE_SELECT} WHERE l.owner_id = $1 AND l.status = 'actif'`, [me.id]);
  const leases = active.map((l) => withGuarantee(l, ref));
  const levels = { vert: 0, jaune: 0, orange: 0, rouge: 0 } as Record<string, number>;
  for (const l of leases) levels[l.guarantee.level!]++;
  const urgent = leases
    .filter((l) => l.guarantee.level !== 'vert')
    .sort((a, b) => a.guarantee.daysRemaining - b.guarantee.daysRemaining);

  // Revenus encaissés des 12 derniers mois, par devise
  const from = addMonths(firstOfMonth(ref), -11);
  const { rows: rev } = await query(
    `SELECT to_char(p.paid_on, 'YYYY-MM') AS month, l.currency, SUM(p.amount) AS total
       FROM payments p JOIN leases l ON l.id = p.lease_id
      WHERE p.owner_id = $1 AND p.paid_on >= $2
      GROUP BY 1, 2 ORDER BY 1`,
    [me.id, from],
  );
  const months = Array.from({ length: 12 }, (_, i) => addMonths(from, i).slice(0, 7));
  const revenue = months.map((month) => ({
    month,
    totals: Object.fromEntries(rev.filter((r) => r.month === month).map((r) => [r.currency, r.total])) as Record<string, number>,
  }));
  const add = (acc: Record<string, number>, cur: string, n: number) => {
    acc[cur] = (acc[cur] ?? 0) + n;
  };

  // Loyers en retard / impayés sur les baux actifs
  const { rows: paid } = await query(
    `SELECT p.lease_id, p.period, SUM(p.amount) AS paid FROM payments p
       JOIN leases l ON l.id = p.lease_id WHERE l.owner_id = $1 AND l.status = 'actif' GROUP BY 1, 2`,
    [me.id],
  );
  const paidMap = new Map(paid.map((r) => [`${r.lease_id}:${r.period}`, r.paid]));
  const late: any[] = [];
  const arrears: Record<string, number> = {};
  for (const l of leases) {
    for (const period of leasePeriods(l.start_date, l.end_date, ref)) {
      const amount = paidMap.get(`${l.id}:${period}`) ?? 0;
      const s = paymentState({ period, startDate: l.start_date, rent: l.monthly_rent, paid: amount, today: ref });
      if (s.state === 'en_retard' || s.state === 'impaye') {
        add(arrears, l.currency, s.remaining);
        late.push({
          leaseId: l.id, property: l.property_title, tenant: `${l.first_name} ${l.last_name}`,
          period, currency: l.currency, ...s,
        });
      }
    }
  }
  late.sort((a, b) => b.daysLate - a.daysLate);

  const thisMonth = ref.slice(0, 7);
  const expected: Record<string, number> = {};
  for (const l of leases) add(expected, l.currency, l.monthly_rent);
  // Monnaies en jeu (baux actifs et encaissements de l'année), pour l'affichage
  const currencies = [...new Set([...leases.map((l) => l.currency), ...rev.map((r) => r.currency)])].sort();

  res.json({
    today: ref,
    properties: { total: totalProperties, ...byStatus },
    occupancyRate: totalProperties ? Math.round((byStatus.occupee / totalProperties) * 100) : 0,
    tenants: tenantCount[0].n,
    activeLeases: leases.length,
    guaranteeLevels: levels,
    urgent: urgent.slice(0, 20),
    revenue,
    revenueThisMonth: revenue.find((r) => r.month === thisMonth)?.totals ?? {},
    currencies,
    expectedMonthly: expected,
    arrears,
    late: late.slice(0, 20),
  });
});

export const alertsRouter = Router();
alertsRouter.use(requireRole('bailleur', 'admin'));

/** Historique des alertes générées (audit). */
alertsRouter.get('/', async (req, res) => {
  const me = currentUser(req);
  const { rows } = await query(
    `SELECT a.*, p.title AS property_title, t.first_name || ' ' || t.last_name AS tenant_name
       FROM alerts a JOIN leases l ON l.id = a.lease_id
       JOIN properties p ON p.id = l.property_id JOIN tenants t ON t.id = l.tenant_id
      WHERE ($1::int IS NULL OR a.owner_id = $1)
      ORDER BY a.created_at DESC LIMIT 500`,
    [me.role === 'admin' ? null : me.id],
  );
  res.json(rows);
});

/** Déclenche immédiatement la vérification des alertes (normalement horaire). */
alertsRouter.post('/run', requireRole('admin'), async (_req, res) => {
  res.json(await runAlerts());
});
