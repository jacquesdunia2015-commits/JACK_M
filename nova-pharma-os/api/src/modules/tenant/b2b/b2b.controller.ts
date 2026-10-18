import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { B2bService } from './b2b.service';

@ApiTags('Espace pharmacie')
@Controller('b2b')
@RequireModule('b2b')
export class B2bController {
  constructor(private readonly b2b: B2bService) {}

  @Get('quotes')
  @RequirePermissions('b2b.read')
  @ApiOperation({ summary: 'Devis professionnels' })
  quotes(@Ctx() ctx: RequestContext, @Query('status') status?: string) {
    return this.b2b.listQuotes(ctx, status);
  }

  @Post('quotes')
  @RequirePermissions('b2b.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Établir un devis' })
  createQuote(
    @Ctx() ctx: RequestContext,
    @Body()
    body: {
      customerId: string; branchId?: string; validUntil?: string; notes?: string;
      lines: { productId: string; quantity: number; unitPrice?: number; discountPercent?: number }[];
    },
  ) {
    return this.b2b.createQuote(ctx, body);
  }

  @Get('quotes/:id')
  @RequirePermissions('b2b.read')
  @ApiOperation({ summary: 'Détail d’un devis' })
  getQuote(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.b2b.getQuote(ctx, id);
  }

  @Post('quotes/:id/convert')
  @RequirePermissions('b2b.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Transformer le devis en commande' })
  convert(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.b2b.convertQuote(ctx, id);
  }

  @Get('orders')
  @RequirePermissions('b2b.read')
  @ApiOperation({ summary: 'Commandes professionnelles' })
  orders(
    @Ctx() ctx: RequestContext,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.b2b.listOrders(ctx, status, customerId);
  }

  @Post('orders')
  @RequirePermissions('b2b.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Enregistrer une commande professionnelle' })
  createOrder(
    @Ctx() ctx: RequestContext,
    @Body()
    body: {
      customerId: string; branchId?: string; paymentTerms?: 'cash' | 'credit';
      requestedDate?: string; notes?: string; clientOperationId?: string;
      lines: { productId: string; quantity: number; unitPrice?: number; discountPercent?: number }[];
    },
  ) {
    return this.b2b.createOrder(ctx, body);
  }

  @Get('orders/:id')
  @RequirePermissions('b2b.read')
  @ApiOperation({ summary: 'Détail d’une commande' })
  getOrder(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.b2b.getOrder(ctx, id);
  }

  @Post('orders/:id/status')
  @RequirePermissions('b2b.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Faire évoluer la commande' })
  setStatus(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.b2b.setStatus(ctx, id, body.status);
  }

  @Post('orders/:id/fulfil')
  @RequirePermissions('b2b.write')
  @WriteOperation()
  @ApiOperation({
    summary: 'Livrer et facturer la commande',
    description:
      'Sort le stock selon la règle FEFO, émet la facture et impute le crédit ' +
      'client le cas échéant.',
  })
  fulfil(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body()
    body: {
      payments?: { method: string; amount: number; provider?: string; reference?: string }[];
    },
  ) {
    return this.b2b.fulfil(ctx, id, body?.payments);
  }
}
