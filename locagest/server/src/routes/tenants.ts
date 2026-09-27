import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { one, query, transaction } from '../db/pool.js';
import { currentUser, idParam, requireRole } from '../lib/auth.js';
import { HttpError, notFound } from '../lib/errors.js';
import { email, optText } from '../lib/validation.js';
import { PLANS, type Plan } from '../lib/plans.js';
import { audit } from '../lib/audit.js';
import { LEASE_SELECT, withGuarantee } from '../lib/leases.js';

export const tenantsRouter = Router();
tenantsRouter.use(requireRole('bailleur'));

const tenantSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Prénom requis').max(100),
    lastName: z.string().trim().min(1, 'Nom requis').max(100),
    email: email.nullish().or(z.literal('').transform(() => null)),
    phone: optText,
    idNumber: optText,
    nationality: optText,
    profession: optText,
    employer: optText,
    previousHousing: optText,
    rating: z.coerce.number().int().min(1).max(5).nullish().or(z.literal('').transform(() => null)),
    ratingNote: optText,
    blacklisted: z.boolean().default(false),
    blacklistReason: optText,
  })
  .refine((d) => !d.blacklisted || d.blacklistReason, {
    message: 'Indiquez le motif de l’inscription sur la liste noire',
    path: ['blacklistReason'],
  });

const COLUMNS = `first_name, last_name, email, phone, id_number, nationality, profession, employer, previous_housing,
  rating, rating_note, blacklisted, blacklist_reason`;

function values(d: z.infer<typeof tenantSchema>) {
  return [
    d.firstName, d.lastName, d.email ?? null, d.phone, d.idNumber, d.nationality, d.profession, d.employer,
    d.previousHousing, d.rating ?? null, d.ratingNote, d.blacklisted, d.blacklisted ? d.blacklistReason : null,
  ];
}

async function ownedTenant(ownerId: number, id: number) {
  const t = await one('SELECT * FROM tenants WHERE id = $1 AND owner_id = $2', [id, ownerId]);
  if (!t) throw notFound('Locataire');
  return t;
}

tenantsRouter.get('/', async (req, res) => {
  const me = currentUser(req);
  const q = typeof req.query.q === 'string' && req.query.q.trim() ? `%${req.query.q.trim()}%` : null;
  const blacklisted = req.query.blacklisted === 'true' ? true : null;
  const { rows } = await query(
    `SELECT t.*, p.title AS current_property, l.id AS current_lease_id, l.guarantee_expires_on
       FROM tenants t
       LEFT JOIN leases l ON l.tenant_id = t.id AND l.status = 'actif'
       LEFT JOIN properties p ON p.id = l.property_id
      WHERE t.owner_id = $1
        AND ($2::text IS NULL OR t.first_name ILIKE $2 OR t.last_name ILIKE $2 OR t.phone ILIKE $2 OR t.id_number ILIKE $2)
        AND ($3::boolean IS NULL OR t.blacklisted = $3)
      ORDER BY t.last_name, t.first_name`,
    [me.id, q, blacklisted],
  );
  res.json(rows);
});

/**
 * Vérifie si une personne figure sur la liste noire du bailleur (même numéro
 * d'identité, même téléphone ou même email) — à consulter avant de signer.
 */
tenantsRouter.get('/check-blacklist', async (req, res) => {
  const me = currentUser(req);
  const val = (k: string) => (typeof req.query[k] === 'string' && req.query[k] ? String(req.query[k]).trim() : null);
  const { rows } = await query(
    `SELECT id, first_name, last_name, blacklist_reason FROM tenants
      WHERE owner_id = $1 AND blacklisted
        AND (($2::text IS NOT NULL AND id_number = $2) OR ($3::text IS NOT NULL AND phone = $3)
             OR ($4::text IS NOT NULL AND lower(email) = lower($4)))`,
    [me.id, val('idNumber'), val('phone'), val('email')],
  );
  res.json({ matches: rows });
});

tenantsRouter.get('/:id', async (req, res) => {
  const me = currentUser(req);
  const t = await ownedTenant(me.id, idParam(req));
  const leases = await query(`${LEASE_SELECT} WHERE l.tenant_id = $1 ORDER BY l.start_date DESC`, [t.id]);
  const portal = t.user_id ? await one('SELECT email, active FROM users WHERE id = $1', [t.user_id]) : null;
  res.json({ ...t, leases: leases.rows.map((l) => withGuarantee(l)), portal });
});

tenantsRouter.post('/', async (req, res) => {
  const me = currentUser(req);
  const d = tenantSchema.parse(req.body);
  const { plan } = (await one('SELECT plan FROM users WHERE id = $1', [me.id]))!;
  const limit = PLANS[plan as Plan].maxTenants;
  if (limit !== null) {
    const { n } = (await one('SELECT COUNT(*) AS n FROM tenants WHERE owner_id = $1', [me.id]))!;
    if (n >= limit) {
      throw new HttpError(402, `Votre offre ${PLANS[plan as Plan].label} est limitée à ${limit} locataires. Passez à l'offre supérieure.`);
    }
  }
  const t = await one(
    `INSERT INTO tenants(owner_id, ${COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [me.id, ...values(d)],
  );
  await audit(me.id, 'create', 'tenant', t.id);
  res.status(201).json(t);
});

tenantsRouter.put('/:id', async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req);
  await ownedTenant(me.id, id);
  const d = tenantSchema.parse(req.body);
  const sets = COLUMNS.split(',').map((c, i) => `${c.trim()} = $${i + 3}`).join(', ');
  const t = await one(`UPDATE tenants SET ${sets}, updated_at = now() WHERE id = $1 AND owner_id = $2 RETURNING *`, [
    id,
    me.id,
    ...values(d),
  ]);
  await audit(me.id, 'update', 'tenant', id, { blacklisted: d.blacklisted });
  res.json(t);
});

tenantsRouter.delete('/:id', async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req);
  const t = await ownedTenant(me.id, id);
  const lease = await one('SELECT 1 FROM leases WHERE tenant_id = $1 LIMIT 1', [id]);
  if (lease) throw new HttpError(409, 'Ce locataire a des baux enregistrés : il ne peut pas être supprimé.');
  await transaction(async (c) => {
    await c.query('DELETE FROM tenants WHERE id = $1', [id]);
    if (t.user_id) await c.query('DELETE FROM users WHERE id = $1', [t.user_id]);
  });
  await audit(me.id, 'delete', 'tenant', id);
  res.status(204).end();
});

/** Ouvre (ou réinitialise) l'espace locataire : le locataire peut consulter son bail. */
tenantsRouter.post('/:id/portal', async (req, res) => {
  const me = currentUser(req);
  const t = await ownedTenant(me.id, idParam(req));
  const { password } = z.object({ password: z.string().min(8, 'Mot de passe : 8 caractères minimum').max(200) }).parse(req.body);
  if (!t.email) throw new HttpError(400, 'Renseignez d’abord l’email du locataire');
  const hash = await bcrypt.hash(password, 10);
  const user = await transaction(async (c) => {
    if (t.user_id) {
      const r = await c.query('UPDATE users SET email = $2, password_hash = $3, active = TRUE WHERE id = $1 RETURNING id, email', [
        t.user_id,
        t.email,
        hash,
      ]);
      return r.rows[0];
    }
    const r = await c.query(
      `INSERT INTO users(email, password_hash, full_name, phone, role, landlord_id)
       VALUES ($1,$2,$3,$4,'locataire',$5) RETURNING id, email`,
      [t.email, hash, `${t.first_name} ${t.last_name}`, t.phone, me.id],
    );
    await c.query('UPDATE tenants SET user_id = $2 WHERE id = $1', [t.id, r.rows[0].id]);
    return r.rows[0];
  });
  await audit(me.id, 'portal_access', 'tenant', t.id);
  res.status(201).json({ email: user.email, active: true });
});

tenantsRouter.delete('/:id/portal', async (req, res) => {
  const me = currentUser(req);
  const t = await ownedTenant(me.id, idParam(req));
  if (t.user_id) await query('UPDATE users SET active = FALSE WHERE id = $1', [t.user_id]);
  res.status(204).end();
});
