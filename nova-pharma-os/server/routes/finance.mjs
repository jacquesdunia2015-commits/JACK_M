// NOVA PHARMA OS — Paiements, créances et dépenses (§32 à §36).

import { route, json, readBody } from '../http.mjs';
import { getDb, uid, now, saveDb } from '../db.mjs';
import { can, audit, tenantFilter, tenantCheck } from '../auth.mjs';

export function registerFinanceRoutes(routes) {
  route(routes, 'POST', /^\/api\/payments$/, async (req, res, user) => {
    if (!can(user, 'paiements:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const b = await readBody(req);
    if (!b.montant || Number(b.montant) <= 0) return json(res, 400, { erreur: 'Montant invalide' });
    const db = getDb();
    const customer = b.customerId ? db.customers.find((c) => c.id === b.customerId && tenantCheck(user, c)) : null;
    if (b.customerId && !customer) return json(res, 404, { erreur: 'Client introuvable' });
    const payment = {
      id: uid(), organizationId: user.organizationId, customerId: customer ? customer.id : null,
      orderId: b.orderId || null, montant: Number(b.montant), mode: b.mode || 'especes',
      ts: now(), userId: user.id,
    };
    db.payments.push(payment);
    if (customer) customer.encours = Math.max(0, customer.encours - payment.montant);
    const session = tenantFilter(user, db.cashSessions).find((s) => s.statut === 'ouverte');
    if (session && payment.mode !== 'a_terme') {
      db.cashMovements.push({
        id: uid(), organizationId: user.organizationId, cashSessionId: session.id, type: 'entree',
        montant: payment.montant, motif: `Paiement ${customer ? customer.nom : ''}`.trim(), ts: now(),
      });
    }
    audit(user, 'paiement', 'client', customer ? customer.id : null, `${payment.montant} USD (${payment.mode})`);
    saveDb();
    json(res, 201, payment);
  });

  route(routes, 'GET', /^\/api\/payments$/, async (req, res, user) => {
    if (!can(user, 'paiements:read') && !can(user, 'paiements:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    json(res, 200, tenantFilter(user, db.payments).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 300));
  });

  /** Créances clients (§33, §36 — délai de paiement). */
  route(routes, 'GET', /^\/api\/creances$/, async (req, res, user) => {
    if (!can(user, 'creances:read') && !can(user, 'clients:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const clients = tenantFilter(user, db.customers).filter((c) => c.encours > 0);
    const enrichi = clients.map((c) => {
      const dernierePaiement = db.payments.filter((p) => p.customerId === c.id).sort((a, b) => b.ts.localeCompare(a.ts))[0];
      return { clientId: c.id, nom: c.nom, encours: c.encours, plafondCredit: c.plafondCredit, dernierPaiement: dernierePaiement ? dernierePaiement.ts : null };
    }).sort((a, b) => b.encours - a.encours);
    json(res, 200, enrichi);
  });

  // ---- Dépenses (§36) ---------------------------------------------------
  route(routes, 'POST', /^\/api\/expenses$/, async (req, res, user) => {
    if (!can(user, 'depenses:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const b = await readBody(req);
    if (!b.categorie || !b.montant) return json(res, 400, { erreur: 'Catégorie et montant requis' });
    const db = getDb();
    const exp = {
      id: uid(), organizationId: user.organizationId, categorie: String(b.categorie),
      montant: Number(b.montant), motif: String(b.motif || ''), ts: now(), userId: user.id,
    };
    db.expenses.push(exp);
    const session = tenantFilter(user, db.cashSessions).find((s) => s.statut === 'ouverte');
    if (session) {
      db.cashMovements.push({
        id: uid(), organizationId: user.organizationId, cashSessionId: session.id, type: 'sortie',
        montant: exp.montant, motif: `Dépense : ${exp.categorie}`, ts: now(),
      });
    }
    audit(user, 'depense', 'depense', exp.id, `${exp.categorie} — ${exp.montant} USD`);
    saveDb();
    json(res, 201, exp);
  });

  route(routes, 'GET', /^\/api\/expenses$/, async (req, res, user) => {
    if (!can(user, 'depenses:read') && !can(user, 'depenses:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    json(res, 200, tenantFilter(user, db.expenses).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 300));
  });
}
