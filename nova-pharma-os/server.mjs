#!/usr/bin/env node
/**
 * NOVA PHARMA OS — Serveur (MVP, §86 du cahier des charges)
 * SaaS de gestion d'une pharmacie : stock, lots/FEFO, achats, ventes,
 * clients, commandes B2B, livraison, caisse, tableau de bord, alertes.
 *
 * Projet pilote : NOVA SANTÉ PHARMA — Bukavu, Sud-Kivu, RDC.
 *
 * Zéro dépendance externe : Node.js >= 18 uniquement.
 * Démarrage :  node server.mjs  [PORT=8080]
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadDb, getDb } from './server/db.mjs';
import { seed } from './server/seed.mjs';
import { getUserFromRequest, checkPassword, sanitizeUser, sessions, audit, can, tenantFilter } from './server/auth.mjs';
import { uid, now, saveDb } from './server/db.mjs';
import { json, readBody } from './server/http.mjs';

import { registerCatalogRoutes } from './server/routes/catalog.mjs';
import { registerStockRoutes } from './server/routes/stock.mjs';
import { registerPurchasingRoutes } from './server/routes/purchasing.mjs';
import { registerSalesRoutes } from './server/routes/sales.mjs';
import { registerCustomerRoutes } from './server/routes/customers.mjs';
import { registerDeliveryRoutes } from './server/routes/delivery.mjs';
import { registerFinanceRoutes } from './server/routes/finance.mjs';
import { registerDashboardRoutes } from './server/routes/dashboard.mjs';
import { registerUserRoutes } from './server/routes/users.mjs';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 8080);

/* ============================ Initialisation ============================ */

loadDb();
if (getDb().organizations.length === 0) seed();

/* ============================ Routage ==================================== */

const routes = [];
registerCatalogRoutes(routes);
registerStockRoutes(routes);
registerPurchasingRoutes(routes);
registerSalesRoutes(routes);
registerCustomerRoutes(routes);
registerDeliveryRoutes(routes);
registerFinanceRoutes(routes);
registerDashboardRoutes(routes);
registerUserRoutes(routes);

/* ---- Authentification (§6) ----------------------------------------- */

routes.push({
  method: 'POST', pattern: /^\/api\/login$/, public: true,
  handler: async (req, res) => {
    const { login, password } = await readBody(req);
    const db = getDb();
    const user = db.users.find((u) => u.login === login && u.actif);
    if (!user || !checkPassword(String(password || ''), user.salt, user.hash)) {
      audit(null, 'connexion_echec', 'utilisateur', null, `login: ${String(login || '').slice(0, 40)}`);
      saveDb();
      return json(res, 401, { erreur: 'Identifiants invalides' });
    }
    const token = crypto.randomBytes(24).toString('base64url');
    sessions.set(token, { userId: user.id, created: Date.now() });
    audit(user, 'connexion', 'utilisateur', user.id, '');
    saveDb();
    json(res, 200, { token, user: sanitizeUser(user) });
  },
});

routes.push({
  method: 'POST', pattern: /^\/api\/logout$/,
  handler: async (req, res, user) => {
    const auth = req.headers['authorization'] || '';
    sessions.delete(auth.slice(7));
    audit(user, 'deconnexion', 'utilisateur', user.id, '');
    saveDb();
    json(res, 200, { ok: true });
  },
});

routes.push({
  method: 'GET', pattern: /^\/api\/me$/,
  handler: async (req, res, user) => {
    const db = getDb();
    const org = db.organizations.find((o) => o.id === user.organizationId);
    json(res, 200, { user: sanitizeUser(user), organisation: org || null });
  },
});

routes.push({
  method: 'GET', pattern: /^\/api\/organizations$/,
  handler: async (req, res, user) => {
    const db = getDb();
    const rows = user.role === 'admin_systeme' ? db.organizations : db.organizations.filter((o) => o.id === user.organizationId);
    json(res, 200, rows);
  },
});

/* ===================== Fichiers statiques (SPA) =========================== */

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, idx) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(idx);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

/* ===================== Serveur HTTP ======================================= */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

  try {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = pathname.match(r.pattern);
      if (!m) continue;
      if (r.public) return await r.handler(req, res, null, m, url);
      const user = getUserFromRequest(req);
      if (!user) return json(res, 401, { erreur: 'Authentification requise' });
      return await r.handler(req, res, user, m, url);
    }
    json(res, 404, { erreur: 'Route inconnue' });
  } catch (e) {
    json(res, 400, { erreur: e.message || 'Erreur serveur' });
  }
});

server.listen(PORT, () => {
  console.log(`NOVA PHARMA OS démarré : http://localhost:${PORT}`);
  console.log(`Données : ${path.join(process.env.NOVA_DATA || path.join(__dirname, 'data'), 'db.json')}`);
});

export { server };
