import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { AuthService } from '../../auth/auth.service';

const ROLES = ['super_admin', 'support_admin', 'commercial'] as const;

/** Utilisateurs internes NOVA PHARMA OS. */
@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT id, email, full_name, role, locale, is_active, last_login_at, created_at
           FROM platform_users ORDER BY full_name`,
      ),
    );
  }

  async create(
    ctx: RequestContext,
    dto: { email: string; fullName: string; password: string; role: string },
  ) {
    if (!ROLES.includes(dto.role as (typeof ROLES)[number])) {
      throw new BadRequestException(
        `Rôle interne invalide. Valeurs acceptées : ${ROLES.join(', ')}.`,
      );
    }
    return this.db.transaction(ctx, async (tx) => {
      const user = await tx.oneOrFail(
        `INSERT INTO platform_users (email, full_name, password_hash, role)
         VALUES ($1,$2,$3,$4)
         RETURNING id, email, full_name, role, is_active, created_at`,
        [
          dto.email.toLowerCase(),
          dto.fullName,
          AuthService.hashPassword(dto.password),
          dto.role,
        ],
      );
      await this.audit.recordPlatform(tx, {
        action: 'platform_user.created',
        entity: 'platform_user',
        entityId: user.id as string,
        after: { email: dto.email, role: dto.role },
      });
      return user;
    });
  }

  async setActive(ctx: RequestContext, id: string, isActive: boolean) {
    return this.db.transaction(ctx, async (tx) => {
      if (!isActive && id === ctx.actorId) {
        throw new BadRequestException('Vous ne pouvez pas désactiver votre propre compte.');
      }
      const user = await tx.oneOrFail(
        `UPDATE platform_users SET is_active = $2 WHERE id = $1
         RETURNING id, email, full_name, role, is_active`,
        [id, isActive],
        'Utilisateur interne introuvable.',
      );
      // Désactiver un compte met immédiatement fin à ses sessions.
      if (!isActive) {
        await tx.query(
          `UPDATE refresh_tokens SET revoked_at = now()
            WHERE platform_user_id = $1 AND revoked_at IS NULL`,
          [id],
        );
      }
      await this.audit.recordPlatform(tx, {
        action: isActive ? 'platform_user.enabled' : 'platform_user.disabled',
        entity: 'platform_user',
        entityId: id,
      });
      return user;
    });
  }

  async resetPassword(ctx: RequestContext, id: string, newPassword: string) {
    return this.db.transaction(ctx, async (tx) => {
      await tx.oneOrFail(
        'UPDATE platform_users SET password_hash = $2 WHERE id = $1 RETURNING id',
        [id, AuthService.hashPassword(newPassword)],
        'Utilisateur interne introuvable.',
      );
      await tx.query(
        `UPDATE refresh_tokens SET revoked_at = now()
          WHERE platform_user_id = $1 AND revoked_at IS NULL`,
        [id],
      );
      await this.audit.recordPlatform(tx, {
        action: 'platform_user.password_reset',
        entity: 'platform_user',
        entityId: id,
      });
      return { message: 'Mot de passe réinitialisé, sessions closes.' };
    });
  }
}
