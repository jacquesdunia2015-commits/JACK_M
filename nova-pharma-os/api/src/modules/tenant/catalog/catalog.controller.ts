import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { CatalogService } from './catalog.service';
import {
  CreateProductDto, ImporterReferenceDto, ImportProductsDto, SearchProductsDto, UpdateProductDto,
} from './dto';

@ApiTags('Espace pharmacie')
@Controller('catalog')
@RequireModule('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  @RequirePermissions('catalog.read')
  @ApiOperation({ summary: 'Rechercher dans le catalogue' })
  search(@Ctx() ctx: RequestContext, @Query() query: SearchProductsDto) {
    return this.catalog.search(ctx, query);
  }

  @Get('products/:id')
  @RequirePermissions('catalog.read')
  @ApiOperation({ summary: 'Fiche produit, lots et derniers mouvements' })
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.catalog.get(ctx, id);
  }

  @Post('products')
  @RequirePermissions('catalog.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Créer un produit' })
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateProductDto) {
    return this.catalog.create(ctx, dto);
  }

  @Post('products/import')
  @RequirePermissions('catalog.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Importer le catalogue initial' })
  import(@Ctx() ctx: RequestContext, @Body() dto: ImportProductsDto) {
    return this.catalog.import(ctx, dto);
  }

  @Patch('products/:id')
  @RequirePermissions('catalog.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Modifier un produit' })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.update(ctx, id, dto);
  }

  @Delete('products/:id')
  @RequirePermissions('catalog.delete')
  @WriteOperation()
  @ApiOperation({ summary: 'Archiver un produit' })
  archive(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.catalog.archive(ctx, id);
  }

  @Get('reference')
  @RequirePermissions('catalog.read')
  @ApiOperation({
    summary: 'Catalogue de référence Goma–Bukavu',
    description: '100 médicaments et produits courants au Kivu, avec prix indicatifs en dollars.',
  })
  reference(@Ctx() ctx: RequestContext) {
    return this.catalog.reference(ctx);
  }

  @Post('reference/import')
  @RequirePermissions('catalog.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Reprendre des produits du catalogue de référence' })
  importerReference(@Ctx() ctx: RequestContext, @Body() dto: ImporterReferenceDto) {
    return this.catalog.importerReference(ctx, dto);
  }

  @Get('categories')
  @RequirePermissions('catalog.read')
  @ApiOperation({ summary: 'Catégories du catalogue' })
  categories(@Ctx() ctx: RequestContext) {
    return this.catalog.categories(ctx);
  }
}
