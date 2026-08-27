import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { RequestContext, SYSTEM_CONTEXT } from '../database/request-context';

/**
 * Journalise chaque requête émise sous un accès support.
 *
 * Le journal d'audit métier ne retient que les écritures ; or le cahier
 * des charges exige de tracer les « actions réalisées » par le support,
 * consultations comprises. Une pharmacie doit pouvoir savoir non
 * seulement ce que l'éditeur a modifié, mais aussi ce qu'il a regardé.
 *
 * L'écriture est faite après la réponse et hors de la transaction
 * métier : elle n'ajoute pas de latence à la requête et ne peut pas la
 * faire échouer.
 */
@Injectable()
export class SupportActivityInterceptor implements NestInterceptor {
  constructor(private readonly db: DatabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const ctx: RequestContext | undefined = request?.novaContext;

    if (!ctx?.supportGrantId) return next.handle();

    const method = request.method as string;
    const path = (request.originalUrl ?? request.url) as string;

    return next.handle().pipe(
      tap({
        next: () => void this.record(ctx, method, path, 'success'),
        error: () => void this.record(ctx, method, path, 'refused'),
      }),
    );
  }

  private async record(
    ctx: RequestContext,
    method: string,
    path: string,
    outcome: string,
  ): Promise<void> {
    try {
      await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
        tx.query(
          `INSERT INTO support_access_events
             (grant_id, organization_id, platform_user_id, agent_email,
              action, method, path)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            ctx.supportGrantId,
            ctx.organizationId,
            ctx.actorId,
            ctx.actorLabel ?? null,
            `support.request.${outcome}`,
            method,
            path,
          ],
        ),
      );
    } catch {
      // La journalisation ne doit jamais interrompre le service ;
      // l'échec est silencieux côté requête et visible en supervision.
    }
  }
}
