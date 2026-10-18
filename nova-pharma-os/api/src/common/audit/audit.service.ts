import { Injectable } from '@nestjs/common';
import { Tx } from '../database/database.service';
import { RequestContext } from '../database/request-context';

export interface AuditEntry {
  action: string;
  entity?: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

/**
 * Journalisation d'audit à deux niveaux :
 *  - `audit_logs`          : actions au sein d'une pharmacie ;
 *  - `platform_audit_logs` : actions du back-office SaaS.
 *
 * Les écritures se font dans la transaction de l'opération auditée :
 * une action annulée ne laisse pas de trace mensongère, et une action
 * validée est toujours tracée.
 */
@Injectable()
export class AuditService {
  async record(tx: Tx, entry: AuditEntry): Promise<void> {
    const ctx = tx.context;
    if (ctx.organizationId) {
      await tx.query(
        `INSERT INTO audit_logs
           (organization_id, branch_id, user_id, support_grant_id, actor_label,
            action, entity, entity_id, before_state, after_state, ip_address, user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          ctx.organizationId,
          ctx.branchId ?? null,
          ctx.actorKind === 'user' ? ctx.actorId : null,
          ctx.supportGrantId ?? null,
          ctx.actorLabel ?? null,
          entry.action,
          entry.entity ?? null,
          entry.entityId ?? null,
          entry.before ? JSON.stringify(entry.before) : null,
          entry.after ? JSON.stringify(entry.after) : null,
          ctx.ip,
          ctx.userAgent,
        ],
      );
    }

    // Toute action d'un agent support est également tracée côté
    // plateforme, y compris lorsqu'elle porte sur une pharmacie.
    if (ctx.supportGrantId) {
      await tx.query(
        `INSERT INTO support_access_events
           (grant_id, organization_id, platform_user_id, action, entity, entity_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          ctx.supportGrantId,
          ctx.organizationId,
          ctx.actorId,
          entry.action,
          entry.entity ?? null,
          entry.entityId ?? null,
        ],
      );
    }
  }

  /** Journal de niveau plateforme (création de pharmacie, changement de forfait…). */
  async recordPlatform(
    tx: Tx,
    entry: AuditEntry & { organizationId?: string | null },
  ): Promise<void> {
    const ctx: RequestContext = tx.context;
    await tx.query(
      `INSERT INTO platform_audit_logs
         (organization_id, platform_user_id, actor_email, action, entity, entity_id,
          before_state, after_state, reason, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        entry.organizationId ?? ctx.organizationId ?? null,
        ctx.actorKind === 'platform_user' ? ctx.actorId : null,
        ctx.actorLabel ?? null,
        entry.action,
        entry.entity ?? null,
        entry.entityId ?? null,
        entry.before ? JSON.stringify(entry.before) : null,
        entry.after ? JSON.stringify(entry.after) : null,
        entry.reason ?? null,
        ctx.ip,
        ctx.userAgent,
      ],
    );
  }
}
