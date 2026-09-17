import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../../../common/audit/audit.service';
import { AccessContextService } from '../../../common/auth/access-context.service';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { EntitlementsService } from '../../../common/entitlements/entitlements.service';
import { AuthService } from '../../auth/auth.service';

/** Administration de l'espace pharmacie : branches, utilisateurs, rôles. */
@Injectable()
export class TenantAdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
    private readonly access: AccessContextService,
  ) {}

  // ---------------- Branches ----------------

  async listBranches(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT b.*,
                (SELECT count(*) FROM user_branches ub WHERE ub.branch_id = b.id) AS users,
                (SELECT COALESCE(sum(si.quantity * si.average_cost), 0)
                   FROM stock_items si WHERE si.branch_id = b.id) AS stock_value
           FROM branches b ORDER BY b.is_main DESC, b.name`,
      ),
    );
  }

  async createBranch(
    ctx: RequestContext,
    dto: {
      code: string; name: string; kind?: string; address?: string;
      city?: string; phone?: string; email?: string;
    },
  ) {
    return this.db.transaction(ctx, async (tx) => {
      // Le nombre de branches est plafonné par le forfait souscrit.
      await this.entitlements.assertCanAdd(tx, ctx.organizationId as string, 'branches');
      const branch = await tx.oneOrFail(
        `INSERT INTO branches
           (organization_id, code, name, kind, address, city, phone, email)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          ctx.organizationId, dto.code.toUpperCase(), dto.name, dto.kind ?? 'pharmacy',
          dto.address ?? null, dto.city ?? null, dto.phone ?? null, dto.email ?? null,
        ],
      );
      await this.audit.record(tx, {
        action: 'admin.branch_created',
        entity: 'branch',
        entityId: branch.id as string,
        after: { code: dto.code, name: dto.name },
      });
      return branch;
    });
  }

  // ---------------- Utilisateurs ----------------

  async listUsers(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT u.id, u.email, u.full_name, u.phone, u.locale, u.is_owner,
                u.is_active, u.last_login_at, u.created_at,
                b.name AS default_branch_name,
                COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles,
                COALESCE(array_agg(DISTINCT br.code) FILTER (WHERE br.code IS NOT NULL), '{}') AS branches
           FROM users u
           LEFT JOIN branches b ON b.id = u.default_branch_id
           LEFT JOIN user_roles ur ON ur.user_id = u.id
           LEFT JOIN roles r ON r.id = ur.role_id
           LEFT JOIN user_branches ub ON ub.user_id = u.id
           LEFT JOIN branches br ON br.id = ub.branch_id
          WHERE u.deleted_at IS NULL
          GROUP BY u.id, b.name
          ORDER BY u.is_owner DESC, u.full_name`,
      ),
    );
  }

  async createUser(
    ctx: RequestContext,
    dto: {
      email: string; fullName: string; password: string; phone?: string;
      roleCodes?: string[]; branchIds?: string[]; defaultBranchId?: string;
    },
  ) {
    return this.db.transaction(ctx, async (tx) => {
      // Le nombre de comptes actifs est plafonné par le forfait.
      await this.entitlements.assertCanAdd(tx, ctx.organizationId as string, 'users');

      const defaultBranchId =
        dto.defaultBranchId ??
        (
          await tx.one<{ id: string }>(
            'SELECT id FROM branches WHERE is_main LIMIT 1',
          )
        )?.id ??
        null;

      const user = await tx.oneOrFail<{ id: string; email: string }>(
        `INSERT INTO users
           (organization_id, email, full_name, password_hash, phone,
            default_branch_id, must_change_password)
         VALUES ($1,$2,$3,$4,$5,$6,true)
         RETURNING id, email, full_name, is_active, created_at`,
        [
          ctx.organizationId, dto.email.toLowerCase(), dto.fullName,
          AuthService.hashPassword(dto.password), dto.phone ?? null, defaultBranchId,
        ],
      );

      for (const roleCode of dto.roleCodes ?? []) {
        await tx.query(
          `INSERT INTO user_roles (user_id, role_id, organization_id)
           SELECT $1, r.id, $3 FROM roles r
            WHERE r.code = $2 AND r.organization_id = $3
           ON CONFLICT DO NOTHING`,
          [user.id, roleCode, ctx.organizationId],
        );
      }

      const branchIds = dto.branchIds ?? (defaultBranchId ? [defaultBranchId] : []);
      for (const branchId of branchIds) {
        await tx.query(
          `INSERT INTO user_branches (user_id, branch_id, organization_id)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [user.id, branchId, ctx.organizationId],
        );
      }

      await this.audit.record(tx, {
        action: 'admin.user_created',
        entity: 'user',
        entityId: user.id,
        after: { email: dto.email, roles: dto.roleCodes ?? [] },
      });
      return { ...user, mustChangePassword: true };
    });
  }

  async setUserActive(ctx: RequestContext, userId: string, isActive: boolean) {
    return this.db.transaction(ctx, async (tx) => {
      const target = await tx.oneOrFail<{ is_owner: boolean }>(
        'SELECT is_owner FROM users WHERE id = $1 AND deleted_at IS NULL',
        [userId],
        'Utilisateur introuvable.',
      );
      if (target.is_owner && !isActive) {
        throw new BadRequestException(
          "L'administrateur de la pharmacie ne peut pas être désactivé.",
        );
      }
      if (isActive) {
        await this.entitlements.assertCanAdd(tx, ctx.organizationId as string, 'users');
      }

      const user = await tx.oneOrFail(
        `UPDATE users SET is_active = $2 WHERE id = $1
         RETURNING id, email, full_name, is_active`,
        [userId, isActive],
      );
      if (!isActive) {
        await tx.query(
          `UPDATE refresh_tokens SET revoked_at = now()
            WHERE user_id = $1 AND revoked_at IS NULL`,
          [userId],
        );
      }
      this.access.invalidateUser(ctx.organizationId as string, userId);
      await this.audit.record(tx, {
        action: isActive ? 'admin.user_enabled' : 'admin.user_disabled',
        entity: 'user',
        entityId: userId,
      });
      return user;
    });
  }

  async setUserRoles(ctx: RequestContext, userId: string, roleCodes: string[]) {
    return this.db.transaction(ctx, async (tx) => {
      await tx.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
      for (const roleCode of roleCodes) {
        await tx.query(
          `INSERT INTO user_roles (user_id, role_id, organization_id)
           SELECT $1, r.id, $3 FROM roles r
            WHERE r.code = $2 AND r.organization_id = $3`,
          [userId, roleCode, ctx.organizationId],
        );
      }
      this.access.invalidateUser(ctx.organizationId as string, userId);
      await this.audit.record(tx, {
        action: 'admin.user_roles_changed',
        entity: 'user',
        entityId: userId,
        after: { roles: roleCodes },
      });
      return { userId, roles: roleCodes };
    });
  }

  async resetUserPassword(ctx: RequestContext, userId: string, newPassword: string) {
    return this.db.transaction(ctx, async (tx) => {
      await tx.oneOrFail(
        `UPDATE users SET password_hash = $2, must_change_password = true,
                          failed_login_count = 0, locked_until = NULL
          WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
        [userId, AuthService.hashPassword(newPassword)],
        'Utilisateur introuvable.',
      );
      await tx.query(
        `UPDATE refresh_tokens SET revoked_at = now()
          WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId],
      );
      await this.audit.record(tx, {
        action: 'admin.user_password_reset',
        entity: 'user',
        entityId: userId,
      });
      return {
        message:
          'Mot de passe réinitialisé. L’utilisateur devra le changer à sa prochaine connexion.',
      };
    });
  }

  // ---------------- Rôles ----------------

  async listRoles(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT r.id, r.code, r.name, r.description, r.is_system,
                COALESCE(array_agg(rp.permission_code)
                  FILTER (WHERE rp.permission_code IS NOT NULL), '{}') AS permissions,
                (SELECT count(*) FROM user_roles ur WHERE ur.role_id = r.id) AS users
           FROM roles r
           LEFT JOIN role_permissions rp ON rp.role_id = r.id
          GROUP BY r.id ORDER BY r.name`,
      ),
    );
  }

  async listPermissions(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many('SELECT code, module, label, description FROM permissions ORDER BY module, code'),
    );
  }

  async upsertRole(
    ctx: RequestContext,
    dto: { code: string; name: string; description?: string; permissions: string[] },
  ) {
    return this.db.transaction(ctx, async (tx) => {
      const role = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO roles (organization_id, code, name, description)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (organization_id, code)
         DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
         RETURNING id`,
        [ctx.organizationId, dto.code, dto.name, dto.description ?? null],
      );
      await tx.query('DELETE FROM role_permissions WHERE role_id = $1', [role.id]);
      if (dto.permissions.length > 0) {
        await tx.query(
          `INSERT INTO role_permissions (role_id, organization_id, permission_code)
           SELECT $1, $2, unnest($3::text[])`,
          [role.id, ctx.organizationId, dto.permissions],
        );
      }
      this.access.invalidate(ctx.organizationId as string);
      await this.audit.record(tx, {
        action: 'admin.role_saved',
        entity: 'role',
        entityId: role.id,
        after: { code: dto.code, permissions: dto.permissions.length },
      });
      return { ...role, code: dto.code, permissions: dto.permissions };
    });
  }

  // ---------------- Paramètres ----------------

  async settings(ctx: RequestContext) {
    return this.db.readTransaction(ctx, async (tx) => {
      const organization = await tx.oneOrFail(
        `SELECT o.id, o.slug, o.legal_name, o.trade_name, o.kind, o.country_code,
                o.currency, o.locale, o.timezone, o.email, o.phone, o.address,
                o.city, o.tax_id, o.license_number, o.status::text AS status,
                o.onboarding_step, o.settings
           FROM organizations o WHERE o.id = $1`,
        [ctx.organizationId],
      );
      const country = await tx.one(
        `SELECT vat_rate, invoice_number_format, payment_methods, phone_prefix,
                credit_rules, regulatory_rules
           FROM country_settings WHERE code = $1`,
        [organization.country_code],
      );
      const taxes = await tx.many(
        'SELECT code, name, rate, is_default FROM tax_rates ORDER BY is_default DESC, code',
      );
      return { organization, country, taxes };
    });
  }

  async updateSettings(ctx: RequestContext, patch: Record<string, unknown>) {
    return this.db.transaction(ctx, async (tx) => {
      const organization = await tx.oneOrFail(
        `UPDATE organizations
            SET settings = settings || $2::jsonb
          WHERE id = $1 RETURNING settings`,
        [ctx.organizationId, JSON.stringify(patch)],
      );
      await this.audit.record(tx, {
        action: 'admin.settings_updated',
        entity: 'organization',
        entityId: ctx.organizationId,
        after: patch,
      });
      return organization;
    });
  }

  /** Journal d'audit de la pharmacie, accès support compris. */
  async auditLogs(
    ctx: RequestContext,
    filters: { action?: string; entity?: string; limit?: number } = {},
  ) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT a.id, a.action, a.entity, a.entity_id, a.actor_label,
                a.before_state, a.after_state, a.occurred_at, a.ip_address,
                u.full_name AS user_name, b.code AS branch_code,
                CASE WHEN a.support_grant_id IS NOT NULL
                     THEN 'Support NOVA PHARMA OS' END AS support_intervention
           FROM audit_logs a
           LEFT JOIN users u ON u.id = a.user_id
           LEFT JOIN branches b ON b.id = a.branch_id
          WHERE ($1::text IS NULL OR a.action LIKE $1 || '%')
            AND ($2::text IS NULL OR a.entity = $2)
          ORDER BY a.occurred_at DESC
          LIMIT $3`,
        [filters.action ?? null, filters.entity ?? null, Math.min(filters.limit ?? 200, 1000)],
      ),
    );
  }
}
