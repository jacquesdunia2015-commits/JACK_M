import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';

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
        `SELECT p.sku, p.name, pl.lot_number, pl.expiry_date,
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
        expiringSoon: expiring,
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
        day: "to_char(date_trunc('day', s.sold_at), 'YYYY-MM-DD')",
        month: "to_char(date_trunc('month', s.sold_at), 'YYYY-MM')",
        product: 'p.name',
        category: "COALESCE(c.name, 'Sans catégorie')",
        seller: "COALESCE(u.full_name, 'Non renseigné')",
        channel: 's.channel',
        customer: "COALESCE(cu.name, 'Client de passage')",
      }[groupBy] ?? "to_char(date_trunc('day', s.sold_at), 'YYYY-MM-DD')";

    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT ${dimension} AS dimension,
                count(DISTINCT s.id) AS sales,
                sum(sl.quantity) AS quantity,
                sum(sl.line_total) AS revenue,
                sum(sl.quantity * sl.unit_cost) AS cost,
                sum(sl.line_total - sl.quantity * sl.unit_cost) AS margin,
                CASE WHEN sum(sl.line_total) > 0
                     THEN round(100 * sum(sl.line_total - sl.quantity * sl.unit_cost)
                                / sum(sl.line_total), 2)
                     ELSE 0 END AS margin_percent
           FROM sales s
           JOIN sale_lines sl ON sl.sale_id = s.id
           JOIN products p ON p.id = sl.product_id
           LEFT JOIN product_categories c ON c.id = p.category_id
           LEFT JOIN users u ON u.id = s.sold_by
           LEFT JOIN customers cu ON cu.id = s.customer_id
          WHERE s.status = 'completed'
            AND ($1::timestamptz IS NULL OR s.sold_at >= $1)
            AND ($2::timestamptz IS NULL OR s.sold_at <= $2)
            AND ($3::uuid IS NULL OR s.branch_id = $3)
          GROUP BY 1 ORDER BY revenue DESC LIMIT 500`,
        [
          query.from ?? null,
          query.to ?? null,
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

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
