import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { InventoryService } from './inventory.service';

@ApiTags('Espace pharmacie')
@Controller('inventory')
@RequireModule('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('stock')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Niveaux de stock' })
  stock(
    @Ctx() ctx: RequestContext,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('onlyIssues') onlyIssues?: string,
  ) {
    return this.inventory.stockLevels(ctx, {
      branchId,
      search,
      onlyIssues: onlyIssues === 'true',
    });
  }

  @Get('products/:productId/fefo')
  @RequirePermissions('inventory.read')
  @ApiOperation({
    summary: 'File FEFO d’un produit',
    description:
      'Ordre exact de consommation des lots : le lot dont la péremption est ' +
      'la plus proche sort en premier.',
  })
  fefo(
    @Ctx() ctx: RequestContext,
    @Param('productId') productId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.inventory.fefoQueue(ctx, productId, branchId);
  }

  @Get('alerts')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Alertes de rupture et de péremption' })
  alerts(
    @Ctx() ctx: RequestContext,
    @Query('branchId') branchId?: string,
    @Query('kind') kind?: string,
  ) {
    return this.inventory.alerts(ctx, branchId, kind);
  }

  @Post('alerts/refresh')
  @RequirePermissions('inventory.read')
  @WriteOperation()
  @ApiOperation({ summary: 'Recalculer les alertes' })
  refresh(@Ctx() ctx: RequestContext, @Body() body: { branchId?: string }) {
    return this.inventory.refreshAlerts(ctx, body?.branchId);
  }

  @Post('alerts/:id/acknowledge')
  @RequirePermissions('inventory.read')
  @WriteOperation()
  @ApiOperation({ summary: 'Prendre en compte une alerte' })
  acknowledge(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.inventory.acknowledgeAlert(ctx, id);
  }

  @Get('movements')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Journal des mouvements de stock' })
  movements(
    @Ctx() ctx: RequestContext,
    @Query('productId') productId?: string,
    @Query('branchId') branchId?: string,
    @Query('kind') kind?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventory.movements(ctx, {
      productId, branchId, kind, limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('adjustments')
  @RequirePermissions('inventory.adjust')
  @WriteOperation()
  @ApiOperation({ summary: 'Régulariser le stock' })
  adjust(
    @Ctx() ctx: RequestContext,
    @Body()
    body: {
      branchId?: string; productId: string; lotId?: string;
      quantity: number; reason: string;
      kind?: 'adjustment_in' | 'adjustment_out' | 'damage' | 'expiry_write_off';
    },
  ) {
    return this.inventory.adjust(ctx, body);
  }

  @Post('write-off-expired')
  @RequirePermissions('inventory.adjust')
  @WriteOperation()
  @ApiOperation({ summary: 'Sortir les lots périmés du stock' })
  writeOff(
    @Ctx() ctx: RequestContext,
    @Body() body: { branchId?: string; reason?: string },
  ) {
    return this.inventory.writeOffExpired(ctx, body?.branchId, body?.reason);
  }

  @Post('counts')
  @RequirePermissions('inventory.count')
  @WriteOperation()
  @ApiOperation({ summary: 'Ouvrir un inventaire' })
  startCount(
    @Ctx() ctx: RequestContext,
    @Body() body: { branchId?: string; kind?: string; productIds?: string[] },
  ) {
    return this.inventory.startCount(ctx, body ?? {});
  }

  @Get('counts/:id')
  @RequirePermissions('inventory.count')
  @ApiOperation({ summary: 'Feuille d’inventaire et écarts' })
  getCount(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.inventory.getCount(ctx, id);
  }

  @Post('counts/:id/lines')
  @RequirePermissions('inventory.count')
  @WriteOperation()
  @ApiOperation({ summary: 'Saisir les quantités comptées' })
  recordCount(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body()
    body: {
      lines: { productId: string; lotId?: string; countedQuantity: number; reason?: string }[];
    },
  ) {
    return this.inventory.recordCount(ctx, id, body.lines);
  }

  @Post('counts/:id/validate')
  @RequirePermissions('inventory.count')
  @WriteOperation()
  @ApiOperation({ summary: 'Valider l’inventaire et régulariser les écarts' })
  validateCount(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.inventory.validateCount(ctx, id);
  }

  @Post('transfers')
  @RequirePermissions('inventory.transfer')
  @RequireModule('multi_site')
  @WriteOperation()
  @ApiOperation({ summary: 'Transférer du stock entre branches' })
  transfer(
    @Ctx() ctx: RequestContext,
    @Body()
    body: {
      fromBranchId: string; toBranchId: string;
      lines: { productId: string; quantity: number }[]; notes?: string;
    },
  ) {
    return this.inventory.transfer(ctx, body);
  }

  @Post('lots/:id/quarantine')
  @RequirePermissions('inventory.adjust')
  @WriteOperation()
  @ApiOperation({ summary: 'Bloquer ou débloquer un lot' })
  quarantine(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { quarantined: boolean; reason: string },
  ) {
    return this.inventory.quarantineLot(ctx, id, body.quarantined, body.reason);
  }
}
