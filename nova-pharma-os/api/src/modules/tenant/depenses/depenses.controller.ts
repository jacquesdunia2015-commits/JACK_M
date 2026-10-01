import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean, IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import {
  Ctx, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { CATEGORIES_DEPENSE, DepensesService } from './depenses.service';

class DepenseDto {
  @ApiPropertyOptional({ example: '2026-10-01' }) @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) expenseDate?: string;
  @ApiProperty({ enum: Object.keys(CATEGORIES_DEPENSE) }) @IsIn(Object.keys(CATEGORIES_DEPENSE)) category!: string;
  @ApiProperty({ example: 'Loyer d’octobre' }) @IsString() @MinLength(2) @MaxLength(200) label!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) supplierName?: string;
  @ApiProperty({ example: 250 }) @IsNumber() @Min(0.01) @Max(100_000_000_000) amount!: number;
  @ApiPropertyOptional({ example: 'CDF' }) @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
  @ApiPropertyOptional({ example: 2850, description: 'Taux de la paire (1 USD = … FC). Par défaut, le dernier taux du jour.' })
  @IsOptional() @IsNumber() @Min(0.000001) exchangeRate?: number;
  @ApiPropertyOptional({ example: 0, description: 'TVA portée par la facture du fournisseur (devise de la pharmacie)' })
  @IsOptional() @IsNumber() @Min(0) vatAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() normalizedInvoice?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) normalizedReference?: string;
  @ApiPropertyOptional({ enum: ['cash', 'mobile_money', 'bank', 'card', 'other'] })
  @IsOptional() @IsIn(['cash', 'mobile_money', 'bank', 'card', 'other']) paymentMethod?: string;
  @ApiPropertyOptional({ description: 'Payée en espèces depuis la caisse ouverte' }) @IsOptional() @IsBoolean() fromCash?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

class AnnulationDto {
  @ApiProperty() @IsString() @MinLength(5) reason!: string;
}

class ReglagesDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() vatRegistered?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) defNumber?: string | null;
}

class ReferenceDto {
  @ApiProperty({ nullable: true }) @IsOptional() @IsString() @MaxLength(300) reference!: string | null;
}

@ApiTags('Espace pharmacie')
@Controller()
export class DepensesController {
  constructor(private readonly depenses: DepensesService) {}

  @Get('expenses/categories')
  @RequirePermissions('cash.read')
  @ApiOperation({ summary: 'Catégories de dépenses' })
  categories() {
    return Object.entries(CATEGORIES_DEPENSE).map(([code, label]) => ({ code, label }));
  }

  @Get('expenses')
  @RequirePermissions('cash.read')
  @ApiOperation({ summary: 'Dépenses d’une période (dates AAAA-MM-JJ incluses)' })
  liste(
    @Ctx() ctx: RequestContext, @Query('from') from?: string, @Query('to') to?: string,
    @Query('category') category?: string, @Query('includeCancelled') includeCancelled?: string,
  ) {
    return this.depenses.liste(ctx, { from, to, category, includeCancelled: includeCancelled === 'true' });
  }

  @Post('expenses')
  @RequirePermissions('cash.manage')
  @WriteOperation()
  @ApiOperation({ summary: 'Enregistrer une dépense (éventuellement sortie de la caisse ouverte)' })
  creer(@Ctx() ctx: RequestContext, @Body() dto: DepenseDto) {
    return this.depenses.creer(ctx, dto);
  }

  @Post('expenses/:id/cancel')
  @RequirePermissions('cash.manage')
  @WriteOperation()
  @ApiOperation({ summary: 'Annuler une dépense saisie par erreur' })
  annuler(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AnnulationDto) {
    return this.depenses.annuler(ctx, id, dto.reason);
  }

  @Get('finance/settings')
  @RequirePermissions('reporting.financial')
  @ApiOperation({ summary: 'Régime de TVA et dispositif fiscal de la pharmacie' })
  reglages(@Ctx() ctx: RequestContext) {
    return this.depenses.reglages(ctx);
  }

  @Put('finance/settings')
  @RequirePermissions('settings.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Déclarer l’assujettissement à la TVA et le numéro du dispositif fiscal' })
  regler(@Ctx() ctx: RequestContext, @Body() dto: ReglagesDto) {
    return this.depenses.reglerReglages(ctx, dto);
  }

  @Get('reports/profit')
  @RequirePermissions('reporting.financial')
  @ApiOperation({ summary: 'Bénéfice réel du mois : marge, pertes, points, dépenses ; TVA si assujetti' })
  benefice(@Ctx() ctx: RequestContext, @Query('month') month?: string) {
    return this.depenses.benefice(ctx, month);
  }

  @Put('sales/:id/normalized-reference')
  @RequirePermissions('sales.create')
  @WriteOperation()
  @ApiOperation({ summary: 'Noter la référence de la facture normalisée émise par le dispositif fiscal' })
  reference(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReferenceDto) {
    return this.depenses.referenceNormalisee(ctx, id, dto.reference ?? null);
  }
}
