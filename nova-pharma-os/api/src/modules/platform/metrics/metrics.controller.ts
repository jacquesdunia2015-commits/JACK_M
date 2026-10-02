import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, PlatformRoles } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { MetricsService } from './metrics.service';

@ApiTags('Back-office SaaS')
@Controller('platform/metrics')
@PlatformRoles('super_admin', 'commercial', 'support_admin')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Tableau de bord de la plateforme',
    description:
      'Portefeuille de pharmacies, revenu récurrent (MRR/ARR), conversion, ' +
      'résiliation, impayés, support, activité et adoption par module.',
  })
  dashboard(@Ctx() ctx: RequestContext) {
    return this.metrics.dashboard(ctx);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Évolution du chiffre facturé et encaissé' })
  revenue(@Ctx() ctx: RequestContext, @Query('months') months?: string) {
    return this.metrics.revenueTimeline(ctx, Number(months ?? 12));
  }
}
