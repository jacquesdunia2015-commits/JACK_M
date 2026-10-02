import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { DeliveryService } from './delivery.service';

@ApiTags('Espace pharmacie')
@Controller('deliveries')
@RequireModule('delivery')
export class DeliveryController {
  constructor(private readonly deliveries: DeliveryService) {}

  @Get()
  @RequirePermissions('delivery.read')
  @ApiOperation({ summary: 'Livraisons' })
  list(
    @Ctx() ctx: RequestContext,
    @Query('status') status?: string,
    @Query('driverUserId') driverUserId?: string,
  ) {
    return this.deliveries.list(ctx, status, driverUserId);
  }

  @Get('my-route')
  @RequirePermissions('delivery.read')
  @ApiOperation({ summary: 'Ma tournée du jour (application livreur)' })
  myRoute(@Ctx() ctx: RequestContext) {
    return this.deliveries.myRoute(ctx);
  }

  @Post()
  @RequirePermissions('delivery.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Créer une livraison' })
  create(
    @Ctx() ctx: RequestContext,
    @Body()
    body: {
      branchId?: string; orderId?: string; saleId?: string; customerId?: string;
      address?: string; city?: string; contactName?: string; contactPhone?: string;
      scheduledAt?: string; driverUserId?: string;
    },
  ) {
    return this.deliveries.create(ctx, body);
  }

  @Get(':id')
  @RequirePermissions('delivery.read')
  @ApiOperation({ summary: 'Détail et suivi d’une livraison' })
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.deliveries.get(ctx, id);
  }

  @Post(':id/assign')
  @RequirePermissions('delivery.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Affecter un livreur' })
  assign(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { driverUserId: string },
  ) {
    return this.deliveries.assign(ctx, id, body.driverUserId);
  }

  @Post(':id/status')
  @RequirePermissions('delivery.write')
  @WriteOperation()
  @ApiOperation({
    summary: 'Faire avancer la livraison',
    description:
      'Une confirmation de livraison exige une preuve : nom du destinataire ' +
      'ou code de confirmation.',
  })
  advance(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body()
    body: {
      status: string; latitude?: number; longitude?: number; note?: string;
      recipientName?: string; proofCode?: string; amountCollected?: number;
      failedReason?: string;
    },
  ) {
    return this.deliveries.advance(ctx, id, body);
  }
}
