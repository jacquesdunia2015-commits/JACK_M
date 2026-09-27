import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { one, query } from '../db/pool.js';
import { currentUser, idParam, requireRole } from '../lib/auth.js';
import { HttpError, notFound } from '../lib/errors.js';
import { count, currency, dateStr, money, optText } from '../lib/validation.js';
import { PLANS, type Plan } from '../lib/plans.js';
import { audit } from '../lib/audit.js';
import { config } from '../lib/config.js';
import { LEASE_SELECT, withGuarantee } from '../lib/leases.js';

export const propertiesRouter = Router();
propertiesRouter.use(requireRole('bailleur'));

const propertySchema = z.object({
  title: z.string().trim().min(2, 'Intitulé requis').max(200),
  province: z.string().trim().min(2, 'Province requise').max(100),
  commune: z.string().trim().min(2, 'Commune requise').max(100),
  quartier: optText,
  avenue: optText,
  numero: optText,
  type: z.enum(['maison', 'appartement', 'studio', 'villa', 'chambre', 'bureau', 'autre']),
  description: optText,
  bedrooms: count,
  livingRooms: count,
  toiletsInternal: count,
  toiletsExternal: count,
  kitchens: count,
  condition: z.enum(['bon', 'moyen', 'a_renover']).default('bon'),
  monthlyRent: money,
  currency: currency.default('USD'),
  availableFrom: dateStr.nullish().or(z.literal('').transform(() => null)),
  status: z.enum(['vacante', 'occupee', 'maintenance']).default('vacante'),
});

const COLUMNS = `title, province, commune, quartier, avenue, numero, type, description, bedrooms, living_rooms,
  toilets_internal, toilets_external, kitchens, condition, monthly_rent, currency, available_from, status`;

function values(d: z.infer<typeof propertySchema>) {
  return [
    d.title, d.province, d.commune, d.quartier, d.avenue, d.numero, d.type, d.description, d.bedrooms, d.livingRooms,
    d.toiletsInternal, d.toiletsExternal, d.kitchens, d.condition, d.monthlyRent, d.currency, d.availableFrom ?? null,
    d.status,
  ];
}

async function ownedProperty(ownerId: number, id: number) {
  const p = await one('SELECT * FROM properties WHERE id = $1 AND owner_id = $2', [id, ownerId]);
  if (!p) throw notFound('Propriété');
  return p;
}

async function photosOf(ids: number[]) {
  if (!ids.length) return new Map<number, any[]>();
  const { rows } = await query(
    'SELECT id, property_id, filename, original_name FROM property_photos WHERE property_id = ANY($1) ORDER BY id',
    [ids],
  );
  const map = new Map<number, any[]>();
  for (const r of rows) {
    const list = map.get(r.property_id) ?? [];
    list.push({ id: r.id, url: `/uploads/${r.filename}`, name: r.original_name });
    map.set(r.property_id, list);
  }
  return map;
}

propertiesRouter.get('/', async (req, res) => {
  const me = currentUser(req);
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  const q = typeof req.query.q === 'string' && req.query.q.trim() ? `%${req.query.q.trim()}%` : null;
  const { rows } = await query(
    `SELECT p.*, t.first_name || ' ' || t.last_name AS current_tenant, l.id AS current_lease_id
       FROM properties p
       LEFT JOIN leases l ON l.property_id = p.id AND l.status = 'actif'
       LEFT JOIN tenants t ON t.id = l.tenant_id
      WHERE p.owner_id = $1
        AND ($2::text IS NULL OR p.status = $2)
        AND ($3::text IS NULL OR p.title ILIKE $3 OR p.commune ILIKE $3 OR p.quartier ILIKE $3 OR p.avenue ILIKE $3)
      ORDER BY p.created_at DESC`,
    [me.id, status, q],
  );
  const photos = await photosOf(rows.map((r) => r.id));
  res.json(rows.map((r) => ({ ...r, photos: photos.get(r.id) ?? [] })));
});

propertiesRouter.get('/:id', async (req, res) => {
  const me = currentUser(req);
  const p = await ownedProperty(me.id, idParam(req));
  const photos = await photosOf([p.id]);
  const leases = await query(`${LEASE_SELECT} WHERE l.property_id = $1 ORDER BY l.start_date DESC`, [p.id]);
  res.json({ ...p, photos: photos.get(p.id) ?? [], leases: leases.rows.map((l) => withGuarantee(l)) });
});

propertiesRouter.post('/', async (req, res) => {
  const me = currentUser(req);
  const d = propertySchema.parse(req.body);
  const { plan } = (await one('SELECT plan FROM users WHERE id = $1', [me.id]))!;
  const limit = PLANS[plan as Plan].maxProperties;
  if (limit !== null) {
    const { n } = (await one('SELECT COUNT(*) AS n FROM properties WHERE owner_id = $1', [me.id]))!;
    if (n >= limit) {
      throw new HttpError(402, `Votre offre ${PLANS[plan as Plan].label} est limitée à ${limit} propriétés. Passez à l'offre supérieure.`);
    }
  }
  const p = await one(
    `INSERT INTO properties(owner_id, ${COLUMNS})
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [me.id, ...values(d)],
  );
  await audit(me.id, 'create', 'property', p.id);
  res.status(201).json({ ...p, photos: [] });
});

propertiesRouter.put('/:id', async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req);
  await ownedProperty(me.id, id);
  const d = propertySchema.parse(req.body);
  const sets = COLUMNS.split(',').map((c, i) => `${c.trim()} = $${i + 3}`).join(', ');
  const p = await one(`UPDATE properties SET ${sets}, updated_at = now() WHERE id = $1 AND owner_id = $2 RETURNING *`, [
    id,
    me.id,
    ...values(d),
  ]);
  await audit(me.id, 'update', 'property', id);
  res.json(p);
});

propertiesRouter.delete('/:id', async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req);
  await ownedProperty(me.id, id);
  const lease = await one('SELECT 1 FROM leases WHERE property_id = $1 LIMIT 1', [id]);
  if (lease) throw new HttpError(409, 'Cette propriété a des baux enregistrés : elle ne peut pas être supprimée.');
  const photos = await query('SELECT filename FROM property_photos WHERE property_id = $1', [id]);
  await query('DELETE FROM properties WHERE id = $1', [id]);
  await Promise.all(photos.rows.map((r) => unlink(path.join(config.uploadDir, r.filename)).catch(() => {})));
  await audit(me.id, 'delete', 'property', id);
  res.status(204).end();
});

// --- Galerie photos ---------------------------------------------------------
mkdirSync(config.uploadDir, { recursive: true });
const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);
const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${ALLOWED.get(file.mimetype) ?? ''}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.has(file.mimetype) ? cb(null, true) : cb(new HttpError(400, 'Formats acceptés : JPEG, PNG, WebP')),
});

propertiesRouter.post('/:id/photos', async (req, res, next) => {
  const me = currentUser(req);
  const id = idParam(req);
  await ownedProperty(me.id, id);
  upload.array('photos', 10)(req, res, async (err) => {
    if (err) return next(err);
    try {
      const files = (req.files as Express.Multer.File[]) ?? [];
      if (!files.length) throw new HttpError(400, 'Aucune photo reçue');
      const out = [];
      for (const f of files) {
        const r = await one(
          'INSERT INTO property_photos(property_id, filename, original_name) VALUES ($1,$2,$3) RETURNING id, filename, original_name',
          [id, f.filename, f.originalname],
        );
        out.push({ id: r.id, url: `/uploads/${r.filename}`, name: r.original_name });
      }
      res.status(201).json(out);
    } catch (e) {
      next(e);
    }
  });
});

propertiesRouter.delete('/:id/photos/:photoId', async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req);
  await ownedProperty(me.id, id);
  const photo = await one('DELETE FROM property_photos WHERE id = $1 AND property_id = $2 RETURNING filename', [
    idParam(req, 'photoId'),
    id,
  ]);
  if (!photo) throw notFound('Photo');
  await unlink(path.join(config.uploadDir, photo.filename)).catch(() => {});
  res.status(204).end();
});
