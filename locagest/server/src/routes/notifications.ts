import { Router } from 'express';
import { one } from '../db/pool.js';
import { currentUser } from '../lib/auth.js';
import { addDays, today } from '../lib/dates.js';

/** Compteurs des notifications in-app (badges du menu), interrogés régulièrement par l'interface. */
export const notificationsRouter = Router();

notificationsRouter.get('/', async (req, res) => {
  const me = currentUser(req);
  if (me.role === 'bailleur') {
    const r = await one(
      `SELECT
         (SELECT COUNT(*) FROM messages WHERE owner_id = $1 AND sender_role = 'locataire' AND read_at IS NULL) AS unread_messages,
         (SELECT COUNT(*) FROM leases WHERE owner_id = $1 AND status = 'actif' AND guarantee_expires_on < $2) AS urgent_guarantees`,
      [me.id, addDays(today(), 30)],
    );
    res.json({ unreadMessages: r.unread_messages, urgentGuarantees: r.urgent_guarantees });
    return;
  }
  if (me.role === 'locataire') {
    const r = await one(
      `SELECT COUNT(*) AS n FROM messages m JOIN tenants t ON t.id = m.tenant_id
        WHERE t.user_id = $1 AND m.sender_role = 'bailleur' AND m.read_at IS NULL`,
      [me.id],
    );
    res.json({ unreadMessages: r.n, urgentGuarantees: 0 });
    return;
  }
  res.json({ unreadMessages: 0, urgentGuarantees: 0 });
});
