import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { CodesBarresService } from './codes-barres.service';

class CodeBarreInput {
  @ApiProperty({ example: '6001234567890' })
  @IsString() barcode!: string;
}

class CodesInternesInput {
  @ApiPropertyOptional({ description: 'Produits à coder ; par défaut, tout le catalogue actif sans code-barres.' })
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) productIds?: string[];
}

@ApiTags('Espace pharmacie')
@Controller('catalog')
@RequireModule('catalog')
export class CodesBarresController {
  constructor(private readonly codes: CodesBarresService) {}

  @Post('products/:id/barcodes')
  @RequirePermissions('catalog.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Ajouter un code-barres (saisi ou scanné) à un produit' })
  ajouter(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CodeBarreInput) {
    return this.codes.ajouter(ctx, id, dto.barcode);
  }

  @Delete('products/:id/barcodes/:code')
  @RequirePermissions('catalog.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Retirer un code-barres d’un produit' })
  retirer(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Param('code') code: string) {
    return this.codes.retirer(ctx, id, code);
  }

  @Post('barcodes/internal')
  @RequirePermissions('catalog.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Donner un code interne (EAN-13 « 29… ») aux produits sans code-barres' })
  internes(@Ctx() ctx: RequestContext, @Body() dto: CodesInternesInput) {
    return this.codes.codesInternes(ctx, dto.productIds);
  }

  @Get('labels')
  @RequirePermissions('catalog.read')
  @ApiOperation({ summary: 'Données des étiquettes : nom, dosage, prix, code-barres principal' })
  etiquettes(@Ctx() ctx: RequestContext, @Query('ids') ids?: string) {
    const liste = (ids ?? '').split(',').map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/i.test(s));
    return this.codes.etiquettes(ctx, liste.slice(0, 500));
  }
}
