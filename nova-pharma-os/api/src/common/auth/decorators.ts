import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { RequestContext } from '../database/request-context';

export const PUBLIC_KEY = 'nova:public';
export const PERMISSIONS_KEY = 'nova:permissions';
export const PLATFORM_ROLES_KEY = 'nova:platformRoles';
export const MODULE_KEY = 'nova:module';
export const WRITE_KEY = 'nova:write';

/** Route accessible sans authentification. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Permissions requises côté pharmacie (toutes exigées). */
export const RequirePermissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);

/** Rôles internes NOVA PHARMA OS autorisés. */
export const PlatformRoles = (...roles: string[]) =>
  SetMetadata(PLATFORM_ROLES_KEY, roles);

/**
 * Module devant être activé par le forfait souscrit. Une pharmacie au
 * forfait Starter reçoit 402 sur une route marquée `b2b`.
 */
export const RequireModule = (moduleCode: string) =>
  SetMetadata(MODULE_KEY, moduleCode);

/**
 * Route en écriture : refusée si le contexte est en lecture seule
 * (organisation suspendue, accès support en read_only).
 */
export const WriteOperation = () => SetMetadata(WRITE_KEY, true);

/** Injecte le contexte d'exécution résolu par le garde d'authentification. */
export const Ctx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext =>
    ctx.switchToHttp().getRequest().novaContext,
);
