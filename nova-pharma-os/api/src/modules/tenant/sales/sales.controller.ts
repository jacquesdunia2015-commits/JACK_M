import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { CancelSaleDto, CreateSaleDto, ListSalesDto } from './dto';
import { SalesService } from './sales.service';

@ApiTags('Espace pharmacie')
@Controller('sales')
@RequireModule('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  @RequirePermissions('sales.create')
  @WriteOperation()
  @ApiOperation({
    summary: 'Enregistrer une vente',
    description:
      'Applique la règle FEFO, décrémente le stock, encaisse les règlements ' +
      'et alimente la caisse — le tout dans une seule transaction.',
  })
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateSaleDto) {
    return this.sales.create(ctx, dto);
  }

  @Get()
  @RequirePermissions('sales.read')
  @ApiOperation({ summary: 'Journal des ventes' })
  list(@Ctx() ctx: RequestContext, @Query() query: ListSalesDto) {
    return this.sales.list(ctx, query);
  }

  @Get(':id')
  @RequirePermissions('sales.read')
  @ApiOperation({ summary: 'Détail d’une vente' })
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.sales.get(ctx, id);
  }

  @Get(':id/receipt')
  @RequirePermissions('sales.read')
  @ApiOperation({ summary: 'Reçu prêt à imprimer' })
  receipt(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.sales.receipt(ctx, id);
  }

  @Post(':id/cancel')
  @RequirePermissions('sales.cancel')
  @WriteOperation()
  @ApiOperation({ summary: 'Annuler une vente et remettre le stock' })
  cancel(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: CancelSaleDto,
  ) {
    return this.sales.cancel(ctx, id, dto);
  }
}
