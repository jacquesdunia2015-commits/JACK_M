import { Injectable } from '@nestjs/common';
import { Tx } from '../database/database.service';
import { PlanLimitException } from '../http/exceptions';

export type QuotaKind = 'users' | 'branches' | 'products' | 'storage_mb' | 'sms';

interface Limits {
  max_users: number | null;
  max_branches: number | null;
  max_products: number | null;
  storage_quota_mb: number | null;
  sms_quota: number;
  modules: string[];
  status: string;
}

export interface QuotaUsage {
  kind: QuotaKind;
  used: number;
  limit: number | null;
  remaining: number | null;
  /** true si la limite est atteinte. */
  exceeded: boolean;
}

/**
 * Fait respecter les limites du forfait souscrit.
 *
 * Les limites effectives sont portées par l'abonnement (forfait + options
 * souscrites), pas par le forfait seul : une pharmacie Starter ayant
 * acheté deux utilisateurs supplémentaires en a bien cinq.
 */
@Injectable()
export class EntitlementsService {
  async getLimits(tx: Tx, organizationId: string): Promise<Limits> {
    const row = await tx.one<Limits>(
      `SELECT max_users, max_branches, max_products, storage_quota_mb,
              sms_quota, modules, status::text AS status
         FROM organization_subscriptions
        WHERE organization_id = $1
          AND status NOT IN ('cancelled', 'expired', 'archived')
        ORDER BY created_at DESC
        LIMIT 1`,
      [organizationId],
    );
    if (!row) {
      throw new PlanLimitException(
        "Aucun abonnement actif n'est rattaché à cette pharmacie.",
      );
    }
    return row;
  }

  async hasModule(tx: Tx, organizationId: string, moduleCode: string): Promise<boolean> {
    const limits = await this.getLimits(tx, organizationId);
    if (limits.modules.includes(moduleCode)) return true;

    // Une activation ponctuelle par le back-office SaaS prime sur le forfait.
    const override = await tx.one<{ enabled: boolean }>(
      `SELECT enabled FROM feature_flags
        WHERE feature_code = $1
          AND (organization_id = $2 OR organization_id IS NULL)
        ORDER BY organization_id NULLS LAST
        LIMIT 1`,
      [moduleCode, organizationId],
    );
    return override?.enabled === true;
  }

  async requireModule(tx: Tx, organizationId: string, moduleCode: string): Promise<void> {
    if (!(await this.hasModule(tx, organizationId, moduleCode))) {
      throw new PlanLimitException(
        `Le module « ${moduleCode} » n'est pas inclus dans votre forfait.`,
        { module: moduleCode },
      );
    }
  }

  async usage(tx: Tx, organizationId: string, kind: QuotaKind): Promise<QuotaUsage> {
    const limits = await this.getLimits(tx, organizationId);
    const { limit, used } = await this.measure(tx, organizationId, kind, limits);
    return {
      kind,
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      exceeded: limit !== null && used >= limit,
    };
  }

  /**
   * Vérifie qu'une création supplémentaire tient dans le forfait.
   * À appeler dans la transaction de création : le comptage et
   * l'insertion partagent la même vue de la base.
   */
  async assertCanAdd(
    tx: Tx,
    organizationId: string,
    kind: QuotaKind,
    quantity = 1,
  ): Promise<void> {
    const limits = await this.getLimits(tx, organizationId);
    const { limit, used } = await this.measure(tx, organizationId, kind, limits);
    if (limit === null) return; // forfait sur mesure : aucune limite chiffrée

    if (used + quantity > limit) {
      throw new PlanLimitException(
        `Limite du forfait atteinte : ${this.label(kind)} (${used}/${limit}). ` +
          `Souscrivez une option ou changez de forfait pour en ajouter.`,
        { quota: kind, used, limit, requested: quantity },
      );
    }
  }

  async summary(tx: Tx, organizationId: string): Promise<QuotaUsage[]> {
    const kinds: QuotaKind[] = ['users', 'branches', 'products', 'storage_mb'];
    return Promise.all(kinds.map((kind) => this.usage(tx, organizationId, kind)));
  }

  private async measure(
    tx: Tx,
    organizationId: string,
    kind: QuotaKind,
    limits: Limits,
  ): Promise<{ limit: number | null; used: number }> {
    switch (kind) {
      case 'users': {
        const row = await tx.one<{ n: string }>(
          `SELECT count(*) AS n FROM users
            WHERE organization_id = $1 AND deleted_at IS NULL AND is_active`,
          [organizationId],
        );
        return { limit: limits.max_users, used: Number(row?.n ?? 0) };
      }
      case 'branches': {
        const row = await tx.one<{ n: string }>(
          `SELECT count(*) AS n FROM branches
            WHERE organization_id = $1 AND is_active`,
          [organizationId],
        );
        return { limit: limits.max_branches, used: Number(row?.n ?? 0) };
      }
      case 'products': {
        const row = await tx.one<{ n: string }>(
          `SELECT count(*) AS n FROM products
            WHERE organization_id = $1 AND deleted_at IS NULL`,
          [organizationId],
        );
        return { limit: limits.max_products, used: Number(row?.n ?? 0) };
      }
      case 'storage_mb': {
        const row = await tx.one<{ n: string }>(
          `SELECT COALESCE(sum(size_bytes), 0) / 1048576.0 AS n
             FROM documents WHERE organization_id = $1`,
          [organizationId],
        );
        return { limit: limits.storage_quota_mb, used: Math.ceil(Number(row?.n ?? 0)) };
      }
      case 'sms': {
        const row = await tx.one<{ n: string }>(
          `SELECT count(*) AS n FROM notifications
            WHERE organization_id = $1 AND channel = 'sms'
              AND created_at >= date_trunc('month', now())`,
          [organizationId],
        );
        return { limit: limits.sms_quota, used: Number(row?.n ?? 0) };
      }
    }
  }

  private label(kind: QuotaKind): string {
    return {
      users: 'utilisateurs',
      branches: 'branches',
      products: 'produits',
      storage_mb: 'stockage documentaire (Mo)',
      sms: 'SMS',
    }[kind];
  }
}
