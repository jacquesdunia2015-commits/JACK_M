import { Injectable } from '@nestjs/common';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { Feuille, classeur } from '../../../common/excel/classeur';
import { RequestContext } from '../../../common/database/request-context';

export interface ParametresPrevision {
  /** Jours à prévoir (ventes attendues). */
  horizon?: number;
  /** Jours de stock que la commande doit couvrir (délai de livraison compris). */
  coverDays?: number;
  /** Stock de sécurité, en % de la prévision sur la couverture. */
  safetyPercent?: number;
}

interface LigneMois { product_id: string; mois: string; q: string }

const NOMS_MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const arrondi = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const borner = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** « 2026-10 » décalé de n mois. */
function decaler(mois: string, n: number): string {
  const [a, m] = mois.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Indice saisonnier d'un mois à partir d'un historique mensuel : ventes du
 * même mois l'an dernier rapportées à la moyenne mensuelle des douze mois
 * qui le précèdent. Sans douze mois d'historique : 1 (pas de saisonnalité
 * connue).
 */
function indice(historique: Map<string, number>, moisCible: string, moisCourant: string): number | null {
  const anneeAvant = decaler(moisCible, -12);
  const fenetre = Array.from({ length: 12 }, (_, i) => decaler(moisCourant, -12 + i));
  // Il faut au moins un an d'historique couvert : le premier mois de la fenêtre doit avoir existé.
  const premier = [...historique.keys()].sort()[0];
  // Un an d'historique au moins, et le mois de l'an dernier doit être connu.
  if (!premier || premier > fenetre[0] || anneeAvant < premier) return null;
  const moyenne = fenetre.reduce((s, m) => s + (historique.get(m) ?? 0), 0) / 12;
  if (moyenne <= 0) return null;
  return borner((historique.get(anneeAvant) ?? 0) / moyenne, 0.3, 3);
}

/**
 * Prévisions de ventes et suggestions de commande, calculées sur
 * l'historique de la pharmacie elle-même : rythme des 90 derniers jours,
 * corrigé de la saison (même mois l'an dernier), pour le produit et pour sa
 * catégorie. Aucune donnée ne quitte la pharmacie, aucun service payant.
 */
@Injectable()
export class PrevisionsService {
  constructor(private readonly db: DatabaseService) {}

  async previsions(ctx: RequestContext, p: ParametresPrevision = {}) {
    return this.db.readTransaction(ctx, (tx) => this.calculer(tx, p));
  }

  private async calculer(tx: Tx, p: ParametresPrevision) {
    const horizon = borner(Math.round(p.horizon ?? 30), 7, 120);
    const couverture = borner(Math.round(p.coverDays ?? 45), 7, 180);
    const securite = borner(p.safetyPercent ?? 20, 0, 100);

    const org = await tx.oneOrFail<{ tz: string; mois: string; jour: string }>(
      `SELECT timezone AS tz, to_char(now() AT TIME ZONE timezone, 'YYYY-MM') AS mois,
              to_char(now() AT TIME ZONE timezone, 'YYYY-MM-DD') AS jour
         FROM organizations WHERE id = current_setting('nova.organization_id')::uuid`,
    );
    // Mois visé : celui du milieu de l'horizon.
    const milieu = new Date(`${org.jour}T12:00:00Z`);
    milieu.setUTCDate(milieu.getUTCDate() + Math.round(horizon / 2));
    const moisCible = milieu.toISOString().slice(0, 7);
    // Mois couverts par les 90 derniers jours, avec leur nombre de jours.
    const joursParMois = new Map<string, number>();
    for (let i = 1; i <= 90; i++) {
      const d = new Date(`${org.jour}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - i);
      const m = d.toISOString().slice(0, 7);
      joursParMois.set(m, (joursParMois.get(m) ?? 0) + 1);
    }

    const mensuel = await tx.many<LigneMois>(
      `SELECT l.product_id, to_char(s.sold_at AT TIME ZONE $1, 'YYYY-MM') AS mois, sum(l.quantity) AS q
         FROM sale_lines l JOIN sales s ON s.id = l.sale_id
        WHERE s.status = 'completed' AND s.sold_at >= date_trunc('month', now()) - interval '24 months'
        GROUP BY 1, 2`,
      [org.tz],
    );
    const produits = await tx.many<{
      id: string; name: string; dosage: string | null; category: string | null; reorder_point: string; reorder_quantity: string;
      units_per_pack: string; stock: string; on_order: string; q90: string; q30: string; premiere_vente: string | null;
    }>(
      `SELECT p.id, p.name, p.dosage, c.name AS category, p.reorder_point, p.reorder_quantity, p.units_per_pack,
              COALESCE((SELECT sum(si.quantity - si.reserved_quantity) FROM stock_items si
                         LEFT JOIN product_lots pl ON pl.id = si.lot_id
                        WHERE si.product_id = p.id AND COALESCE(pl.is_quarantined, false) = false
                          AND (pl.expiry_date IS NULL OR pl.expiry_date >= CURRENT_DATE)), 0) AS stock,
              COALESCE((SELECT sum(ol.quantity - ol.received_quantity) FROM purchase_order_lines ol
                         JOIN purchase_orders o ON o.id = ol.purchase_order_id
                        WHERE ol.product_id = p.id AND ol.quantity > ol.received_quantity
                          AND o.status NOT IN ('draft', 'cancelled', 'received', 'closed', 'completed')), 0) AS on_order,
              COALESCE((SELECT sum(l.quantity) FROM sale_lines l JOIN sales s ON s.id = l.sale_id
                         WHERE l.product_id = p.id AND s.status = 'completed' AND s.sold_at >= now() - interval '90 days'), 0) AS q90,
              COALESCE((SELECT sum(l.quantity) FROM sale_lines l JOIN sales s ON s.id = l.sale_id
                         WHERE l.product_id = p.id AND s.status = 'completed' AND s.sold_at >= now() - interval '30 days'), 0) AS q30,
              (SELECT to_char(min(s.sold_at) AT TIME ZONE $1, 'YYYY-MM') FROM sale_lines l JOIN sales s ON s.id = l.sale_id
                WHERE l.product_id = p.id AND s.status = 'completed') AS premiere_vente
         FROM products p LEFT JOIN product_categories c ON c.id = p.category_id
        WHERE p.deleted_at IS NULL AND p.is_active
          AND EXISTS (SELECT 1 FROM sale_lines l JOIN sales s ON s.id = l.sale_id
                       WHERE l.product_id = p.id AND s.status = 'completed' AND s.sold_at >= now() - interval '12 months')`,
      [org.tz],
    );

    // Historique mensuel par produit et par catégorie.
    const parProduit = new Map<string, Map<string, number>>();
    for (const l of mensuel) {
      const h = parProduit.get(l.product_id) ?? new Map<string, number>();
      h.set(l.mois, Number(l.q));
      parProduit.set(l.product_id, h);
    }
    const categorieDe = new Map(produits.map((x) => [x.id, x.category ?? 'Sans catégorie']));
    const parCategorie = new Map<string, Map<string, number>>();
    for (const l of mensuel) {
      const cat = categorieDe.get(l.product_id);
      if (!cat) continue;
      const h = parCategorie.get(cat) ?? new Map<string, number>();
      h.set(l.mois, (h.get(l.mois) ?? 0) + Number(l.q));
      parCategorie.set(cat, h);
    }

    const indiceMelange = (produit: string, mois: string) => {
      const ip = indice(parProduit.get(produit) ?? new Map(), mois, org.mois);
      const ic = indice(parCategorie.get(categorieDe.get(produit) ?? '') ?? new Map(), mois, org.mois);
      const volume = [...(parProduit.get(produit)?.values() ?? [])].reduce((s, q) => s + q, 0);
      // Un produit peu vendu suit la saison de sa catégorie ; un produit bien vendu, la sienne surtout.
      if (ip !== null && ic !== null) return volume >= 24 ? 0.7 * ip + 0.3 * ic : 0.3 * ip + 0.7 * ic;
      return ip ?? ic ?? 1;
    };

    const lignes = produits.map((x) => {
      const historique = parProduit.get(x.id) ?? new Map<string, number>();
      const moisHistorique = x.premiere_vente
        ? Math.max(1, (Number(org.mois.slice(0, 4)) - Number(x.premiere_vente.slice(0, 4))) * 12 + Number(org.mois.slice(5)) - Number(x.premiere_vente.slice(5)) + 1)
        : 0;
      // Rythme récent : les 30 derniers jours comptent autant que les 60 d'avant.
      const q90 = Number(x.q90);
      const q30 = Number(x.q30);
      const rythme = q90 > 0 ? 0.5 * (q30 / 30) + 0.5 * ((q90 - q30) / 60) : 0;
      // Saison : on retire celle des trois derniers mois, on applique celle du mois visé.
      const indiceRecent = Math.max(0.5, [...joursParMois].reduce((s, [m, j]) => s + j * indiceMelange(x.id, m), 0) / 90);
      const indiceCible = indiceMelange(x.id, moisCible);
      const parJour = rythme / indiceRecent * indiceCible;
      const prevision = parJour * horizon;
      const stock = Number(x.stock);
      const commande = Number(x.on_order);
      const besoin = parJour * couverture * (1 + securite / 100);
      let aCommander = Math.max(0, Math.ceil(besoin - stock - commande));
      // Le seuil de réapprovisionnement saisi sur la fiche reste un plancher.
      if (aCommander === 0 && Number(x.reorder_point) > 0 && stock + commande <= Number(x.reorder_point)) {
        aCommander = Math.max(Math.ceil(Number(x.reorder_quantity)), 1);
      }
      const joursCouverts = parJour > 0 ? stock / parJour : null;
      return {
        productId: x.id,
        product: x.dosage && !x.name.toLowerCase().includes(x.dosage.toLowerCase()) ? `${x.name} ${x.dosage}` : x.name,
        category: x.category ?? 'Sans catégorie',
        stock: arrondi(stock, 3), onOrder: arrondi(commande, 3),
        dailyRate: arrondi(rythme, 3), seasonalIndex: arrondi(indiceCible / indiceRecent, 2),
        forecast: arrondi(prevision, 1), daysOfCover: joursCouverts === null ? null : Math.floor(joursCouverts),
        suggestedOrder: aCommander,
        confidence: moisHistorique >= 13 ? 'bonne' : moisHistorique >= 6 ? 'moyenne' : 'faible',
        history: Array.from({ length: 12 }, (_, i) => historique.get(decaler(org.mois, -11 + i)) ?? 0),
      };
    });
    lignes.sort((a, b) => (a.daysOfCover ?? 9999) - (b.daysOfCover ?? 9999) || b.forecast - a.forecast);

    // Profil saisonnier de chaque catégorie : indice de chacun des 12 prochains mois.
    const saisons = [...parCategorie.entries()]
      .map(([categorie, h]) => ({
        category: categorie,
        months: Array.from({ length: 12 }, (_, i) => {
          const m = decaler(org.mois, i + 1);
          const v = indice(h, m, org.mois);
          return { month: m, label: NOMS_MOIS[Number(m.slice(5)) - 1], index: v === null ? null : arrondi(v, 2) };
        }),
      }))
      .filter((s) => s.months.some((m) => m.index !== null));

    return {
      generatedAt: new Date().toISOString(), horizon, coverDays: couverture, safetyPercent: securite,
      targetMonth: moisCible, targetLabel: `${NOMS_MOIS[Number(moisCible.slice(5)) - 1]} ${moisCible.slice(0, 4)}`,
      historyLabels: Array.from({ length: 12 }, (_, i) => NOMS_MOIS[Number(decaler(org.mois, -11 + i).slice(5)) - 1]),
      products: lignes,
      toOrder: lignes.filter((l) => l.suggestedOrder > 0).length,
      seasons: saisons,
    };
  }

  /** Classeur Excel des prévisions et des quantités à commander. */
  async classeur(ctx: RequestContext, p: ParametresPrevision = {}) {
    const r = await this.previsions(ctx, p);
    const officine = await this.db.readTransaction(ctx, (tx) =>
      tx.oneOrFail<{ name: string }>('SELECT COALESCE(trade_name, legal_name) AS name FROM organizations WHERE id = $1', [ctx.organizationId]),
    );
    const entete = [`${officine.name} — Prévisions pour les ${r.horizon} prochains jours (${r.targetLabel})`,
      `Commande pour ${r.coverDays} jours de stock, sécurité ${r.safetyPercent} % — calculé le ${r.generatedAt.slice(0, 10)}`];
    const feuilles: Feuille[] = [
      {
        nom: 'À commander', entete,
        colonnes: [
          { titre: 'Produit', largeur: 36 }, { titre: 'Catégorie', largeur: 22 }, { titre: 'Stock', type: 'nombre' },
          { titre: 'En commande', type: 'nombre' }, { titre: 'Ventes / jour', type: 'nombre' },
          { titre: 'Saison (×)', type: 'nombre' }, { titre: `Prévision ${r.horizon} j`, type: 'nombre' },
          { titre: 'Jours couverts', type: 'nombre' }, { titre: 'À commander', type: 'nombre' }, { titre: 'Fiabilité', largeur: 12 },
        ],
        lignes: r.products.map((l) => [l.product, l.category, l.stock, l.onOrder, l.dailyRate, l.seasonalIndex, l.forecast, l.daysOfCover ?? '', l.suggestedOrder, l.confidence]),
      },
      {
        nom: 'Ventes 12 mois', entete: [`${officine.name} — Quantités vendues par mois`, 'Du plus ancien au plus récent'],
        colonnes: [{ titre: 'Produit', largeur: 36 }, ...r.historyLabels.map((m) => ({ titre: m, type: 'nombre' as const }))],
        lignes: r.products.map((l) => [l.product, ...l.history]),
      },
    ];
    return classeur(feuilles);
  }
}
