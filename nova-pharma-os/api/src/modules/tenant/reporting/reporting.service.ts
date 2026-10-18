import { Injectable } from '@nestjs/common';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { Feuille, classeur } from '../../../common/excel/classeur';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { niveauPeremption } from '../../../common/niveau-peremption';
import { RequestContext } from '../../../common/database/request-context';

/** Jour d'une vente dans le fuseau de la pharmacie (Goma et Bukavu : UTC+2). */
const JOUR_VENTE = `(s.sold_at AT TIME ZONE (SELECT o.timezone FROM organizations o WHERE o.id = s.organization_id))::date`;

/** « 2026-10-01 » ou une date ISO complète → jour ; sinon null. */
function jour(valeur?: string): string | null {
  if (!valeur) return null;
  const j = valeur.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(j) || Number.isNaN(new Date(j).getTime())) {
    throw new BusinessRuleException(`Date invalide : « ${valeur} » (attendu AAAA-MM-JJ).`);
  }
  return j;
}

@Injectable()
export class ReportingService {
  constructor(private readonly db: DatabaseService) {}

  /** Tableau de bord opérationnel de la pharmacie. */
  async dashboard(ctx: RequestContext, branchId?: string) {
    const target = branchId ?? ctx.branchId ?? null;

    return this.db.readTransaction(ctx, async (tx) => {
      const today = await tx.oneOrFail<Record<string, string>>(
        `SELECT
           count(*)                                   AS sales,
           COALESCE(sum(total), 0)                    AS revenue,
           COALESCE(sum(margin_total), 0)             AS margin,
           COALESCE(sum(total) FILTER (
             WHERE EXISTS (SELECT 1 FROM sale_payments sp
                            WHERE sp.sale_id = s.id AND sp.method = 'credit')), 0) AS credit_sales,
           COALESCE(avg(total), 0)                    AS average_basket
         FROM sales s
        WHERE s.status = 'completed'
          AND s.sold_at >= date_trunc('day', now())
          AND ($1::uuid IS NULL OR s.branch_id = $1)`,
        [target],
      );

      const month = await tx.oneOrFail<Record<string, string>>(
        `SELECT count(*) AS sales,
                COALESCE(sum(total), 0) AS revenue,
                COALESCE(sum(margin_total), 0) AS margin,
                COALESCE(sum(cost_total), 0) AS cost
           FROM sales s
          WHERE s.status = 'completed'
            AND s.sold_at >= date_trunc('month', now())
            AND ($1::uuid IS NULL OR s.branch_id = $1)`,
        [target],
      );

      const stock = await tx.oneOrFail<Record<string, string>>(
        `SELECT COALESCE(sum(si.quantity), 0) AS units,
                COALESCE(sum(si.quantity * si.average_cost), 0) AS value,
                count(DISTINCT si.product_id) FILTER (WHERE si.quantity > 0) AS products_in_stock,
                COALESCE(sum(si.quantity) FILTER (
                  WHERE pl.expiry_date IS NOT NULL AND pl.expiry_date < CURRENT_DATE), 0)
                  AS expired_units,
                COALESCE(sum(si.quantity * si.average_cost) FILTER (
                  WHERE pl.expiry_date IS NOT NULL
                    AND pl.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90), 0)
                  AS value_expiring_90d
           FROM stock_items si
           LEFT JOIN product_lots pl ON pl.id = si.lot_id
          WHERE ($1::uuid IS NULL OR si.branch_id = $1)`,
        [target],
      );

      const alerts = await tx.oneOrFail<Record<string, string>>(
        `SELECT count(*) FILTER (WHERE kind = 'out_of_stock') AS out_of_stock,
                count(*) FILTER (WHERE kind = 'low_stock')    AS low_stock,
                count(*) FILTER (WHERE kind = 'expiring')     AS expiring,
                count(*) FILTER (WHERE kind = 'expired')      AS expired
           FROM stock_alerts
          WHERE status = 'open' AND ($1::uuid IS NULL OR branch_id = $1)`,
        [target],
      );

      const receivables = await tx.oneOrFail<Record<string, string>>(
        `SELECT COALESCE(sum(outstanding_balance), 0) AS total,
                count(*) FILTER (WHERE outstanding_balance > 0) AS customers
           FROM customers WHERE deleted_at IS NULL`,
      );

      const cash = await tx.one<Record<string, string>>(
        `SELECT expected_cash, opening_float, register_code, opened_at
           FROM cash_sessions
          WHERE status = 'open' AND ($1::uuid IS NULL OR branch_id = $1)
          ORDER BY opened_at DESC LIMIT 1`,
        [target],
      );

      const topProducts = await tx.many(
        `SELECT p.sku, p.name,
                sum(sl.quantity) AS quantity,
                sum(sl.line_total) AS revenue,
                sum(sl.line_total - sl.quantity * sl.unit_cost) AS margin
           FROM sale_lines sl
           JOIN sales s ON s.id = sl.sale_id
           JOIN products p ON p.id = sl.product_id
          WHERE s.status = 'completed'
            AND s.sold_at >= now() - interval '30 days'
            AND ($1::uuid IS NULL OR s.branch_id = $1)
          GROUP BY p.id, p.sku, p.name
          ORDER BY revenue DESC LIMIT 10`,
        [target],
      );

      const timeline = await tx.many(
        `SELECT to_char(day, 'YYYY-MM-DD') AS date,
                COALESCE(count(s.id), 0) AS sales,
                COALESCE(sum(s.total), 0) AS revenue,
                COALESCE(sum(s.margin_total), 0) AS margin
           FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE, interval '1 day') AS day
           LEFT JOIN sales s
             ON date_trunc('day', s.sold_at) = day
            AND s.status = 'completed'
            AND ($1::uuid IS NULL OR s.branch_id = $1)
          GROUP BY day ORDER BY day`,
        [target],
      );

      const expiring = await tx.many(
        `SELECT p.sku, p.name, pl.lot_number, pl.expiry_date, p.expiry_alert_days,
                si.quantity, (pl.expiry_date - CURRENT_DATE) AS days_left,
                si.quantity * si.average_cost AS value_at_risk
           FROM stock_items si
           JOIN product_lots pl ON pl.id = si.lot_id
           JOIN products p ON p.id = si.product_id
          WHERE si.quantity > 0
            AND pl.expiry_date IS NOT NULL
            AND pl.expiry_date <= CURRENT_DATE + 90
            AND ($1::uuid IS NULL OR si.branch_id = $1)
          ORDER BY pl.expiry_date LIMIT 25`,
        [target],
      );

      const revenue = Number(month.revenue);
      const cost = Number(month.cost);

      return {
        today: {
          sales: Number(today.sales),
          revenue: this.round(Number(today.revenue)),
          margin: this.round(Number(today.margin)),
          creditSales: this.round(Number(today.credit_sales)),
          averageBasket: this.round(Number(today.average_basket)),
        },
        month: {
          sales: Number(month.sales),
          revenue: this.round(revenue),
          cost: this.round(cost),
          margin: this.round(Number(month.margin)),
          marginPercent: revenue > 0 ? this.round(((revenue - cost) / revenue) * 100) : 0,
        },
        stock: {
          units: this.round(Number(stock.units)),
          value: this.round(Number(stock.value)),
          productsInStock: Number(stock.products_in_stock),
          expiredUnits: this.round(Number(stock.expired_units)),
          valueExpiring90Days: this.round(Number(stock.value_expiring_90d)),
        },
        alerts: {
          outOfStock: Number(alerts.out_of_stock),
          lowStock: Number(alerts.low_stock),
          expiring: Number(alerts.expiring),
          expired: Number(alerts.expired),
        },
        receivables: {
          total: this.round(Number(receivables.total)),
          customers: Number(receivables.customers),
        },
        cashSession: cash
          ? {
              registerCode: cash.register_code,
              expectedCash: this.round(Number(cash.expected_cash)),
              openedAt: cash.opened_at,
            }
          : null,
        topProducts: topProducts.map((row) => ({
          sku: row.sku,
          name: row.name,
          quantity: this.round(Number(row.quantity)),
          revenue: this.round(Number(row.revenue)),
          margin: this.round(Number(row.margin)),
        })),
        timeline,
        expiringSoon: expiring.map((lot) => ({
          ...lot,
          expiry_level: niveauPeremption(lot.days_left as number, lot.expiry_alert_days as number),
        })),
      };
    });
  }

  /** Ventes agrégées par période, produit, catégorie ou vendeur. */
  async salesReport(
    ctx: RequestContext,
    query: { from?: string; to?: string; groupBy?: string; branchId?: string },
  ) {
    const groupBy = query.groupBy ?? 'day';
    const dimension =
      {
        day: `to_char(${JOUR_VENTE}, 'YYYY-MM-DD')`,
        month: `to_char(${JOUR_VENTE}, 'YYYY-MM')`,
        product: 'p.name',
        category: "COALESCE(c.name, 'Sans catégorie')",
        seller: "COALESCE(u.full_name, 'Non renseigné')",
        channel: 's.channel',
        customer: "COALESCE(cu.name, 'Client de passage')",
      }[groupBy] ?? `to_char(${JOUR_VENTE}, 'YYYY-MM-DD')`;

    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT ${dimension} AS dimension,
                count(DISTINCT s.id) AS sales,
                sum(sl.quantity) AS quantity,
                sum(sl.line_total) AS revenue,
                sum(sl.tax_amount) AS tax,
                sum(sl.quantity * sl.unit_cost) AS cost,
                -- Marge hors taxes : la TVA collectée n'appartient pas à la pharmacie.
                sum(sl.line_total - sl.tax_amount - sl.quantity * sl.unit_cost) AS margin,
                CASE WHEN sum(sl.line_total - sl.tax_amount) > 0
                     THEN round(100 * sum(sl.line_total - sl.tax_amount - sl.quantity * sl.unit_cost)
                                / sum(sl.line_total - sl.tax_amount), 2)
                     ELSE 0 END AS margin_percent
           FROM sales s
           JOIN sale_lines sl ON sl.sale_id = s.id
           JOIN products p ON p.id = sl.product_id
           LEFT JOIN product_categories c ON c.id = p.category_id
           LEFT JOIN users u ON u.id = s.sold_by
           LEFT JOIN customers cu ON cu.id = s.customer_id
          WHERE s.status = 'completed'
            AND ${JOUR_VENTE} BETWEEN COALESCE($1::date, '1900-01-01') AND COALESCE($2::date, '2999-12-31')
            AND ($3::uuid IS NULL OR s.branch_id = $3)
          GROUP BY 1 ORDER BY ${groupBy === 'day' || groupBy === 'month' ? '1' : 'revenue DESC'} LIMIT 500`,
        [
          jour(query.from),
          jour(query.to),
          query.branchId ?? ctx.branchId ?? null,
        ],
      ),
    );
  }

  /** Valorisation du stock, avec le risque de péremption chiffré. */
  async stockValuation(ctx: RequestContext, branchId?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT COALESCE(c.name, 'Sans catégorie') AS category,
                count(DISTINCT p.id) AS products,
                sum(si.quantity) AS units,
                sum(si.quantity * si.average_cost) AS cost_value,
                sum(si.quantity * p.sale_price) AS retail_value,
                sum(si.quantity * (p.sale_price - si.average_cost)) AS potential_margin,
                sum(si.quantity * si.average_cost) FILTER (
                  WHERE pl.expiry_date IS NOT NULL
                    AND pl.expiry_date <= CURRENT_DATE + 90) AS at_risk_90d
           FROM stock_items si
           JOIN products p ON p.id = si.product_id
           LEFT JOIN product_categories c ON c.id = p.category_id
           LEFT JOIN product_lots pl ON pl.id = si.lot_id
          WHERE si.quantity > 0
            AND ($1::uuid IS NULL OR si.branch_id = $1)
          GROUP BY 1 ORDER BY cost_value DESC`,
        [branchId ?? ctx.branchId ?? null],
      ),
    );
  }

  /**
   * Rotation des stocks : distingue ce qui tourne de ce qui dort.
   * Les produits sans vente sur la période immobilisent de la trésorerie.
   */
  async stockRotation(ctx: RequestContext, days = 90, branchId?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `WITH sold AS (
           SELECT sl.product_id, sum(sl.quantity) AS quantity_sold
             FROM sale_lines sl
             JOIN sales s ON s.id = sl.sale_id
            WHERE s.status = 'completed'
              AND s.sold_at >= now() - ($1 || ' days')::interval
              AND ($2::uuid IS NULL OR s.branch_id = $2)
            GROUP BY sl.product_id
         )
         SELECT p.sku, p.name,
                COALESCE(sum(si.quantity), 0) AS on_hand,
                COALESCE(sum(si.quantity * si.average_cost), 0) AS tied_up_capital,
                COALESCE(sd.quantity_sold, 0) AS sold,
                CASE WHEN COALESCE(sum(si.quantity), 0) > 0
                     THEN round(COALESCE(sd.quantity_sold, 0)::numeric
                                / sum(si.quantity), 2)
                     ELSE NULL END AS rotation,
                CASE WHEN COALESCE(sd.quantity_sold, 0) = 0 THEN 'dormant'
                     WHEN COALESCE(sd.quantity_sold, 0)
                          / GREATEST(sum(si.quantity), 1) > 2 THEN 'rapide'
                     ELSE 'normale' END AS classification
           FROM products p
           LEFT JOIN stock_items si ON si.product_id = p.id
                AND ($2::uuid IS NULL OR si.branch_id = $2)
           LEFT JOIN sold sd ON sd.product_id = p.id
          WHERE p.deleted_at IS NULL AND p.is_active
          GROUP BY p.id, p.sku, p.name, sd.quantity_sold
          ORDER BY tied_up_capital DESC LIMIT 300`,
        [String(days), branchId ?? ctx.branchId ?? null],
      ),
    );
  }

  /** Synthèse d'une période : chiffre d'affaires, marge, panier, parts payées par les tiers. */
  async synthese(ctx: RequestContext, q: { from?: string; to?: string; branchId?: string }) {
    return this.db.readTransaction(ctx, (tx) => this.syntheseTx(tx, ctx, q));
  }

  private async syntheseTx(tx: Tx, ctx: RequestContext, q: { from?: string; to?: string; branchId?: string }) {
    const [de, a] = [jour(q.from), jour(q.to)];
    const totaux = await tx.oneOrFail<Record<string, string>>(
      `SELECT count(*) AS sales,
              COALESCE(sum(s.total), 0) AS revenue,
              COALESCE(sum(s.cost_total), 0) AS cost,
              COALESCE(sum(s.margin_total), 0) AS margin,
              COALESCE(sum(s.tax_total), 0) AS tax,
              COALESCE(avg(s.total), 0) AS average_basket,
              COALESCE(sum(s.payer_share), 0) AS payer_share,
              COALESCE(sum(s.discount_total), 0) AS discounts,
              count(*) FILTER (WHERE s.created_at - s.sold_at > interval '1 minute') AS offline_sales
         FROM sales s
        WHERE s.status = 'completed'
          AND ${JOUR_VENTE} BETWEEN COALESCE($1::date, '1900-01-01') AND COALESCE($2::date, '2999-12-31')
          AND ($3::uuid IS NULL OR s.branch_id = $3)`,
      [de, a, q.branchId ?? ctx.branchId ?? null],
    );
    const annulees = await tx.oneOrFail<{ n: string; total: string }>(
      `SELECT count(*) AS n, COALESCE(sum(s.total), 0) AS total FROM sales s
        WHERE s.status = 'cancelled'
          AND ${JOUR_VENTE} BETWEEN COALESCE($1::date, '1900-01-01') AND COALESCE($2::date, '2999-12-31')
          AND ($3::uuid IS NULL OR s.branch_id = $3)`,
      [de, a, q.branchId ?? ctx.branchId ?? null],
    );
    const devise = await tx.oneOrFail<{ currency: string }>('SELECT currency FROM organizations WHERE id = $1', [ctx.organizationId]);
    const ca = Number(totaux.revenue);
    const caHt = ca - Number(totaux.tax);
    return {
      from: de, to: a, currency: devise.currency,
      sales: Number(totaux.sales), revenue: ca, tax: Number(totaux.tax), cost: Number(totaux.cost),
      margin: Number(totaux.margin),
      // Taux de marge sur le chiffre d'affaires hors taxes.
      marginPercent: caHt > 0 ? this.round((100 * Number(totaux.margin)) / caHt) : 0,
      averageBasket: this.round(Number(totaux.average_basket)), payerShare: Number(totaux.payer_share),
      discounts: Number(totaux.discounts), offlineSales: Number(totaux.offline_sales),
      cancelled: { count: Number(annulees.n), total: Number(annulees.total) },
    };
  }

  /** Encaissements par moyen de paiement et par devise remise. */
  async paiements(ctx: RequestContext, q: { from?: string; to?: string; branchId?: string }) {
    return this.db.readTransaction(ctx, (tx) => this.paiementsTx(tx, ctx, q));
  }

  private paiementsTx(tx: Tx, ctx: RequestContext, q: { from?: string; to?: string; branchId?: string }) {
    return tx.many(
      `SELECT sp.method::text AS method,
              COALESCE(sp.tendered_currency, sp.currency) AS currency,
              count(*) AS payments,
              sum(COALESCE(sp.tendered_amount, sp.amount)) AS tendered,
              sum(sp.amount) AS amount
         FROM sale_payments sp
         JOIN sales s ON s.id = sp.sale_id
        WHERE s.status = 'completed'
          AND ${JOUR_VENTE} BETWEEN COALESCE($1::date, '1900-01-01') AND COALESCE($2::date, '2999-12-31')
          AND ($3::uuid IS NULL OR s.branch_id = $3)
        GROUP BY 1, 2 ORDER BY amount DESC`,
      [jour(q.from), jour(q.to), q.branchId ?? ctx.branchId ?? null],
    );
  }

  /**
   * Pertes par péremption : ce qui a été retiré pour péremption sur la
   * période, ce qui est périmé et encore en rayon, ce qui va l'être.
   */
  async peremptions(ctx: RequestContext, q: { from?: string; to?: string; branchId?: string }) {
    return this.db.readTransaction(ctx, (tx) => this.peremptionsTx(tx, ctx, q));
  }

  private async peremptionsTx(tx: Tx, ctx: RequestContext, q: { from?: string; to?: string; branchId?: string }) {
    const branche = q.branchId ?? ctx.branchId ?? null;
    const retires = await tx.many(
      `SELECT sm.occurred_at, p.sku, p.name, pl.lot_number, pl.expiry_date,
              -sm.quantity AS quantity, -sm.quantity * sm.unit_cost AS value, sm.reason
         FROM stock_movements sm
         JOIN products p ON p.id = sm.product_id
         LEFT JOIN product_lots pl ON pl.id = sm.lot_id
        WHERE sm.kind = 'expiry_write_off'
          AND (sm.occurred_at AT TIME ZONE (SELECT o.timezone FROM organizations o WHERE o.id = sm.organization_id))::date
              BETWEEN COALESCE($1::date, '1900-01-01') AND COALESCE($2::date, '2999-12-31')
          AND ($3::uuid IS NULL OR sm.branch_id = $3)
        ORDER BY sm.occurred_at DESC LIMIT 500`,
      [jour(q.from), jour(q.to), branche],
    );
    const enRayon = await tx.many(
      `SELECT p.sku, p.name, pl.lot_number, pl.expiry_date, si.quantity,
              si.quantity * si.average_cost AS value,
              (pl.expiry_date - CURRENT_DATE) AS days_left
         FROM stock_items si
         JOIN products p ON p.id = si.product_id
         JOIN product_lots pl ON pl.id = si.lot_id
        WHERE si.quantity > 0 AND pl.expiry_date IS NOT NULL AND pl.expiry_date <= CURRENT_DATE + 90
          AND ($1::uuid IS NULL OR si.branch_id = $1)
        ORDER BY pl.expiry_date LIMIT 500`,
      [branche],
    );
    const somme = (lignes: Record<string, unknown>[], filtre: (l: Record<string, unknown>) => boolean) =>
      this.round(lignes.filter(filtre).reduce((s, l) => s + Number(l.value), 0));
    return {
      writtenOff: retires,
      writtenOffValue: somme(retires, () => true),
      atRisk: enRayon,
      expiredValue: somme(enRayon, (l) => Number(l.days_left) < 0),
      expiring30Value: somme(enRayon, (l) => Number(l.days_left) >= 0 && Number(l.days_left) <= 30),
      expiring90Value: somme(enRayon, (l) => Number(l.days_left) >= 0),
    };
  }

  /** Tous les rapports d'une période dans un classeur Excel, une feuille par rapport. */
  async classeur(ctx: RequestContext, q: { from?: string; to?: string; branchId?: string }) {
    const [syn, parJour, parProduit, parCategorie, parVendeur, parClient, pay, stock, rotation, per] = await Promise.all([
      this.synthese(ctx, q),
      this.salesReport(ctx, { ...q, groupBy: 'day' }),
      this.salesReport(ctx, { ...q, groupBy: 'product' }),
      this.salesReport(ctx, { ...q, groupBy: 'category' }),
      this.salesReport(ctx, { ...q, groupBy: 'seller' }),
      this.salesReport(ctx, { ...q, groupBy: 'customer' }),
      this.paiements(ctx, q),
      this.stockValuation(ctx, q.branchId),
      this.stockRotation(ctx, 90, q.branchId),
      this.peremptions(ctx, q),
    ]);
    const officine = await this.db.readTransaction(ctx, (tx) =>
      tx.oneOrFail<{ name: string }>('SELECT COALESCE(trade_name, legal_name) AS name FROM organizations WHERE id = $1', [ctx.organizationId]),
    );
    const periode = `Du ${syn.from ?? 'début'} au ${syn.to ?? "aujourd'hui"} — montants en ${syn.currency}`;
    const entete = (titre: string) => [`${officine.name} — ${titre}`, periode];
    const ventes = (r: Record<string, unknown>[]) => r.map((l) => [l.dimension, l.sales, l.quantity, l.revenue, l.tax, l.cost, l.margin, l.margin_percent]);
    const colonnesVentes = (premiere: string, type: 'texte' | 'date' = 'texte') => [
      { titre: premiere, type, largeur: type === 'date' ? 13 : 34 },
      { titre: 'Ventes', type: 'nombre' as const }, { titre: 'Quantité', type: 'nombre' as const },
      { titre: 'Chiffre d’affaires TTC', type: 'montant' as const }, { titre: 'dont taxes', type: 'montant' as const },
      { titre: 'Coût d’achat', type: 'montant' as const },
      { titre: 'Marge HT', type: 'montant' as const }, { titre: 'Marge % (sur HT)', type: 'pourcent' as const },
    ];
    const LIB_MOYEN: Record<string, string> = {
      cash: 'Espèces', mobile_money: 'Mobile Money', card: 'Carte', bank_transfer: 'Virement',
      bank_local: 'Banque', credit: 'Crédit client', insurance: 'Tiers payant', loyalty: 'Points fidélité', manual: 'Autre',
    };
    const feuilles: Feuille[] = [
      {
        nom: 'Synthèse', entete: entete('Synthèse'),
        colonnes: [{ titre: 'Indicateur', largeur: 40 }, { titre: 'Valeur', type: 'montant', largeur: 18 }],
        lignes: [
          ['Nombre de ventes', syn.sales], ['Chiffre d’affaires TTC', syn.revenue], ['dont taxes', syn.tax],
          ['Coût d’achat', syn.cost], ['Marge hors taxes', syn.margin], ['Marge % (sur le CA hors taxes)', syn.marginPercent],
          ['Panier moyen', syn.averageBasket],
          ['Remises accordées', syn.discounts], ['Part payée par les tiers payants', syn.payerShare],
          ['Ventes faites hors connexion', syn.offlineSales],
          ['Ventes annulées', syn.cancelled.count], ['Montant des ventes annulées', syn.cancelled.total],
          ['Pertes par péremption (retirées)', per.writtenOffValue], ['Périmé encore en stock', per.expiredValue],
          ['Péremption sous 90 jours', per.expiring90Value],
        ],
      },
      { nom: 'Ventes par jour', entete: entete('Ventes par jour'), colonnes: colonnesVentes('Jour', 'date'), lignes: ventes(parJour) },
      { nom: 'Par produit', entete: entete('Ventes par produit'), colonnes: colonnesVentes('Produit'), lignes: ventes(parProduit) },
      { nom: 'Par catégorie', entete: entete('Ventes par catégorie'), colonnes: colonnesVentes('Catégorie'), lignes: ventes(parCategorie) },
      { nom: 'Par vendeur', entete: entete('Ventes par vendeur'), colonnes: colonnesVentes('Vendeur'), lignes: ventes(parVendeur) },
      { nom: 'Par client', entete: entete('Ventes par client'), colonnes: colonnesVentes('Client'), lignes: ventes(parClient) },
      {
        nom: 'Paiements', entete: entete('Encaissements par moyen et par devise'),
        colonnes: [
          { titre: 'Moyen', largeur: 20 }, { titre: 'Devise remise', largeur: 14 }, { titre: 'Paiements', type: 'nombre' },
          { titre: 'Montant remis', type: 'montant', largeur: 18 }, { titre: `Contre-valeur (${syn.currency})`, type: 'montant', largeur: 20 },
        ],
        lignes: (pay as Record<string, unknown>[]).map((l) => [LIB_MOYEN[l.method as string] ?? l.method, l.currency, l.payments, l.tendered, l.amount]),
      },
      {
        nom: 'Valeur du stock', entete: [`${officine.name} — Valeur du stock au ${new Date().toISOString().slice(0, 10)}`, `Montants en ${syn.currency}`],
        colonnes: [
          { titre: 'Catégorie', largeur: 30 }, { titre: 'Produits', type: 'nombre' }, { titre: 'Unités', type: 'nombre' },
          { titre: 'Valeur d’achat', type: 'montant' }, { titre: 'Valeur de vente', type: 'montant' },
          { titre: 'Marge potentielle', type: 'montant' }, { titre: 'Péremption sous 90 j', type: 'montant' },
        ],
        lignes: (stock as Record<string, unknown>[]).map((l) => [l.category, l.products, l.units, l.cost_value, l.retail_value, l.potential_margin, l.at_risk_90d]),
      },
      {
        nom: 'Ne se vendent pas', entete: [`${officine.name} — Rotation du stock (90 derniers jours)`, 'Produits dormants : en stock, aucune vente en 90 jours'],
        colonnes: [
          { titre: 'Référence', largeur: 16 }, { titre: 'Produit', largeur: 34 }, { titre: 'En stock', type: 'nombre' },
          { titre: 'Capital immobilisé', type: 'montant', largeur: 18 }, { titre: 'Vendu (90 j)', type: 'nombre' },
          { titre: 'Rotation', type: 'nombre' }, { titre: 'Classement', largeur: 14 },
        ],
        lignes: (rotation as Record<string, unknown>[])
          .filter((l) => Number(l.on_hand) > 0)
          .sort((x, y) => (x.classification === 'dormant' ? 0 : 1) - (y.classification === 'dormant' ? 0 : 1))
          .map((l) => [l.sku, l.name, l.on_hand, l.tied_up_capital, l.sold, l.rotation, l.classification]),
      },
      {
        nom: 'Péremptions', entete: entete('Lots périmés ou qui périment sous 90 jours'),
        colonnes: [
          { titre: 'Référence', largeur: 16 }, { titre: 'Produit', largeur: 34 }, { titre: 'Lot', largeur: 14 },
          { titre: 'Péremption', type: 'date', largeur: 13 }, { titre: 'Jours restants', type: 'nombre' },
          { titre: 'Quantité', type: 'nombre' }, { titre: 'Valeur d’achat', type: 'montant' },
        ],
        lignes: (per.atRisk as Record<string, unknown>[]).map((l) => [l.sku, l.name, l.lot_number, l.expiry_date, l.days_left, l.quantity, l.value]),
      },
      {
        nom: 'Pertes retirées', entete: entete('Produits retirés pour péremption'),
        colonnes: [
          { titre: 'Date', type: 'date', largeur: 13 }, { titre: 'Référence', largeur: 16 }, { titre: 'Produit', largeur: 34 },
          { titre: 'Lot', largeur: 14 }, { titre: 'Quantité', type: 'nombre' }, { titre: 'Valeur d’achat', type: 'montant' },
          { titre: 'Motif', largeur: 30 },
        ],
        lignes: (per.writtenOff as Record<string, unknown>[]).map((l) => [l.occurred_at, l.sku, l.name, l.lot_number, l.quantity, l.value, l.reason]),
      },
    ];
    const fichier = classeur(feuilles);
    const suffixe = [syn.from, syn.to].filter(Boolean).join('_') || new Date().toISOString().slice(0, 10);
    return { fichier, nom: `rapports-${suffixe}.xlsx` };
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
