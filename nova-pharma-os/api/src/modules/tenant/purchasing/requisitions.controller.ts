import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { CreateRequisitionDto, UpdateRequisitionDto } from './requisitions.dto';
import { RequisitionsService } from './requisitions.service';

/**
 * Réquisitions : ce qu'il faut acheter et chez qui. Module « suppliers »,
 * présent dans tous les forfaits.
 */
@ApiTags('Espace pharmacie')
@Controller('purchasing/requisitions')
@RequireModule('suppliers')
export class RequisitionsController {
  constructor(private readonly requisitions: RequisitionsService) {}

  @Get()
  @RequirePermissions('suppliers.read')
  @ApiOperation({ summary: 'Réquisitions' })
  list(@Ctx() ctx: RequestContext) {
    return this.requisitions.list(ctx);
  }

  @Get(':id')
  @RequirePermissions('suppliers.read')
  @ApiOperation({ summary: 'Réquisition et ses lignes' })
  get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.requisitions.get(ctx, id);
  }

  @Get(':id/pdf')
  @RequirePermissions('suppliers.read')
  @ApiOperation({ summary: 'Réquisition en PDF, au logo de la pharmacie (un fournisseur par page)' })
  async pdf(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('supplierId') supplierId?: string,
  ) {
    const { fichier, nom } = await this.requisitions.pdf(ctx, id, supplierId || undefined);
    return new StreamableFile(fichier, {
      type: 'application/pdf',
      disposition: `inline; filename="${nom}"`,
      length: fichier.length,
    });
  }

  @Post()
  @RequirePermissions('suppliers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Créer une réquisition' })
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateRequisitionDto) {
    return this.requisitions.create(ctx, dto);
  }

  @Patch(':id')
  @RequirePermissions('suppliers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Modifier une réquisition, ou changer son statut' })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequisitionDto,
  ) {
    return this.requisitions.update(ctx, id, dto);
  }
}
