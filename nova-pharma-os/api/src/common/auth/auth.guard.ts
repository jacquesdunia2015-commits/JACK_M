import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { RequestContext, SYSTEM_CONTEXT } from '../database/request-context';
import { AccessContextService } from './access-context.service';
import { AccessTokenPayload } from './auth.types';
import { PUBLIC_KEY } from './decorators';

/**
 * Authentifie la requête et construit son contexte d'exécution.
 * Deux porteurs sont acceptés : un jeton JWT (interface web et mobile)
 * ou une clé d'API d'organisation (intégrations partenaires).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly access: AccessContextService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();

    const apiKey = request.headers['x-api-key'] as string | undefined;
    if (apiKey) {
      request.novaContext = await this.contextFromApiKey(apiKey, request);
      return true;
    }

    const token = this.extractBearer(request.headers.authorization);
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException("Jeton d'accès manquant.");
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException("Jeton d'accès invalide ou expiré.");
    }

    // Une branche explicite prime sur la branche par défaut du jeton,
    // à condition que l'utilisateur y soit rattaché.
    const requestedBranch = request.headers['x-branch-id'] as string | undefined;
    const ctx = await this.access.buildContext(payload, request);
    request.novaContext = requestedBranch
      ? await this.withBranch(ctx, requestedBranch)
      : ctx;
    return true;
  }

  private extractBearer(header?: string): string | null {
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }

  private async withBranch(
    ctx: RequestContext,
    branchId: string,
  ): Promise<RequestContext> {
    if (!ctx.organizationId) return ctx;
    const allowed = await this.db.transaction({ ...ctx, readonly: true }, (tx) =>
      tx.one(
        `SELECT 1 FROM branches b
          WHERE b.id = $1 AND b.is_active
            AND ($2::uuid IS NULL
                 OR EXISTS (SELECT 1 FROM users u WHERE u.id = $2 AND u.is_owner)
                 OR EXISTS (SELECT 1 FROM user_branches ub
                             WHERE ub.user_id = $2 AND ub.branch_id = b.id))`,
        [branchId, ctx.actorId],
      ),
    );
    if (!allowed) {
      throw new UnauthorizedException("Branche inconnue ou non autorisée.");
    }
    return { ...ctx, branchId };
  }

  private async contextFromApiKey(
    apiKey: string,
    request: { ip?: string; headers: Record<string, unknown> },
  ): Promise<RequestContext> {
    const hash = createHash('sha256').update(apiKey).digest('hex');
    const row = await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.one<{ id: string; organization_id: string; scopes: string[] }>(
        `SELECT id, organization_id, scopes FROM api_keys
          WHERE key_hash = $1 AND revoked_at IS NULL
            AND (expires_at IS NULL OR expires_at > now())`,
        [hash],
      ),
    );
    if (!row) throw new UnauthorizedException('Clé API invalide ou révoquée.');

    const access = await this.access.getOrganizationAccess(row.organization_id);
    await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.query('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [row.id]),
    );

    return {
      organizationId: row.organization_id,
      actorId: row.id,
      actorKind: 'api_key',
      actorLabel: `api_key:${row.id}`,
      platform: false,
      readonly: access.readonly,
      permissions: row.scopes,
      modules: access.modules,
      ip: request.ip ?? null,
      userAgent: (request.headers['user-agent'] as string) ?? null,
    };
  }
}
