import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../../../common/audit/audit.service';
import { AccessTokenPayload } from '../../../common/auth/auth.types';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import {
  RequestContext,
  SYSTEM_CONTEXT,
} from '../../../common/database/request-context';
import { NumberingService } from '../../../common/numbering/numbering.service';
import {
  CreateTicketDto,
  RequestSupportAccessDto,
  SatisfactionDto,
  TicketMessageDto,
  UpdateTicketDto,
} from './dto';

const SLA_HOURS: Record<string, number> = {
  low: 72,
  normal: 24,
  high: 8,
  critical: 2,
};

@Injectable()
export class SupportService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ===================================================================
  // Accès support temporaire
  // ===================================================================

  /**
   * Un agent demande l'accès aux données d'une pharmacie.
   *
   * L'accès n'est jamais implicite : il est motivé, borné dans le temps,
   * en lecture seule par défaut, et soumis à la validation de la
   * pharmacie sauf exception explicitement paramétrée. Un accès en
   * écriture requiert toujours la validation du client.
   */
  async requestAccess(
    ctx: RequestContext,
    organizationId: string,
    dto: RequestSupportAccessDto,
  ) {
    const mode = dto.mode ?? 'read_only';
    const maxHours = Number(
      (await this.setting('support.access_max_hours')) ?? 72,
    );
    const hours = Math.min(dto.durationHours ?? 4, maxHours);

    // La validation du client est obligatoire pour toute écriture.
    const requiresApproval =
      mode === 'read_write' ? true : dto.requiresCustomerApproval !== false;

    return this.db.transaction(ctx, async (tx) => {
      await tx.oneOrFail(
        'SELECT id FROM organizations WHERE id = $1 AND deleted_at IS NULL',
        [organizationId],
        'Pharmacie introuvable.',
      );

      const agent = await tx.oneOrFail<{ full_name: string; email: string }>(
        'SELECT full_name, email FROM platform_users WHERE id = $1',
        [ctx.actorId],
        'Agent support introuvable.',
      );

      const grant = await tx.oneOrFail(
        `INSERT INTO support_access_grants
           (organization_id, platform_user_id, agent_name, agent_email,
            ticket_id, reason, mode, status, requires_customer_approval,
            starts_at, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::nova.support_access_mode,
                 $8::nova.support_access_status, $9,
                 CASE WHEN $9 THEN NULL ELSE now() END,
                 now() + ($10 || ' hours')::interval)
         RETURNING *`,
        [
          organizationId,
          ctx.actorId,
          agent.full_name,
          agent.email,
          dto.ticketId ?? null,
          dto.reason,
          mode,
          requiresApproval ? 'requested' : 'active',
          requiresApproval,
          String(hours),
        ],
      );

      await this.audit.recordPlatform(tx, {
        organizationId,
        action: 'support.access_requested',
        entity: 'support_access_grant',
        entityId: grant.id as string,
        after: { mode, hours, requiresApproval },
        reason: dto.reason,
      });

      // La pharmacie est informée de la demande dans son espace.
      await this.notifyOrganization(organizationId, {
        category: 'system',
        severity: requiresApproval ? 'warning' : 'info',
        title: requiresApproval
          ? "Demande d'accès du support NOVA PHARMA OS"
          : 'Intervention du support NOVA PHARMA OS',
        body:
          `Motif : ${dto.reason}\n` +
          `Mode : ${mode === 'read_only' ? 'lecture seule' : 'lecture et écriture'}\n` +
          `Durée : ${hours} heure(s).` +
          (requiresApproval ? '\nVotre validation est requise.' : ''),
        payload: { grantId: grant.id, mode, requiresApproval },
      });

      return {
        grant,
        message: requiresApproval
          ? "Demande enregistrée. L'accès s'ouvrira après validation de la pharmacie."
          : `Accès ouvert en lecture seule pour ${hours} heure(s).`,
      };
    });
  }

  /** La pharmacie accorde l'accès demandé. */
  async approveAccess(ctx: RequestContext, grantId: string) {
    return this.db.transaction(ctx, async (tx) => {
      const grant = await tx.oneOrFail<{ id: string; status: string; mode: string; reason: string }>(
        `SELECT * FROM support_access_grants
          WHERE id = $1 AND organization_id = $2`,
        [grantId, ctx.organizationId],
        "Demande d'accès introuvable.",
      );
      if (grant.status !== 'requested') {
        throw new BadRequestException(
          `Cette demande n'est plus en attente (statut : ${grant.status}).`,
        );
      }

      const updated = await tx.oneOrFail(
        `UPDATE support_access_grants
            SET status = 'active', approved_at = now(),
                approved_by_user_id = $2, starts_at = now()
          WHERE id = $1 RETURNING *`,
        [grantId, ctx.actorId],
      );

      await this.audit.record(tx, {
        action: 'support.access_approved',
        entity: 'support_access_grant',
        entityId: grantId,
        after: { mode: grant.mode, reason: grant.reason },
      });

      return { grant: updated, message: "Accès support accordé." };
    });
  }

  async denyAccess(ctx: RequestContext, grantId: string, reason?: string) {
    return this.db.transaction(ctx, async (tx) => {
      const updated = await tx.oneOrFail(
        `UPDATE support_access_grants
            SET status = 'denied', revoked_at = now(), revoked_by = $2
          WHERE id = $1 AND organization_id = $3 AND status = 'requested'
          RETURNING *`,
        [grantId, ctx.actorId, ctx.organizationId],
        "Demande d'accès introuvable ou déjà traitée.",
      );
      await this.audit.record(tx, {
        action: 'support.access_denied',
        entity: 'support_access_grant',
        entityId: grantId,
        reason: reason ?? null,
      });
      return { grant: updated, message: "Demande d'accès refusée." };
    });
  }

  /** Révocation, à l'initiative de la pharmacie ou de l'éditeur. */
  async revokeAccess(ctx: RequestContext, grantId: string, reason?: string) {
    const isTenant = ctx.actorKind === 'user';
    return this.db.transaction(ctx, async (tx) => {
      const updated = await tx.oneOrFail(
        `UPDATE support_access_grants
            SET status = 'revoked', revoked_at = now(), revoked_by = $2
          WHERE id = $1
            AND ($3::uuid IS NULL OR organization_id = $3)
            AND status IN ('requested','approved','active')
          RETURNING *`,
        [grantId, ctx.actorId, isTenant ? ctx.organizationId : null],
        "Accès introuvable ou déjà clos.",
      );
      if (isTenant) {
        await this.audit.record(tx, {
          action: 'support.access_revoked',
          entity: 'support_access_grant',
          entityId: grantId,
          reason: reason ?? null,
        });
      } else {
        await this.audit.recordPlatform(tx, {
          organizationId: updated.organization_id as string,
          action: 'support.access_revoked',
          entity: 'support_access_grant',
          entityId: grantId,
          reason: reason ?? null,
        });
      }
      return { grant: updated, message: 'Accès support révoqué.' };
    });
  }

  /**
   * Ouvre une session d'intervention : un jeton dédié, porteur de la
   * subvention d'accès. Toutes les requêtes émises avec ce jeton sont
   * tracées dans `support_access_events`.
   */
  async openSession(ctx: RequestContext, grantId: string) {
    const grant = await this.db.transaction(ctx, (tx) =>
      tx.oneOrFail<{
        id: string; organization_id: string; platform_user_id: string;
        status: string; mode: string; expires_at: Date;
      }>(
        'SELECT * FROM support_access_grants WHERE id = $1',
        [grantId],
        'Accès support introuvable.',
      ),
    );

    if (grant.platform_user_id !== ctx.actorId) {
      throw new ForbiddenException("Cet accès a été accordé à un autre agent.");
    }
    if (grant.status !== 'active') {
      throw new ForbiddenException(
        grant.status === 'requested'
          ? "La pharmacie n'a pas encore validé cette demande."
          : `Accès non actif (statut : ${grant.status}).`,
      );
    }
    if (new Date(grant.expires_at) <= new Date()) {
      throw new ForbiddenException("Cet accès a expiré.");
    }

    const payload: AccessTokenPayload = {
      sub: ctx.actorId as string,
      kind: 'platform_user',
      role: ctx.platformRole ?? 'support_admin',
      grant: grant.id,
      email: ctx.actorLabel ?? '',
      name: ctx.actorLabel ?? '',
    };
    const expiresIn = Math.min(
      3600,
      Math.floor((new Date(grant.expires_at).getTime() - Date.now()) / 1000),
    );
    const accessToken = await this.jwt.signAsync(payload, { expiresIn });

    await this.db.transaction(ctx, (tx) =>
      tx.query(
        `INSERT INTO support_access_events
           (grant_id, organization_id, platform_user_id, action)
         VALUES ($1,$2,$3,'support.session_opened')`,
        [grant.id, grant.organization_id, ctx.actorId],
      ),
    );

    return {
      accessToken,
      tokenType: 'Bearer' as const,
      expiresIn,
      mode: grant.mode,
      organizationId: grant.organization_id,
      expiresAt: grant.expires_at,
      notice:
        grant.mode === 'read_only'
          ? 'Session en lecture seule. Toute action est journalisée et visible par la pharmacie.'
          : 'Session en écriture. Toute action est journalisée et visible par la pharmacie.',
    };
  }

  /** Journal d'un accès : ce que la pharmacie peut consulter à tout moment. */
  async accessTrail(ctx: RequestContext, organizationId?: string) {
    const targetOrg = ctx.actorKind === 'user' ? ctx.organizationId : organizationId;
    return this.db.readTransaction(ctx, async (tx) => {
      // L'identité de l'agent est portée par la subvention elle-même :
      // la pharmacie sait qui intervient sans accéder au référentiel
      // des comptes internes de l'éditeur.
      return tx.many(
        `SELECT g.id, g.reason, g.mode::text AS mode, g.status::text AS status,
                g.requested_at, g.approved_at, g.starts_at, g.expires_at, g.revoked_at,
                g.requires_customer_approval, g.agent_name, g.agent_email,
                (SELECT count(*) FROM support_access_events e WHERE e.grant_id = g.id) AS actions
           FROM support_access_grants g
          WHERE ($1::uuid IS NULL OR g.organization_id = $1)
          ORDER BY g.requested_at DESC
          LIMIT 100`,
        [targetOrg ?? null],
      );
    });
  }

  async accessEvents(ctx: RequestContext, grantId: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT action, method, path, entity, entity_id, occurred_at
           FROM support_access_events
          WHERE grant_id = $1
          ORDER BY occurred_at DESC LIMIT 500`,
        [grantId],
      ),
    );
  }

  /** Ferme les accès arrivés à échéance. Appelée par l'ordonnanceur. */
  async expireStaleGrants(): Promise<number> {
    return this.db.transaction(SYSTEM_CONTEXT, async (tx) => {
      const { rowCount } = await tx.query(
        `UPDATE support_access_grants
            SET status = 'expired'
          WHERE status IN ('requested','approved','active')
            AND expires_at <= now()`,
      );
      return rowCount;
    });
  }

  // ===================================================================
  // Tickets
  // ===================================================================

  async createTicket(ctx: RequestContext, dto: CreateTicketDto) {
    const priority = dto.priority ?? 'normal';
    return this.db.transaction(ctx, async (tx) => {
      const reference = await this.numbering.next(tx, 'ticket');
      const ticket = await tx.oneOrFail(
        `INSERT INTO support_tickets
           (organization_id, reference, subject, description, category, priority,
            status, sla_due_at, created_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,'open', now() + ($7 || ' hours')::interval, $8)
         RETURNING *`,
        [
          ctx.organizationId,
          reference,
          dto.subject,
          dto.description,
          dto.category ?? 'question',
          priority,
          String(SLA_HOURS[priority] ?? 24),
          ctx.actorId,
        ],
      );
      await tx.query(
        `INSERT INTO support_ticket_messages
           (ticket_id, organization_id, author_kind, author_user_id, body)
         VALUES ($1,$2,'customer',$3,$4)`,
        [ticket.id, ctx.organizationId, ctx.actorId, dto.description],
      );
      await this.audit.record(tx, {
        action: 'support.ticket_created',
        entity: 'support_ticket',
        entityId: ticket.id as string,
        after: { reference, subject: dto.subject, priority },
      });
      return ticket;
    });
  }

  async listTickets(
    ctx: RequestContext,
    filters: { status?: string; organizationId?: string; priority?: string } = {},
  ) {
    const scopeOrg =
      ctx.actorKind === 'user' ? ctx.organizationId : (filters.organizationId ?? null);
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT t.id, t.reference, t.subject, t.category, t.priority, t.status,
                t.sla_due_at, t.first_response_at, t.resolved_at, t.created_at,
                t.satisfaction_score,
                o.slug AS organization_slug, o.legal_name AS organization_name,
                pu.full_name AS assigned_to,
                (SELECT count(*) FROM support_ticket_messages m
                  WHERE m.ticket_id = t.id AND NOT m.is_internal_note) AS messages
           FROM support_tickets t
           JOIN organizations o ON o.id = t.organization_id
           LEFT JOIN platform_users pu ON pu.id = t.assigned_platform_user_id
          WHERE ($1::uuid IS NULL OR t.organization_id = $1)
            AND ($2::text IS NULL OR t.status = $2)
            AND ($3::text IS NULL OR t.priority = $3)
          ORDER BY
            CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                            WHEN 'normal' THEN 2 ELSE 3 END,
            t.created_at DESC
          LIMIT 200`,
        [scopeOrg, filters.status ?? null, filters.priority ?? null],
      ),
    );
  }

  async getTicket(ctx: RequestContext, id: string) {
    const hideInternal = ctx.actorKind === 'user';
    return this.db.readTransaction(ctx, async (tx) => {
      const ticket = await tx.oneOrFail(
        `SELECT t.*, o.slug AS organization_slug, o.legal_name AS organization_name
           FROM support_tickets t
           JOIN organizations o ON o.id = t.organization_id
          WHERE t.id = $1`,
        [id],
        'Ticket introuvable.',
      );
      const messages = await tx.many(
        `SELECT m.id, m.author_kind, m.body, m.attachments, m.is_internal_note, m.created_at,
                COALESCE(u.full_name, pu.full_name) AS author_name
           FROM support_ticket_messages m
           LEFT JOIN users u ON u.id = m.author_user_id
           LEFT JOIN platform_users pu ON pu.id = m.author_platform_user_id
          WHERE m.ticket_id = $1
            AND ($2::boolean IS FALSE OR NOT m.is_internal_note)
          ORDER BY m.created_at`,
        [id, hideInternal],
      );
      return { ticket, messages };
    });
  }

  async addMessage(ctx: RequestContext, ticketId: string, dto: TicketMessageDto) {
    const fromPlatform = ctx.actorKind === 'platform_user';
    return this.db.transaction(ctx, async (tx) => {
      const message = await tx.oneOrFail(
        `INSERT INTO support_ticket_messages
           (ticket_id, organization_id, author_kind, author_user_id,
            author_platform_user_id, body, is_internal_note)
         SELECT t.id, t.organization_id, $2, $3, $4, $5, $6
           FROM support_tickets t WHERE t.id = $1
         RETURNING *`,
        [
          ticketId,
          fromPlatform ? 'platform' : 'customer',
          fromPlatform ? null : ctx.actorId,
          fromPlatform ? ctx.actorId : null,
          dto.body,
          dto.isInternalNote === true && fromPlatform,
        ],
        'Ticket introuvable.',
      );

      if (fromPlatform && dto.isInternalNote !== true) {
        await tx.query(
          `UPDATE support_tickets
              SET first_response_at = COALESCE(first_response_at, now()),
                  status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END
            WHERE id = $1`,
          [ticketId],
        );
      }
      return message;
    });
  }

  async updateTicket(ctx: RequestContext, ticketId: string, dto: UpdateTicketDto) {
    return this.db.transaction(ctx, async (tx) => {
      const ticket = await tx.oneOrFail(
        `UPDATE support_tickets
            SET status = COALESCE($2, status),
                priority = COALESCE($3, priority),
                assigned_platform_user_id = COALESCE($4::uuid, assigned_platform_user_id),
                resolved_at = CASE WHEN $2 = 'resolved' THEN now() ELSE resolved_at END,
                closed_at   = CASE WHEN $2 = 'closed'   THEN now() ELSE closed_at END
          WHERE id = $1 RETURNING *`,
        [ticketId, dto.status ?? null, dto.priority ?? null, dto.assignedPlatformUserId ?? null],
        'Ticket introuvable.',
      );
      await this.audit.recordPlatform(tx, {
        organizationId: ticket.organization_id as string,
        action: 'support.ticket_updated',
        entity: 'support_ticket',
        entityId: ticketId,
        after: dto as Record<string, unknown>,
      });
      return ticket;
    });
  }

  /** Mesure de satisfaction après résolution. */
  async rateTicket(ctx: RequestContext, ticketId: string, dto: SatisfactionDto) {
    return this.db.transaction(ctx, async (tx) => {
      const ticket = await tx.oneOrFail(
        `UPDATE support_tickets
            SET satisfaction_score = $2, satisfaction_comment = $3
          WHERE id = $1 AND organization_id = $4
            AND status IN ('resolved','closed')
          RETURNING *`,
        [ticketId, dto.score, dto.comment ?? null, ctx.organizationId],
        "Ticket introuvable ou non encore résolu.",
      );
      return ticket;
    });
  }

  // ===================================================================
  // Base de connaissances et incidents
  // ===================================================================

  async knowledgeBase(ctx: RequestContext, search?: string, locale = 'fr') {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT slug, title, category, kind, video_url, tags,
                left(body, 320) AS excerpt
           FROM knowledge_base_articles
          WHERE is_published
            AND locale = $1
            AND ($2::text IS NULL OR title ILIKE '%'||$2||'%' OR body ILIKE '%'||$2||'%')
          ORDER BY category, title`,
        [locale, search ?? null],
      ),
    );
  }

  async article(ctx: RequestContext, slug: string) {
    return this.db.transaction(ctx, async (tx) => {
      const article = await tx.oneOrFail(
        'SELECT * FROM knowledge_base_articles WHERE slug = $1 AND is_published',
        [slug],
        'Article introuvable.',
      );
      return article;
    });
  }

  async incidents(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT title, status, severity, body, started_at, resolved_at
           FROM platform_incidents
          WHERE started_at >= now() - interval '90 days'
          ORDER BY started_at DESC`,
      ),
    );
  }

  // ===================================================================
  // Utilitaires
  // ===================================================================

  private async setting(key: string): Promise<unknown> {
    const row = await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.one<{ value: unknown }>(
        'SELECT value FROM platform_settings WHERE key = $1',
        [key],
      ),
    );
    return row?.value ?? null;
  }

  private async notifyOrganization(
    organizationId: string,
    notification: {
      category: string;
      severity: string;
      title: string;
      body: string;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.db.transaction(
      {
        organizationId,
        actorKind: 'system',
        platform: false,
        readonly: false,
      },
      (tx) =>
        tx.query(
          `INSERT INTO notifications
             (organization_id, channel, category, severity, title, body, payload)
           VALUES ($1,'in_app',$2,$3,$4,$5,$6)`,
          [
            organizationId,
            notification.category,
            notification.severity,
            notification.title,
            notification.body,
            JSON.stringify(notification.payload),
          ],
        ),
    );
  }
}
