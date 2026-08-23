// NOVA PHARMA OS — Ventes comptoir (POS) et caisse (§21, §22, §35).

import { route, json, readBody } from '../http.mjs';
import { getDb, uid, now, nextNum, saveDb } from '../db.mjs';
import { can, audit, tenantFilter, tenantCheck } from '../auth.mjs';
import { allouerFEFO, appliquerAllocation } from '../stock-engine.mjs';
import { buildDocumentPdf } from '../pdf.mjs';

const TARIF_PAR_CATEGORIE = { detail: 'prixDetail', pro: 'prixPro', semi_gros: 'prixSemiGros' };

export function registerSalesRoutes(routes) {
  // ---- Caisse (§35) -----------------------------------------------------
  route(routes, 'GET', /^\/api\/cash-sessions\/current$/, async (req, res, user) => {
    if (!can(user, 'caisse:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const session = tenantFilter(user, db.cashSessions).find((s) => s.statut === 'ouverte');
    if (!session) return json(res, 200, null);
    const mouvements = db.cashMovements.filter((m) => m.cashSessionId === session.id);
    json(res, 200, { ...session, mouvements });
  });

  route(routes, 'POST', /^\/api\/cash-sessions\/open$/, async (req, res, user) => {
    if (!can(user, 'caisse:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    if (tenantFilter(user, db.cashSessions).some((s) => s.statut === 'ouverte')) {
      return json(res, 409, { erreur: 'Une session de caisse est déjà ouverte' });
    }
    const b = await readBody(req);
    const session = {
      id: uid(), organizationId: user.organizationId, ouvertureTs: now(), fermetureTs: null,
      montantOuverture: Number(b.montantOuverture || 0), montantFermetureTheorique: null,
      montantFermetureReel: null, ecart: null, userId: user.id, userNom: user.nom, statut: 'ouverte',
    };
    db.cashSessions.push(session);
    audit(user, 'ouverture_caisse', 'session_caisse', session.id, `Fond de caisse : ${session.montantOuverture} USD`);
    saveDb();
    json(res, 201, session);
  });

  route(routes, 'POST', /^\/api\/cash-sessions\/([\w-]+)\/close$/, async (req, res, user, m) => {
    if (!can(user, 'caisse:rapprocher') && !can(user, 'caisse:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const session = db.cashSessions.find((x) => x.id === m[1]);
    if (!session || !tenantCheck(user, session)) return json(res, 404, { erreur: 'Session introuvable' });
    if (session.statut !== 'ouverte') return json(res, 409, { erreur: 'Session déjà clôturée' });
    const b = await readBody(req);
    const mouvements = db.cashMovements.filter((mv) => mv.cashSessionId === session.id);
    const entrees = mouvements.filter((mv) => mv.type === 'vente' || mv.type === 'entree').reduce((s, mv) => s + mv.montant, 0);
    const sorties = mouvements.filter((mv) => mv.type === 'sortie' || mv.type === 'remboursement').reduce((s, mv) => s + mv.montant, 0);
    const theorique = session.montantOuverture + entrees - sorties;
    const reel = Number(b.montantFermetureReel ?? theorique);
    session.montantFermetureTheorique = theorique;
    session.montantFermetureReel = reel;
    session.ecart = Number((reel - theorique).toFixed(2));
    session.fermetureTs = now();
    session.statut = 'cloturee';
    audit(user, 'cloture_caisse', 'session_caisse', session.id, `Théorique ${theorique} / Réel ${reel} / Écart ${session.ecart}`);
    saveDb();
    json(res, 200, session);
  });

  route(routes, 'GET', /^\/api\/cash-sessions$/, async (req, res, user) => {
    if (!can(user, 'caisse:read') && !can(user, 'caisse:rapprocher')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    json(res, 200, tenantFilter(user, db.cashSessions).sort((a, b) => b.ouvertureTs.localeCompare(a.ouvertureTs)).slice(0, 100));
  });

  // ---- Ventes comptoir (§21) ----------------------------------------
  route(routes, 'POST', /^\/api\/sales$/, async (req, res, user) => {
    if (!can(user, 'ventes:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const session = tenantFilter(user, db.cashSessions).find((s) => s.statut === 'ouverte');
    if (!session) return json(res, 409, { erreur: 'Aucune session de caisse ouverte — ouvrez la caisse avant de vendre' });
    const b = await readBody(req);
    if (!Array.isArray(b.lignes) || !b.lignes.length) return json(res, 400, { erreur: 'Au moins une ligne requise' });

    const customer = b.customerId ? db.customers.find((c) => c.id === b.customerId && tenantCheck(user, c)) : null;

    // Lignes fusionnées par produit, pour qu'un même produit répété dans
    // le panier ne soit alloué qu'une seule fois (évite tout chevauchement
    // entre lignes lors de la vérification de stock ci-dessous).
    const quantitesParProduit = new Map();
    for (const l of b.lignes) {
      quantitesParProduit.set(l.productId, {
        quantite: (quantitesParProduit.get(l.productId)?.quantite || 0) + Number(l.quantite),
        prixUnitaire: l.prixUnitaire,
      });
    }

    // Étape 1 — validation intégrale (prix minimum, disponibilité FEFO)
    // SANS aucune mutation : allouerFEFO se contente de lire les lots
    // existants. Rien n'est modifié tant que toutes les lignes ne sont
    // pas validées (§92 règles 1, 2 et 4).
    const previsions = [];
    for (const [productId, { quantite, prixUnitaire: prixDemande }] of quantitesParProduit) {
      const p = db.products.find((pr) => pr.id === productId && pr.actif && tenantCheck(user, pr));
      if (!p) return json(res, 404, { erreur: 'Produit introuvable ou inactif' });
      const champTarif = TARIF_PAR_CATEGORIE[customer ? customer.categorieTarifaire : 'detail'] || 'prixDetail';
      const prixUnitaire = prixDemande != null ? Number(prixDemande) : p[champTarif];
      if (prixUnitaire < p.prixMin && !can(user, 'commandes:valider_sensible') && user.role !== 'admin_pharmacie') {
        return json(res, 403, { erreur: `Prix de ${p.code} sous le minimum autorisé (§92 règle 4)` });
      }
      try {
        const allocation = allouerFEFO(db, p.id, quantite, { forcerNegatif: false });
        previsions.push({ produit: p, quantite, prixUnitaire, allocation });
      } catch (e) {
        return json(res, e.code === 'STOCK_INSUFFISANT' ? 409 : 400, { erreur: e.message });
      }
    }

    // Étape 2 — toutes les lignes sont valides : on applique réellement
    // les décréments de stock.
    const lignesVente = previsions.map(({ produit: p, quantite, prixUnitaire, allocation }) => {
      const coutTotal = allocation.reduce((s, a) => s + a.quantite * a.batch.prixAchatUnitaire, 0);
      appliquerAllocation(db, allocation, {
        organizationId: user.organizationId, type: 'vente', motif: 'Vente comptoir', userId: user.id, reference: '',
      });
      return {
        productId: p.id, produitCode: p.code, produitNom: p.nom, quantite, prixUnitaire,
        montant: quantite * prixUnitaire, coutTotal, marge: quantite * prixUnitaire - coutTotal,
        lots: allocation.map((a) => ({ batchId: a.batch.id, numeroLot: a.batch.numeroLot, quantite: a.quantite })),
      };
    });

    const total = lignesVente.reduce((s, l) => s + l.montant, 0);
    const sale = {
      id: uid(), organizationId: user.organizationId, numero: nextNum('VTE'), customerId: customer ? customer.id : null,
      lignes: lignesVente, total, margeTotal: lignesVente.reduce((s, l) => s + l.marge, 0),
      paiementMode: b.paiementMode || 'especes', cashSessionId: session.id, userId: user.id, userNom: user.nom, cree: now(),
    };
    db.sales.push(sale);

    if (sale.paiementMode !== 'credit') {
      db.cashMovements.push({
        id: uid(), organizationId: user.organizationId, cashSessionId: session.id, type: 'vente',
        montant: total, motif: `Vente ${sale.numero}`, ts: now(),
      });
    } else if (customer) {
      customer.encours += total;
    }

    audit(user, 'vente', 'vente', sale.id, `${sale.numero} — ${total.toFixed(2)} USD`);
    saveDb();
    json(res, 201, sale);
  });

  route(routes, 'GET', /^\/api\/sales$/, async (req, res, user, m, url) => {
    if (!can(user, 'ventes:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    let rows = tenantFilter(user, db.sales).sort((a, b) => b.cree.localeCompare(a.cree));
    const depuis = url.searchParams.get('depuis');
    if (depuis) rows = rows.filter((s) => s.cree >= depuis);
    json(res, 200, rows.slice(0, 300));
  });

  route(routes, 'GET', /^\/api\/sales\/([\w-]+)\/pdf$/, async (req, res, user, m) => {
    if (!can(user, 'ventes:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const sale = db.sales.find((x) => x.id === m[1]);
    if (!sale || !tenantCheck(user, sale)) return json(res, 404, { erreur: 'Vente introuvable' });
    const org = db.organizations.find((o) => o.id === sale.organizationId);
    const client = sale.customerId ? db.customers.find((c) => c.id === sale.customerId) : null;
    const { buffer } = buildDocumentPdf({
      titre: 'Reçu de vente', numero: sale.numero, organisation: org,
      tiers: { nom: client ? client.nom : 'Client comptoir', lignesAdresse: client ? [client.telephone] : [] },
      dateLabel: 'Vente', date: sale.cree,
      lignes: sale.lignes.map((l) => ({ libelle: `${l.produitNom} (${l.produitCode})`, quantite: l.quantite, prixUnitaire: l.prixUnitaire })),
      notes: `Mode de paiement : ${sale.paiementMode}`,
    });
    audit(user, 'export_pdf', 'vente', sale.id, sale.numero);
    saveDb();
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${sale.numero}.pdf"`, 'Content-Length': buffer.length });
    res.end(buffer);
  });
}
