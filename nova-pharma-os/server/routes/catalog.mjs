// NOVA PHARMA OS — Routes catalogue produits & fournisseurs (§10, §19 partiel).

import { route, json, readBody } from '../http.mjs';
import { getDb, uid, now, saveDb } from '../db.mjs';
import { can, audit, tenantFilter, tenantCheck } from '../auth.mjs';
import { stockDisponible, stockTotalBrut } from '../stock-engine.mjs';

export function registerCatalogRoutes(routes) {
  // ---- Fournisseurs (§18) -------------------------------------------
  route(routes, 'GET', /^\/api\/suppliers$/, async (req, res, user) => {
    if (!can(user, 'fournisseurs:read') && !can(user, 'achats:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    json(res, 200, tenantFilter(user, db.suppliers));
  });

  route(routes, 'POST', /^\/api\/suppliers$/, async (req, res, user) => {
    if (!can(user, 'fournisseurs:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const b = await readBody(req);
    if (!b.nom) return json(res, 400, { erreur: 'Nom requis' });
    const db = getDb();
    const s = {
      id: uid(), organizationId: user.organizationId, nom: String(b.nom), ville: String(b.ville || ''),
      telephone: String(b.telephone || ''), delaiJours: Number(b.delaiJours || 7), actif: true,
    };
    db.suppliers.push(s);
    audit(user, 'creation', 'fournisseur', s.id, s.nom);
    saveDb();
    json(res, 201, s);
  });

  // ---- Catégories -----------------------------------------------------
  route(routes, 'GET', /^\/api\/categories$/, async (req, res, user) => {
    const db = getDb();
    json(res, 200, tenantFilter(user, db.categories));
  });

  // ---- Produits (§10) ---------------------------------------------------
  route(routes, 'GET', /^\/api\/products$/, async (req, res, user, m, url) => {
    if (!can(user, 'catalogue:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const q = (url.searchParams.get('q') || '').toLowerCase();
    let rows = tenantFilter(user, db.products);
    if (!url.searchParams.get('inclureInactifs')) rows = rows.filter((p) => p.actif);
    if (q) rows = rows.filter((p) => [p.code, p.nom, p.dci].some((v) => (v || '').toLowerCase().includes(q)));
    const enrichi = rows.map((p) => ({
      ...p,
      stockDisponible: stockDisponible(db, p.id),
      stockTotal: stockTotalBrut(db, p.id),
    }));
    json(res, 200, enrichi.slice(0, 300));
  });

  route(routes, 'POST', /^\/api\/products$/, async (req, res, user) => {
    if (!can(user, 'catalogue:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const b = await readBody(req);
    if (!b.code || !b.nom) return json(res, 400, { erreur: 'Code et nom requis' });
    const db = getDb();
    if (db.products.some((p) => p.organizationId === user.organizationId && p.code === b.code)) {
      return json(res, 409, { erreur: 'Ce code produit existe déjà' });
    }
    const p = {
      id: uid(), organizationId: user.organizationId, code: String(b.code).toUpperCase(), nom: String(b.nom),
      dci: String(b.dci || ''), dosage: String(b.dosage || ''), forme: String(b.forme || ''),
      unite: String(b.unite || 'unité'), categorie: String(b.categorie || 'Général'),
      fournisseurPrincipalId: b.fournisseurPrincipalId || null,
      prixAchat: Number(b.prixAchat || 0), prixDetail: Number(b.prixDetail || 0),
      prixPro: Number(b.prixPro ?? b.prixDetail ?? 0), prixSemiGros: Number(b.prixSemiGros ?? b.prixDetail ?? 0),
      prixMin: Number(b.prixMin ?? b.prixAchat ?? 0),
      stockMin: Number(b.stockMin || 0), stockMax: Number(b.stockMax || 0), seuilAlerte: Number(b.seuilAlerte ?? b.stockMin ?? 0),
      actif: true,
    };
    db.products.push(p);
    audit(user, 'creation', 'produit', p.id, `${p.code} — ${p.nom}`);
    saveDb();
    json(res, 201, p);
  });

  route(routes, 'PUT', /^\/api\/products\/([\w-]+)$/, async (req, res, user, m) => {
    if (!can(user, 'catalogue:write') && !can(user, 'prix:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const p = db.products.find((x) => x.id === m[1]);
    if (!p || !tenantCheck(user, p)) return json(res, 404, { erreur: 'Produit introuvable' });
    const b = await readBody(req);
    const champsTexte = ['nom', 'dci', 'dosage', 'forme', 'unite', 'categorie'];
    for (const k of champsTexte) if (b[k] != null) p[k] = String(b[k]);
    const champsNum = ['prixAchat', 'prixDetail', 'prixPro', 'prixSemiGros', 'prixMin', 'stockMin', 'stockMax', 'seuilAlerte'];
    for (const k of champsNum) if (b[k] != null) p[k] = Number(b[k]);
    if (typeof b.actif === 'boolean') p.actif = b.actif;
    audit(user, 'modification', 'produit', p.id, `${p.code} modifié`);
    saveDb();
    json(res, 200, p);
  });

  route(routes, 'GET', /^\/api\/products\/([\w-]+)$/, async (req, res, user, m) => {
    if (!can(user, 'catalogue:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const p = db.products.find((x) => x.id === m[1]);
    if (!p || !tenantCheck(user, p)) return json(res, 404, { erreur: 'Produit introuvable' });
    const lots = db.batches.filter((b) => b.productId === p.id).sort((a, b) => new Date(a.dateExpiration) - new Date(b.dateExpiration));
    const mouvements = db.stockMovements.filter((mv) => mv.productId === p.id).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 50);
    json(res, 200, { produit: { ...p, stockDisponible: stockDisponible(db, p.id), stockTotal: stockTotalBrut(db, p.id) }, lots, mouvements });
  });
}
