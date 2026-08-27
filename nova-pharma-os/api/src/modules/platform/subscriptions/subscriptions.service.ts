import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { AccessContextService } from '../../../common/auth/access-context.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { AddAddonDto, ChangePlanDto, ExtendTrialDto } from './dto';

export type BillingCycle = 'monthly' | 'quarterly' | 'annual';

export interface CreateSubscriptionParams {
  organizationId: string;
  planCode: string;
  billingCycle: BillingCycle;
  startTrial: boolean;
  trialDays?: number;
  promoCode?: string;
  currency: string;
}

const CYCLE_MONTHS: Record<BillingCycle, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
};

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly access: AccessContextService,
  ) {}

  // -------------------------------------------------------------------
  // Création
  // -------------------------------------------------------------------
  async create(tx: Tx, params: CreateSubscriptionParams) {
    const plan = await tx.oneOrFail<PlanRow>(
      `SELECT * FROM subscription_plans WHERE code = $1 AND is_active`,
      [params.planCode],
      `Forfait « ${params.planCode} » introuvable ou inactif.`,
    );

    const promo = params.promoCode
      ? await this.resolvePromo(tx, params.promoCode, plan.code)
      : null;

    const trialDays = params.startTrial
      ? (params.trialDays ?? plan.trial_days)
      : 0;
    const price = this.priceFor(plan, params.billingCycle);
    const months = CYCLE_MONTHS[params.billingCycle];

    const subscription = await tx.oneOrFail(
      `INSERT INTO organization_subscriptions
         (organization_id, plan_id, status, billing_cycle, currency, unit_price,
          discount_percent, promo_code_id, trial_ends_at,
          current_period_start, current_period_end, renewal_at,
          max_users, max_branches, max_products, storage_quota_mb,
          sms_quota, whatsapp_quota, modules)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
               CASE WHEN $9 > 0 THEN now() + ($9 || ' days')::interval END,
               now(),
               CASE WHEN $9 > 0 THEN now() + ($9 || ' days')::interval
                    ELSE now() + ($10 || ' months')::interval END,
               CASE WHEN $9 > 0 THEN now() + ($9 || ' days')::interval
                    ELSE now() + ($10 || ' months')::interval END,
               $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        params.organizationId,
        plan.id,
        trialDays > 0 ? 'trialing' : 'pending_payment',
        params.billingCycle,
        params.currency,
        price,
        promo?.discount_percent ?? 0,
        promo?.id ?? null,
        String(trialDays),
        String(months),
        plan.max_users,
        plan.max_branches,
        plan.max_products,
        plan.storage_quota_mb,
        plan.sms_quota,
        plan.whatsapp_quota,
        plan.modules,
      ],
    );

    if (promo) {
      await tx.query(
        'UPDATE promo_codes SET redemptions = redemptions + 1 WHERE id = $1',
        [promo.id],
      );
    }

    await tx.query(
      `INSERT INTO subscription_plan_changes
         (organization_id, subscription_id, to_plan_id, to_status, to_cycle, reason, changed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        params.organizationId,
        subscription.id,
        plan.id,
        subscription.status,
        params.billingCycle,
        trialDays > 0
          ? `Souscription initiale — essai gratuit de ${trialDays} jours.`
          : 'Souscription initiale.',
        tx.context.actorId ?? null,
      ],
    );

    this.access.invalidate(params.organizationId);
    return subscription;
  }

  // -------------------------------------------------------------------
  // Changement de forfait
  // -------------------------------------------------------------------
  /**
   * Change le forfait d'une pharmacie. Les limites effectives sont
   * recalculées à partir du nouveau forfait et des options en cours,
   * et le changement est historisé.
   */
  async changePlan(ctx: RequestContext, organizationId: string, dto: ChangePlanDto) {
    return this.db.transaction(ctx, async (tx) => {
      const current = await this.currentSubscription(tx, organizationId);
      const plan = await tx.oneOrFail<PlanRow>(
        'SELECT * FROM subscription_plans WHERE code = $1 AND is_active',
        [dto.planCode],
        `Forfait « ${dto.planCode} » introuvable ou inactif.`,
      );

      const cycle = (dto.billingCycle ?? current.billing_cycle) as BillingCycle;
      const limits = await this.effectiveLimits(tx, organizationId, plan);

      const updated = await tx.oneOrFail(
        `UPDATE organization_subscriptions
            SET plan_id = $2, billing_cycle = $3, unit_price = $4,
                max_users = $5, max_branches = $6, max_products = $7,
                storage_quota_mb = $8, sms_quota = $9, whatsapp_quota = $10,
                modules = $11
          WHERE id = $1 RETURNING *`,
        [
          current.id,
          plan.id,
          cycle,
          this.priceFor(plan, cycle),
          limits.maxUsers,
          limits.maxBranches,
          limits.maxProducts,
          limits.storageQuotaMb,
          limits.smsQuota,
          limits.whatsappQuota,
          limits.modules,
        ],
      );

      await tx.query(
        `INSERT INTO subscription_plan_changes
           (organization_id, subscription_id, from_plan_id, to_plan_id,
            from_status, to_status, from_cycle, to_cycle, reason, changed_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          organizationId, current.id, current.plan_id, plan.id,
          current.status, updated.status, current.billing_cycle, cycle,
          dto.reason, ctx.actorId ?? null,
        ],
      );

      await this.audit.recordPlatform(tx, {
        organizationId,
        action: 'subscription.plan_changed',
        entity: 'organization_subscription',
        entityId: current.id,
        before: { plan: current.plan_id, cycle: current.billing_cycle },
        after: { plan: plan.code, cycle },
        reason: dto.reason,
      });

      this.access.invalidate(organizationId);
      return { subscription: updated, plan: plan.code, limits };
    });
  }

  /**
   * Recalcule les limites : celles du forfait, augmentées des options
   * souscrites (utilisateurs, branches, stockage, SMS, modules).
   */
  private async effectiveLimits(tx: Tx, organizationId: string, plan: PlanRow) {
    const addons = await tx.many<{
      quantity: number;
      grants_modules: string[];
      grants_users: number;
      grants_branches: number;
      grants_storage_mb: number;
      grants_sms: number;
    }>(
      `SELECT oa.quantity, a.grants_modules, a.grants_users,
              a.grants_branches, a.grants_storage_mb, a.grants_sms
         FROM organization_addons oa
         JOIN plan_addons a ON a.id = oa.addon_id
        WHERE oa.organization_id = $1
          AND (oa.active_until IS NULL OR oa.active_until > now())`,
      [organizationId],
    );

    const add = (base: number | null, grant: (a: (typeof addons)[number]) => number) =>
      base === null
        ? null // forfait sur mesure : la limite reste illimitée
        : base + addons.reduce((sum, a) => sum + grant(a) * a.quantity, 0);

    const modules = new Set(plan.modules);
    addons.forEach((a) => a.grants_modules.forEach((m) => modules.add(m)));

    return {
      maxUsers: add(plan.max_users, (a) => a.grants_users),
      maxBranches: add(plan.max_branches, (a) => a.grants_branches),
      maxProducts: plan.max_products,
      storageQuotaMb: add(plan.storage_quota_mb, (a) => a.grants_storage_mb),
      smsQuota: (add(plan.sms_quota, (a) => a.grants_sms) ?? plan.sms_quota) as number,
      whatsappQuota: plan.whatsapp_quota,
      modules: [...modules],
    };
  }

  // -------------------------------------------------------------------
  // Options
  // -------------------------------------------------------------------
  async addAddon(ctx: RequestContext, organizationId: string, dto: AddAddonDto) {
    return this.db.transaction(ctx, async (tx) => {
      const subscription = await this.currentSubscription(tx, organizationId);
      const addon = await tx.oneOrFail<{
        id: string; code: string; name: string; unit_price: string; currency: string;
      }>(
        'SELECT * FROM plan_addons WHERE code = $1 AND is_active',
        [dto.addonCode],
        `Option « ${dto.addonCode} » introuvable.`,
      );

      await tx.query(
        `INSERT INTO organization_addons
           (organization_id, subscription_id, addon_id, quantity, unit_price, currency)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          organizationId,
          subscription.id,
          addon.id,
          dto.quantity ?? 1,
          addon.unit_price,
          addon.currency,
        ],
      );

      const plan = await tx.oneOrFail<PlanRow>(
        'SELECT * FROM subscription_plans WHERE id = $1',
        [subscription.plan_id],
      );
      const limits = await this.effectiveLimits(tx, organizationId, plan);
      await this.applyLimits(tx, subscription.id, limits);

      await this.audit.recordPlatform(tx, {
        organizationId,
        action: 'subscription.addon_added',
        entity: 'plan_addon',
        entityId: addon.id,
        after: { code: addon.code, quantity: dto.quantity ?? 1 },
      });

      this.access.invalidate(organizationId);
      return { addon: addon.code, quantity: dto.quantity ?? 1, limits };
    });
  }

  async removeAddon(ctx: RequestContext, organizationId: string, addonId: string) {
    return this.db.transaction(ctx, async (tx) => {
      const subscription = await this.currentSubscription(tx, organizationId);
      await tx.query(
        `UPDATE organization_addons SET active_until = now()
          WHERE id = $1 AND organization_id = $2`,
        [addonId, organizationId],
      );
      const plan = await tx.oneOrFail<PlanRow>(
        'SELECT * FROM subscription_plans WHERE id = $1',
        [subscription.plan_id],
      );
      const limits = await this.effectiveLimits(tx, organizationId, plan);
      await this.applyLimits(tx, subscription.id, limits);
      await this.audit.recordPlatform(tx, {
        organizationId,
        action: 'subscription.addon_removed',
        entity: 'organization_addon',
        entityId: addonId,
      });
      this.access.invalidate(organizationId);
      return { limits };
    });
  }

  private async applyLimits(
    tx: Tx,
    subscriptionId: string,
    limits: Awaited<ReturnType<SubscriptionsService['effectiveLimits']>>,
  ): Promise<void> {
    await tx.query(
      `UPDATE organization_subscriptions
          SET max_users = $2, max_branches = $3, max_products = $4,
              storage_quota_mb = $5, sms_quota = $6, whatsapp_quota = $7, modules = $8
        WHERE id = $1`,
      [
        subscriptionId,
        limits.maxUsers,
        limits.maxBranches,
        limits.maxProducts,
        limits.storageQuotaMb,
        limits.smsQuota,
        limits.whatsappQuota,
        limits.modules,
      ],
    );
  }

  // -------------------------------------------------------------------
  // Statut
  // -------------------------------------------------------------------
  /** Change le statut d'abonnement en consignant systématiquement l'historique. */
  async changeStatus(
    tx: Tx,
    organizationId: string,
    status: string,
    reason: string,
  ) {
    const current = await this.currentSubscription(tx, organizationId).catch(() => null);
    if (!current) return null;

    const updated = await tx.oneOrFail(
      `UPDATE organization_subscriptions
          SET status = $2::nova.subscription_status,
              suspended_at = CASE WHEN $2 = 'suspended' THEN now()
                                  WHEN $2 = 'active' THEN NULL
                                  ELSE suspended_at END,
              cancelled_at = CASE WHEN $2 = 'cancelled' THEN now() ELSE cancelled_at END,
              cancel_reason = CASE WHEN $2 = 'cancelled' THEN $3 ELSE cancel_reason END
        WHERE id = $1 RETURNING *`,
      [current.id, status, reason],
    );

    await tx.query(
      `INSERT INTO subscription_plan_changes
         (organization_id, subscription_id, from_plan_id, to_plan_id,
          from_status, to_status, reason, changed_by)
       VALUES ($1,$2,$3,$3,$4,$5,$6,$7)`,
      [
        organizationId, current.id, current.plan_id,
        current.status, status, reason, tx.context.actorId ?? null,
      ],
    );

    this.access.invalidate(organizationId);
    return updated;
  }

  async setStatus(
    ctx: RequestContext,
    organizationId: string,
    status: string,
    reason: string,
  ) {
    return this.db.transaction(ctx, async (tx) => {
      const updated = await this.changeStatus(tx, organizationId, status, reason);
      await this.audit.recordPlatform(tx, {
        organizationId,
        action: 'subscription.status_changed',
        entity: 'organization_subscription',
        after: { status },
        reason,
      });
      return updated;
    });
  }

  async extendTrial(ctx: RequestContext, organizationId: string, dto: ExtendTrialDto) {
    return this.db.transaction(ctx, async (tx) => {
      const current = await this.currentSubscription(tx, organizationId);
      if (current.status !== 'trialing') {
        throw new BadRequestException(
          "Seul un abonnement en essai gratuit peut être prolongé.",
        );
      }
      const updated = await tx.oneOrFail(
        `UPDATE organization_subscriptions
            SET trial_ends_at = COALESCE(trial_ends_at, now()) + ($2 || ' days')::interval,
                current_period_end = COALESCE(trial_ends_at, now()) + ($2 || ' days')::interval
          WHERE id = $1 RETURNING *`,
        [current.id, String(dto.days)],
      );
      await this.audit.recordPlatform(tx, {
        organizationId,
        action: 'subscription.trial_extended',
        entity: 'organization_subscription',
        entityId: current.id,
        after: { days: dto.days, trialEndsAt: updated.trial_ends_at },
        reason: dto.reason,
      });
      this.access.invalidate(organizationId);
      return updated;
    });
  }

  // -------------------------------------------------------------------
  // Lecture
  // -------------------------------------------------------------------
  async currentSubscription(tx: Tx, organizationId: string) {
    return tx.oneOrFail<SubscriptionRow>(
      `SELECT * FROM organization_subscriptions
        WHERE organization_id = $1
          AND status NOT IN ('cancelled','expired','archived')
        ORDER BY created_at DESC LIMIT 1`,
      [organizationId],
      "Aucun abonnement actif pour cette pharmacie.",
    );
  }

  /** Vue de l'abonnement destinée à la pharmacie elle-même. */
  async selfView(ctx: RequestContext) {
    return this.db.readTransaction(ctx, async (tx) => {
      const subscription = await tx.one(
        `SELECT s.status::text AS status, s.billing_cycle::text AS billing_cycle,
                s.currency, s.unit_price, s.discount_percent,
                s.started_at, s.trial_ends_at, s.current_period_start,
                s.current_period_end, s.renewal_at, s.auto_renew, s.grace_days,
                s.max_users, s.max_branches, s.max_products, s.storage_quota_mb,
                s.sms_quota, s.modules,
                p.code AS plan_code, p.name AS plan_name, p.target_audience
           FROM organization_subscriptions s
           JOIN subscription_plans p ON p.id = s.plan_id
          WHERE s.organization_id = $1
          ORDER BY s.created_at DESC LIMIT 1`,
        [ctx.organizationId],
      );
      const addons = await tx.many(
        `SELECT a.code, a.name, oa.quantity, oa.unit_price, oa.currency
           FROM organization_addons oa
           JOIN plan_addons a ON a.id = oa.addon_id
          WHERE oa.organization_id = $1
            AND (oa.active_until IS NULL OR oa.active_until > now())`,
        [ctx.organizationId],
      );
      const invoices = await tx.many(
        `SELECT number, status::text AS status, issue_date, due_date,
                currency, total, amount_paid, balance
           FROM subscription_invoices
          WHERE organization_id = $1 AND kind = 'invoice'
          ORDER BY issue_date DESC LIMIT 24`,
        [ctx.organizationId],
      );
      return { subscription, addons, invoices };
    });
  }

  // -------------------------------------------------------------------
  // Utilitaires
  // -------------------------------------------------------------------
  private priceFor(plan: PlanRow, cycle: BillingCycle): string {
    return {
      monthly: plan.price_monthly,
      quarterly: plan.price_quarterly,
      annual: plan.price_annual,
    }[cycle];
  }

  private async resolvePromo(tx: Tx, code: string, planCode: string) {
    const promo = await tx.one<{
      id: string; discount_percent: number | null; applies_to_plans: string[];
      max_redemptions: number | null; redemptions: number;
    }>(
      `SELECT id, discount_percent, applies_to_plans, max_redemptions, redemptions
         FROM promo_codes
        WHERE upper(code) = upper($1) AND is_active
          AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
          AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)`,
      [code],
    );
    if (!promo) throw new BadRequestException('Code promotionnel invalide ou expiré.');
    if (promo.max_redemptions !== null && promo.redemptions >= promo.max_redemptions) {
      throw new BadRequestException('Ce code promotionnel a atteint sa limite d’utilisation.');
    }
    if (
      promo.applies_to_plans.length > 0 &&
      !promo.applies_to_plans.includes(planCode)
    ) {
      throw new BadRequestException(
        `Ce code promotionnel ne s'applique pas au forfait « ${planCode} ».`,
      );
    }
    return promo;
  }
}

interface PlanRow {
  id: string;
  code: string;
  trial_days: number;
  price_monthly: string;
  price_quarterly: string;
  price_annual: string;
  max_users: number | null;
  max_branches: number | null;
  max_products: number | null;
  storage_quota_mb: number | null;
  sms_quota: number;
  whatsapp_quota: number;
  modules: string[];
}

interface SubscriptionRow {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  currency: string;
  unit_price: string;
  current_period_start: Date;
  current_period_end: Date;
  trial_ends_at: Date | null;
  grace_days: number;
}
