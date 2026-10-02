import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, PlatformRoles } from '../../../common/auth/decorators';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BackupsService } from '../backups/backups.service';

@ApiTags('Back-office SaaS')
@Controller('platform')
@PlatformRoles('super_admin', 'support_admin')
export class PlatformAuditController {
  constructor(
    private readonly db: DatabaseService,
    private readonly backups: BackupsService,
  ) {}

  @Get('audit-logs')
  @ApiOperation({ summary: "Journal d'audit de niveau plateforme" })
  auditLogs(
    @Ctx() ctx: RequestContext,
    @Query('organizationId') organizationId?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
  ) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT l.id, l.action, l.entity, l.entity_id, l.reason,
                l.before_state, l.after_state, l.occurred_at, l.ip_address,
                pu.full_name AS actor_name, pu.email AS actor_email,
                o.slug AS organization_slug
           FROM platform_audit_logs l
           LEFT JOIN platform_users pu ON pu.id = l.platform_user_id
           LEFT JOIN organizations o ON o.id = l.organization_id
          WHERE ($1::uuid IS NULL OR l.organization_id = $1)
            AND ($2::text IS NULL OR l.action LIKE $2 || '%')
          ORDER BY l.occurred_at DESC
          LIMIT $3`,
        [organizationId ?? null, action ?? null, Math.min(Number(limit ?? 200), 1000)],
      ),
    );
  }

  @Get('backups')
  @ApiOperation({ summary: 'Sauvegardes de toutes les pharmacies' })
  backupsList(@Ctx() ctx: RequestContext, @Query('organizationId') organizationId?: string) {
    return this.backups.list(ctx, organizationId);
  }
}
