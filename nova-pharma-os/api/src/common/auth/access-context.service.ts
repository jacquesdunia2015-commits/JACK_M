import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RequestContext, SYSTEM_CONTEXT } from '../database/request-context';
import { AccessTokenPayload } from './auth.types';

interface OrganizationAccess {
  organizationId: string;
  organizationStatus: string;
  subscriptionStatus: string | null;
  modules: string[];
  /** L'organisation est consultable mais figée (suspension, impayé). */
  readonly: boolean;
  reason: string | null;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 15_000;

/**
 * Résout ce qu'un porteur de jeton a le droit de voir et de faire :
 * organisation, statut d'abonnement, modules du forfait, permissions,
 * et éventuel accès support temporaire.
 */
@Injectable()
export class AccessContextService {
  private readonly orgCache = new Map<string, CacheEntry<OrganizationAccess>>();
  private readonly permissionCache = new Map<string, CacheEntry<string[]>>();

  constructor(private readonly db: DatabaseService) {}

  invalidate(organizationId: string): void {
    this.orgCache.delete(organizationId);
    for (const key of this.permissionCache.keys()) {
      if (key.startsWith(`${organizationId}:`)) this.permissionCache.delete(key);
    }
  }

  invalidateUser(organizationId: string, userId: string): void {
    this.permissionCache.delete(`${organizationId}:${userId}`);
  }

  async buildContext(
    payload: AccessTokenPayload,
    request: { ip?: string; headers: Record<string, unknown> },
  ): Promise<RequestContext> {
    const ip = request.ip ?? null;
    const userAgent = (request.headers['user-agent'] as string) ?? null;

    if (payload.kind === 'platform_user') {
      return this.buildPlatformContext(payload, ip, userAgent);
    }
    return this.buildTenantContext(payload, ip, userAgent);
  }

  // -------------------------------------------------------------------
  // Utilisateur interne NOVA PHARMA OS
  // -------------------------------------------------------------------
  private async buildPlatformContext(
    payload: AccessTokenPayload,
    ip: string | null,
    userAgent: string | null,
  ): Promise<RequestContext> {
    const base: RequestContext = {
      actorId: payload.sub,
      actorKind: 'platform_user',
      actorLabel: payload.email,
      platform: true,
      readonly: false,
      platformRole: payload.role ?? 'support_admin',
      ip,
      userAgent,
    };

    if (!payload.grant) return base;

    // Accès support temporaire : le jeton porte la subvention, mais
    // c'est son état en base qui fait foi à chaque requête.
    const grant = await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.one<{
        id: string;
        organization_id: string;
        mode: string;
        status: string;
        expires_at: Date;
        platform_user_id: string;
      }>(
        `SELECT id, organization_id, mode, status, expires_at, platform_user_id
           FROM support_access_grants WHERE id = $1`,
        [payload.grant],
      ),
    );

    if (!grant || grant.platform_user_id !== payload.sub) {
      throw new ForbiddenException("Accès support introuvable.");
    }
    if (grant.status !== 'active' && grant.status !== 'approved') {
      throw new ForbiddenException(
        `Accès support non actif (statut : ${grant.status}).`,
      );
    }
    if (new Date(grant.expires_at).getTime() <= Date.now()) {
      // Révocation automatique à l'échéance.
      await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
        tx.query(
          `UPDATE support_access_grants SET status = 'expired' WHERE id = $1`,
          [grant.id],
        ),
      );
      throw new ForbiddenException("L'accès support a expiré.");
    }

    const access = await this.getOrganizationAccess(grant.organization_id);
    const permissions = await this.supportPermissions(grant.mode);

    return {
      ...base,
      organizationId: grant.organization_id,
      // Le contexte plateforme est abandonné pendant un accès support :
      // l'agent travaille dans le périmètre de la pharmacie, sous RLS.
      platform: false,
      readonly: grant.mode === 'read_only' || access.readonly,
      permissions,
      modules: access.modules,
      supportGrantId: grant.id,
    };
  }

  /**
   * Droits d'un agent pendant une intervention.
   *
   * Un accès en lecture seule ne confère que les permissions de
   * consultation : l'agent voit ce qu'il faut pour diagnostiquer, et
   * rien de plus. Un accès en écriture — que la pharmacie doit toujours
   * valider explicitement — confère les permissions d'exploitation, à
   * l'exclusion de l'administration des comptes et des paramètres, qui
   * restent la main du client.
   */
  private async supportPermissions(mode: string): Promise<string[]> {
    const cacheKey = `support:${mode}`;
    const cached = this.permissionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const excludedModules = ['users', 'settings', 'integrations'];
    const rows = await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.many<{ code: string }>(
        `SELECT code FROM permissions
          WHERE module <> ALL($1::text[])
            AND ($2::boolean OR code LIKE '%.read')`,
        [excludedModules, mode === 'read_write'],
      ),
    );

    const permissions = rows.map((row) => row.code);
    this.permissionCache.set(cacheKey, {
      value: permissions,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return permissions;
  }

  // -------------------------------------------------------------------
  // Utilisateur d'une pharmacie
  // -------------------------------------------------------------------
  private async buildTenantContext(
    payload: AccessTokenPayload,
    ip: string | null,
    userAgent: string | null,
  ): Promise<RequestContext> {
    if (!payload.org) {
      throw new UnauthorizedException('Jeton sans organisation.');
    }
    const access = await this.getOrganizationAccess(payload.org);

    if (access.organizationStatus === 'terminated' || access.organizationStatus === 'archived') {
      throw new ForbiddenException(
        "L'abonnement de cette pharmacie est résilié. Contactez NOVA PHARMA OS.",
      );
    }

    const permissions = await this.getPermissions(payload.org, payload.sub);

    return {
      organizationId: payload.org,
      branchId: payload.branch ?? null,
      actorId: payload.sub,
      actorKind: 'user',
      actorLabel: payload.email,
      platform: false,
      readonly: access.readonly,
      permissions,
      modules: access.modules,
      ip,
      userAgent,
    };
  }

  async getOrganizationAccess(organizationId: string): Promise<OrganizationAccess> {
    const cached = this.orgCache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const row = await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.one<{
        status: string;
        subscription_status: string | null;
        modules: string[] | null;
      }>(
        `SELECT o.status,
                s.status::text AS subscription_status,
                s.modules
           FROM organizations o
           LEFT JOIN organization_subscriptions s
             ON s.organization_id = o.id
            AND s.status NOT IN ('cancelled', 'expired', 'archived')
          WHERE o.id = $1 AND o.deleted_at IS NULL`,
        [organizationId],
      ),
    );

    if (!row) throw new UnauthorizedException('Organisation inconnue.');

    // Une pharmacie suspendue conserve l'accès à ses données critiques,
    // mais en lecture seule : rien n'est supprimé, rien n'est modifiable.
    const frozenStatuses = ['suspended', 'cancelled', 'expired'];
    const readonly =
      row.status === 'suspended' ||
      (row.subscription_status !== null &&
        frozenStatuses.includes(row.subscription_status));

    const value: OrganizationAccess = {
      organizationId,
      organizationStatus: row.status,
      subscriptionStatus: row.subscription_status,
      modules: row.modules ?? [],
      readonly,
      reason: readonly ? 'Abonnement suspendu ou impayé.' : null,
    };
    this.orgCache.set(organizationId, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return value;
  }

  private async getPermissions(
    organizationId: string,
    userId: string,
  ): Promise<string[]> {
    const key = `${organizationId}:${userId}`;
    const cached = this.permissionCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const rows = await this.db.transaction(
      {
        organizationId,
        actorKind: 'system',
        platform: false,
        readonly: true,
      },
      (tx) =>
        tx.many<{ permission_code: string; is_owner: boolean }>(
          `SELECT rp.permission_code, u.is_owner
             FROM users u
             LEFT JOIN user_roles ur ON ur.user_id = u.id
             LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
            WHERE u.id = $1 AND u.deleted_at IS NULL AND u.is_active`,
          [userId],
        ),
    );

    if (rows.length === 0) {
      throw new UnauthorizedException('Compte utilisateur inactif ou supprimé.');
    }

    // L'administrateur pharmacie détient toutes les permissions de son
    // organisation, sans dépendre d'un rôle explicite.
    const permissions = rows[0].is_owner
      ? ['*']
      : [...new Set(rows.map((r) => r.permission_code).filter(Boolean))];

    this.permissionCache.set(key, {
      value: permissions,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return permissions;
  }
}
