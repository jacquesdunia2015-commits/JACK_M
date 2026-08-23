// NOVA PHARMA OS — Gestion des utilisateurs (§4 — un compte individuel
// par utilisateur, jamais de compte partagé, §92 règle 8).

import { route, json, readBody } from '../http.mjs';
import { getDb, uid, now, saveDb } from '../db.mjs';
import { can, audit, tenantFilter, hashPassword, sanitizeUser, ROLES } from '../auth.mjs';

const ROLE_ADMIN_ONLY = new Set(['admin_systeme', 'admin_pharmacie']);

export function registerUserRoutes(routes) {
  route(routes, 'GET', /^\/api\/users$/, async (req, res, user) => {
    if (user.role !== 'admin_pharmacie' && user.role !== 'admin_systeme') return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    json(res, 200, tenantFilter(user, db.users).map(sanitizeUser));
  });

  route(routes, 'GET', /^\/api\/roles$/, async (req, res, user) => {
    json(res, 200, Object.entries(ROLES).filter(([k]) => k !== 'admin_systeme' || user.role === 'admin_systeme')
      .map(([value, r]) => ({ value, label: r.label })));
  });

  route(routes, 'POST', /^\/api\/users$/, async (req, res, user) => {
    if (user.role !== 'admin_pharmacie' && user.role !== 'admin_systeme') return json(res, 403, { erreur: 'Accès refusé' });
    const b = await readBody(req);
    if (!b.login || !b.password || !b.nom || !ROLES[b.role]) return json(res, 400, { erreur: 'Champs requis : login, password, nom, role' });
    if (ROLE_ADMIN_ONLY.has(b.role) && user.role !== 'admin_systeme') return json(res, 403, { erreur: 'Rôle réservé à l’administrateur plateforme' });
    const db = getDb();
    if (db.users.some((u) => u.login === b.login)) return json(res, 409, { erreur: 'Login déjà utilisé' });
    const { salt, hash } = hashPassword(String(b.password));
    const u = {
      id: uid(), login: String(b.login), nom: String(b.nom), role: b.role,
      organizationId: user.role === 'admin_systeme' ? (b.organizationId || null) : user.organizationId,
      salt, hash, actif: true, cree: now(),
    };
    db.users.push(u);
    audit(user, 'creation', 'utilisateur', u.id, `${u.login} (${u.role})`);
    saveDb();
    json(res, 201, sanitizeUser(u));
  });

  route(routes, 'PUT', /^\/api\/users\/([\w-]+)$/, async (req, res, user, m) => {
    if (user.role !== 'admin_pharmacie' && user.role !== 'admin_systeme') return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const u = db.users.find((x) => x.id === m[1]);
    if (!u || (user.role !== 'admin_systeme' && u.organizationId !== user.organizationId)) return json(res, 404, { erreur: 'Utilisateur introuvable' });
    const b = await readBody(req);
    if (b.nom) u.nom = String(b.nom);
    if (b.role && ROLES[b.role] && (!ROLE_ADMIN_ONLY.has(b.role) || user.role === 'admin_systeme')) u.role = b.role;
    if (typeof b.actif === 'boolean') u.actif = b.actif;
    if (b.password) Object.assign(u, hashPassword(String(b.password)));
    audit(user, 'modification', 'utilisateur', u.id, `${u.login} modifié`);
    saveDb();
    json(res, 200, sanitizeUser(u));
  });
}
