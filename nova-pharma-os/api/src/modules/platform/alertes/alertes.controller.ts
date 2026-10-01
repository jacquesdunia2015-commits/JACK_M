import { Body, Controller, Get, Injectable, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, MaxLength, MinLength,
} from 'class-validator';
import { AuditService } from '../../../common/audit/audit.service';
import { Ctx, PlatformRoles } from '../../../common/auth/decorators';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { BusinessRuleException } from '../../../common/http/exceptions';
import { ACTIONS_ALERTE, SOURCES_ALERTE, TYPES_ALERTE } from '../../tenant/rappels/rappels.service';

class AlerteDto {
  @ApiProperty({ enum: TYPES_ALERTE }) @IsIn(TYPES_ALERTE as unknown as string[]) kind!: string;
  @ApiProperty({ example: 'Rappel du lot P2304 de Paracétamol 500 mg' }) @IsString() @MinLength(4) @MaxLength(200) title!: string;
  @ApiProperty({ example: 'Paracétamol 500 mg comprimés' }) @IsString() @MinLength(2) @MaxLength(200) productName!: string;
  @ApiPropertyOptional({ example: 'paracétamol 500', description: 'Mots qui doivent figurer dans le nom ou la molécule du produit' })
  @IsOptional() @IsString() @MaxLength(200) matchTerms?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) manufacturer?: string;
  @ApiProperty({ type: [String], example: ['P2304', 'P2305'] })
  @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) lotNumbers!: string[];
  @ApiPropertyOptional({ enum: SOURCES_ALERTE }) @IsOptional() @IsIn(SOURCES_ALERTE as unknown as string[]) source?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional({ enum: ACTIONS_ALERTE }) @IsOptional() @IsIn(ACTIONS_ALERTE as unknown as string[]) actionRequired?: string;
  @ApiPropertyOptional({ example: 'CD', nullable: true, description: 'Pays concerné ; null pour toutes les pharmacies' })
  @IsOptional() @IsString() @Length(2, 2) countryCode?: string | null;
}

class EtatDto {
  @ApiProperty() @IsBoolean() isActive!: boolean;
}

@Injectable()
export class AlertesService {
  constructor(private readonly db: DatabaseService, private readonly audit: AuditService) {}

  liste(ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT a.*, u.full_name AS created_by_name
           FROM product_alerts a LEFT JOIN platform_users u ON u.id = a.created_by
          ORDER BY a.is_active DESC, a.published_at DESC LIMIT 200`,
      ),
    );
  }

  publier(ctx: RequestContext, dto: AlerteDto) {
    const lots = [...new Set(dto.lotNumbers.map((l) => l.trim()).filter(Boolean))];
    if (!lots.length && !dto.matchTerms?.trim()) {
      throw new BusinessRuleException('Indiquez les numéros de lot, ou des mots du nom du produit pour une alerte qui vise tous les lots.');
    }
    return this.db.transaction(ctx, async (tx) => {
      const a = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO product_alerts
           (kind, title, product_name, match_terms, manufacturer, lot_numbers, source, reference, description,
            action_required, country_code, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [
          dto.kind, dto.title.trim(), dto.productName.trim(), dto.matchTerms?.trim() || null, dto.manufacturer?.trim() || null,
          lots, dto.source ?? 'autre', dto.reference?.trim() || null, dto.description?.trim() || null,
          dto.actionRequired ?? 'quarantine', dto.countryCode === undefined ? 'CD' : dto.countryCode,
          ctx.actorKind === 'platform_user' ? ctx.actorId : null,
        ],
      );
      await this.audit.record(tx, { action: 'platform.product_alert.published', entity: 'product_alert', entityId: a.id, after: a });
      return a;
    });
  }

  etat(ctx: RequestContext, id: string, actif: boolean) {
    return this.db.transaction(ctx, async (tx) => {
      const a = await tx.oneOrFail('UPDATE product_alerts SET is_active = $2 WHERE id = $1 RETURNING *', [id, actif], 'Alerte introuvable.');
      await this.audit.record(tx, { action: 'platform.product_alert.updated', entity: 'product_alert', entityId: id, after: a });
      return a;
    });
  }
}

@ApiTags('Back-office SaaS')
@Controller('platform/product-alerts')
@PlatformRoles('super_admin', 'support_admin')
export class AlertesController {
  constructor(private readonly alertes: AlertesService) {}

  @Get()
  @ApiOperation({ summary: 'Alertes produits publiées (rappels, falsifiés)' })
  liste(@Ctx() ctx: RequestContext) {
    return this.alertes.liste(ctx);
  }

  @Post()
  @ApiOperation({ summary: 'Publier un rappel de lot ou une alerte produit falsifié à toutes les pharmacies du pays' })
  publier(@Ctx() ctx: RequestContext, @Body() dto: AlerteDto) {
    return this.alertes.publier(ctx, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Retirer ou republier une alerte' })
  etat(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EtatDto) {
    return this.alertes.etat(ctx, id, dto.isActive);
  }
}
