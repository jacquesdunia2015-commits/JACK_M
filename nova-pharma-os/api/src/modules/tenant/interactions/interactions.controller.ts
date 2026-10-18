import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Ctx, PlatformRoles, RequirePermissions } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { InteractionsService, NIVEAUX } from './interactions.service';

class VerificationDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMaxSize(100) @IsUUID('all', { each: true }) productIds!: string[];
  @ApiPropertyOptional({ description: 'Patient : ses traitements suivis sont confrontés au ticket' }) @IsOptional() @IsUUID() customerId?: string;
}

class InteractionDto {
  @ApiProperty({ example: 'warfarine', description: 'Substance (DCI) ou classe (« classe:ains »)' }) @IsString() @MinLength(2) @MaxLength(80) termA!: string;
  @ApiProperty({ example: 'classe:ains' }) @IsString() @MinLength(2) @MaxLength(80) termB!: string;
  @ApiProperty({ enum: NIVEAUX }) @IsIn(NIVEAUX as unknown as string[]) severity!: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(500) effect!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) advice?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) source?: string;
}

class ModifInteractionDto {
  @ApiPropertyOptional({ enum: NIVEAUX }) @IsOptional() @IsIn(NIVEAUX as unknown as string[]) severity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) effect?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) advice?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

class ImportDto {
  @ApiProperty({ description: 'CSV « ; » : terme_a;terme_b;niveau;effet;conduite;source' }) @IsString() @MaxLength(500_000) csv!: string;
}

@ApiTags('Espace pharmacie')
@Controller('interactions')
export class InteractionsController {
  constructor(private readonly interactions: InteractionsService) {}

  @Post('check')
  @RequirePermissions('sales.read')
  @ApiOperation({ summary: 'Interactions entre des produits (et avec les traitements suivis du patient)' })
  verifier(@Ctx() ctx: RequestContext, @Body() dto: VerificationDto) {
    return this.interactions.verifier(ctx, dto.productIds, dto.customerId);
  }

  @Get()
  @RequirePermissions('catalog.read')
  @ApiOperation({ summary: 'Liste de référence des interactions (recherche par substance ou classe)' })
  liste(@Ctx() ctx: RequestContext, @Query('q') q?: string) {
    return this.interactions.liste(ctx, q);
  }
}

@ApiTags('Back-office SaaS')
@Controller('platform/interactions')
@PlatformRoles('super_admin', 'support_admin')
export class PlatformInteractionsController {
  constructor(private readonly interactions: InteractionsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste de référence des interactions' })
  liste(@Ctx() ctx: RequestContext, @Query('q') q?: string) {
    return this.interactions.liste(ctx, q);
  }

  @Post()
  @ApiOperation({ summary: 'Ajouter une interaction' })
  creer(@Ctx() ctx: RequestContext, @Body() dto: InteractionDto) {
    return this.interactions.creer(ctx, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier ou désactiver une interaction' })
  modifier(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ModifInteractionDto) {
    return this.interactions.modifier(ctx, id, dto);
  }

  @Post('import')
  @ApiOperation({ summary: 'Importer une liste CSV (une paire connue est mise à jour)' })
  importer(@Ctx() ctx: RequestContext, @Body() dto: ImportDto) {
    return this.interactions.importer(ctx, dto.csv);
  }
}
