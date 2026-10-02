import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { EmettreFactureDto, ListeFacturesDto } from './invoices.dto';
import { InvoicesService } from './invoices.service';

/** Factures des clients : émission depuis une vente, PDF à imprimer ou partager. */
@ApiTags('Espace pharmacie')
@Controller('invoices')
@RequireModule('sales')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequirePermissions('sales.read')
  @ApiOperation({ summary: 'Factures clients' })
  list(@Ctx() ctx: RequestContext, @Query() query: ListeFacturesDto) {
    return this.invoices.list(ctx, query);
  }

  @Post()
  @RequirePermissions('sales.create')
  @WriteOperation()
  @ApiOperation({
    summary: 'Établir la facture d’une vente',
    description: 'Une vente n’a qu’une facture : la redemander renvoie celle déjà émise.',
  })
  emettre(@Ctx() ctx: RequestContext, @Body() dto: EmettreFactureDto) {
    return this.invoices.emettre(ctx, dto);
  }

  @Get(':id')
  @RequirePermissions('sales.read')
  @ApiOperation({ summary: 'Facture, client, lignes et règlements' })
  get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.get(ctx, id);
  }

  @Get(':id/pdf')
  @RequirePermissions('sales.read')
  @ApiOperation({ summary: 'Facture en PDF, au logo de la pharmacie' })
  async pdf(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    const { fichier, nom } = await this.invoices.pdf(ctx, id);
    return new StreamableFile(fichier, {
      type: 'application/pdf',
      disposition: `inline; filename="${nom}"`,
      length: fichier.length,
    });
  }
}
