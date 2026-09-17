import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { CreatePurchaseOrderDto, CreateReceiptDto, CreateSupplierDto } from './dto';
import { PurchasingService } from './purchasing.service';

@ApiTags('Espace pharmacie')
@Controller('purchasing')
@RequireModule('purchasing')
export class PurchasingController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get('suppliers')
  @RequirePermissions('suppliers.read')
  @ApiOperation({ summary: 'Fournisseurs' })
  suppliers(@Ctx() ctx: RequestContext, @Query('search') search?: string) {
    return this.purchasing.listSuppliers(ctx, search);
  }

  @Post('suppliers')
  @RequirePermissions('suppliers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Créer un fournisseur' })
  createSupplier(@Ctx() ctx: RequestContext, @Body() dto: CreateSupplierDto) {
    return this.purchasing.createSupplier(ctx, dto);
  }

  @Get('orders')
  @RequirePermissions('purchasing.read')
  @ApiOperation({ summary: 'Commandes fournisseur' })
  orders(@Ctx() ctx: RequestContext, @Query('status') status?: string) {
    return this.purchasing.listOrders(ctx, status);
  }

  @Post('orders')
  @RequirePermissions('purchasing.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Créer une commande fournisseur' })
  createOrder(@Ctx() ctx: RequestContext, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchasing.createOrder(ctx, dto);
  }

  @Get('orders/:id')
  @RequirePermissions('purchasing.read')
  @ApiOperation({ summary: 'Détail d’une commande' })
  getOrder(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.purchasing.getOrder(ctx, id);
  }

  @Post('orders/:id/submit')
  @RequirePermissions('purchasing.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Transmettre la commande au fournisseur' })
  submit(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.purchasing.submitOrder(ctx, id);
  }

  @Post('receipts')
  @RequirePermissions('purchasing.receive')
  @WriteOperation()
  @ApiOperation({
    summary: 'Réceptionner une livraison',
    description:
      'Crée les lots (numéro et péremption) et entre la marchandise en stock. ' +
      'Un produit à péremption ne peut pas être réceptionné sans date.',
  })
  receive(@Ctx() ctx: RequestContext, @Body() dto: CreateReceiptDto) {
    return this.purchasing.receive(ctx, dto);
  }

  @Get('replenishment')
  @RequirePermissions('purchasing.read')
  @ApiOperation({
    summary: 'Suggestions de réapprovisionnement',
    description:
      'Fondées sur les seuils, la consommation des 30 derniers jours et le ' +
      'délai de livraison du fournisseur.',
  })
  replenishment(@Ctx() ctx: RequestContext) {
    return this.purchasing.replenishmentSuggestions(ctx);
  }
}
