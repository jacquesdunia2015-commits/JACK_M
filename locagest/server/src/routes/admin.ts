import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool.js';
import { currentUser, idParam, requireRole } from '../lib/auth.js';
import { notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { PLANS } from '../lib/plans.js';

export const adminRouter = Router();
adminRouter.use(requireRole('admin'));

adminRouter.get('/stats', async (_req, res) => {
  const r = await one(`SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'bailleur') AS landlords,
      (SELECT COUNT(*) FROM users WHERE role = 'bailleur' AND active) AS active_landlords,
      (SELECT COUNT(*) FROM properties) AS properties,
      (SELECT COUNT(*) FROM tenants) AS tenants,
      (SELECT COUNT(*) FROM leases WHERE status = 'actif') AS active_leases,
      (SELECT COUNT(*) FROM alerts WHERE created_at > now() - interval '30 days') AS alerts_30d`);
  const plans = await query("SELECT plan, COUNT(*) AS n FROM users WHERE role = 'bailleur' GROUP BY plan");
  // Répartition géographique des bailleurs
  const countries = await query(
    "SELECT COALESCE(country, '??') AS country, COUNT(*) AS n FROM users WHERE role = 'bailleur' GROUP BY 1 ORDER BY 2 DESC",
  );
  res.json({
    ...r,
    plans: Object.fromEntries(plans.rows.map((p) => [p.plan, p.n])),
    countries: countries.rows,
  });
});

adminRouter.get('/users', async (_req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name, u.phone, u.plan, u.active, u.created_at, u.country, u.currency, u.locale,
            (SELECT COUNT(*) FROM properties p WHERE p.owner_id = u.id) AS properties,
            (SELECT COUNT(*) FROM tenants t WHERE t.owner_id = u.id) AS tenants,
            (SELECT COUNT(*) FROM leases l WHERE l.owner_id = u.id AND l.status = 'actif') AS active_leases
       FROM users u WHERE u.role = 'bailleur' ORDER BY u.created_at DESC`,
  );
  res.json({ users: rows, plans: PLANS });
});

adminRouter.patch('/users/:id', async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req);
  const d = z
    .object({ plan: z.enum(['starter', 'pro', 'enterprise']).optional(), active: z.boolean().optional() })
    .parse(req.body);
  const u = await one(
    `UPDATE users SET plan = COALESCE($2, plan), active = COALESCE($3, active)
      WHERE id = $1 AND role = 'bailleur' RETURNING id, email, full_name, plan, active`,
    [id, d.plan ?? null, d.active ?? null],
  );
  if (!u) throw notFound('account');
  await audit(me.id, 'admin_update', 'user', id, d);
  res.json(u);
});

adminRouter.get('/audit', async (_req, res) => {
  const { rows } = await query(
    `SELECT a.*, u.email FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 300`,
  );
  res.json(rows);
});
