import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
  MinLength, ValidateNested,
} from 'class-validator';
import { Ctx, Public, RequirePermissions, WriteOperation } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { ReservationsService } from './reservations.service';

class LigneDto {
  @ApiProperty() @IsUUID() productId!: string;
  @ApiProperty({ example: 1 }) @IsInt() @Min(1) @Max(99) quantity!: number;
}

class ReservationDto {
  @ApiProperty({ example: 'Maman Furaha' }) @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @ApiProperty({ example: '0991234567' }) @IsString() @MinLength(6) @MaxLength(20) phone!: string;
  @ApiPropertyOptional({ type: [LigneDto] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => LigneDto) lines?: LigneDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) message?: string;
  @ApiPropertyOptional({ example: 'Ce soir après 17 h' }) @IsOptional() @IsString() @MaxLength(100) pickup?: string;
  @ApiPropertyOptional({ description: 'Photo de l’ordonnance (data URL JPEG ou PNG, 2,5 Mo au plus)' })
  @IsOptional() @IsString() @MaxLength(3_500_000) prescriptionPhoto?: string;
  @ApiPropertyOptional({ description: 'Champ piège : laisser vide' }) @IsOptional() @IsString() website?: string;
}

class ProfilDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) headline?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1500) description?: string | null;
  @ApiPropertyOptional({ example: 'Lun–Sam 7 h 30–21 h · Dim 9 h–13 h' }) @IsOptional() @IsString() @MaxLength(300) openingHours?: string | null;
  @ApiPropertyOptional({ example: 'En face du marché de Virunga' }) @IsOptional() @IsString() @MaxLength(200) addressHint?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) whatsapp?: string | null;
  @ApiPropertyOptional({ example: 'De garde ce week-end' }) @IsOptional() @IsString() @MaxLength(200) onDutyNote?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showPrices?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() acceptReservations?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() acceptPrescriptions?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number | null;
}

class StatutDto {
  @ApiProperty({ enum: ['confirmed', 'ready', 'collected', 'cancelled'] }) @IsIn(['confirmed', 'ready', 'collected', 'cancelled']) status!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class MessageDto {
  @ApiPropertyOptional({ description: 'Texte libre ; par défaut, « reçue » ou « prête » selon le statut' })
  @IsOptional() @IsString() @MaxLength(1000) text?: string;
}

/** Page publique d'une pharmacie : sans compte, sans jeton. */
@ApiTags('Page publique')
@Controller('public/pharmacies')
export class PagePubliqueController {
  constructor(private readonly reservations: ReservationsService) {}

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Fiche publique de la pharmacie (si publiée)' })
  page(@Param('slug') slug: string) {
    return this.reservations.pagePublique(slug);
  }

  @Public()
  @Get(':slug/products')
  @ApiOperation({ summary: 'Médicaments : disponible ou sur commande (jamais les quantités)' })
  produits(@Param('slug') slug: string, @Query('q') q: string) {
    return this.reservations.produitsPublics(slug, q);
  }

  @Public()
  @Post(':slug/reservations')
  @ApiOperation({ summary: 'Réserver des médicaments ou envoyer la photo de son ordonnance' })
  reserver(@Param('slug') slug: string, @Body() dto: ReservationDto) {
    return this.reservations.reserver(slug, dto);
  }

  @Public()
  @Get(':slug/reservations/:number')
  @ApiOperation({ summary: 'Suivre sa demande (numéro et téléphone)' })
  suivi(@Param('slug') slug: string, @Param('number') numero: string, @Query('phone') phone: string) {
    return this.reservations.suivi(slug, numero, phone);
  }
}

@ApiTags('Espace pharmacie')
@Controller()
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get('public-profile')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Réglages de la page publique' })
  profil(@Ctx() ctx: RequestContext) {
    return this.reservations.profil(ctx);
  }

  @Put('public-profile')
  @RequirePermissions('settings.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Publier et régler la page publique' })
  reglerProfil(@Ctx() ctx: RequestContext, @Body() dto: ProfilDto) {
    return this.reservations.reglerProfil(ctx, dto);
  }

  @Get('reservations')
  @RequirePermissions('sales.read')
  @ApiOperation({ summary: 'Réservations en cours (status=all pour toutes)' })
  liste(@Ctx() ctx: RequestContext, @Query('status') status?: string) {
    return this.reservations.liste(ctx, status);
  }

  @Get('reservations/summary')
  @RequirePermissions('sales.read')
  @ApiOperation({ summary: 'Nouvelles réservations et commandes prêtes' })
  resume(@Ctx() ctx: RequestContext) {
    return this.reservations.resume(ctx);
  }

  @Get('reservations/:id/prescription')
  @RequirePermissions('sales.read')
  @ApiOperation({ summary: "Photo de l'ordonnance jointe" })
  async photo(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Res() res: { setHeader: (k: string, v: string) => void; send: (b: Buffer) => void }) {
    const f = await this.reservations.photo(ctx, id);
    res.setHeader('Content-Type', f.content_type);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(f.data);
  }

  @Post('reservations/:id/status')
  @RequirePermissions('sales.create')
  @WriteOperation()
  @ApiOperation({ summary: 'Confirmer, marquer prête, retirée ou annulée' })
  statut(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatutDto) {
    return this.reservations.changerStatut(ctx, id, dto.status, dto.note);
  }

  @Post('reservations/:id/notify')
  @RequirePermissions('messaging.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Préparer le message WhatsApp au client (lien wa.me gratuit)' })
  prevenir(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MessageDto) {
    return this.reservations.prevenir(ctx, id, dto.text);
  }
}
