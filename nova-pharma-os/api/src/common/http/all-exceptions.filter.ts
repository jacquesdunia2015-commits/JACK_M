import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { DatabaseError } from 'pg';
import { DatabaseService, RowNotFoundError } from '../database/database.service';
import { RequestContext, SYSTEM_CONTEXT } from '../database/request-context';

/**
 * Traduit les erreurs techniques en réponses lisibles, sans jamais
 * exposer la structure interne de la base au client.
 */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  constructor(private readonly db?: DatabaseService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();

    // Une requête refusée sous accès support reste une action à tracer :
    // la pharmacie doit voir ce que l'éditeur a tenté, pas seulement ce
    // qu'il a obtenu. Les gardes s'exécutant avant les intercepteurs,
    // c'est ici que le refus est capté.
    void this.recordSupportRefusal(request);

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      response.status(exception.getStatus()).json(
        typeof body === 'string'
          ? { statusCode: exception.getStatus(), message: body }
          : body,
      );
      return;
    }

    if (exception instanceof RowNotFoundError) {
      response
        .status(HttpStatus.NOT_FOUND)
        .json({ statusCode: 404, error: 'NotFound', message: exception.message });
      return;
    }

    if (exception instanceof DatabaseError) {
      const mapped = this.mapDatabaseError(exception);
      if (mapped) {
        response.status(mapped.status).json(mapped.body);
        return;
      }
    }

    this.logger.error(
      `${request.method} ${request.url} — ${(exception as Error)?.message}`,
      (exception as Error)?.stack,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      error: 'InternalServerError',
      message: 'Une erreur interne est survenue.',
    });
  }

  private mapDatabaseError(
    error: DatabaseError,
  ): { status: number; body: Record<string, unknown> } | null {
    switch (error.code) {
      case '23505': // unique_violation
        return {
          status: HttpStatus.CONFLICT,
          body: {
            statusCode: 409,
            error: 'Conflict',
            message: 'Cet enregistrement existe déjà.',
            details: { constraint: error.constraint },
          },
        };
      case '23503': // foreign_key_violation
        return {
          status: HttpStatus.CONFLICT,
          body: {
            statusCode: 409,
            error: 'Conflict',
            message:
              'Cet enregistrement est référencé ailleurs ou référence un élément inexistant.',
            details: { constraint: error.constraint },
          },
        };
      case '23514': // check_violation
        return {
          status: HttpStatus.BAD_REQUEST,
          body: {
            statusCode: 400,
            error: 'BadRequest',
            message: 'Valeur refusée par une règle de cohérence.',
            details: { constraint: error.constraint },
          },
        };
      case '42501': // insufficient_privilege — politique RLS
        return {
          status: HttpStatus.FORBIDDEN,
          body: {
            statusCode: 403,
            error: 'Forbidden',
            message: "Opération refusée : données hors de votre périmètre.",
          },
        };
      default:
        return null;
    }
  }

  private async recordSupportRefusal(request: {
    novaContext?: RequestContext;
    method?: string;
    originalUrl?: string;
    url?: string;
  }): Promise<void> {
    const ctx = request?.novaContext;
    if (!ctx?.supportGrantId || !this.db) return;
    try {
      await this.db.transaction(SYSTEM_CONTEXT, (tx) =>
        tx.query(
          `INSERT INTO support_access_events
             (grant_id, organization_id, platform_user_id, agent_email,
              action, method, path)
           VALUES ($1,$2,$3,$4,'support.request.refused',$5,$6)`,
          [
            ctx.supportGrantId,
            ctx.organizationId,
            ctx.actorId,
            ctx.actorLabel ?? null,
            request.method ?? null,
            request.originalUrl ?? request.url ?? null,
          ],
        ),
      );
    } catch {
      // La journalisation ne doit jamais masquer l'erreur d'origine.
    }
  }
}
