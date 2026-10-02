import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength,
} from 'class-validator';
import { Ctx, RequirePermissions, WriteOperation } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { ACTIONS_ALERTE, RappelsService, SOURCES_ALERTE, TYPES_ALERTE } from './rappels.service';

class RappelDto {
  @ApiProperty({ enum: TYPES_ALERTE }) @IsIn(TYPES_ALERTE as unknown as string[]) kind!: string;
  @ApiProperty({ example: 'Rappel du lot P2304 par le grossiste' }) @IsString() @MinLength(4) @MaxLength(200) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional({ example: 'Paracétamol 500 mg' }) @IsOptional() @IsString() @MaxLength(200) productName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) matchTerms?: string;
  @ApiProperty({ type: [String], example: ['P2304'] }) @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) lotNumbers!: string[];
  @ApiPropertyOptional({ enum: SOURCES_ALERTE }) @IsOptional() @IsIn(SOURCES_ALERTE as unknown as string[]) source?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional({ enum: ACTIONS_ALERTE }) @IsOptional() @IsIn(ACTIONS_ALERTE as unknown as string[]) actionRequired?: string;
  @ApiPropertyOptional({ default: true, description: 'Mettre aussitôt en quarantaine les lots trouvés' })
  @IsOptional() @IsBoolean() quarantineNow?: boolean;
}

class RetraitDto {
  @ApiProperty({ enum: ['destroyed', 'returned'] }) @IsIn(['destroyed', 'returned']) resolution!: 'destroyed' | 'returned';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

class LeveeDto {
  @ApiProperty({ example: 'Le fournisseur confirme que notre lot n’est pas concerné' }) @IsString() @MinLength(5) note!: string;
}

class PrevenirDto {
  @ApiProperty() @IsUUID() customerId!: string;
}

@ApiTags('Espace pharmacie')
@Controller('recalls')
export class RappelsController {
  constructor(private readonly rappels: RappelsService) {}

  @Get()
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Rappels de lots et alertes produits falsifiés, avec le stock concerné' })
  liste(@Ctx() ctx: RequestContext, @Query('status') status?: string) {
    return this.rappels.liste(ctx, status);
  }

  @Get('summary')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Rappels ouverts, avec du stock concerné, non encore en quarantaine' })
  resume(@Ctx() ctx: RequestContext) {
    return this.rappels.resume(ctx);
  }

  @Get(':id')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lots concernés, stock, et clients qui les ont achetés' })
  detail(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.rappels.detail(ctx, id);
  }

  @Post()
  @RequirePermissions('inventory.adjust')
  @WriteOperation()
  @ApiOperation({ summary: 'Enregistrer un rappel reçu (grossiste, fabricant…) ; les lots trouvés passent en quarantaine' })
  creer(@Ctx() ctx: RequestContext, @Body() dto: RappelDto) {
    return this.rappels.creer(ctx, dto);
  }

  @Post(':id/quarantine')
  @RequirePermissions('inventory.adjust')
  @WriteOperation()
  @ApiOperation({ summary: 'Mettre en quarantaine tous les lots concernés' })
  quarantaine(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.rappels.quarantaine(ctx, id);
  }

  @Post(':id/withdraw')
  @RequirePermissions('inventory.adjust')
  @WriteOperation()
  @ApiOperation({ summary: 'Sortir du stock les lots concernés (détruits ou rendus) et clore le rappel' })
  retirer(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RetraitDto) {
    return this.rappels.retirer(ctx, id, dto.resolution, dto.note);
  }

  @Post(':id/release')
  @RequirePermissions('inventory.adjust')
  @WriteOperation()
  @ApiOperation({ summary: 'Fausse alerte : lever la quarantaine et clore le rappel' })
  lever(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LeveeDto) {
    return this.rappels.lever(ctx, id, dto.note);
  }

  @Post(':id/notify')
  @RequirePermissions('messaging.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Préparer le message WhatsApp pour un client qui a acheté un lot concerné' })
  prevenir(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PrevenirDto) {
    return this.rappels.prevenir(ctx, id, dto.customerId);
  }
}
