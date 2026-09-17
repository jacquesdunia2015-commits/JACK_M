import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, PlatformRoles } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { PlatformUsersService } from './platform-users.service';

@ApiTags('Back-office SaaS')
@Controller('platform/users')
@PlatformRoles('super_admin')
export class PlatformUsersController {
  constructor(private readonly users: PlatformUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Utilisateurs internes NOVA PHARMA OS' })
  list(@Ctx() ctx: RequestContext) {
    return this.users.list(ctx);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un utilisateur interne' })
  create(
    @Ctx() ctx: RequestContext,
    @Body() body: { email: string; fullName: string; password: string; role: string },
  ) {
    return this.users.create(ctx, body);
  }

  @Post(':id/activation')
  @ApiOperation({ summary: 'Activer ou désactiver un utilisateur interne' })
  setActive(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.users.setActive(ctx, id, body.isActive);
  }

  @Post(':id/password')
  @ApiOperation({ summary: "Réinitialiser le mot de passe d'un utilisateur interne" })
  resetPassword(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { newPassword: string },
  ) {
    return this.users.resetPassword(ctx, id, body.newPassword);
  }
}
