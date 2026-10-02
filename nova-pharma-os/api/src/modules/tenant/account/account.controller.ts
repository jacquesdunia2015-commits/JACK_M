import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, RequirePermissions, WriteOperation } from '../../../common/auth/decorators';
import { DatabaseService } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';
import { EntitlementsService } from '../../../common/entitlements/entitlements.service';
import { BillingService } from '../../platform/billing/billing.service';
import { CreateTicketDto, SatisfactionDto, TicketMessageDto } from '../../platform/support/dto';
import { SupportService } from '../../platform/support/support.service';
import { SubscriptionsService } from '../../platform/subscriptions/subscriptions.service';

/**
 * Espace « Mon abonnement » de la pharmacie : ce que le client voit de
 * sa relation avec NOVA PHARMA OS — forfait, consommation des quotas,
 * factures, support et accès accordés à l'éditeur.
 */
@ApiTags('Espace pharmacie')
@Controller('account')
export class AccountController {
  constructor(
    private readonly db: DatabaseService,
    private readonly subscriptions: SubscriptionsService,
    private readonly billing: BillingService,
    private readonly support: SupportService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get('subscription')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'Mon abonnement, mes options et mes factures' })
  subscription(@Ctx() ctx: RequestContext) {
    return this.subscriptions.selfView(ctx);
  }

  @Get('usage')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'Consommation des quotas du forfait' })
  usage(@Ctx() ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      this.entitlements.summary(tx, ctx.organizationId as string),
    );
  }

  @Get('invoices')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: "Mes factures d'abonnement" })
  invoices(@Ctx() ctx: RequestContext) {
    return this.billing.myInvoices(ctx);
  }

  @Get('invoices/:id')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'Détail d’une facture d’abonnement' })
  invoice(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.billing.getInvoice(ctx, id);
  }

  // ---------------- Support ----------------

  @Get('support/tickets')
  @RequirePermissions('support.read')
  @ApiOperation({ summary: 'Mes tickets de support' })
  tickets(@Ctx() ctx: RequestContext, @Query('status') status?: string) {
    return this.support.listTickets(ctx, { status });
  }

  @Post('support/tickets')
  @RequirePermissions('support.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Ouvrir un ticket' })
  createTicket(@Ctx() ctx: RequestContext, @Body() dto: CreateTicketDto) {
    return this.support.createTicket(ctx, dto);
  }

  @Get('support/tickets/:id')
  @RequirePermissions('support.read')
  @ApiOperation({ summary: 'Suivi d’un ticket' })
  ticket(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.support.getTicket(ctx, id);
  }

  @Post('support/tickets/:id/messages')
  @RequirePermissions('support.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Répondre sur un ticket' })
  reply(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: TicketMessageDto,
  ) {
    return this.support.addMessage(ctx, id, dto);
  }

  @Post('support/tickets/:id/satisfaction')
  @RequirePermissions('support.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Évaluer la résolution' })
  rate(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: SatisfactionDto,
  ) {
    return this.support.rateTicket(ctx, id, dto);
  }

  @Get('support/knowledge-base')
  @RequirePermissions('support.read')
  @ApiOperation({ summary: 'Base de connaissances et tutoriels' })
  knowledgeBase(
    @Ctx() ctx: RequestContext,
    @Query('q') q?: string,
    @Query('locale') locale?: string,
  ) {
    return this.support.knowledgeBase(ctx, q, locale ?? 'fr');
  }

  @Get('support/knowledge-base/:slug')
  @RequirePermissions('support.read')
  @ApiOperation({ summary: 'Lire un article' })
  article(@Ctx() ctx: RequestContext, @Param('slug') slug: string) {
    return this.support.article(ctx, slug);
  }

  @Get('support/incidents')
  @RequirePermissions('support.read')
  @ApiOperation({ summary: 'État des incidents de la plateforme' })
  incidents(@Ctx() ctx: RequestContext) {
    return this.support.incidents(ctx);
  }

  // ---------------- Accès du support à mes données ----------------

  @Get('support-access')
  @RequirePermissions('support.read')
  @ApiOperation({
    summary: 'Accès accordés au support NOVA PHARMA OS',
    description:
      'Demandes en attente, accès actifs et historique complet des interventions.',
  })
  accessGrants(@Ctx() ctx: RequestContext) {
    return this.support.accessTrail(ctx);
  }

  @Get('support-access/:id/events')
  @RequirePermissions('support.read')
  @ApiOperation({ summary: 'Actions réalisées par le support sous cet accès' })
  accessEvents(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.support.accessEvents(ctx, id);
  }

  @Post('support-access/:id/approve')
  @RequirePermissions('support.grant_access')
  @WriteOperation()
  @ApiOperation({ summary: 'Autoriser un accès support' })
  approve(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.support.approveAccess(ctx, id);
  }

  @Post('support-access/:id/deny')
  @RequirePermissions('support.grant_access')
  @WriteOperation()
  @ApiOperation({ summary: 'Refuser un accès support' })
  deny(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.support.denyAccess(ctx, id, body?.reason);
  }

  @Post('support-access/:id/revoke')
  @RequirePermissions('support.grant_access')
  @WriteOperation()
  @ApiOperation({ summary: 'Révoquer un accès support en cours' })
  revoke(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.support.revokeAccess(ctx, id, body?.reason);
  }

  // ---------------- Notifications ----------------

  @Get('notifications')
  @ApiOperation({ summary: 'Mes notifications' })
  notifications(@Ctx() ctx: RequestContext) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT id, category, severity, title, body, payload, status, created_at, read_at
           FROM notifications
          WHERE channel = 'in_app'
            AND (user_id IS NULL OR user_id = $1)
          ORDER BY created_at DESC LIMIT 100`,
        [ctx.actorId],
      ),
    );
  }

  @Post('notifications/:id/read')
  @WriteOperation()
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  markRead(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.db.transaction(ctx, (tx) =>
      tx.oneOrFail(
        `UPDATE notifications SET status = 'read', read_at = now()
          WHERE id = $1 RETURNING id, status`,
        [id],
        'Notification introuvable.',
      ),
    );
  }
}
