// NOVA PHARMA OS — Tableau de bord, KPI et journal d'audit (§37 à §39, §64).

import { route, json } from '../http.mjs';
import { getDb } from '../db.mjs';
import { can, tenantFilter } from '../auth.mjs';
import { calculerAlertes, valeurStock } from '../stock-engine.mjs';

const debutJour = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };
const debutSemaine = () => { const d = new Date(); const jour = (d.getDay() + 6) % 7; d.setDate(d.getDate() - jour); d.setHours(0, 0, 0, 0); return d.toISOString(); };
const debutMois = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString(); };

export function registerDashboardRoutes(routes) {
  route(routes, 'GET', /^\/api\/dashboard$/, async (req, res, user) => {
    if (!can(user, 'dashboard:read')) return json(res, 403, { erreur: 'Accès refusé' });
    if (!user.organizationId) return json(res, 200, { multiOrg: true });
    const db = getDb();
    const ventes = tenantFilter(user, db.sales);
    const commandes = tenantFilter(user, db.customerOrders);
    const livraisons = tenantFilter(user, db.deliveries);

    const ventesAujourdhui = ventes.filter((s) => s.cree >= debutJour());
    const caJour = ventesAujourdhui.reduce((s, v) => s + v.total, 0);
    const margeJour = ventesAujourdhui.reduce((s, v) => s + v.margeTotal, 0);

    const session = tenantFilter(user, db.cashSessions).find((s) => s.statut === 'ouverte');
    const caisseActuelle = session
      ? session.montantOuverture + db.cashMovements.filter((m) => m.cashSessionId === session.id)
        .reduce((s, m) => s + (['vente', 'entree'].includes(m.type) ? m.montant : -m.montant), 0)
      : null;

    const { ruptures, peremptions } = calculerAlertes(db, user.organizationId);
    const creances = tenantFilter(user, db.customers).reduce((s, c) => s + (c.encours || 0), 0);
    const achatsRecommandes = ruptures.reduce((s, r) => {
      const p = db.products.find((pr) => pr.id === r.productId);
      const qte = Math.max(0, (p ? p.stockMax : r.seuil * 2) - r.stock);
      return s + qte * (p ? p.prixAchat : 0);
    }, 0);

    json(res, 200, {
      aujourdhui: {
        chiffreAffaires: Number(caJour.toFixed(2)), margeBrute: Number(margeJour.toFixed(2)),
        commandes: commandes.filter((o) => o.cree >= debutJour()).length,
        livraisons: livraisons.filter((d) => d.cree >= debutJour()).length,
        caisse: caisseActuelle,
      },
      cetteSemaine: {
        ventes: ventes.filter((s) => s.cree >= debutSemaine()).reduce((s, v) => s + v.total, 0),
      },
      ceMois: {
        chiffreAffaires: ventes.filter((s) => s.cree >= debutMois()).reduce((s, v) => s + v.total, 0),
        margeBrute: ventes.filter((s) => s.cree >= debutMois()).reduce((s, v) => s + v.margeTotal, 0),
      },
      valeurStock: Number(valeurStock(db, user.organizationId).toFixed(2)),
      creances: Number(creances.toFixed(2)),
      produitsEnRupture: ruptures.length,
      produitsARisqueExpiration: peremptions.length,
      achatsRecommandes: Number(achatsRecommandes.toFixed(2)),
      ruptures: ruptures.slice(0, 10),
      peremptions: peremptions.slice(0, 10),
    });
  });

  /** Top produits / clients — §74 rapport hebdomadaire (version simplifiée). */
  route(routes, 'GET', /^\/api\/reports\/top$/, async (req, res, user) => {
    if (!can(user, 'rapports:read') && !can(user, 'dashboard:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    const ventes = tenantFilter(user, db.sales);
    const parProduit = new Map();
    for (const v of ventes) {
      for (const l of v.lignes) {
        const cur = parProduit.get(l.productId) || { produitNom: l.produitNom, quantite: 0, montant: 0 };
        cur.quantite += l.quantite; cur.montant += l.montant;
        parProduit.set(l.productId, cur);
      }
    }
    const topProduits = [...parProduit.values()].sort((a, b) => b.montant - a.montant).slice(0, 10);

    const parClient = new Map();
    for (const v of ventes) {
      if (!v.customerId) continue;
      const client = db.customers.find((c) => c.id === v.customerId);
      const cur = parClient.get(v.customerId) || { nom: client ? client.nom : '?', montant: 0, nbCommandes: 0 };
      cur.montant += v.total; cur.nbCommandes += 1;
      parClient.set(v.customerId, cur);
    }
    const topClients = [...parClient.values()].sort((a, b) => b.montant - a.montant).slice(0, 10);

    json(res, 200, { topProduits, topClients });
  });

  route(routes, 'GET', /^\/api\/audit$/, async (req, res, user, m, url) => {
    if (!can(user, 'audit:read')) return json(res, 403, { erreur: 'Accès refusé' });
    const db = getDb();
    let rows = user.role === 'admin_systeme' ? db.auditLog : db.auditLog.filter((a) => a.organizationId === user.organizationId);
    const q = (url.searchParams.get('q') || '').toLowerCase();
    if (q) rows = rows.filter((a) => [a.action, a.entite, a.userNom, a.details].some((v) => (v || '').toLowerCase().includes(q)));
    json(res, 200, rows.slice(-500).reverse());
  });
}
