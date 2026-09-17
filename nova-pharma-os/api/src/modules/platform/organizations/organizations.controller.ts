import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, PlatformRoles } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { BackupsService } from '../backups/backups.service';
import { SupportService } from '../support/support.service';
import { RequestSupportAccessDto } from '../support/dto';
import { AddAddonDto, ChangePlanDto, ChangeStatusDto, ExtendTrialDto } from '../subscriptions/dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  CreateOrganizationDto,
  ListOrganizationsDto,
  SuspendOrganizationDto,
  TerminateOrganizationDto,
  UpdateOrganizationDto,
} from './dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Back-office SaaS')
@Controller('platform/organizations')
@PlatformRoles('super_admin', 'support_admin', 'commercial')
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly support: SupportService,
    private readonly backups: BackupsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lister les pharmacies clientes' })
  list(@Ctx() ctx: RequestContext, @Query() query: ListOrganizationsDto) {
    return this.organizations.list(ctx, query);
  }

  @Post()
  @PlatformRoles('super_admin', 'commercial')
  @ApiOperation({
    summary: 'Créer une pharmacie cliente',
    description:
      "Provisionne en une opération l'organisation, son abonnement (essai gratuit " +
      "par défaut), sa branche principale, les rôles livrés et le compte administrateur.",
  })
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateOrganizationDto) {
    return this.organizations.provision(ctx, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: "Fiche complète d'une pharmacie" })
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.organizations.get(ctx, id);
  }

  @Patch(':id')
  @PlatformRoles('super_admin', 'commercial')
  @ApiOperation({ summary: "Mettre à jour la fiche d'une pharmacie" })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizations.update(ctx, id, dto);
  }

  @Post(':id/suspend')
  @PlatformRoles('super_admin')
  @ApiOperation({
    summary: 'Suspendre une pharmacie',
    description:
      'Les données sont conservées et restent consultables en lecture seule.',
  })
  suspend(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: SuspendOrganizationDto,
  ) {
    return this.organizations.suspend(ctx, id, dto);
  }

  @Post(':id/reactivate')
  @PlatformRoles('super_admin')
  @ApiOperation({ summary: 'Réactiver une pharmacie suspendue' })
  reactivate(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.organizations.reactivate(ctx, id, body?.reason);
  }

  @Post(':id/terminate')
  @PlatformRoles('super_admin')
  @ApiOperation({ summary: "Résilier l'abonnement d'une pharmacie" })
  terminate(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: TerminateOrganizationDto,
  ) {
    return this.organizations.terminate(ctx, id, dto);
  }

  @Delete(':id')
  @PlatformRoles('super_admin')
  @ApiOperation({ summary: 'Archiver une pharmacie (suppression logique)' })
  softDelete(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.organizations.softDelete(ctx, id, body?.reason ?? 'Archivage.');
  }

  @Post(':id/restore')
  @PlatformRoles('super_admin')
  @ApiOperation({ summary: 'Restaurer une pharmacie archivée' })
  restore(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.organizations.restore(ctx, id);
  }

  // ---------------- Abonnement ----------------

  @Post(':id/subscription/plan')
  @PlatformRoles('super_admin', 'commercial')
  @ApiOperation({ summary: 'Attribuer ou modifier le forfait' })
  changePlan(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: ChangePlanDto,
  ) {
    return this.subscriptions.changePlan(ctx, id, dto);
  }

  @Post(':id/subscription/status')
  @PlatformRoles('super_admin')
  @ApiOperation({ summary: "Changer le statut d'abonnement" })
  changeStatus(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.subscriptions.setStatus(ctx, id, dto.status, dto.reason);
  }

  @Post(':id/subscription/trial')
  @PlatformRoles('super_admin', 'commercial')
  @ApiOperation({ summary: "Prolonger l'essai gratuit" })
  extendTrial(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: ExtendTrialDto,
  ) {
    return this.subscriptions.extendTrial(ctx, id, dto);
  }

  @Post(':id/subscription/addons')
  @PlatformRoles('super_admin', 'commercial')
  @ApiOperation({ summary: 'Souscrire une option' })
  addAddon(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: AddAddonDto,
  ) {
    return this.subscriptions.addAddon(ctx, id, dto);
  }

  @Delete(':id/subscription/addons/:addonId')
  @PlatformRoles('super_admin', 'commercial')
  @ApiOperation({ summary: 'Résilier une option' })
  removeAddon(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Param('addonId') addonId: string,
  ) {
    return this.subscriptions.removeAddon(ctx, id, addonId);
  }

  // ---------------- Accès support ----------------

  @Post(':id/support-access')
  @ApiOperation({
    summary: 'Demander un accès temporaire aux données de la pharmacie',
    description:
      'Motif obligatoire, durée limitée, lecture seule par défaut, validation ' +
      'du client requise, révocation automatique à échéance.',
  })
  requestAccess(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: RequestSupportAccessDto,
  ) {
    return this.support.requestAccess(ctx, id, dto);
  }

  @Get(':id/support-access')
  @ApiOperation({ summary: 'Historique des accès support à cette pharmacie' })
  accessTrail(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.support.accessTrail(ctx, id);
  }

  // ---------------- Sauvegardes ----------------

  @Post(':id/backups')
  @PlatformRoles('super_admin')
  @ApiOperation({ summary: 'Sauvegarder cette pharmacie' })
  backup(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.backups.createBackup(ctx, id, 'manual');
  }

  @Get(':id/backups')
  @PlatformRoles('super_admin', 'support_admin')
  @ApiOperation({ summary: 'Sauvegardes disponibles pour cette pharmacie' })
  listBackups(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.backups.list(ctx, id);
  }
}
