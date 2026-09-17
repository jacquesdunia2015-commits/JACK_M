import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { AccessContextService } from '../../common/auth/access-context.service';
import {
  AccessTokenPayload,
  AuthenticatedTokens,
} from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../common/database/database.service';
import {
  RequestContext,
  SYSTEM_CONTEXT,
} from '../../common/database/request-context';
import { LoginDto } from './dto';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

interface SessionInfo {
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly access: AccessContextService,
    private readonly audit: AuditService,
  ) {}

  static hashPassword(plain: string): string {
    return bcrypt.hashSync(plain, 10);
  }

  // -------------------------------------------------------------------
  // Connexion d'un utilisateur de pharmacie
  // -------------------------------------------------------------------
  async login(dto: LoginDto, session: SessionInfo): Promise<AuthenticatedTokens & {
    user: Record<string, unknown>;
  }> {
    const candidates = await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.many<{
        id: string;
        organization_id: string;
        email: string;
        full_name: string;
        password_hash: string;
        default_branch_id: string | null;
        is_active: boolean;
        locked_until: Date | null;
        failed_login_count: number;
        org_slug: string;
        org_status: string;
      }>(
        // Le compte est recherché hors contexte tenant : à ce stade,
        // l'organisation n'est pas encore connue. Voir la migration 012.
        `SELECT * FROM nova.authentication_lookup($1, $2)`,
        [dto.email, dto.organizationSlug ?? null],
      ),
    );

    if (candidates.length === 0) {
      // Message volontairement identique à celui d'un mot de passe faux :
      // ne pas révéler quels comptes existent.
      throw new UnauthorizedException('Identifiants incorrects.');
    }
    if (candidates.length > 1) {
      throw new UnauthorizedException(
        'Cette adresse est utilisée dans plusieurs pharmacies : précisez organizationSlug.',
      );
    }

    const user = candidates[0];
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new ForbiddenException(
        `Compte temporairement verrouillé après plusieurs échecs. Réessayez dans ${LOCK_MINUTES} minutes.`,
      );
    }
    if (!user.is_active) {
      throw new ForbiddenException('Ce compte est désactivé.');
    }

    if (!bcrypt.compareSync(dto.password, user.password_hash)) {
      await this.registerFailedLogin(user.organization_id, user.id, user.failed_login_count);
      throw new UnauthorizedException('Identifiants incorrects.');
    }

    if (['terminated', 'archived'].includes(user.org_status)) {
      throw new ForbiddenException(
        "L'abonnement de cette pharmacie est résilié. Contactez NOVA PHARMA OS.",
      );
    }

    const context: RequestContext = {
      organizationId: user.organization_id,
      actorId: user.id,
      actorKind: 'user',
      actorLabel: user.email,
      platform: false,
      readonly: false,
      ip: session.ip,
      userAgent: session.userAgent,
    };

    const tokens = await this.db.transaction(context, async (tx) => {
      await tx.query(
        `UPDATE users
            SET last_login_at = now(), failed_login_count = 0, locked_until = NULL
          WHERE id = $1`,
        [user.id],
      );
      await this.audit.record(tx, {
        action: 'auth.login',
        entity: 'user',
        entityId: user.id,
      });
      return this.issueTokens(
        tx,
        {
          sub: user.id,
          kind: 'user',
          org: user.organization_id,
          branch: user.default_branch_id ?? undefined,
          email: user.email,
          name: user.full_name,
        },
        session,
      );
    });

    const access = await this.access.getOrganizationAccess(user.organization_id);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        organizationId: user.organization_id,
        organizationSlug: user.org_slug,
        defaultBranchId: user.default_branch_id,
        readonly: access.readonly,
        subscriptionStatus: access.subscriptionStatus,
        modules: access.modules,
      },
    };
  }

  // -------------------------------------------------------------------
  // Connexion d'un utilisateur interne NOVA PHARMA OS
  // -------------------------------------------------------------------
  async loginPlatform(
    dto: LoginDto,
    session: SessionInfo,
  ): Promise<AuthenticatedTokens & { user: Record<string, unknown> }> {
    const user = await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.one<{
        id: string;
        email: string;
        full_name: string;
        password_hash: string;
        role: string;
        is_active: boolean;
      }>(
        `SELECT id, email, full_name, password_hash, role, is_active
           FROM platform_users WHERE lower(email) = lower($1)`,
        [dto.email],
      ),
    );

    if (!user || !bcrypt.compareSync(dto.password, user.password_hash)) {
      throw new UnauthorizedException('Identifiants incorrects.');
    }
    if (!user.is_active) throw new ForbiddenException('Ce compte est désactivé.');

    const context: RequestContext = {
      actorId: user.id,
      actorKind: 'platform_user',
      actorLabel: user.email,
      platform: true,
      readonly: false,
      platformRole: user.role,
      ip: session.ip,
      userAgent: session.userAgent,
    };

    const tokens = await this.db.transaction(context, async (tx) => {
      await tx.query('UPDATE platform_users SET last_login_at = now() WHERE id = $1', [
        user.id,
      ]);
      await this.audit.recordPlatform(tx, {
        action: 'platform.login',
        entity: 'platform_user',
        entityId: user.id,
      });
      return this.issueTokens(
        tx,
        {
          sub: user.id,
          kind: 'platform_user',
          role: user.role,
          email: user.email,
          name: user.full_name,
        },
        session,
      );
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    };
  }

  // -------------------------------------------------------------------
  // Rotation du jeton de rafraîchissement
  // -------------------------------------------------------------------
  async refresh(refreshToken: string, session: SessionInfo): Promise<AuthenticatedTokens> {
    const hash = createHash('sha256').update(refreshToken).digest('hex');

    const stored = await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.one<{
        id: string;
        organization_id: string | null;
        user_id: string | null;
        platform_user_id: string | null;
        expires_at: Date;
        revoked_at: Date | null;
      }>(
        `SELECT id, organization_id, user_id, platform_user_id, expires_at, revoked_at
           FROM refresh_tokens WHERE token_hash = $1`,
        [hash],
      ),
    );

    if (!stored || stored.revoked_at || new Date(stored.expires_at) <= new Date()) {
      throw new UnauthorizedException('Jeton de rafraîchissement invalide ou expiré.');
    }

    const payload = stored.platform_user_id
      ? await this.platformPayload(stored.platform_user_id)
      : await this.tenantPayload(stored.user_id as string);

    const context: RequestContext = stored.platform_user_id
      ? {
          actorId: stored.platform_user_id,
          actorKind: 'platform_user',
          platform: true,
          readonly: false,
        }
      : {
          organizationId: stored.organization_id,
          actorId: stored.user_id,
          actorKind: 'user',
          platform: false,
          readonly: false,
        };

    return this.db.transaction(context, async (tx) => {
      // Rotation : l'ancien jeton est révoqué et chaîné au nouveau, ce
      // qui rend un vol de jeton détectable et non réutilisable.
      const tokens = await this.issueTokens(tx, payload, session);
      await tx.query(
        `UPDATE refresh_tokens
            SET revoked_at = now(),
                replaced_by = (SELECT id FROM refresh_tokens
                                WHERE token_hash = $2)
          WHERE id = $1`,
        [stored.id, createHash('sha256').update(tokens.refreshToken).digest('hex')],
      );
      return tokens;
    });
  }

  async logout(ctx: RequestContext, refreshToken?: string): Promise<void> {
    await this.db.transaction({ ...ctx, readonly: false }, async (tx) => {
      if (refreshToken) {
        const hash = createHash('sha256').update(refreshToken).digest('hex');
        await tx.query(
          `UPDATE refresh_tokens SET revoked_at = now()
            WHERE token_hash = $1 AND revoked_at IS NULL`,
          [hash],
        );
      } else {
        await tx.query(
          `UPDATE refresh_tokens SET revoked_at = now()
            WHERE revoked_at IS NULL
              AND (user_id = $1 OR platform_user_id = $1)`,
          [ctx.actorId],
        );
      }
    });
  }

  async changePassword(
    ctx: RequestContext,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const table = ctx.actorKind === 'platform_user' ? 'platform_users' : 'users';
    await this.db.transaction({ ...ctx, readonly: false }, async (tx) => {
      const row = await tx.oneOrFail<{ password_hash: string }>(
        `SELECT password_hash FROM ${table} WHERE id = $1`,
        [ctx.actorId],
        'Compte introuvable.',
      );
      if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
        throw new UnauthorizedException('Mot de passe actuel incorrect.');
      }
      await tx.query(
        `UPDATE ${table} SET password_hash = $2${
          table === 'users' ? ', must_change_password = false' : ''
        } WHERE id = $1`,
        [ctx.actorId, AuthService.hashPassword(newPassword)],
      );
      // Changer de mot de passe met fin à toutes les autres sessions.
      await tx.query(
        `UPDATE refresh_tokens SET revoked_at = now()
          WHERE revoked_at IS NULL AND (user_id = $1 OR platform_user_id = $1)`,
        [ctx.actorId],
      );
      if (ctx.actorKind === 'platform_user') {
        await this.audit.recordPlatform(tx, { action: 'platform.password_changed' });
      } else {
        await this.audit.record(tx, { action: 'auth.password_changed' });
      }
    });
  }

  // -------------------------------------------------------------------
  // Interne
  // -------------------------------------------------------------------
  private async issueTokens(
    tx: Tx,
    payload: AccessTokenPayload,
    session: SessionInfo,
  ): Promise<AuthenticatedTokens> {
    const accessTtl = Number(this.config.get('JWT_ACCESS_TTL') ?? 900);
    const refreshTtl = Number(this.config.get('JWT_REFRESH_TTL') ?? 2_592_000);

    const accessToken = await this.jwt.signAsync(payload, { expiresIn: accessTtl });
    const refreshToken = randomBytes(48).toString('base64url');

    await tx.query(
      `INSERT INTO refresh_tokens
         (organization_id, user_id, platform_user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1,$2,$3,$4, now() + ($5 || ' seconds')::interval, $6, $7)`,
      [
        payload.kind === 'user' ? payload.org : null,
        payload.kind === 'user' ? payload.sub : null,
        payload.kind === 'platform_user' ? payload.sub : null,
        createHash('sha256').update(refreshToken).digest('hex'),
        String(refreshTtl),
        session.userAgent ?? null,
        session.ip ?? null,
      ],
    );

    return { accessToken, refreshToken, expiresIn: accessTtl, tokenType: 'Bearer' };
  }

  private async tenantPayload(userId: string): Promise<AccessTokenPayload> {
    const row = await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.oneOrFail<{
        id: string;
        organization_id: string;
        email: string;
        full_name: string;
        default_branch_id: string | null;
        is_active: boolean;
      }>(
        `SELECT * FROM nova.authentication_lookup_by_id($1) WHERE is_active`,
        [userId],
        'Compte utilisateur inactif.',
      ),
    );
    return {
      sub: row.id,
      kind: 'user',
      org: row.organization_id,
      branch: row.default_branch_id ?? undefined,
      email: row.email,
      name: row.full_name,
    };
  }

  private async platformPayload(userId: string): Promise<AccessTokenPayload> {
    const row = await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.oneOrFail<{ id: string; email: string; full_name: string; role: string }>(
        `SELECT id, email, full_name, role FROM platform_users
          WHERE id = $1 AND is_active`,
        [userId],
        'Compte interne inactif.',
      ),
    );
    return {
      sub: row.id,
      kind: 'platform_user',
      role: row.role,
      email: row.email,
      name: row.full_name,
    };
  }

  private async registerFailedLogin(
    organizationId: string,
    userId: string,
    currentCount: number,
  ): Promise<void> {
    const next = currentCount + 1;
    await this.db.transaction(
      { organizationId, actorKind: 'system', platform: false, readonly: false },
      (tx) =>
        tx.query(
          `UPDATE users
              SET failed_login_count = $2,
                  locked_until = CASE WHEN $2 >= $3
                                      THEN now() + ($4 || ' minutes')::interval
                                      ELSE locked_until END
            WHERE id = $1`,
          [userId, next, MAX_FAILED_LOGINS, String(LOCK_MINUTES)],
        ),
    );
  }
}
