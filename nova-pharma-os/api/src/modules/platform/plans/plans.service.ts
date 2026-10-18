import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';

@Injectable()
export class PlansService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** Grille tarifaire publique, telle qu'affichée au prospect. */
  async publicCatalog(ctx: RequestContext) {
    return this.db.readTransaction(ctx, async (tx) => {
      const plans = await tx.many(
        `SELECT code, name, target_audience, description, currency,
                price_monthly, price_quarterly, price_annual, trial_days,
                max_users, max_branches, max_products, storage_quota_mb,
                sms_quota, whatsapp_quota, modules, is_custom
           FROM subscription_plans
          WHERE is_active AND is_public
          ORDER BY sort_order`,
      );
      const addons = await tx.many(
        `SELECT code, name, description, unit, currency, unit_price,
                billing_cycle::text AS billing_cycle, grants_modules,
                grants_users, grants_branches, grants_storage_mb, grants_sms
           FROM plan_addons WHERE is_active ORDER BY name`,
      );
      return { plans, addons };
    });
  }

  async updatePlan(
    ctx: RequestContext,
    code: string,
    changes: Record<string, unknown>,
  ) {
    const allowed = [
      'name', 'target_audience', 'description', 'price_monthly', 'price_quarterly',
      'price_annual', 'trial_days', 'max_users', 'max_branches', 'max_products',
      'storage_quota_mb', 'sms_quota', 'whatsapp_quota', 'modules', 'is_active',
      'is_public', 'sort_order',
    ];
    const entries = Object.entries(changes).filter(([key]) => allowed.includes(key));
    if (entries.length === 0) return this.getPlan(ctx, code);

    return this.db.transaction(ctx, async (tx) => {
      const before = await tx.oneOrFail(
        'SELECT * FROM subscription_plans WHERE code = $1',
        [code],
        'Forfait introuvable.',
      );
      const assignments = entries
        .map(([column], index) => `${column} = $${index + 2}`)
        .join(', ');
      const after = await tx.oneOrFail(
        `UPDATE subscription_plans SET ${assignments} WHERE code = $1 RETURNING *`,
        [code, ...entries.map(([, value]) => value)],
      );
      await this.audit.recordPlatform(tx, {
        action: 'plan.updated',
        entity: 'subscription_plan',
        entityId: after.id as string,
        before,
        after,
      });
      return after;
    });
  }

  async getPlan(ctx: RequestContext, code: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.oneOrFail('SELECT * FROM subscription_plans WHERE code = $1', [code],
        'Forfait introuvable.'),
    );
  }

  /**
   * Force l'activation ou la désactivation d'une fonctionnalité pour une
   * pharmacie, indépendamment de son forfait (geste commercial, pilote).
   */
  async setFeatureFlag(
    ctx: RequestContext,
    organizationId: string | null,
    featureCode: string,
    enabled: boolean,
    note?: string,
  ) {
    return this.db.transaction(ctx, async (tx) => {
      const flag = await tx.oneOrFail(
        `INSERT INTO feature_flags (organization_id, feature_code, enabled, source, note)
         VALUES ($1,$2,$3,'override',$4)
         ON CONFLICT (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), feature_code)
         DO UPDATE SET enabled = EXCLUDED.enabled, note = EXCLUDED.note, updated_at = now()
         RETURNING *`,
        [organizationId, featureCode, enabled, note ?? null],
      );
      await this.audit.recordPlatform(tx, {
        organizationId,
        action: 'feature_flag.set',
        entity: 'feature_flag',
        entityId: flag.id as string,
        after: { featureCode, enabled },
        reason: note ?? null,
      });
      return flag;
    });
  }

  async listFeatureFlags(ctx: RequestContext, organizationId?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT f.id, f.feature_code, f.enabled, f.source, f.note, f.updated_at,
                o.slug AS organization_slug
           FROM feature_flags f
           LEFT JOIN organizations o ON o.id = f.organization_id
          WHERE ($1::uuid IS NULL OR f.organization_id = $1 OR f.organization_id IS NULL)
          ORDER BY o.slug NULLS FIRST, f.feature_code`,
        [organizationId ?? null],
      ),
    );
  }
}
