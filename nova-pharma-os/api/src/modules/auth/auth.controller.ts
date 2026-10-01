import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, Public } from '../../common/auth/decorators';
import { RequestContext } from '../../common/database/request-context';
import { AuthService } from './auth.service';
import { ChangePasswordDto, CodeDto, DesactivationDto, LoginDto, RefreshDto } from './dto';

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
  @ApiOperation({ summary: 'Changement de mot de passe (renvoie une session neuve ; les autres sont fermées)' })
  async changePassword(
    @Ctx() ctx: RequestContext,
    @Body() dto: ChangePasswordDto,
    @Req() req: { ip?: string; headers: Record<string, string> },
  ) {
    const tokens = await this.auth.changePassword(ctx, dto.currentPassword, dto.newPassword, {
      ip: req.ip, userAgent: req.headers['user-agent'],
    });
    return { message: 'Mot de passe modifié. Les autres sessions ont été fermées.', ...tokens };
  }

  @Get('2fa')
  @ApiOperation({ summary: 'État de la double authentification du compte' })
  etat2fa(@Ctx() ctx: RequestContext) {
    return this.auth.etatDoubleAuth(ctx);
  }

  @Post('2fa/setup')
  @ApiOperation({ summary: 'Préparer la double authentification : secret et lien du QR code' })
  preparer2fa(@Ctx() ctx: RequestContext) {
    return this.auth.preparerDoubleAuth(ctx);
  }

  @Post('2fa/enable')
  @ApiOperation({ summary: 'Activer la double authentification avec un premier code (renvoie les codes de secours)' })
  activer2fa(@Ctx() ctx: RequestContext, @Body() dto: CodeDto) {
    return this.auth.activerDoubleAuth(ctx, dto.code);
  }

  @Post('2fa/disable')
  @ApiOperation({ summary: 'Désactiver la double authentification (mot de passe et code exigés)' })
  desactiver2fa(@Ctx() ctx: RequestContext, @Body() dto: DesactivationDto) {
    return this.auth.desactiverDoubleAuth(ctx, dto.password, dto.code);
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
