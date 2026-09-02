import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccessContextService } from '../../common/auth/access-context.service';
import { DatabaseService } from '../../common/database/database.service';
import {
  RequestContext,
  SYSTEM_CONTEXT,
  systemTenantContext,
} from '../../common/database/request-context';
import { BillingService } from '../platform/billing/billing.service';
import { SupportService } from '../platform/support/support.service';
import { StockService } from '../tenant/inventory/stock.service';

export interface JobReport {
  job: string;
  processed: number;
  details: Record<string, unknown>;
  ranAt: string;
}

/**
 * Traitements périodiques de la plateforme.
 *
 * Chaque traitement est idempotent : le rejouer le même jour ne produit
 * ni double facture, ni double relance, ni double suspension. Ils sont
 * donc sûrs à relancer manuellement après un incident.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly billing: BillingService,
    private readonly support: SupportService,
    private readonly stock: StockService,
    private readonly access: AccessContextService,
    private readonly config: ConfigService,
  ) {}

  private get enabled(): boolean {
    return (this.config.get<string>('SCHEDULER_ENABLED') ?? 'true') !== 'false';
  }

  // ===================================================================
  // Facturation des périodes échues
  // ===================================================================
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'billing-cycle' })
  async scheduledBillingCycle(): Promise<void> {
    if (!this.enabled) return;
    const report = await this.runBillingCycle();
    this.logger.log(`Facturation : ${report.processed} facture(s) émise(s).`);
  }

  /**
   * Émet la facture des abonnements dont la période est échue.
   * Un essai gratuit arrivé à terme bascule en attente de paiement, avec
   * sa première facture.
   */
  async runBillingCycle(): Promise<JobReport> {
    const due = await this.db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.many<{ organization_id: string; status: string; slug: string }>(
        `SELECT s.organization_id, s.status::text AS status, o.slug
           FROM organization_subscriptions s
           JOIN organizations o ON o.id = s.organization_id
          WHERE o.deleted_at IS NULL
            AND s.status IN ('active','trialing','pending_payment')
            AND s.current_period_end <= now()`,
      ),
    );

    const invoiced: string[] = [];
    const failed: { slug: string; error: string }[] = [];

    for (const subscription of due) {
      try {
        await this.db.transaction(SYSTEM_CONTEXT, async (tx) => {
          const { invoice, created } = await this.billing.generateInvoice(
            tx,
            subscription.organization_id,
          );
          if (created) invoiced.push(invoice.number as string);

          // La période suivante est ouverte, et l'abonnement attend son règlement.
          await tx.query(
            `UPDATE organization_subscriptions
                SET status = CASE WHEN status = 'trialing'
                                  THEN 'pending_payment'::nova.subscription_status
                                  ELSE status END,
                    current_period_start = current_period_end,
                    current_period_end = current_period_end + (CASE billing_cycle
                        WHEN 'monthly'   THEN interval '1 month'
                        WHEN 'quarterly' THEN interval '3 months'
                        ELSE interval '1 year' END),
                    renewal_at = current_period_end + (CASE billing_cycle
                        WHEN 'monthly'   THEN interval '1 month'
                        WHEN 'quarterly' THEN interval '3 months'
                        ELSE interval '1 year' END)
              WHERE organization_id = $1
                AND status NOT IN ('cancelled','expired','archived')`,
            [subscription.organization_id],
          );
        });
        this.access.invalidate(subscription.organization_id);
      } catch (error) {
        failed.push({ slug: subscription.slug, error: (error as Error).message });
        this.logger.error(
          `Facturation impossible pour ${subscription.slug} : ${(error as Error).message}`,
        );
      }
    }

    return {
      job: 'billing-cycle',
      processed: invoiced.length,
      details: { invoiced, failed, candidates: due.length },
      ranAt: new Date().toISOString(),
    };
  }

  // ===================================================================
  // Relances d'impayé et suspension
  // ===================================================================
  @Cron(CronExpression.EVERY_DAY_AT_8AM, { name: 'dunning' })
  async scheduledDunning(): Promise<void> {
    if (!this.enabled) return;
    const report = await this.runDunning();
    this.logger.log(
      `Relances : ${report.processed} envoyée(s), ` +
        `${(report.details.suspended as string[]).length} suspension(s).`,
    );
  }

  /**
   * Relance les factures échues selon le calendrier paramétré, puis
   * suspend les comptes dont le retard dépasse le délai de grâce.
   * La suspension ne supprime aucune donnée.
   */
  async runDunning(): Promise<JobReport> {
    const schedule = ((await this.setting('billing.dunning_schedule')) as number[]) ?? [1, 7, 14];
    const defaultGrace = Number((await this.setting('billing.grace_days')) ?? 7);

    const overdue = await this.db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.many<{
        id: string; organization_id: string; number: string; due_date: Date;
        balance: string; currency: string; slug: string; grace_days: number;
        days_overdue: string; organization_status: string;
      }>(
        `SELECT i.id, i.organization_id, i.number, i.due_date, i.balance, i.currency,
                o.slug, o.status::text AS organization_status,
                COALESCE(s.grace_days, $1) AS grace_days,
                (CURRENT_DATE - i.due_date) AS days_overdue
           FROM subscription_invoices i
           JOIN organizations o ON o.id = i.organization_id
           LEFT JOIN organization_subscriptions s
             ON s.organization_id = o.id
            AND s.status NOT IN ('cancelled','expired','archived')
          WHERE i.kind = 'invoice'
            AND i.status IN ('issued','partially_paid','overdue')
            AND i.balance > 0
            AND i.due_date < CURRENT_DATE
            AND o.deleted_at IS NULL
            AND o.status <> 'terminated'`,
        [defaultGrace],
      ),
    );

    const sent: string[] = [];
    const suspended: string[] = [];

    for (const invoice of overdue) {
      const daysOverdue = Number(invoice.days_overdue);

      // Niveau de relance atteint : le plus élevé dont le seuil est franchi.
      const level = schedule.reduce(
        (acc, threshold, index) => (daysOverdue >= threshold ? index + 1 : acc),
        0,
      );

      if (level > 0) {
        const wasSent = await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
          this.billing.sendDunning(tx, invoice, level),
        );
        if (wasSent) sent.push(`${invoice.number} (niveau ${level})`);
      }

      const graceExceeded = daysOverdue > Number(invoice.grace_days) + (schedule.at(-1) ?? 14);
      if (graceExceeded && invoice.organization_status !== 'suspended') {
        await this.suspendForNonPayment(invoice.organization_id, invoice.number, daysOverdue);
        suspended.push(invoice.slug);
      }
    }

    return {
      job: 'dunning',
      processed: sent.length,
      details: { sent, suspended, overdueInvoices: overdue.length },
      ranAt: new Date().toISOString(),
    };
  }

  private async suspendForNonPayment(
    organizationId: string,
    invoiceNumber: string,
    daysOverdue: number,
  ): Promise<void> {
    const reason =
      `Suspension automatique : facture ${invoiceNumber} impayée depuis ${daysOverdue} jours.`;

    await this.db.transaction(SYSTEM_CONTEXT, async (tx) => {
      await tx.query(
        `UPDATE organizations SET status = 'suspended', suspended_at = now()
          WHERE id = $1 AND status <> 'suspended'`,
        [organizationId],
      );
      await tx.query(
        `UPDATE organization_subscriptions SET status = 'suspended', suspended_at = now()
          WHERE organization_id = $1
            AND status NOT IN ('cancelled','expired','archived')`,
        [organizationId],
      );
      await tx.query(
        `INSERT INTO subscription_plan_changes
           (organization_id, subscription_id, from_plan_id, to_plan_id, to_status, reason)
         SELECT organization_id, id, plan_id, plan_id, 'suspended', $2
           FROM organization_subscriptions
          WHERE organization_id = $1
            AND status NOT IN ('cancelled','expired','archived')`,
        [organizationId, reason],
      );
      await tx.query(
        `INSERT INTO platform_audit_logs
           (organization_id, actor_email, action, entity, entity_id, reason)
         VALUES ($1::uuid, 'scheduler', 'organization.suspended_for_non_payment',
                 'organization', $1::text, $2)`,
        [organizationId, reason],
      );
    });

    // La pharmacie est prévenue dans son espace : ses données restent
    // consultables, seules les écritures sont bloquées.
    await this.db.transaction(systemTenantContext(organizationId), (tx) =>
      tx.query(
        `INSERT INTO notifications
           (organization_id, channel, category, severity, title, body)
         VALUES ($1,'in_app','payment_due','critical',
                 'Compte suspendu pour impayé',
                 $2)`,
        [
          organizationId,
          `${reason} Vos données sont conservées et restent consultables en lecture seule. ` +
            `Le règlement de la facture rétablit immédiatement vos accès.`,
        ],
      ),
    );

    this.access.invalidate(organizationId);
  }

  // ===================================================================
  // Fin des essais gratuits
  // ===================================================================
  @Cron(CronExpression.EVERY_DAY_AT_6AM, { name: 'trials' })
  async scheduledTrials(): Promise<void> {
    if (!this.enabled) return;
    await this.runTrialExpiry();
  }

  /** Bascule en attente de paiement les essais arrivés à terme. */
  async runTrialExpiry(): Promise<JobReport> {
    const expired = await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.many<{ organization_id: string }>(
        `UPDATE organization_subscriptions
            SET status = 'pending_payment'
          WHERE status = 'trialing'
            AND trial_ends_at IS NOT NULL
            AND trial_ends_at <= now()
          RETURNING organization_id`,
      ),
    );
    expired.forEach((row) => this.access.invalidate(row.organization_id));

    return {
      job: 'trial-expiry',
      processed: expired.length,
      details: { organizations: expired.map((r) => r.organization_id) },
      ranAt: new Date().toISOString(),
    };
  }

  // ===================================================================
  // Accès support arrivés à échéance
  // ===================================================================
  @Cron(CronExpression.EVERY_HOUR, { name: 'support-access-expiry' })
  async scheduledSupportExpiry(): Promise<void> {
    if (!this.enabled) return;
    const closed = await this.support.expireStaleGrants();
    if (closed > 0) this.logger.log(`${closed} accès support arrivé(s) à échéance.`);
  }

  async runSupportAccessExpiry(): Promise<JobReport> {
    const closed = await this.support.expireStaleGrants();
    return {
      job: 'support-access-expiry',
      processed: closed,
      details: {},
      ranAt: new Date().toISOString(),
    };
  }

  // ===================================================================
  // Alertes de stock
  // ===================================================================
  @Cron(CronExpression.EVERY_DAY_AT_5AM, { name: 'stock-alerts' })
  async scheduledStockAlerts(): Promise<void> {
    if (!this.enabled) return;
    const report = await this.runStockAlerts();
    this.logger.log(`Alertes de stock : ${report.processed} branche(s) analysée(s).`);
  }

  /** Recalcule ruptures, seuils et péremptions pour chaque branche active. */
  async runStockAlerts(): Promise<JobReport> {
    const branches = await this.db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.many<{ organization_id: string; branch_id: string }>(
        `SELECT b.organization_id, b.id AS branch_id
           FROM branches b
           JOIN organizations o ON o.id = b.organization_id
          WHERE b.is_active AND o.deleted_at IS NULL
            AND o.status IN ('trial','active','suspended')`,
      ),
    );

    let opened = 0;
    for (const branch of branches) {
      try {
        const result = await this.db.transaction(
          systemTenantContext(branch.organization_id),
          (tx) => this.stock.refreshAlerts(tx, branch.branch_id),
        );
        opened += result.opened;
      } catch (error) {
        this.logger.error(
          `Alertes impossibles pour la branche ${branch.branch_id} : ${(error as Error).message}`,
        );
      }
    }

    return {
      job: 'stock-alerts',
      processed: branches.length,
      details: { alertsOpened: opened },
      ranAt: new Date().toISOString(),
    };
  }

  // ===================================================================
  // Mesure d'usage
  // ===================================================================
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'usage-metrics' })
  async scheduledUsage(): Promise<void> {
    if (!this.enabled) return;
    const report = await this.runUsageCollection();
    this.logger.log(`Mesure d'usage : ${report.processed} pharmacie(s).`);
  }

  /**
   * Agrège l'activité de chaque pharmacie et publie le résultat dans
   * `usage_metrics`.
   *
   * L'agrégation s'exécute dans le périmètre de la pharmacie : le
   * back-office SaaS obtient des compteurs, jamais les données métier
   * sous-jacentes.
   */
  async runUsageCollection(): Promise<JobReport> {
    const organizations = await this.db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.many<{ id: string; slug: string }>(
        `SELECT id, slug FROM organizations
          WHERE deleted_at IS NULL AND status IN ('trial','active','suspended')`,
      ),
    );

    let processed = 0;
    for (const organization of organizations) {
      try {
        const metrics = await this.db.readTransaction(
          systemTenantContext(organization.id),
          async (tx) => {
            const counters = await tx.oneOrFail<Record<string, string>>(
              `SELECT
                 (SELECT count(*) FROM users
                   WHERE deleted_at IS NULL AND is_active
                     AND last_login_at >= now() - interval '30 days')   AS users_active,
                 (SELECT count(*) FROM sales
                   WHERE status = 'completed'
                     AND sold_at >= date_trunc('month', now()))         AS sales_count,
                 (SELECT COALESCE(sum(total), 0) FROM sales
                   WHERE status = 'completed'
                     AND sold_at >= date_trunc('month', now()))         AS sales_value,
                 (SELECT COALESCE(sum(quantity), 0) FROM stock_items)   AS stock_units,
                 (SELECT COALESCE(sum(quantity * average_cost), 0)
                    FROM stock_items)                                   AS stock_value,
                 (SELECT count(*) FROM products WHERE deleted_at IS NULL) AS products_count,
                 (SELECT COALESCE(sum(size_bytes), 0) / 1048576.0
                    FROM documents)                                     AS storage_mb`,
            );

            // Modules réellement utilisés ce mois-ci, déduits de l'activité.
            const used = await tx.many<{ module: string }>(
              `SELECT 'sales' AS module WHERE EXISTS (
                 SELECT 1 FROM sales WHERE sold_at >= date_trunc('month', now()))
               UNION ALL
               SELECT 'purchasing' WHERE EXISTS (
                 SELECT 1 FROM goods_receipts WHERE created_at >= date_trunc('month', now()))
               UNION ALL
               SELECT 'b2b' WHERE EXISTS (
                 SELECT 1 FROM b2b_orders WHERE created_at >= date_trunc('month', now()))
               UNION ALL
               SELECT 'delivery' WHERE EXISTS (
                 SELECT 1 FROM deliveries WHERE created_at >= date_trunc('month', now()))
               UNION ALL
               SELECT 'inventory' WHERE EXISTS (
                 SELECT 1 FROM stock_movements WHERE occurred_at >= date_trunc('month', now()))
               UNION ALL
               SELECT 'cash' WHERE EXISTS (
                 SELECT 1 FROM cash_sessions WHERE opened_at >= date_trunc('month', now()))`,
            );

            return { counters, modules: used.map((row) => row.module) };
          },
        );

        await this.db.transaction(SYSTEM_CONTEXT, async (tx) => {
          const entries: [string, number][] = Object.entries(metrics.counters).map(
            ([metric, value]) => [metric, Number(value)],
          );
          for (const module of metrics.modules) {
            entries.push([`module_used:${module}`, 1]);
          }
          for (const [metric, value] of entries) {
            await tx.query(
              `INSERT INTO usage_metrics
                 (organization_id, metric, period_start, period_end, value)
               VALUES ($1, $2, date_trunc('month', CURRENT_DATE)::date,
                       (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date, $3)
               ON CONFLICT (organization_id, metric, period_start, period_end)
               DO UPDATE SET value = EXCLUDED.value, recorded_at = now()`,
              [organization.id, metric, value],
            );
          }
        });
        processed += 1;
      } catch (error) {
        this.logger.error(
          `Mesure d'usage impossible pour ${organization.slug} : ${(error as Error).message}`,
        );
      }
    }

    return {
      job: 'usage-metrics',
      processed,
      details: { organizations: organizations.length },
      ranAt: new Date().toISOString(),
    };
  }

  // ===================================================================
  // Conservation des données après résiliation
  // ===================================================================
  @Cron(CronExpression.EVERY_DAY_AT_4AM, { name: 'retention' })
  async scheduledRetention(): Promise<void> {
    if (!this.enabled) return;
    await this.runRetention();
  }

  /**
   * Archive les pharmacies résiliées dont la durée de conservation
   * contractuelle est écoulée. L'archivage est une suppression logique :
   * les données restent restaurables jusqu'à une purge explicite.
   */
  async runRetention(): Promise<JobReport> {
    const archived = await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.many<{ id: string; slug: string }>(
        `UPDATE organizations
            SET status = 'archived', deleted_at = now()
          WHERE status = 'terminated'
            AND data_retention_until IS NOT NULL
            AND data_retention_until < CURRENT_DATE
            AND deleted_at IS NULL
          RETURNING id, slug`,
      ),
    );

    for (const organization of archived) {
      this.access.invalidate(organization.id);
    }

    return {
      job: 'retention',
      processed: archived.length,
      details: { archived: archived.map((o) => o.slug) },
      ranAt: new Date().toISOString(),
    };
  }

  // ===================================================================
  private async setting(key: string): Promise<unknown> {
    const row = await this.db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.one<{ value: unknown }>(
        'SELECT value FROM platform_settings WHERE key = $1',
        [key],
      ),
    );
    return row?.value ?? null;
  }

  systemContext(): RequestContext {
    return SYSTEM_CONTEXT;
  }
}
