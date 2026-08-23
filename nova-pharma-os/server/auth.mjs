// NOVA PHARMA OS — Authentification, rôles et permissions (§4, §6, §92 règle 8)

import crypto from 'node:crypto';
import { getDb, uid, now } from './db.mjs';

export const sessions = new Map(); // token -> { userId, created }
const SESSION_TTL = 12 * 3600 * 1000;

export function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return { salt, hash };
}

export function checkPassword(password, salt, hash) {
  const h = crypto.scryptSync(password, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash));
}

// Rôles retenus pour le MVP (§4) — un compte individuel par utilisateur,
// jamais de compte partagé (§92 règle 8).
export const ROLES = {
  admin_systeme: { label: 'Super administrateur SaaS', perms: ['*'] },
  admin_pharmacie: {
    label: 'Propriétaire / Administrateur pharmacie',
    perms: ['*org'],
  },
  pharmacien: {
    label: 'Pharmacien responsable',
    perms: [
      'catalogue:read', 'catalogue:write', 'lots:read', 'lots:write',
      'lots:quarantaine', 'stock:read', 'achats:read', 'ventes:read',
      'commandes:read', 'commandes:valider_sensible', 'rappels:gerer',
      'dashboard:read', 'audit:read',
    ],
  },
  gestionnaire: {
    label: 'Gestionnaire',
    perms: [
      'catalogue:read', 'catalogue:write', 'fournisseurs:read', 'fournisseurs:write',
      'achats:read', 'achats:write', 'stock:read', 'commandes:read', 'commandes:write',
      'prix:write', 'dashboard:read', 'rapports:read', 'clients:read', 'clients:write',
    ],
  },
  magasinier: {
    label: 'Magasinier',
    perms: [
      'catalogue:read', 'stock:read', 'stock:mouvement', 'lots:read',
      'reception:write', 'inventaire:write', 'commandes:read', 'commandes:preparer',
      'livraisons:read', 'livraisons:write',
    ],
  },
  vendeur: {
    label: 'Vendeur / Caissier',
    perms: [
      'catalogue:read', 'stock:read', 'ventes:read', 'ventes:write',
      'clients:read', 'clients:write', 'caisse:read', 'caisse:write',
      'commandes:read', 'commandes:write',
    ],
  },
  comptable: {
    label: 'Comptable',
    perms: [
      'depenses:read', 'depenses:write', 'creances:read', 'paiements:read',
      'paiements:write', 'caisse:read', 'caisse:rapprocher', 'rapports:read',
      'dashboard:read', 'clients:read',
    ],
  },
  livreur: {
    label: 'Livreur',
    perms: ['livraisons:read', 'livraisons:write'],
  },
};

export function can(user, perm) {
  const role = ROLES[user.role];
  if (!role) return false;
  if (role.perms.includes('*')) return true;
  if (role.perms.includes('*org')) return true; // admin pharmacie : tout dans son organisation
  return role.perms.includes(perm);
}

export function audit(user, action, entite, entiteId, details) {
  const db = getDb();
  db.auditLog.push({
    id: uid(),
    ts: now(),
    userId: user ? user.id : null,
    userNom: user ? user.nom : 'anonyme',
    organizationId: user ? user.organizationId : null,
    action,
    entite,
    entiteId: entiteId || null,
    details: details || '',
  });
}

export function getUserFromRequest(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.created > SESSION_TTL) { sessions.delete(token); return null; }
  const db = getDb();
  const user = db.users.find((u) => u.id === s.userId && u.actif);
  return user || null;
}

export const sanitizeUser = (u) => ({
  id: u.id, login: u.login, nom: u.nom, role: u.role,
  roleLabel: (ROLES[u.role] || {}).label || u.role,
  organizationId: u.organizationId, actif: u.actif,
});

/** Étanchéité multi-tenant (§5) : un utilisateur ne voit que les données
 * de son organisation ; l'admin système voit tout. */
export function tenantFilter(user, rows) {
  if (user.role === 'admin_systeme') return rows;
  return rows.filter((r) => r.organizationId === user.organizationId);
}

export function tenantCheck(user, row) {
  if (!row) return false;
  return user.role === 'admin_systeme' || row.organizationId === user.organizationId;
}
