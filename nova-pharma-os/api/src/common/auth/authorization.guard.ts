import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContext } from '../database/request-context';
import { PlanLimitException } from '../http/exceptions';
import {
  MODULE_KEY,
  PERMISSIONS_KEY,
  PLATFORM_ROLES_KEY,
  PUBLIC_KEY,
  WRITE_KEY,
} from './decorators';

/**
 * Vérifie, dans l'ordre : le rôle interne, les permissions pharmacie,
 * l'activation du module par le forfait, puis le caractère écrivable
 * du contexte.
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const ctx: RequestContext | undefined = request.novaContext;
    if (!ctx) throw new UnauthorizedException('Contexte non résolu.');

    const targets = [context.getHandler(), context.getClass()];
    const platformRoles = this.reflector.getAllAndOverride<string[]>(
      PLATFORM_ROLES_KEY,
      targets,
    );
    const permissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      targets,
    );
    const moduleCode = this.reflector.getAllAndOverride<string>(MODULE_KEY, targets);
    const isWrite = this.reflector.getAllAndOverride<boolean>(WRITE_KEY, targets);

    if (platformRoles?.length) {
      if (ctx.actorKind !== 'platform_user') {
        throw new ForbiddenException(
          'Route réservée au back-office NOVA PHARMA OS.',
        );
      }
      if (!platformRoles.includes(ctx.platformRole ?? '')) {
        throw new ForbiddenException(
          `Rôle interne insuffisant (requis : ${platformRoles.join(' ou ')}).`,
        );
      }
    }

    if (isWrite && ctx.readonly) {
      throw new ForbiddenException(
        ctx.supportGrantId
          ? "L'accès support en cours est limité à la lecture seule."
          : 'Votre abonnement est suspendu : vos données restent consultables, ' +
            'mais aucune modification n\'est possible. Régularisez le paiement pour réactiver le compte.',
      );
    }

    if (permissions?.length) {
      const held = ctx.permissions ?? [];
      const hasAll =
        held.includes('*') || permissions.every((code) => held.includes(code));
      if (!hasAll) {
        throw new ForbiddenException(
          `Permission requise : ${permissions.join(', ')}.`,
        );
      }
    }

    if (moduleCode && ctx.actorKind !== 'platform_user') {
      const modules = ctx.modules ?? [];
      if (!modules.includes(moduleCode)) {
        throw new PlanLimitException(
          `Le module « ${moduleCode} » n'est pas inclus dans votre forfait.`,
          { module: moduleCode },
        );
      }
    }

    return true;
  }
}
