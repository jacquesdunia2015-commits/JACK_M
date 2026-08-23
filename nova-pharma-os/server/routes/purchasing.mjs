// NOVA PHARMA OS — Achats : commandes fournisseurs et réception (§19).

import { route, json, readBody } from '../http.mjs';
import { getDb, uid, now, nextNum, saveDb } from '../db.mjs';
import { can, audit, tenantFilter, tenantCheck } from '../auth.mjs';

export function registerPurchasingRoutes(routes) {
  route(routes, 'GET', /^\/api\/purchase-orders$/, async (req, res, user, m, url) => {
    if (!can(user, 'achats:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    let rows = tenantFilter(user, db.purchaseOrders);
    const statut = url.searchParams.get('statut');
    if (statut) rows = rows.filter((po) => po.statut === statut);
    rows = rows.slice().sort((a, b) => b.cree.localeCompare(a.cree));
    const enrichi = rows.map((po) => ({ ...po, fournisseurNom: (db.suppliers.find((s) => s.id === po.fournisseurId) || {}).nom || '?' }));
    json(res, 200, enrichi);
  });

  route(routes, 'POST', /^\/api\/purchase-orders$/, async (req, res, user) => {
    if (!can(user, 'achats:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const b = await readBody(req);
    if (!b.fournisseurId || !Array.isArray(b.lignes) || !b.lignes.length) {
      return json(res, 400, { erreur: 'Fournisseur et au moins une ligne requis' });
    }
    const db = getDb();
    const fournisseur = db.suppliers.find((s) => s.id === b.fournisseurId && tenantCheck(user, s));
    if (!fournisseur) return json(res, 404, { erreur: 'Fournisseur introuvable' });
    const lignes = b.lignes.map((l) => {
      const p = db.products.find((pr) => pr.id === l.productId);
      return {
        productId: l.productId, produitCode: p ? p.code : '?', produitNom: p ? p.nom : '?',
        quantiteCommandee: Number(l.quantiteCommandee), quantiteRecue: 0,
        prixUnitaire: Number(l.prixUnitaire ?? (p ? p.prixAchat : 0)),
      };
    });
    const po = {
      id: uid(), organizationId: user.organizationId, numero: nextNum('PO'), fournisseurId: fournisseur.id,
      statut: 'brouillon', lignes, cree: now(), creePar: user.id,
    };
    db.purchaseOrders.push(po);
    audit(user, 'creation', 'commande_achat', po.id, `${po.numero} — ${fournisseur.nom}`);
    saveDb();
    json(res, 201, po);
  });

  route(routes, 'GET', /^\/api\/purchase-orders\/([\w-]+)$/, async (req, res, user, m) => {
    if (!can(user, 'achats:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const po = db.purchaseOrders.find((x) => x.id === m[1]);
    if (!po || !tenantCheck(user, po)) return json(res, 404, { erreur: 'Commande introuvable' });
    const fournisseur = db.suppliers.find((s) => s.id === po.fournisseurId);
    json(res, 200, { ...po, fournisseur });
  });

  route(routes, 'POST', /^\/api\/purchase-orders\/([\w-]+)\/envoyer$/, async (req, res, user, m) => {
    if (!can(user, 'achats:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const po = db.purchaseOrders.find((x) => x.id === m[1]);
    if (!po || !tenantCheck(user, po)) return json(res, 404, { erreur: 'Commande introuvable' });
    if (po.statut !== 'brouillon') return json(res, 409, { erreur: 'Seule une commande en brouillon peut être envoyée' });
    po.statut = 'envoyee';
    audit(user, 'envoi', 'commande_achat', po.id, po.numero);
    saveDb();
    json(res, 200, po);
  });

  /** Réception de marchandise → création des lots (§19, §11). */
  route(routes, 'POST', /^\/api\/purchase-orders\/([\w-]+)\/receptionner$/, async (req, res, user, m) => {
    if (!can(user, 'reception:write') && !can(user, 'achats:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const po = db.purchaseOrders.find((x) => x.id === m[1]);
    if (!po || !tenantCheck(user, po)) return json(res, 404, { erreur: 'Commande introuvable' });
    if (!['envoyee', 'partiellement_recue'].includes(po.statut)) {
      return json(res, 409, { erreur: `Réception impossible au statut « ${po.statut} »` });
    }
    const b = await readBody(req);
    if (!Array.isArray(b.lignes) || !b.lignes.length) return json(res, 400, { erreur: 'Au moins une ligne de réception requise' });

    const lotsCrees = [];
    for (const rl of b.lignes) {
      const ligne = po.lignes.find((l) => l.productId === rl.productId);
      if (!ligne) continue;
      const quantite = Number(rl.quantiteRecue || 0);
      if (quantite <= 0) continue;
      if (!rl.numeroLot || !rl.dateExpiration) {
        return json(res, 400, { erreur: `Numéro de lot et date d'expiration requis pour ${ligne.produitCode}` });
      }
      const batch = {
        id: uid(), organizationId: user.organizationId, productId: ligne.productId, numeroLot: String(rl.numeroLot),
        quantiteInitiale: quantite, quantite, dateReception: now(), dateExpiration: rl.dateExpiration,
        fournisseurId: po.fournisseurId, prixAchatUnitaire: Number(rl.prixUnitaire ?? ligne.prixUnitaire),
        statut: 'actif', factureFournisseurRef: rl.factureRef || '',
      };
      db.batches.push(batch);
      db.stockMovements.push({
        id: uid(), organizationId: user.organizationId, ts: now(), productId: ligne.productId, batchId: batch.id,
        type: 'achat', quantite, motif: `Réception ${po.numero}`, userId: user.id, reference: po.numero,
      });
      ligne.quantiteRecue += quantite;
      lotsCrees.push(batch);
    }
    const complet = po.lignes.every((l) => l.quantiteRecue >= l.quantiteCommandee);
    po.statut = complet ? 'recue' : 'partiellement_recue';
    audit(user, 'reception', 'commande_achat', po.id, `${po.numero} — ${lotsCrees.length} lot(s) créé(s), statut ${po.statut}`);
    saveDb();
    json(res, 200, { commande: po, lots: lotsCrees });
  });

  route(routes, 'POST', /^\/api\/purchase-orders\/([\w-]+)\/annuler$/, async (req, res, user, m) => {
    if (!can(user, 'achats:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const po = db.purchaseOrders.find((x) => x.id === m[1]);
    if (!po || !tenantCheck(user, po)) return json(res, 404, { erreur: 'Commande introuvable' });
    if (['recue'].includes(po.statut)) return json(res, 409, { erreur: 'Une commande déjà reçue ne peut être annulée' });
    po.statut = 'annulee';
    audit(user, 'annulation', 'commande_achat', po.id, po.numero);
    saveDb();
    json(res, 200, po);
  });
}
