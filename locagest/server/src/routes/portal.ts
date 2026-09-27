import { Router } from 'express';
import { query } from '../db/pool.js';
import { currentUser, requireRole } from '../lib/auth.js';
import { LEASE_SELECT, withGuarantee } from '../lib/leases.js';
import { leaseSchedule } from './leases.js';

/** Espace locataire : consultation de ses baux, de sa garantie et de ses loyers. */
export const portalRouter = Router();
portalRouter.use(requireRole('locataire'));

portalRouter.get('/leases', async (req, res) => {
  const me = currentUser(req);
  const { rows } = await query(
    `${LEASE_SELECT}
     WHERE t.user_id = $1 ORDER BY (l.status = 'actif') DESC, l.start_date DESC`,
    [me.id],
  );
  const landlord = await query('SELECT full_name, email, phone FROM users WHERE id = $1', [me.landlordId]);
  const out = [];
  for (const l of rows) out.push({ ...withGuarantee(l), schedule: await leaseSchedule(l) });
  res.json({ landlord: landlord.rows[0] ?? null, leases: out });
});
