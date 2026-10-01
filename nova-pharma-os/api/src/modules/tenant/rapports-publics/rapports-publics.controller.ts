import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Ctx, RequirePermissions, WriteOperation } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { RapportsPublicsService } from './rapports-publics.service';

class ReglagesDto {
  @ApiPropertyOptional({ description: 'Code de la structure attribué par le programme' }) @IsOptional() @IsString() @MaxLength(60) facilityCode?: string | null;
  @ApiPropertyOptional({ example: 'DiszpKrYNg8', description: 'Unité d’organisation DHIS2' }) @IsOptional() @IsString() @MaxLength(11) dhis2OrgUnit?: string | null;
  @ApiPropertyOptional({ description: 'Formulaire (data set) DHIS2' }) @IsOptional() @IsString() @MaxLength(11) dhis2DataSet?: string | null;
  @ApiPropertyOptional({ example: 3 }) @IsOptional() @IsNumber() @Min(0.5) @Max(24) maxMonths?: number;
}

class CorrespondanceDto {
  @ApiPropertyOptional({ description: 'Code du produit dans la liste nationale' }) @IsOptional() @IsString() @MaxLength(60) nationalCode?: string | null;
  @ApiPropertyOptional({ example: { consumed: { de: 'fbfJHSPpUQD' }, closing: { de: 'cYeuwXTCPkU', coc: 'pq2XI5kz2BY' } } })
  @IsOptional() @IsObject() dhis2?: Record<string, { de: string; coc?: string }>;
}

class ImportDto {
  @ApiProperty({ description: 'reference_nova;code_national;rubrique;data_element;category_option_combo' })
  @IsString() @MinLength(3) @MaxLength(500_000) csv!: string;
}

const oui = (v?: string) => v === 'true' || v === '1';

@ApiTags('Espace pharmacie')
@Controller('reports/public-programs')
export class RapportsPublicsController {
  constructor(private readonly rapports: RapportsPublicsService) {}

  @Get()
  @RequirePermissions('reporting.read')
  @ApiOperation({ summary: 'Rapport mensuel de gestion des stocks (stock initial, reçu, consommé, pertes, stock final, ruptures, à commander)' })
  rapport(@Ctx() ctx: RequestContext, @Query('month') month?: string, @Query('branchId') branchId?: string, @Query('mappedOnly') mappedOnly?: string) {
    return this.rapports.rapport(ctx, { month, branchId: branchId || undefined, mappedOnly: oui(mappedOnly) });
  }

  @Get('workbook')
  @RequirePermissions('reporting.read')
  @ApiOperation({ summary: 'Rapport mensuel en classeur Excel (colonnes OpenLMIS / LOGIMEV en regard)' })
  async classeur(@Ctx() ctx: RequestContext, @Query('month') month?: string, @Query('branchId') branchId?: string, @Query('mappedOnly') mappedOnly?: string) {
    const { fichier, mois } = await this.rapports.classeur(ctx, { month, branchId: branchId || undefined, mappedOnly: oui(mappedOnly) });
    return new StreamableFile(fichier, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="rapport-mensuel-stock-${mois}.xlsx"`,
      length: fichier.length,
    });
  }

  @Get('dhis2')
  @RequirePermissions('reporting.read')
  @ApiOperation({ summary: 'Fichier DHIS2 dataValueSets (JSON) à importer dans l’application Import/Export' })
  async dhis2(@Ctx() ctx: RequestContext, @Query('month') month?: string, @Query('branchId') branchId?: string, @Query('download') download?: string) {
    const r = await this.rapports.dhis2(ctx, { month, branchId: branchId || undefined });
    if (!oui(download)) return r;
    const contenu = Buffer.from(JSON.stringify(r.fichier, null, 2), 'utf8');
    return new StreamableFile(contenu, {
      type: 'application/json',
      disposition: `attachment; filename="dhis2-${r.mois}.json"`,
      length: contenu.length,
    });
  }

  @Get('settings')
  @RequirePermissions('reporting.read')
  @ApiOperation({ summary: 'Codes de la structure pour les programmes publics' })
  reglages(@Ctx() ctx: RequestContext) {
    return this.rapports.reglages(ctx);
  }

  @Put('settings')
  @RequirePermissions('settings.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Enregistrer les codes de la structure' })
  reglerReglages(@Ctx() ctx: RequestContext, @Body() dto: ReglagesDto) {
    return this.rapports.reglerReglages(ctx, dto);
  }

  @Get('mappings')
  @RequirePermissions('reporting.read')
  @ApiOperation({ summary: 'Codes nationaux et éléments DHIS2 des produits' })
  correspondances(@Ctx() ctx: RequestContext) {
    return this.rapports.correspondances(ctx);
  }

  @Put('mappings/:productId')
  @RequirePermissions('settings.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Relier un produit à son code national et à ses éléments DHIS2' })
  reglerCorrespondance(@Ctx() ctx: RequestContext, @Param('productId', ParseUUIDPipe) productId: string, @Body() dto: CorrespondanceDto) {
    return this.rapports.reglerCorrespondance(ctx, productId, dto);
  }

  @Post('mappings/import')
  @RequirePermissions('settings.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Importer les correspondances (CSV séparé par des points-virgules)' })
  importer(@Ctx() ctx: RequestContext, @Body() dto: ImportDto) {
    return this.rapports.importer(ctx, dto.csv);
  }
}
