// NOVA PHARMA OS — Routes stock, lots et alertes (§11 à §17).

import { route, json, readBody } from '../http.mjs';
import { getDb, uid, now, saveDb } from '../db.mjs';
import { can, audit, tenantFilter, tenantCheck } from '../auth.mjs';
import { ajusterStock, calculerAlertes } from '../stock-engine.mjs';

export function registerStockRoutes(routes) {
  route(routes, 'GET', /^\/api\/batches$/, async (req, res, user, m, url) => {
    if (!can(user, 'stock:read') && !can(user, 'lots:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    let rows = tenantFilter(user, db.batches);
    const productId = url.searchParams.get('productId');
    if (productId) rows = rows.filter((b) => b.productId === productId);
    rows = rows.slice().sort((a, b) => new Date(a.dateExpiration) - new Date(b.dateExpiration));
    const enrichi = rows.map((b) => {
      const p = db.products.find((pr) => pr.id === b.productId);
      return { ...b, produitCode: p ? p.code : '?', produitNom: p ? p.nom : '?' };
    });
    json(res, 200, enrichi);
  });

  /** Où est le lot X ? Quels mouvements l'ont concerné ? (§11 — traçabilité). */
  route(routes, 'GET', /^\/api\/batches\/([\w-]+)$/, async (req, res, user, m) => {
    if (!can(user, 'stock:read') && !can(user, 'lots:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const b = db.batches.find((x) => x.id === m[1]);
    if (!b || !tenantCheck(user, b)) return json(res, 404, { erreur: 'Lot introuvable' });
    const mouvements = db.stockMovements.filter((mv) => mv.batchId === b.id).sort((a, x) => a.ts.localeCompare(x.ts));
    const ventes = db.sales.filter((s) => s.lignes.some((l) => l.batchId === b.id));
    json(res, 200, { lot: b, mouvements, ventesAssociees: ventes.map((s) => ({ id: s.id, numero: s.numero, cliente: s.customerId, ts: s.cree })) });
  });

  /** Mise en quarantaine / libération d'un lot (§51). */
  route(routes, 'POST', /^\/api\/batches\/([\w-]+)\/quarantaine$/, async (req, res, user, m) => {
    if (!can(user, 'lots:quarantaine') && !can(user, 'lots:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const b = db.batches.find((x) => x.id === m[1]);
    if (!b || !tenantCheck(user, b)) return json(res, 404, { erreur: 'Lot introuvable' });
    const body = await readBody(req);
    if (!body.motif) return json(res, 400, { erreur: 'Un motif est requis (§51)' });
    b.statut = body.liberer ? 'actif' : 'quarantaine';
    audit(user, body.liberer ? 'liberation_quarantaine' : 'mise_en_quarantaine', 'lot', b.id, `${b.numeroLot} — ${body.motif}`);
    saveDb();
    json(res, 200, b);
  });

  /** Ajustement manuel de stock — motif obligatoire (§92 règle 3). */
  route(routes, 'POST', /^\/api\/stock\/adjustment$/, async (req, res, user) => {
    if (!can(user, 'stock:mouvement')) return json(res, 403, { erreur: 'Accès refusé' });
    const b = await readBody(req);
    const db = getDb();
    try {
      const batch = ajusterStock(db, {
        organizationId: user.organizationId, batchId: b.batchId, delta: Number(b.delta),
        motif: b.motif, type: b.type || 'ajustement', userId: user.id, reference: b.reference || '',
      });
      audit(user, 'ajustement_stock', 'lot', batch.id, `${b.type || 'ajustement'} : ${b.delta > 0 ? '+' : ''}${b.delta} — ${b.motif}`);
      saveDb();
      json(res, 200, batch);
    } catch (e) {
      json(res, e.code === 'NOT_FOUND' ? 404 : 400, { erreur: e.message });
    }
  });

  route(routes, 'GET', /^\/api\/stock\/movements$/, async (req, res, user, m, url) => {
    if (!can(user, 'stock:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    let rows = tenantFilter(user, db.stockMovements);
    const productId = url.searchParams.get('productId');
    if (productId) rows = rows.filter((mv) => mv.productId === productId);
    rows = rows.slice().sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 300);
    json(res, 200, rows);
  });

  route(routes, 'GET', /^\/api\/stock\/alerts$/, async (req, res, user) => {
    if (!can(user, 'stock:read') && !can(user, 'dashboard:read')) return json(res, 403, { erreur: 'Accès refusé' });
    if (!user.organizationId) return json(res, 200, { ruptures: [], peremptions: [], surstock: [] });
    const db = getDb();
    json(res, 200, calculerAlertes(db, user.organizationId));
  });

  // ---- Inventaire (§15) --------------------------------------------------
  route(routes, 'POST', /^\/api\/inventory\/count$/, async (req, res, user) => {
    if (!can(user, 'inventaire:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const b = await readBody(req);
    if (!b.batchId || b.quantiteReelle == null) return json(res, 400, { erreur: 'Lot et quantité réelle requis' });
    const db = getDb();
    const batch = db.batches.find((x) => x.id === b.batchId);
    if (!batch || !tenantCheck(user, batch)) return json(res, 404, { erreur: 'Lot introuvable' });
    const ecart = Number(b.quantiteReelle) - batch.quantite;
    const inv = {
      id: uid(), organizationId: user.organizationId, ts: now(), productId: batch.productId, batchId: batch.id,
      quantiteTheorique: batch.quantite, quantiteReelle: Number(b.quantiteReelle), ecart,
      userId: user.id, valide: false,
    };
    db.inventoryCounts.push(inv);
    audit(user, 'comptage_inventaire', 'lot', batch.id, `théorique ${inv.quantiteTheorique} / réel ${inv.quantiteReelle} (écart ${ecart >= 0 ? '+' : ''}${ecart})`);
    saveDb();
    json(res, 201, inv);
  });

  route(routes, 'POST', /^\/api\/inventory\/count\/([\w-]+)\/valider$/, async (req, res, user, m) => {
    if (!can(user, 'inventaire:write') && !can(user, 'stock:mouvement')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const inv = db.inventoryCounts.find((x) => x.id === m[1]);
    if (!inv || inv.organizationId !== user.organizationId) return json(res, 404, { erreur: 'Comptage introuvable' });
    if (inv.valide) return json(res, 409, { erreur: 'Comptage déjà validé' });
    if (inv.ecart !== 0) {
      ajusterStock(db, {
        organizationId: user.organizationId, batchId: inv.batchId, delta: inv.ecart,
        motif: `Correction d'inventaire (comptage ${inv.id})`, type: 'ajustement', userId: user.id, reference: inv.id,
      });
    }
    inv.valide = true;
    audit(user, 'validation_inventaire', 'lot', inv.batchId, `écart ${inv.ecart >= 0 ? '+' : ''}${inv.ecart} appliqué`);
    saveDb();
    json(res, 200, inv);
  });

  route(routes, 'GET', /^\/api\/inventory\/count$/, async (req, res, user) => {
    if (!can(user, 'inventaire:write') && !can(user, 'stock:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    json(res, 200, tenantFilter(user, db.inventoryCounts).sort((a, b) => b.ts.localeCompare(a.ts)));
  });
}
