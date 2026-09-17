import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, RequirePermissions } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { ReportingService } from './reporting.service';

@ApiTags('Espace pharmacie')
@Controller('reports')
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('dashboard')
  @RequirePermissions('reporting.read')
  @ApiOperation({ summary: 'Tableau de bord opérationnel' })
  dashboard(@Ctx() ctx: RequestContext, @Query('branchId') branchId?: string) {
    return this.reporting.dashboard(ctx, branchId);
  }

  @Get('sales')
  @RequirePermissions('reporting.read')
  @ApiOperation({
    summary: 'Ventes agrégées',
    description:
      'Regroupement possible par jour, mois, produit, catégorie, vendeur, ' +
      'canal ou client.',
  })
  sales(
    @Ctx() ctx: RequestContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('groupBy') groupBy?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reporting.salesReport(ctx, { from, to, groupBy, branchId });
  }

  @Get('stock-valuation')
  @RequirePermissions('reporting.financial')
  @ApiOperation({ summary: 'Valorisation du stock et risque de péremption' })
  valuation(@Ctx() ctx: RequestContext, @Query('branchId') branchId?: string) {
    return this.reporting.stockValuation(ctx, branchId);
  }

  @Get('stock-rotation')
  @RequirePermissions('reporting.read')
  @ApiOperation({ summary: 'Rotation des stocks et capital immobilisé' })
  rotation(
    @Ctx() ctx: RequestContext,
    @Query('days') days?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reporting.stockRotation(ctx, Number(days ?? 90), branchId);
  }
}
