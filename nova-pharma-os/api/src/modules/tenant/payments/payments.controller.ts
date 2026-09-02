import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { DemandeEncaissement, MobileMoneyService } from './mobile-money.service';

@ApiTags('Espace pharmacie')
@Controller('payments/mobile-money')
@RequireModule('payments')
export class PaymentsController {
  constructor(private readonly mobileMoney: MobileMoneyService) {}

  @Get('operators')
  @RequirePermissions('payments.read')
  @ApiOperation({ summary: 'Opérateurs Mobile Money configurés' })
  operateurs(@Ctx() ctx: RequestContext) {
    return this.mobileMoney.operateurs(ctx);
  }

  @Post('operators')
  @RequirePermissions('payments.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Enregistrer un opérateur et son numéro marchand' })
  enregistrerOperateur(
    @Ctx() ctx: RequestContext,
    @Body() body: { code: string; label: string; merchantNumber?: string; ussdPattern?: string },
  ) {
    return this.mobileMoney.enregistrerOperateur(ctx, body);
  }

  @Get()
  @RequirePermissions('payments.read')
  @ApiOperation({ summary: 'Encaissements Mobile Money' })
  liste(
    @Ctx() ctx: RequestContext,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.mobileMoney.liste(ctx, status, limit ? Number(limit) : undefined);
  }

  @Get('reconciliation')
  @RequirePermissions('payments.read')
  @ApiOperation({ summary: 'Rapprochement du jour, par opérateur' })
  rapprochement(@Ctx() ctx: RequestContext) {
    return this.mobileMoney.rapprochement(ctx);
  }

  @Post()
  @RequirePermissions('payments.write')
  @WriteOperation()
  @ApiOperation({
    summary: 'Ouvrir une demande de paiement Mobile Money',
    description:
      "Rend la référence et les instructions à dicter au client. Rien n'est " +
      'encaissé tant que la transaction n\'est pas confirmée.',
  })
  demander(@Ctx() ctx: RequestContext, @Body() body: DemandeEncaissement) {
    return this.mobileMoney.demander(ctx, body);
  }

  @Post(':id/confirm')
  @RequirePermissions('payments.write')
  @WriteOperation()
  @ApiOperation({
    summary: 'Confirmer le versement',
    description:
      "L'identifiant de transaction de l'opérateur est obligatoire et unique : " +
      'un même versement ne peut pas être encaissé deux fois.',
  })
  confirmer(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { operatorReference: string; payerName?: string },
  ) {
    return this.mobileMoney.confirmer(ctx, id, body);
  }

  @Post(':id/fail')
  @RequirePermissions('payments.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Marquer la demande comme non aboutie' })
  echouer(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.mobileMoney.echouer(ctx, id, body?.reason);
  }
}
