import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
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

  @Get('summary')
  @RequirePermissions('reporting.read')
  @ApiOperation({ summary: 'Synthèse d’une période (dates AAAA-MM-JJ incluses, fuseau de la pharmacie)' })
  summary(@Ctx() ctx: RequestContext, @Query('from') from?: string, @Query('to') to?: string, @Query('branchId') branchId?: string) {
    return this.reporting.synthese(ctx, { from, to, branchId });
  }

  @Get('payments')
  @RequirePermissions('reporting.read')
  @ApiOperation({ summary: 'Encaissements par moyen de paiement et par devise remise' })
  payments(@Ctx() ctx: RequestContext, @Query('from') from?: string, @Query('to') to?: string, @Query('branchId') branchId?: string) {
    return this.reporting.paiements(ctx, { from, to, branchId });
  }

  @Get('expiry')
  @RequirePermissions('reporting.read')
  @ApiOperation({ summary: 'Pertes par péremption : retirés sur la période, périmés en stock, à risque sous 90 jours' })
  expiry(@Ctx() ctx: RequestContext, @Query('from') from?: string, @Query('to') to?: string, @Query('branchId') branchId?: string) {
    return this.reporting.peremptions(ctx, { from, to, branchId });
  }

  @Get('workbook')
  @RequirePermissions('reporting.financial')
  @ApiOperation({ summary: 'Tous les rapports de la période dans un classeur Excel (.xlsx)' })
  async workbook(@Ctx() ctx: RequestContext, @Query('from') from?: string, @Query('to') to?: string, @Query('branchId') branchId?: string) {
    const { fichier, nom } = await this.reporting.classeur(ctx, { from, to, branchId });
    return new StreamableFile(fichier, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${nom}"`,
      length: fichier.length,
    });
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
