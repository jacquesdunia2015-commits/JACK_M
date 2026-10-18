import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { Canal, DemandeEnvoi, MessagingService } from './messaging.service';

@ApiTags('Espace pharmacie')
@Controller('messaging')
@RequireModule('messaging')
export class MessagingController {
  constructor(private readonly messagerie: MessagingService) {}

  @Get('settings')
  @RequirePermissions('messaging.read')
  @ApiOperation({ summary: "Mode d'envoi SMS et WhatsApp" })
  reglages(@Ctx() ctx: RequestContext) {
    return this.messagerie.reglages(ctx);
  }

  @Put('settings')
  @RequirePermissions('messaging.write')
  @WriteOperation()
  @ApiOperation({
    summary: "Changer le mode d'envoi",
    description:
      '« manual » produit un lien à ouvrir depuis le téléphone du vendeur ' +
      "et n'entraîne aucun frais ; « gateway » appelle une passerelle payante.",
  })
  majReglages(
    @Ctx() ctx: RequestContext,
    @Body()
    body: {
      smsMode?: string; whatsappMode?: string; senderName?: string;
      gatewayUrl?: string; gatewayToken?: string; defaultCountryCode?: string;
    },
  ) {
    return this.messagerie.majReglages(ctx, body);
  }

  @Get('templates')
  @RequirePermissions('messaging.read')
  @ApiOperation({ summary: 'Modèles de message' })
  modeles(@Ctx() ctx: RequestContext) {
    return this.messagerie.modeles(ctx);
  }

  @Post('templates')
  @RequirePermissions('messaging.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Créer ou modifier un modèle' })
  enregistrerModele(
    @Ctx() ctx: RequestContext,
    @Body() body: { code: string; channel: Canal; locale?: string; label: string; body: string },
  ) {
    return this.messagerie.enregistrerModele(ctx, body);
  }

  @Get('messages')
  @RequirePermissions('messaging.read')
  @ApiOperation({ summary: 'Journal des messages' })
  journal(
    @Ctx() ctx: RequestContext,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagerie.journal(ctx, status, limit ? Number(limit) : undefined);
  }

  @Post('messages')
  @RequirePermissions('messaging.write')
  @WriteOperation()
  @ApiOperation({
    summary: 'Préparer un message pour un client',
    description:
      'En mode manuel la réponse contient `sendLink` : le lien à ouvrir ' +
      'depuis le téléphone du vendeur pour envoyer réellement le message.',
  })
  envoyer(@Ctx() ctx: RequestContext, @Body() body: DemandeEnvoi) {
    return this.messagerie.envoyer(ctx, body);
  }

  @Post('messages/:id/sent')
  @RequirePermissions('messaging.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Confirmer que le message est parti' })
  confirmer(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.messagerie.confirmerEnvoi(ctx, id);
  }

  @Post('messages/:id/cancel')
  @RequirePermissions('messaging.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Annuler un message non envoyé' })
  annuler(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.messagerie.annuler(ctx, id, body?.reason);
  }
}
