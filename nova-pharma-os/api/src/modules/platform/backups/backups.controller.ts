import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, PlatformRoles } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { BackupsService } from './backups.service';

@ApiTags('Back-office SaaS')
@Controller('platform/backups')
@PlatformRoles('super_admin')
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Post('restore')
  @ApiOperation({
    summary: 'Restaurer une pharmacie depuis une sauvegarde',
    description:
      "Restauration ciblée : seule la pharmacie concernée est rétablie, sans " +
      "toucher aux autres. L'identifiant court de la pharmacie doit être " +
      'répété en confirmation.',
  })
  restore(
    @Ctx() ctx: RequestContext,
    @Body() body: { backupId: string; confirmSlug: string },
  ) {
    return this.backups.restore(ctx, body.backupId, body.confirmSlug);
  }
}
