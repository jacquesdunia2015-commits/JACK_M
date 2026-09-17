import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, PlatformRoles } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { TicketMessageDto, UpdateTicketDto } from './dto';
import { SupportService } from './support.service';

@ApiTags('Back-office SaaS')
@Controller('platform/support')
@PlatformRoles('super_admin', 'support_admin', 'commercial')
export class PlatformSupportController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets')
  @ApiOperation({ summary: 'Tickets de support, toutes pharmacies' })
  tickets(
    @Ctx() ctx: RequestContext,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.support.listTickets(ctx, { status, priority, organizationId });
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Détail d’un ticket, notes internes comprises' })
  ticket(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.support.getTicket(ctx, id);
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Répondre à un ticket' })
  reply(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: TicketMessageDto,
  ) {
    return this.support.addMessage(ctx, id, dto);
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Mettre à jour un ticket (statut, priorité, affectation)' })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.support.updateTicket(ctx, id, dto);
  }

  @Get('access-grants')
  @ApiOperation({ summary: 'Accès support accordés' })
  grants(@Ctx() ctx: RequestContext, @Query('organizationId') organizationId?: string) {
    return this.support.accessTrail(ctx, organizationId);
  }

  @Post('access-grants/:id/session')
  @ApiOperation({
    summary: "Ouvrir une session d'intervention",
    description:
      "Délivre un jeton limité à la pharmacie et à la durée de l'accès accordé. " +
      'Toutes les actions réalisées avec ce jeton sont journalisées.',
  })
  openSession(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.support.openSession(ctx, id);
  }

  @Post('access-grants/:id/revoke')
  @ApiOperation({ summary: 'Révoquer un accès support' })
  revoke(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.support.revokeAccess(ctx, id, body?.reason);
  }

  @Get('access-grants/:id/events')
  @ApiOperation({ summary: 'Journal détaillé des actions réalisées sous cet accès' })
  events(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.support.accessEvents(ctx, id);
  }
}
