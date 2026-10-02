import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import {
  Ctx, Public, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { SmsMobileMoneyService } from './sms-mobile-money.service';

class SmsDto {
  @ApiProperty({ example: 'Vous avez reçu 25 000 FC de 0991234567. ID de transaction : 8J3K2L1M9P' })
  @IsString() @MinLength(10) @MaxLength(2000) text!: string;
}

class SmsTransfereDto {
  // Les applications de transfert envoient le texte sous des noms variés.
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) text?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) message?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) body?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) from?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) sender?: string;
}

class AssocierDto {
  @ApiProperty() @IsUUID() collectionId!: string;
}

@ApiTags('Espace pharmacie')
@Controller('payments/mobile-money')
@RequireModule('payments')
export class SmsMobileMoneyController {
  constructor(private readonly sms: SmsMobileMoneyService) {}

  @Post('sms/analyse')
  @RequirePermissions('payments.read')
  @ApiOperation({ summary: 'Lire un SMS d’opérateur et proposer les versements attendus qu’il confirme' })
  analyser(@Ctx() ctx: RequestContext, @Body() dto: SmsDto) {
    return this.sms.analyser(ctx, dto.text);
  }

  @Post(':id/confirm-sms')
  @RequirePermissions('payments.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Confirmer un versement avec le SMS de l’opérateur (montant vérifié)' })
  confirmer(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SmsDto) {
    return this.sms.confirmerParSms(ctx, id, dto.text);
  }

  @Get('sms')
  @RequirePermissions('payments.read')
  @ApiOperation({ summary: 'SMS reçus (status=unmatched pour ceux à examiner)' })
  boite(@Ctx() ctx: RequestContext, @Query('status') status?: string) {
    return this.sms.boite(ctx, status);
  }

  @Post('sms/:id/match')
  @RequirePermissions('payments.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Rapprocher un SMS en attente d’un versement attendu' })
  associer(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssocierDto) {
    return this.sms.associer(ctx, id, dto.collectionId);
  }

  @Post('sms/:id/ignore')
  @RequirePermissions('payments.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Écarter un SMS sans rapport' })
  ignorer(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.sms.ignorer(ctx, id);
  }

  @Get('sms-link')
  @RequirePermissions('payments.read')
  @ApiOperation({ summary: 'État du lien de transfert automatique des SMS' })
  lien(@Ctx() ctx: RequestContext) {
    return this.sms.lien(ctx);
  }

  @Post('sms-link')
  @RequirePermissions('settings.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Créer (ou remplacer) le lien secret de transfert des SMS — montré une seule fois' })
  generer(@Ctx() ctx: RequestContext) {
    return this.sms.genererLien(ctx);
  }

  @Delete('sms-link')
  @RequirePermissions('settings.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Couper le transfert automatique des SMS' })
  async couper(@Ctx() ctx: RequestContext) {
    await this.sms.desactiverLien(ctx);
    return { active: false };
  }
}

/** Point d'arrivée des SMS transférés par le téléphone marchand (lien secret, sans compte). */
@ApiTags('Page publique')
@Controller('public/mobile-money')
export class SmsTransfertController {
  constructor(private readonly sms: SmsMobileMoneyService) {}

  @Public()
  @Post('sms/:token')
  @ApiOperation({ summary: 'Recevoir un SMS d’opérateur transféré par le téléphone marchand' })
  recevoir(@Param('token') token: string, @Body() dto: SmsTransfereDto) {
    return this.sms.recevoir(token, dto.text ?? dto.message ?? dto.body ?? '', dto.from ?? dto.sender);
  }
}
