import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { MALADIES, TraitementsService } from './traitements.service';

class TraitementDto {
  @ApiProperty() @IsUUID() customerId!: string;
  @ApiProperty() @IsUUID() productId!: string;
  @ApiPropertyOptional({ enum: MALADIES }) @IsOptional() @IsIn(MALADIES as unknown as string[]) condition?: string;
  @ApiProperty({ example: 30, description: 'Jours de traitement couverts par une unité vendue.' })
  @IsNumber() @Min(0.1) @Max(3650) daysPerUnit!: number;
  @ApiPropertyOptional({ default: 3 }) @IsOptional() @IsInt() @Min(0) @Max(30) remindDaysBefore?: number;
  @ApiPropertyOptional({ example: '2026-09-28' }) @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) lastDispensedAt?: string;
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @IsNumber() @Min(0.001) lastQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

class ModificationDto {
  @ApiPropertyOptional({ enum: MALADIES }) @IsOptional() @IsIn(MALADIES as unknown as string[]) condition?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.1) @Max(3650) daysPerUnit?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(30) remindDaysBefore?: number;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) lastDispensedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.001) lastQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

class RappelDto {
  @ApiPropertyOptional({ enum: ['whatsapp', 'sms'], default: 'whatsapp' })
  @IsOptional() @IsIn(['whatsapp', 'sms']) channel?: 'whatsapp' | 'sms';
}

@ApiTags('Espace pharmacie')
@Controller('treatments')
@RequireModule('customers')
export class TraitementsController {
  constructor(private readonly traitements: TraitementsService) {}

  @Get()
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'Traitements suivis ; etat=a_prevenir pour les patients à prévenir' })
  liste(@Ctx() ctx: RequestContext, @Query('etat') etat?: string, @Query('customerId') customerId?: string) {
    return this.traitements.liste(ctx, { etat, customerId });
  }

  @Post()
  @RequirePermissions('customers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Suivre le traitement d’un patient' })
  creer(@Ctx() ctx: RequestContext, @Body() dto: TraitementDto) {
    return this.traitements.creer(ctx, dto);
  }

  @Patch(':id')
  @RequirePermissions('customers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Modifier, arrêter ou reprendre un traitement suivi' })
  modifier(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ModificationDto) {
    return this.traitements.modifier(ctx, id, dto);
  }

  @Post(':id/remind')
  @RequirePermissions('messaging.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Préparer le rappel WhatsApp ou SMS (lien à ouvrir depuis le téléphone)' })
  rappeler(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RappelDto) {
    return this.traitements.rappeler(ctx, id, dto.channel ?? 'whatsapp');
  }
}
