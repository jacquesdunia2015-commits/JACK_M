// NOVA PHARMA OS — Livraisons (§29 à §31).

import { route, json, readBody } from '../http.mjs';
import { getDb, uid, now, saveDb } from '../db.mjs';
import { can, audit, tenantFilter, tenantCheck } from '../auth.mjs';

const TRANSITIONS = {
  a_livrer: ['en_route', 'echec'],
  en_route: ['livree', 'echec'],
  echec: ['en_route'],
  livree: [],
};

export function registerDeliveryRoutes(routes) {
  route(routes, 'POST', /^\/api\/deliveries$/, async (req, res, user) => {
    if (!can(user, 'livraisons:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const b = await readBody(req);
    const db = getDb();
    const order = db.customerOrders.find((o) => o.id === b.orderId && tenantCheck(user, o));
    if (!order) return json(res, 404, { erreur: 'Commande introuvable' });
    if (!['prete', 'confirmee'].includes(order.statut)) {
      return json(res, 409, { erreur: `La commande doit être prête pour livraison (statut actuel : ${order.statut})` });
    }
    if (db.deliveries.some((d) => d.orderId === order.id && d.statut !== 'echec')) {
      return json(res, 409, { erreur: 'Une livraison existe déjà pour cette commande' });
    }
    const client = db.customers.find((c) => c.id === order.customerId);
    const delivery = {
      id: uid(), organizationId: user.organizationId, orderId: order.id, numeroCommande: order.numero,
      clientNom: client ? client.nom : '?', clientTelephone: client ? client.telephone : '',
      adresse: order.adresseLivraison, statut: 'a_livrer', livreurId: b.livreurId || null,
      preuve: null, cree: now(), historique: [{ ts: now(), statut: 'a_livrer', par: user.nom }],
    };
    db.deliveries.push(delivery);
    audit(user, 'creation', 'livraison', delivery.id, `Pour commande ${order.numero}`);
    saveDb();
    json(res, 201, delivery);
  });

  route(routes, 'GET', /^\/api\/deliveries$/, async (req, res, user, m, url) => {
    if (!can(user, 'livraisons:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    let rows = tenantFilter(user, db.deliveries);
    if (user.role === 'livreur') rows = rows.filter((d) => d.livreurId === user.id || !d.livreurId);
    const statut = url.searchParams.get('statut');
    if (statut) rows = rows.filter((d) => d.statut === statut);
    json(res, 200, rows.sort((a, b) => b.cree.localeCompare(a.cree)));
  });

  route(routes, 'GET', /^\/api\/deliveries\/([\w-]+)$/, async (req, res, user, m) => {
    if (!can(user, 'livraisons:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const d = db.deliveries.find((x) => x.id === m[1]);
    if (!d || !tenantCheck(user, d)) return json(res, 404, { erreur: 'Livraison introuvable' });
    json(res, 200, d);
  });

  route(routes, 'POST', /^\/api\/deliveries\/([\w-]+)\/statut$/, async (req, res, user, m) => {
    if (!can(user, 'livraisons:write')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const d = db.deliveries.find((x) => x.id === m[1]);
    if (!d || !tenantCheck(user, d)) return json(res, 404, { erreur: 'Livraison introuvable' });
    const b = await readBody(req);
    const cible = String(b.statut || '');
    if (!(TRANSITIONS[d.statut] || []).includes(cible)) {
      return json(res, 409, { erreur: `Transition ${d.statut} → ${cible} non autorisée` });
    }
    if (cible === 'livree') {
      if (!b.preuve || !b.preuve.nomReceptionnaire) {
        return json(res, 400, { erreur: 'Une preuve de livraison (nom du réceptionnaire au minimum) est requise (§30)' });
      }
      d.preuve = {
        nomReceptionnaire: String(b.preuve.nomReceptionnaire), signature: b.preuve.signature || null,
        photo: b.preuve.photo || null, heure: now(), commentaire: b.preuve.commentaire || '',
      };
      const order = db.customerOrders.find((o) => o.id === d.orderId);
      if (order) {
        order.statut = 'livree';
        order.historique.push({ ts: now(), statut: 'livree', par: user.nom });
      }
    }
    d.statut = cible;
    d.historique.push({ ts: now(), statut: cible, par: user.nom });
    audit(user, 'changement_statut', 'livraison', d.id, `${d.numeroCommande} → ${cible}`);
    saveDb();
    json(res, 200, d);
  });

  /** Suivi public par le client, sans authentification (§25) : numéro de
   * commande + téléphone de vérification, aucune autre donnée exposée. */
  route(routes, 'GET', /^\/api\/portal\/commande\/([\w-]+)$/, async (req, res, _user, m, url) => {
    const db = getDb();
    const order = db.customerOrders.find((o) => o.numero === m[1]);
    if (!order) return json(res, 404, { erreur: 'Commande introuvable' });
    const client = db.customers.find((c) => c.id === order.customerId);
    const telephone = url.searchParams.get('telephone');
    if (!client || !telephone || client.telephone.replace(/\s/g, '') !== telephone.replace(/\s/g, '')) {
      return json(res, 403, { erreur: 'Numéro de téléphone de vérification incorrect' });
    }
    const delivery = db.deliveries.find((d) => d.orderId === order.id);
    json(res, 200, {
      numero: order.numero, statut: order.statut, historique: order.historique,
      livraison: delivery ? { statut: delivery.statut, preuve: !!delivery.preuve } : null,
    });
  }, { public: true });
}
