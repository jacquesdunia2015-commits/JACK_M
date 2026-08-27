import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, RequirePermissions, WriteOperation } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { TenantAdminService } from './admin.service';

@ApiTags('Espace pharmacie')
@Controller('admin')
export class TenantAdminController {
  constructor(private readonly admin: TenantAdminService) {}

  // ---------------- Branches ----------------

  @Get('branches')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Branches de la pharmacie' })
  branches(@Ctx() ctx: RequestContext) {
    return this.admin.listBranches(ctx);
  }

  @Post('branches')
  @RequirePermissions('settings.write')
  @WriteOperation()
  @ApiOperation({
    summary: 'Créer une branche',
    description: 'Refusé au-delà du nombre de branches inclus au forfait.',
  })
  createBranch(
    @Ctx() ctx: RequestContext,
    @Body()
    body: {
      code: string; name: string; kind?: string; address?: string;
      city?: string; phone?: string; email?: string;
    },
  ) {
    return this.admin.createBranch(ctx, body);
  }

  // ---------------- Utilisateurs ----------------

  @Get('users')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Utilisateurs de la pharmacie' })
  users(@Ctx() ctx: RequestContext) {
    return this.admin.listUsers(ctx);
  }

  @Post('users')
  @RequirePermissions('users.write')
  @WriteOperation()
  @ApiOperation({
    summary: 'Créer un utilisateur',
    description: "Refusé au-delà du nombre d'utilisateurs inclus au forfait.",
  })
  createUser(
    @Ctx() ctx: RequestContext,
    @Body()
    body: {
      email: string; fullName: string; password: string; phone?: string;
      roleCodes?: string[]; branchIds?: string[]; defaultBranchId?: string;
    },
  ) {
    return this.admin.createUser(ctx, body);
  }

  @Post('users/:id/activation')
  @RequirePermissions('users.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Activer ou désactiver un utilisateur' })
  setActive(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.admin.setUserActive(ctx, id, body.isActive);
  }

  @Post('users/:id/roles')
  @RequirePermissions('users.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Attribuer les rôles d’un utilisateur' })
  setRoles(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { roleCodes: string[] },
  ) {
    return this.admin.setUserRoles(ctx, id, body.roleCodes);
  }

  @Post('users/:id/password')
  @RequirePermissions('users.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Réinitialiser le mot de passe d’un utilisateur' })
  resetPassword(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { newPassword: string },
  ) {
    return this.admin.resetUserPassword(ctx, id, body.newPassword);
  }

  // ---------------- Rôles ----------------

  @Get('roles')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Rôles et permissions' })
  roles(@Ctx() ctx: RequestContext) {
    return this.admin.listRoles(ctx);
  }

  @Get('permissions')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Référentiel des permissions' })
  permissions(@Ctx() ctx: RequestContext) {
    return this.admin.listPermissions(ctx);
  }

  @Post('roles')
  @RequirePermissions('users.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Créer ou modifier un rôle' })
  upsertRole(
    @Ctx() ctx: RequestContext,
    @Body()
    body: { code: string; name: string; description?: string; permissions: string[] },
  ) {
    return this.admin.upsertRole(ctx, body);
  }

  // ---------------- Paramètres et audit ----------------

  @Get('settings')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Paramètres de la pharmacie et règles locales' })
  settings(@Ctx() ctx: RequestContext) {
    return this.admin.settings(ctx);
  }

  @Patch('settings')
  @RequirePermissions('settings.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Modifier les paramètres' })
  updateSettings(@Ctx() ctx: RequestContext, @Body() body: Record<string, unknown>) {
    return this.admin.updateSettings(ctx, body);
  }

  @Get('audit-logs')
  @RequirePermissions('audit.read')
  @ApiOperation({
    summary: 'Journal d’audit de la pharmacie',
    description:
      "Inclut les interventions du support NOVA PHARMA OS, identifiées comme telles.",
  })
  auditLogs(
    @Ctx() ctx: RequestContext,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.auditLogs(ctx, {
      action, entity, limit: limit ? Number(limit) : undefined,
    });
  }
}
