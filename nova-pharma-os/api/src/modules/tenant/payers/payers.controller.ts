import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import {
  ClaimInput, ClaimPaymentInput, MemberInput, MemberUpdate, PayerInput, PayerUpdate,
} from './dto';
import { PayersService } from './payers.service';

@ApiTags('Espace pharmacie')
@Controller('payers')
@RequireModule('sales')
export class PayersController {
  constructor(private readonly payers: PayersService) {}

  @Get()
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'Organismes payeurs (assurances, mutuelles, conventions) et ce qu’ils doivent' })
  list(@Ctx() ctx: RequestContext, @Query('search') search?: string) {
    return this.payers.list(ctx, search);
  }

  @Post()
  @RequirePermissions('customers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Enregistrer un organisme payeur' })
  create(@Ctx() ctx: RequestContext, @Body() dto: PayerInput) {
    return this.payers.create(ctx, dto);
  }

  @Get('members')
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'Rechercher un bénéficiaire (nom, carte, matricule, téléphone)' })
  members(@Ctx() ctx: RequestContext, @Query('q') q?: string, @Query('payerId') payerId?: string) {
    return this.payers.searchMembers(ctx, q, payerId);
  }

  @Get('members/:id/coverage')
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'Partage d’un montant entre le payeur et le patient (aperçu)' })
  coverage(
    @Ctx() ctx: RequestContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('amount') amount: string,
  ) {
    return this.payers.apercu(ctx, id, Number(amount) || 0);
  }

  @Patch('members/:id')
  @RequirePermissions('customers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Modifier un bénéficiaire' })
  updateMember(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MemberUpdate) {
    return this.payers.updateMember(ctx, id, dto);
  }

  @Get('claims')
  @RequirePermissions('customers.credit')
  @ApiOperation({ summary: 'Relevés présentés aux payeurs' })
  claims(@Ctx() ctx: RequestContext, @Query('payerId') payerId?: string) {
    return this.payers.listClaims(ctx, payerId);
  }

  @Post('claims')
  @RequirePermissions('customers.credit')
  @WriteOperation()
  @ApiOperation({ summary: 'Établir le relevé d’un payeur pour une période' })
  createClaim(@Ctx() ctx: RequestContext, @Body() dto: ClaimInput) {
    return this.payers.createClaim(ctx, dto);
  }

  @Get('claims/:id')
  @RequirePermissions('customers.credit')
  @ApiOperation({ summary: 'Relevé : ventes, règlements' })
  claim(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.payers.getClaim(ctx, id);
  }

  @Get('claims/:id/pdf')
  @RequirePermissions('customers.credit')
  @ApiOperation({ summary: 'Relevé en PDF, au logo de la pharmacie' })
  async claimPdf(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    const { fichier, nom } = await this.payers.claimPdf(ctx, id);
    return new StreamableFile(fichier, {
      type: 'application/pdf',
      disposition: `inline; filename="${nom}"`,
      length: fichier.length,
    });
  }

  @Post('claims/:id/send')
  @RequirePermissions('customers.credit')
  @WriteOperation()
  @ApiOperation({ summary: 'Marquer le relevé comme présenté au payeur' })
  send(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.payers.markSent(ctx, id);
  }

  @Post('claims/:id/payments')
  @RequirePermissions('customers.credit')
  @WriteOperation()
  @ApiOperation({ summary: 'Enregistrer un règlement du payeur' })
  pay(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ClaimPaymentInput) {
    return this.payers.recordPayment(ctx, id, dto);
  }

  @Post('claims/:id/cancel')
  @RequirePermissions('customers.credit')
  @WriteOperation()
  @ApiOperation({ summary: 'Annuler un relevé non réglé (ses ventes redeviennent à présenter)' })
  cancelClaim(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.payers.cancelClaim(ctx, id);
  }

  @Get(':id')
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'Organisme : bénéficiaires, relevés, ventes à présenter' })
  get(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.payers.get(ctx, id);
  }

  @Patch(':id')
  @RequirePermissions('customers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Modifier un organisme payeur' })
  update(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PayerUpdate) {
    return this.payers.update(ctx, id, dto);
  }

  @Post(':id/members')
  @RequirePermissions('customers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Ajouter un bénéficiaire (carte ou matricule)' })
  addMember(@Ctx() ctx: RequestContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MemberInput) {
    return this.payers.addMember(ctx, id, dto);
  }
}
