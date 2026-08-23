// NOVA PHARMA OS — Clients, devis et commandes B2B (§8, §9, §21 à §28).

import { route, json, readBody } from '../http.mjs';
import { getDb, uid, now, nextNum, saveDb } from '../db.mjs';
import { can, audit, tenantFilter, tenantCheck } from '../auth.mjs';
import { allouerFEFO, appliquerAllocation, stockDisponible } from '../stock-engine.mjs';

const TARIF_PAR_CATEGORIE = { detail: 'prixDetail', pro: 'prixPro', semi_gros: 'prixSemiGros' };

function prixPour(product, customer) {
  const champ = TARIF_PAR_CATEGORIE[customer ? customer.categorieTarifaire : 'detail'] || 'prixDetail';
  return product[champ] ?? product.prixDetail;
}

/** Construit les lignes tarifées à partir d'une liste {productId, quantite,
 * prixUnitaire?}. Refuse toute vente sous le prix minimum sans habilitation
 * (§92 règle 4), sauf pour un utilisateur disposant de `commandes:valider_sensible`. */
function tariferLignes(db, customer, lignesDemandees, user) {
  const lignes = [];
  for (const l of lignesDemandees) {
    const p = db.products.find((pr) => pr.id === l.productId && pr.actif);
    if (!p) { const e = new Error('Produit introuvable ou inactif'); e.code = 'PRODUIT_INTROUVABLE'; throw e; }
    const prixSuggere = prixPour(p, customer);
    let prixUnitaire = l.prixUnitaire != null ? Number(l.prixUnitaire) : prixSuggere;
    if (prixUnitaire < p.prixMin && !can(user, 'commandes:valider_sensible') && user.role !== 'admin_pharmacie') {
      const e = new Error(`Prix de ${p.code} (${prixUnitaire}) sous le minimum autorisé (${p.prixMin}) — validation requise (§92 règle 4)`);
      e.code = 'PRIX_SOUS_MINIMUM';
      throw e;
    }
    lignes.push({
      productId: p.id, produitCode: p.code, produitNom: p.nom,
      quantite: Number(l.quantite), prixUnitaire, montant: Number(l.quantite) * prixUnitaire,
    });
  }
  return lignes;
}

export function registerCustomerRoutes(routes) {
  // ---- Clients (§8, §9) ---------------------------------------------
  route(routes, 'GET', /^\/api\/customers$/, async (req, res, user, m, url) => {
    if (!can(user, 'clients:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const q = (url.searchParams.get('q') || '').toLowerCase();
    let rows = tenantFilter(user, db.customers).filter((c) => c.actif);
    if (q) rows = rows.filter((c) => [c.nom, c.telephone].some((v) => (v || '').toLowerCase().includes(q)));
    json(res, 200, rows.slice(0, 200));
  });

  route(routes, 'POST', /^\/api\/customers$/, async (req, res, user) => {
    if (!can(user, 'clients:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const b = await readBody(req);
    if (!b.nom || !b.telephone) return json(res, 400, { erreur: 'Nom et téléphone requis' });
    const db = getDb();
    const c = {
      id: uid(), organizationId: user.organizationId, type: b.type === 'professionnel' ? 'professionnel' : 'particulier',
      nom: String(b.nom), telephone: String(b.telephone), whatsapp: String(b.whatsapp || b.telephone),
      email: String(b.email || ''), adresse: String(b.adresse || ''), ville: String(b.ville || ''),
      categorieTarifaire: ['detail', 'pro', 'semi_gros'].includes(b.categorieTarifaire) ? b.categorieTarifaire : 'detail',
      plafondCredit: Number(b.plafondCredit || 0), encours: 0, responsable: String(b.responsable || ''),
      actif: true, cree: now(),
    };
    db.customers.push(c);
    audit(user, 'creation', 'client', c.id, `${c.nom} (${c.type})`);
    saveDb();
    json(res, 201, c);
  });

  route(routes, 'GET', /^\/api\/customers\/([\w-]+)$/, async (req, res, user, m) => {
    if (!can(user, 'clients:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const c = db.customers.find((x) => x.id === m[1]);
    if (!c || !tenantCheck(user, c)) return json(res, 404, { erreur: 'Client introuvable' });
    const commandes = db.customerOrders.filter((o) => o.customerId === c.id).sort((a, b) => b.cree.localeCompare(a.cree));
    const paiements = db.payments.filter((p) => p.customerId === c.id).sort((a, b) => b.ts.localeCompare(a.ts));
    json(res, 200, { client: c, commandes, paiements });
  });

  // ---- Devis (§27) ----------------------------------------------------
  route(routes, 'POST', /^\/api\/quotes$/, async (req, res, user) => {
    if (!can(user, 'commandes:write') && !can(user, 'ventes:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const b = await readBody(req);
    const db = getDb();
    const customer = db.customers.find((c) => c.id === b.customerId && tenantCheck(user, c));
    if (!customer) return json(res, 404, { erreur: 'Client introuvable' });
    try {
      const lignes = tariferLignes(db, customer, b.lignes || [], user);
      const q = {
        id: uid(), organizationId: user.organizationId, numero: nextNum('DEV'), customerId: customer.id,
        lignes, total: lignes.reduce((s, l) => s + l.montant, 0), statut: 'brouillon',
        validite: b.validite || null, cree: now(), creePar: user.id,
      };
      db.quotes.push(q);
      audit(user, 'creation', 'devis', q.id, `${q.numero} — ${customer.nom}`);
      saveDb();
      json(res, 201, q);
    } catch (e) {
      json(res, e.code === 'PRIX_SOUS_MINIMUM' ? 403 : 400, { erreur: e.message });
    }
  });

  route(routes, 'GET', /^\/api\/quotes$/, async (req, res, user) => {
    if (!can(user, 'commandes:read') && !can(user, 'ventes:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    json(res, 200, tenantFilter(user, db.quotes).sort((a, b) => b.cree.localeCompare(a.cree)));
  });

  route(routes, 'POST', /^\/api\/quotes\/([\w-]+)\/convertir$/, async (req, res, user, m) => {
    if (!can(user, 'commandes:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const q = db.quotes.find((x) => x.id === m[1]);
    if (!q || !tenantCheck(user, q)) return json(res, 404, { erreur: 'Devis introuvable' });
    if (q.statut === 'converti') return json(res, 409, { erreur: 'Devis déjà converti' });
    const customer = db.customers.find((c) => c.id === q.customerId);
    const order = {
      id: uid(), organizationId: user.organizationId, numero: nextNum('NSP'), customerId: customer.id,
      type: 'b2b', lignes: q.lignes, total: q.total, statut: 'en_attente',
      adresseLivraison: customer.adresse, moyenPaiement: 'credit', quoteId: q.id,
      cree: now(), creePar: user.id, historique: [{ ts: now(), statut: 'en_attente', par: user.nom }],
    };
    db.customerOrders.push(order);
    q.statut = 'converti';
    audit(user, 'conversion_devis', 'devis', q.id, `→ commande ${order.numero}`);
    saveDb();
    json(res, 201, order);
  });

  // ---- Commandes clients (détail & B2B) (§25, §26) ---------------------
  const TRANSITIONS = {
    brouillon: ['en_attente', 'annulee'],
    en_attente: ['confirmee', 'annulee'],
    confirmee: ['en_preparation', 'annulee'],
    en_preparation: ['prete', 'annulee'],
    prete: ['en_livraison', 'livree', 'annulee'],
    en_livraison: ['livree', 'partiellement_livree', 'annulee'],
    partiellement_livree: ['livree'],
    livree: ['retournee'],
    annulee: [],
    retournee: [],
  };

  route(routes, 'POST', /^\/api\/customer-orders$/, async (req, res, user) => {
    if (!can(user, 'commandes:write') && !can(user, 'ventes:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const b = await readBody(req);
    const db = getDb();
    const customer = db.customers.find((c) => c.id === b.customerId && tenantCheck(user, c));
    if (!customer) return json(res, 404, { erreur: 'Client introuvable' });
    if (!Array.isArray(b.lignes) || !b.lignes.length) return json(res, 400, { erreur: 'Au moins une ligne requise' });
    try {
      const lignes = tariferLignes(db, customer, b.lignes, user);
      const order = {
        id: uid(), organizationId: user.organizationId, numero: nextNum('NSP'), customerId: customer.id,
        type: customer.type === 'professionnel' ? 'b2b' : 'detail', lignes, total: lignes.reduce((s, l) => s + l.montant, 0),
        statut: 'brouillon', adresseLivraison: String(b.adresseLivraison || customer.adresse || ''),
        moyenPaiement: b.moyenPaiement || 'comptant', urgence: !!b.urgence,
        cree: now(), creePar: user.id, historique: [{ ts: now(), statut: 'brouillon', par: user.nom }],
      };
      db.customerOrders.push(order);
      audit(user, 'creation', 'commande_client', order.id, `${order.numero} — ${customer.nom}`);
      saveDb();
      json(res, 201, order);
    } catch (e) {
      json(res, e.code === 'PRIX_SOUS_MINIMUM' ? 403 : 400, { erreur: e.message });
    }
  });

  route(routes, 'GET', /^\/api\/customer-orders$/, async (req, res, user, m, url) => {
    if (!can(user, 'commandes:read') && !can(user, 'ventes:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    let rows = tenantFilter(user, db.customerOrders);
    const statut = url.searchParams.get('statut');
    if (statut) rows = rows.filter((o) => o.statut === statut);
    rows = rows.slice().sort((a, b) => b.cree.localeCompare(a.cree));
    const enrichi = rows.map((o) => ({ ...o, clientNom: (db.customers.find((c) => c.id === o.customerId) || {}).nom || '?' }));
    json(res, 200, enrichi.slice(0, 300));
  });

  route(routes, 'GET', /^\/api\/customer-orders\/([\w-]+)$/, async (req, res, user, m) => {
    if (!can(user, 'commandes:read') && !can(user, 'ventes:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const o = db.customerOrders.find((x) => x.id === m[1]);
    if (!o || !tenantCheck(user, o)) return json(res, 404, { erreur: 'Commande introuvable' });
    const client = db.customers.find((c) => c.id === o.customerId);
    const livraison = db.deliveries.find((d) => d.orderId === o.id);
    json(res, 200, { ...o, client, livraison });
  });

  route(routes, 'POST', /^\/api\/customer-orders\/([\w-]+)\/statut$/, async (req, res, user, m) => {
    const db = getDb();
    const o = db.customerOrders.find((x) => x.id === m[1]);
    if (!o || !tenantCheck(user, o)) return json(res, 404, { erreur: 'Commande introuvable' });
    const b = await readBody(req);
    const cible = String(b.statut || '');
    if (!(TRANSITIONS[o.statut] || []).includes(cible)) {
      return json(res, 409, { erreur: `Transition ${o.statut} → ${cible} non autorisée` });
    }
    const permParStatut = {
      en_attente: ['commandes:write', 'ventes:write'],
      confirmee: ['commandes:write', 'ventes:write'], annulee: ['commandes:write', 'ventes:write'],
      en_preparation: ['commandes:preparer'], prete: ['commandes:preparer'],
      en_livraison: ['livraisons:write'], livree: ['livraisons:write'], retournee: ['commandes:write'],
    };
    if (!(permParStatut[cible] || []).some((p) => can(user, p))) {
      return json(res, 403, { erreur: 'Votre rôle ne permet pas cette étape' });
    }

    const client = db.customers.find((c) => c.id === o.customerId);

    // §33 — plafond de crédit : blocage à la confirmation si dépassement.
    if (cible === 'confirmee' && o.moyenPaiement === 'credit' && client) {
      const futurEncours = client.encours + o.total;
      if (futurEncours > client.plafondCredit && !can(user, 'commandes:valider_sensible') && user.role !== 'admin_pharmacie') {
        return json(res, 403, {
          erreur: `Plafond de crédit dépassé pour ${client.nom} (encours ${client.encours} + ${o.total} > plafond ${client.plafondCredit}) — validation d'un responsable requise (§33)`,
        });
      }
      client.encours = futurEncours;
    }

    // Décrémentation réelle du stock au moment de la préparation (FEFO,
    // jamais de lot expiré — §92 règle 1).
    if (cible === 'en_preparation') {
      for (const ligne of o.lignes) {
        const dispo = stockDisponible(db, ligne.productId);
        if (dispo < ligne.quantite && !can(user, 'commandes:valider_sensible') && user.role !== 'admin_pharmacie') {
          return json(res, 409, { erreur: `Stock insuffisant pour ${ligne.produitNom} (${dispo}/${ligne.quantite} disponibles)` });
        }
      }
      for (const ligne of o.lignes) {
        const allocation = allouerFEFO(db, ligne.productId, ligne.quantite, { forcerNegatif: true });
        appliquerAllocation(db, allocation, {
          organizationId: user.organizationId, type: 'vente', motif: `Commande ${o.numero}`, userId: user.id, reference: o.numero,
        });
        ligne.lotsAlloues = allocation.map((a) => ({ batchId: a.batch.id, numeroLot: a.batch.numeroLot, quantite: a.quantite }));
      }
    }

    o.statut = cible;
    o.historique.push({ ts: now(), statut: cible, par: user.nom });
    audit(user, 'changement_statut', 'commande_client', o.id, `${o.numero} → ${cible}`);
    saveDb();
    json(res, 200, o);
  });
}
