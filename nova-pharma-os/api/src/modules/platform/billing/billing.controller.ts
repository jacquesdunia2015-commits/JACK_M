import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, PlatformRoles } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { BillingService } from './billing.service';
import {
  CreditNoteDto,
  GenerateInvoiceDto,
  ListInvoicesDto,
  RecordPaymentDto,
} from './dto';

@ApiTags('Back-office SaaS')
@Controller('platform/billing')
@PlatformRoles('super_admin', 'commercial', 'support_admin')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('invoices')
  @ApiOperation({ summary: "Factures d'abonnement" })
  list(@Ctx() ctx: RequestContext, @Query() query: ListInvoicesDto) {
    return this.billing.listInvoices(ctx, query);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Détail d’une facture SaaS' })
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.billing.getInvoice(ctx, id);
  }

  @Post('organizations/:organizationId/invoices')
  @PlatformRoles('super_admin', 'commercial')
  @ApiOperation({ summary: "Émettre la facture d'abonnement de la période" })
  generate(
    @Ctx() ctx: RequestContext,
    @Param('organizationId') organizationId: string,
    @Body() dto: GenerateInvoiceDto,
  ) {
    return this.billing.generateInvoiceForOrganization(ctx, organizationId, dto);
  }

  @Post('organizations/:organizationId/quotes')
  @PlatformRoles('super_admin', 'commercial')
  @ApiOperation({ summary: 'Établir un devis SaaS' })
  quote(
    @Ctx() ctx: RequestContext,
    @Param('organizationId') organizationId: string,
    @Body() body: { planCode: string },
  ) {
    return this.billing.createQuote(ctx, organizationId, body.planCode);
  }

  @Post('organizations/:organizationId/payments')
  @PlatformRoles('super_admin', 'commercial')
  @ApiOperation({
    summary: "Enregistrer un règlement d'abonnement",
    description:
      "Rapproché de la facture ; réactive automatiquement une pharmacie suspendue " +
      'lorsque plus aucune facture ne reste impayée.',
  })
  pay(
    @Ctx() ctx: RequestContext,
    @Param('organizationId') organizationId: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.billing.recordPayment(ctx, organizationId, dto);
  }

  @Post('credit-notes')
  @PlatformRoles('super_admin')
  @ApiOperation({ summary: 'Émettre une note de crédit (avoir)' })
  creditNote(@Ctx() ctx: RequestContext, @Body() dto: CreditNoteDto) {
    return this.billing.createCreditNote(ctx, dto);
  }
}
