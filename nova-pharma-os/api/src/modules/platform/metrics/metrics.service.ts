import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';

/**
 * Indicateurs du back-office SaaS.
 *
 * Les compteurs d'activité (ventes traitées, volume de stock, utilisateurs
 * actifs) proviennent de `usage_metrics`, alimentée par une tâche qui
 * agrège chaque pharmacie dans son propre périmètre. Le back-office lit
 * donc des agrégats, jamais les données métier elles-mêmes : la
 * confidentialité des pharmacies est préservée jusque dans les tableaux
 * de bord de l'éditeur.
 */
@Injectable()
export class MetricsService {
  constructor(private readonly db: DatabaseService) {}

  async dashboard(ctx: RequestContext) {
    return this.db.readTransaction(ctx, async (tx) => {
      const portfolio = await tx.oneOrFail<Record<string, string>>(
        `SELECT
           count(*) FILTER (WHERE o.deleted_at IS NULL)                          AS total,
           count(*) FILTER (WHERE o.status = 'active')                           AS active,
           count(*) FILTER (WHERE o.status = 'trial')                            AS trial,
           count(*) FILTER (WHERE o.status = 'suspended')                        AS suspended,
           count(*) FILTER (WHERE o.status = 'terminated')                       AS terminated,
           count(*) FILTER (WHERE s.status = 'past_due')                         AS past_due,
           count(*) FILTER (WHERE s.status = 'pending_payment')                  AS pending_payment,
           count(*) FILTER (WHERE o.created_at >= date_trunc('month', now()))    AS new_this_month
         FROM organizations o
         LEFT JOIN organization_subscriptions s
           ON s.organization_id = o.id
          AND s.status NOT IN ('cancelled','expired','archived')
        WHERE o.deleted_at IS NULL`,
      );

      // Revenu mensuel récurrent : chaque abonnement facturant est
      // ramené à une base mensuelle, remise déduite.
      const revenue = await tx.oneOrFail<{ mrr: string; paying: string }>(
        `SELECT
           COALESCE(sum(
             s.unit_price * (1 - s.discount_percent / 100.0) /
             CASE s.billing_cycle WHEN 'monthly' THEN 1
                                  WHEN 'quarterly' THEN 3
                                  ELSE 12 END
           ), 0) AS mrr,
           count(*) AS paying
         FROM organization_subscriptions s
         JOIN organizations o ON o.id = s.organization_id
        WHERE s.status IN ('active','past_due','pending_payment')
          AND o.deleted_at IS NULL`,
      );

      const byPlan = await tx.many(
        `SELECT p.code, p.name,
                -- count(s.id) et non count(*) : une jointure externe sans
                -- abonnement ne doit pas compter le forfait lui-même.
                count(s.id) AS subscriptions,
                COALESCE(sum(
                  s.unit_price * (1 - s.discount_percent / 100.0) /
                  CASE s.billing_cycle WHEN 'monthly' THEN 1
                                       WHEN 'quarterly' THEN 3
                                       ELSE 12 END
                ), 0) AS mrr
           FROM subscription_plans p
           LEFT JOIN organization_subscriptions s
             ON s.plan_id = p.id AND s.status IN ('active','past_due','pending_payment')
          GROUP BY p.code, p.name, p.sort_order
          ORDER BY p.sort_order`,
      );

      // Conversion essai → abonnement : parmi les pharmacies ayant
      // démarré un essai, celles qui ont ensuite payé.
      const conversion = await tx.oneOrFail<{ trials: string; converted: string }>(
        `SELECT
           count(DISTINCT c.organization_id) FILTER (WHERE c.to_status = 'trialing') AS trials,
           count(DISTINCT c.organization_id) FILTER (
             WHERE c.to_status = 'active'
               AND EXISTS (SELECT 1 FROM subscription_plan_changes t
                            WHERE t.organization_id = c.organization_id
                              AND t.to_status = 'trialing')) AS converted
         FROM subscription_plan_changes c`,
      );

      // Taux de résiliation sur 12 mois glissants.
      const churn = await tx.oneOrFail<{ cancelled: string; base: string }>(
        `SELECT
           count(*) FILTER (WHERE s.cancelled_at >= now() - interval '12 months') AS cancelled,
           count(*) FILTER (WHERE s.started_at <= now() - interval '12 months'
                              OR s.status IN ('active','past_due')) AS base
         FROM organization_subscriptions s`,
      );

      const receivables = await tx.oneOrFail<Record<string, string>>(
        `SELECT
           COALESCE(sum(balance) FILTER (
             WHERE status IN ('issued','partially_paid','overdue')), 0) AS outstanding,
           COALESCE(sum(balance) FILTER (WHERE status = 'overdue'), 0)  AS overdue,
           count(*) FILTER (WHERE status = 'overdue')                   AS overdue_count,
           COALESCE(sum(amount_paid) FILTER (
             WHERE issue_date >= date_trunc('month', now())), 0)        AS collected_this_month
         FROM subscription_invoices WHERE kind = 'invoice'`,
      );

      const support = await tx.oneOrFail<Record<string, string>>(
        `SELECT
           count(*) FILTER (WHERE status IN ('open','in_progress','pending_customer')) AS open_tickets,
           count(*) FILTER (WHERE priority = 'critical'
                              AND status NOT IN ('resolved','closed'))                 AS critical_tickets,
           count(*) FILTER (WHERE sla_due_at < now()
                              AND status NOT IN ('resolved','closed'))                 AS sla_breached,
           COALESCE(round(avg(satisfaction_score), 2), 0)                              AS satisfaction
         FROM support_tickets`,
      );

      const usage = await tx.many<{ metric: string; value: string }>(
        `SELECT metric, sum(value) AS value
           FROM usage_metrics
          WHERE period_start >= date_trunc('month', CURRENT_DATE)
          GROUP BY metric`,
      );
      const usageByMetric = Object.fromEntries(
        usage.map((row) => [row.metric, Number(row.value)]),
      );

      // Taux d'adoption par module : part des pharmacies actives dont le
      // forfait inclut le module et qui l'utilisent réellement.
      const adoption = await tx.many(
        `WITH active AS (
           SELECT s.organization_id, s.modules
             FROM organization_subscriptions s
             JOIN organizations o ON o.id = s.organization_id
            WHERE s.status IN ('active','past_due','trialing') AND o.deleted_at IS NULL
         ), entitled AS (
           SELECT unnest(modules) AS module, organization_id FROM active
         )
         SELECT e.module,
                count(DISTINCT e.organization_id) AS entitled,
                count(DISTINCT u.organization_id) AS using_it
           FROM entitled e
           LEFT JOIN usage_metrics u
             ON u.organization_id = e.organization_id
            AND u.metric = 'module_used:' || e.module
            AND u.period_start >= date_trunc('month', CURRENT_DATE)
          GROUP BY e.module
          ORDER BY e.module`,
      );

      const availability = await tx.oneOrFail<{ incidents: string; downtime_minutes: string }>(
        `SELECT count(*) AS incidents,
                COALESCE(sum(EXTRACT(EPOCH FROM (COALESCE(resolved_at, now()) - started_at)) / 60)
                  FILTER (WHERE severity IN ('major','critical')), 0) AS downtime_minutes
           FROM platform_incidents
          WHERE started_at >= now() - interval '30 days'`,
      );

      const mrr = Number(revenue.mrr);
      const trials = Number(conversion.trials);
      const churnBase = Number(churn.base);
      const monthMinutes = 30 * 24 * 60;

      return {
        portfolio: {
          totalPharmacies: Number(portfolio.total),
          active: Number(portfolio.active),
          trial: Number(portfolio.trial),
          suspended: Number(portfolio.suspended),
          terminated: Number(portfolio.terminated),
          pastDue: Number(portfolio.past_due),
          pendingPayment: Number(portfolio.pending_payment),
          newThisMonth: Number(portfolio.new_this_month),
        },
        revenue: {
          currency: 'USD',
          mrr: this.round(mrr),
          arr: this.round(mrr * 12),
          payingSubscriptions: Number(revenue.paying),
          averageRevenuePerAccount:
            Number(revenue.paying) > 0 ? this.round(mrr / Number(revenue.paying)) : 0,
          byPlan: byPlan.map((row) => ({
            planCode: row.code,
            planName: row.name,
            subscriptions: Number(row.subscriptions),
            mrr: this.round(Number(row.mrr)),
          })),
        },
        conversion: {
          trialsStarted: trials,
          converted: Number(conversion.converted),
          rate: trials > 0 ? this.round((Number(conversion.converted) / trials) * 100) : 0,
        },
        churn: {
          cancelledLast12Months: Number(churn.cancelled),
          rate:
            churnBase > 0
              ? this.round((Number(churn.cancelled) / churnBase) * 100)
              : 0,
        },
        receivables: {
          outstanding: this.round(Number(receivables.outstanding)),
          overdue: this.round(Number(receivables.overdue)),
          overdueInvoices: Number(receivables.overdue_count),
          collectedThisMonth: this.round(Number(receivables.collected_this_month)),
        },
        support: {
          openTickets: Number(support.open_tickets),
          criticalTickets: Number(support.critical_tickets),
          slaBreached: Number(support.sla_breached),
          averageSatisfaction: Number(support.satisfaction),
        },
        activity: {
          activeUsers: usageByMetric['users_active'] ?? 0,
          salesProcessed: usageByMetric['sales_count'] ?? 0,
          salesValue: usageByMetric['sales_value'] ?? 0,
          stockValue: usageByMetric['stock_value'] ?? 0,
          stockUnits: usageByMetric['stock_units'] ?? 0,
          productsManaged: usageByMetric['products_count'] ?? 0,
        },
        moduleAdoption: adoption.map((row) => ({
          module: row.module,
          entitled: Number(row.entitled),
          using: Number(row.using_it),
          rate:
            Number(row.entitled) > 0
              ? this.round((Number(row.using_it) / Number(row.entitled)) * 100)
              : 0,
        })),
        platform: {
          incidentsLast30Days: Number(availability.incidents),
          downtimeMinutes: this.round(Number(availability.downtime_minutes)),
          availabilityPercent: this.round(
            Math.max(
              0,
              100 - (Number(availability.downtime_minutes) / monthMinutes) * 100,
            ),
          ),
        },
        generatedAt: new Date().toISOString(),
      };
    });
  }

  /** Évolution du revenu récurrent mois par mois. */
  async revenueTimeline(ctx: RequestContext, months = 12) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT to_char(month, 'YYYY-MM') AS period,
                COALESCE(sum(i.total), 0)       AS invoiced,
                COALESCE(sum(i.amount_paid), 0) AS collected,
                count(i.id)                     AS invoices
           FROM generate_series(
                  date_trunc('month', now()) - ($1 || ' months')::interval,
                  date_trunc('month', now()),
                  interval '1 month') AS month
           LEFT JOIN subscription_invoices i
             ON date_trunc('month', i.issue_date) = month AND i.kind = 'invoice'
          GROUP BY month
          ORDER BY month`,
        [String(months)],
      ),
    );
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
