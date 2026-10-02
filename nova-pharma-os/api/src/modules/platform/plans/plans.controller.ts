import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, PlatformRoles, Public } from '../../../common/auth/decorators';
import { RequestContext, SYSTEM_CONTEXT } from '../../../common/database/request-context';
import { PlansService } from './plans.service';

@ApiTags('Forfaits')
@Controller('plans')
export class PublicPlansController {
  constructor(private readonly plans: PlansService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Grille des forfaits et options commercialisés' })
  catalog(@Ctx() ctx: RequestContext) {
    return this.plans.publicCatalog(ctx ?? SYSTEM_CONTEXT);
  }
}

@ApiTags('Back-office SaaS')
@Controller('platform/plans')
@PlatformRoles('super_admin')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get(':code')
  @ApiOperation({ summary: 'Détail d’un forfait' })
  get(@Ctx() ctx: RequestContext, @Param('code') code: string) {
    return this.plans.getPlan(ctx, code);
  }

  @Patch(':code')
  @ApiOperation({ summary: 'Modifier un forfait (tarifs, limites, modules)' })
  update(
    @Ctx() ctx: RequestContext,
    @Param('code') code: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.plans.updatePlan(ctx, code, body);
  }

  @Get('features/flags')
  @ApiOperation({ summary: 'Fonctionnalités activées par dérogation' })
  flags(@Ctx() ctx: RequestContext, @Query('organizationId') organizationId?: string) {
    return this.plans.listFeatureFlags(ctx, organizationId);
  }

  @Post('features/flags')
  @ApiOperation({
    summary: 'Activer ou désactiver une fonctionnalité pour une pharmacie',
  })
  setFlag(
    @Ctx() ctx: RequestContext,
    @Body()
    body: {
      organizationId?: string;
      featureCode: string;
      enabled: boolean;
      note?: string;
    },
  ) {
    return this.plans.setFeatureFlag(
      ctx,
      body.organizationId ?? null,
      body.featureCode,
      body.enabled,
      body.note,
    );
  }
}
