import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import {
  CreateSupplierDto, SupplierProductDto, UpdateSupplierDto, UpdateSupplierProductDto,
} from './suppliers.dto';
import { SuppliersService } from './suppliers.service';

/**
 * Répertoire des fournisseurs : fiche, catalogue et prix de chaque dépôt.
 * Module « suppliers », présent dans tous les forfaits ; les commandes et
 * réceptions restent dans PurchasingController (module « purchasing »).
 */
@ApiTags('Espace pharmacie')
@Controller('purchasing/suppliers')
@RequireModule('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @RequirePermissions('suppliers.read')
  @ApiOperation({ summary: 'Fournisseurs' })
  list(@Ctx() ctx: RequestContext, @Query('search') search?: string) {
    return this.suppliers.list(ctx, search);
  }

  // Déclarée avant « :id », sinon « price-comparison » serait lu comme un identifiant.
  @Get('price-comparison')
  @RequirePermissions('suppliers.read')
  @ApiOperation({ summary: "Comparer les prix d'un produit entre fournisseurs" })
  comparePrices(
    @Ctx() ctx: RequestContext,
    @Query('search') search?: string,
    @Query('productId') productId?: string,
  ) {
    return this.suppliers.comparePrices(ctx, search, productId);
  }

  @Get(':id')
  @RequirePermissions('suppliers.read')
  @ApiOperation({ summary: "Fiche d'un fournisseur et son catalogue" })
  get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.suppliers.get(ctx, id);
  }

  @Post()
  @RequirePermissions('suppliers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Enregistrer un fournisseur' })
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(ctx, dto);
  }

  @Patch(':id')
  @RequirePermissions('suppliers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Modifier, désactiver ou réactiver un fournisseur' })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliers.update(ctx, id, dto);
  }

  @Post(':id/products')
  @RequirePermissions('suppliers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Ajouter un produit et son prix au catalogue du fournisseur' })
  addProduct(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SupplierProductDto,
  ) {
    return this.suppliers.addProduct(ctx, id, dto);
  }

  @Patch(':id/products/:lineId')
  @RequirePermissions('suppliers.write')
  @WriteOperation()
  @ApiOperation({ summary: "Modifier le prix ou la disponibilité d'un produit" })
  updateProduct(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: UpdateSupplierProductDto,
  ) {
    return this.suppliers.updateProduct(ctx, id, lineId, dto);
  }

  @Delete(':id/products/:lineId')
  @RequirePermissions('suppliers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Retirer un produit du catalogue du fournisseur' })
  removeProduct(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ) {
    return this.suppliers.removeProduct(ctx, id, lineId);
  }
}
