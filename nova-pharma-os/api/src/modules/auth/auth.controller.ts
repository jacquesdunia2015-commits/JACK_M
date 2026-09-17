import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, Public } from '../../common/auth/decorators';
import { RequestContext } from '../../common/database/request-context';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto } from './dto';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: "Connexion d'un utilisateur de pharmacie" })
  login(@Body() dto: LoginDto, @Req() req: { ip?: string; headers: Record<string, string> }) {
    return this.auth.login(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('platform/login')
  @ApiOperation({ summary: "Connexion au back-office SaaS NOVA PHARMA OS" })
  loginPlatform(
    @Body() dto: LoginDto,
    @Req() req: { ip?: string; headers: Record<string, string> },
  ) {
    return this.auth.loginPlatform(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Renouvellement du jeton (rotation)' })
  refresh(
    @Body() dto: RefreshDto,
    @Req() req: { ip?: string; headers: Record<string, string> },
  ) {
    return this.auth.refresh(dto.refreshToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('logout')
  @ApiOperation({ summary: 'Déconnexion et révocation des jetons' })
  async logout(@Ctx() ctx: RequestContext, @Body() dto: Partial<RefreshDto>) {
    await this.auth.logout(ctx, dto?.refreshToken);
    return { message: 'Session close.' };
  }

  @Post('password')
  @ApiOperation({ summary: 'Changement de mot de passe' })
  async changePassword(@Ctx() ctx: RequestContext, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(ctx, dto.currentPassword, dto.newPassword);
    return { message: 'Mot de passe modifié. Les autres sessions ont été fermées.' };
  }

  @Get('me')
  @ApiOperation({ summary: 'Contexte de la session courante' })
  me(@Ctx() ctx: RequestContext) {
    return {
      actorId: ctx.actorId,
      actorKind: ctx.actorKind,
      email: ctx.actorLabel,
      organizationId: ctx.organizationId ?? null,
      branchId: ctx.branchId ?? null,
      platform: ctx.platform,
      platformRole: ctx.platformRole ?? null,
      readonly: ctx.readonly,
      permissions: ctx.permissions ?? [],
      modules: ctx.modules ?? [],
      supportGrantId: ctx.supportGrantId ?? null,
    };
  }
}
