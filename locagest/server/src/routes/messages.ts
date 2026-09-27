import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool.js';
import { currentUser, idParam, requireRole } from '../lib/auth.js';
import { HttpError, notFound } from '../lib/errors.js';
import { sendMail } from '../lib/mailer.js';
import { config } from '../lib/config.js';

const bodySchema = z.object({ body: z.string().trim().min(1, 'Message vide').max(5000) });

/**
 * Enregistre un message et prévient le destinataire par email. L'email ne
 * contient pas le message, seulement l'invitation à le lire dans LocaGest.
 */
export async function postMessage(tenant: any, senderRole: 'bailleur' | 'locataire', body: string) {
  const m = await one(
    'INSERT INTO messages(owner_id, tenant_id, sender_role, body) VALUES ($1,$2,$3,$4) RETURNING *',
    [tenant.owner_id, tenant.id, senderRole, body],
  );
  const to =
    senderRole === 'bailleur'
      ? tenant.user_id && tenant.email // seulement si le locataire a un espace pour répondre
      : (await one('SELECT email FROM users WHERE id = $1', [tenant.owner_id]))?.email;
  if (to) {
    const from = senderRole === 'bailleur' ? 'votre bailleur' : `${tenant.first_name} ${tenant.last_name}`;
    await sendMail({
      to,
      subject: `Nouveau message de ${from} — LocaGest`,
      text: `Vous avez reçu un nouveau message de ${from}.\n\nLisez-le et répondez sur ${config.appUrl}\n\n— LocaGest`,
    });
  }
  return m;
}

/** Messages d'une conversation ; ceux reçus par `readerRole` sont marqués lus. */
export async function readConversation(tenantId: number, readerRole: 'bailleur' | 'locataire') {
  const other = readerRole === 'bailleur' ? 'locataire' : 'bailleur';
  await query('UPDATE messages SET read_at = now() WHERE tenant_id = $1 AND sender_role = $2 AND read_at IS NULL', [
    tenantId,
    other,
  ]);
  const { rows } = await query('SELECT * FROM messages WHERE tenant_id = $1 ORDER BY created_at, id', [tenantId]);
  return rows;
}

/** Messagerie côté bailleur : une conversation par locataire. */
export const messagesRouter = Router();
messagesRouter.use(requireRole('bailleur'));

messagesRouter.get('/', async (req, res) => {
  const me = currentUser(req);
  const { rows } = await query(
    `SELECT t.id AS tenant_id, t.first_name, t.last_name, t.user_id IS NOT NULL AS has_portal,
            last.body AS last_body, last.sender_role AS last_sender, last.created_at AS last_at,
            (SELECT COUNT(*) FROM messages m WHERE m.tenant_id = t.id AND m.sender_role = 'locataire' AND m.read_at IS NULL) AS unread
       FROM tenants t
       JOIN LATERAL (SELECT body, sender_role, created_at FROM messages m WHERE m.tenant_id = t.id
                     ORDER BY created_at DESC, id DESC LIMIT 1) last ON TRUE
      WHERE t.owner_id = $1
      ORDER BY last.created_at DESC`,
    [me.id],
  );
  res.json(rows);
});

async function ownedTenant(ownerId: number, id: number) {
  const t = await one('SELECT * FROM tenants WHERE id = $1 AND owner_id = $2', [id, ownerId]);
  if (!t) throw notFound('tenant');
  return t;
}

messagesRouter.get('/:tenantId', async (req, res) => {
  const me = currentUser(req);
  const t = await ownedTenant(me.id, idParam(req, 'tenantId'));
  res.json({
    tenant: { id: t.id, firstName: t.first_name, lastName: t.last_name, hasPortal: !!t.user_id },
    messages: await readConversation(t.id, 'bailleur'),
  });
});

messagesRouter.post('/:tenantId', async (req, res) => {
  const me = currentUser(req);
  const t = await ownedTenant(me.id, idParam(req, 'tenantId'));
  const { body } = bodySchema.parse(req.body);
  res.status(201).json(await postMessage(t, 'bailleur', body));
});

/** Messagerie côté locataire (monté sous /api/portal). */
export const portalMessagesRouter = Router();

async function myTenant(userId: number) {
  const t = await one('SELECT * FROM tenants WHERE user_id = $1', [userId]);
  if (!t) throw new HttpError(404, 'Aucun dossier locataire associé à ce compte', 'no_tenant_record');
  return t;
}

portalMessagesRouter.get('/', async (req, res) => {
  const t = await myTenant(currentUser(req).id);
  res.json({ messages: await readConversation(t.id, 'locataire') });
});

portalMessagesRouter.post('/', async (req, res) => {
  const t = await myTenant(currentUser(req).id);
  const { body } = bodySchema.parse(req.body);
  res.status(201).json(await postMessage(t, 'locataire', body));
});
