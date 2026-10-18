import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf,
} from 'class-validator';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { FideliteService } from './fidelite.service';

class ProgrammeDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isEnabled?: boolean;
  @ApiPropertyOptional({ example: 1, description: 'Points gagnés par unité de devise payée' })
  @IsOptional() @IsNumber() @Min(0) @Max(1000) pointsPerUnit?: number;
  @ApiPropertyOptional({ example: 0.05, description: "Valeur d'un point utilisé" })
  @IsOptional() @IsNumber() @Min(0.0001) @Max(1000) pointValue?: number;
  @ApiPropertyOptional({ example: 100 }) @IsOptional() @IsInt() @Min(0) minRedeemPoints?: number;
  @ApiPropertyOptional({ example: 50 }) @IsOptional() @IsNumber() @Min(1) @Max(100) maxRedeemPercent?: number;
  @ApiPropertyOptional({ example: 0 }) @IsOptional() @IsInt() @Min(0) @Max(100000) welcomePoints?: number;
}

class AjustementDto {
  @ApiProperty({ example: 50, description: 'Positif pour offrir, négatif pour retirer' }) @IsInt() points!: number;
  @ApiProperty({ example: 'Geste commercial' }) @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}

class CategorieDto {
  @ApiProperty({ example: 'Personnel' }) @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @ApiProperty({ example: 10 }) @IsNumber() @Min(0) @Max(100) discountPercent!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

class ModifCategorieDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) discountPercent?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

class ClassementDto {
  @ApiProperty({ nullable: true }) @ValidateIf((_, v) => v !== null) @IsUUID() groupId!: string | null;
}

@ApiTags('Espace pharmacie')
@Controller('loyalty')
@RequireModule('customers')
export class FideliteController {
  constructor(private readonly fidelite: FideliteService) {}

  @Get('program')
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'Réglages du programme de fidélité et points en circulation' })
  programme(@Ctx() ctx: RequestContext) {
    return this.fidelite.programme(ctx);
  }

  @Put('program')
  @RequirePermissions('customers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Activer et régler le programme de fidélité' })
  regler(@Ctx() ctx: RequestContext, @Body() dto: ProgrammeDto) {
    return this.fidelite.reglerProgramme(ctx, {
      is_enabled: dto.isEnabled, points_per_unit: dto.pointsPerUnit, point_value: dto.pointValue,
      min_redeem_points: dto.minRedeemPoints, max_redeem_percent: dto.maxRedeemPercent, welcome_points: dto.welcomePoints,
    });
  }

  @Get('dashboard')
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'Meilleurs clients par points et derniers mouvements' })
  tableau(@Ctx() ctx: RequestContext) {
    return this.fidelite.tableau(ctx);
  }

  @Get('customers/:id')
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: "Solde de points d'un client et ses mouvements" })
  client(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.fidelite.client(ctx, id);
  }

  @Get('customers/:id/quote')
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'À la caisse : combien de points ce client peut utiliser sur ce montant' })
  apercu(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Query('amount') amount?: string) {
    return this.fidelite.apercu(ctx, id, Number(amount) || 0);
  }

  @Post('customers/:id/adjust')
  @RequirePermissions('customers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Offrir ou retirer des points, avec un motif' })
  ajuster(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AjustementDto) {
    return this.fidelite.ajuster(ctx, id, dto.points, dto.reason);
  }

  @Get('groups')
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'Catégories de clients et leur remise' })
  categories(@Ctx() ctx: RequestContext) {
    return this.fidelite.categories(ctx);
  }

  @Post('groups')
  @RequirePermissions('customers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Créer une catégorie de clients avec remise permanente' })
  creerCategorie(@Ctx() ctx: RequestContext, @Body() dto: CategorieDto) {
    return this.fidelite.creerCategorie(ctx, dto);
  }

  @Patch('groups/:id')
  @RequirePermissions('customers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Modifier ou désactiver une catégorie' })
  modifierCategorie(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ModifCategorieDto) {
    return this.fidelite.modifierCategorie(ctx, id, dto);
  }

  @Put('customers/:id/group')
  @RequirePermissions('customers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Ranger un client dans une catégorie (null pour l’en sortir)' })
  classer(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ClassementDto) {
    return this.fidelite.classer(ctx, id, dto.groupId);
  }
}
