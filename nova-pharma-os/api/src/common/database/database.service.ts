import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { RequestContext } from './request-context';

/**
 * Client transactionnel remis aux services : toutes les requêtes qu'il
 * exécute partagent la même transaction, et donc le même contexte tenant.
 */
export interface Tx {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
  /** Première ligne, ou null. */
  one<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<T | null>;
  /** Première ligne, erreur si absente. */
  oneOrFail<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
    message?: string,
  ): Promise<T>;
  many<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<T[]>;
  readonly context: RequestContext;
}

export class RowNotFoundError extends Error {}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: Pool;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  onModuleInit(): void {
    const connectionString = this.config.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL est requis.');
    }
    this.pool = new Pool({
      connectionString,
      max: Number(this.config.get('DATABASE_POOL_MAX') ?? 20),
      idleTimeoutMillis: 30_000,
      // Toute requête est bornée : un verrou oublié ne bloque pas la caisse.
      statement_timeout: 30_000,
    });
    this.pool.on('error', (err) =>
      this.logger.error(`Erreur du pool PostgreSQL : ${err.message}`),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  getPool(): Pool {
    return this.pool;
  }

  /**
   * Exécute `work` dans une transaction dont le contexte tenant est
   * appliqué au niveau base (SET LOCAL). En cas d'échec, la transaction
   * est intégralement annulée : aucune vente à moitié enregistrée,
   * aucun stock décrémenté sans mouvement correspondant.
   */
  async transaction<T>(
    context: RequestContext,
    work: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.applyContext(client, context);
      const result = await work(this.wrap(client, context));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Transaction en lecture seule : le contexte est forcé en readonly. */
  async readTransaction<T>(
    context: RequestContext,
    work: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    return this.transaction({ ...context, readonly: true }, work);
  }

  private async applyContext(
    client: PoolClient,
    context: RequestContext,
  ): Promise<void> {
    // set_config(..., true) = portée transaction, comme SET LOCAL.
    await client.query(
      `SELECT set_config('nova.organization_id', $1, true),
              set_config('nova.branch_id',       $2, true),
              set_config('nova.actor_id',        $3, true),
              set_config('nova.platform',        $4, true),
              set_config('nova.readonly',        $5, true)`,
      [
        context.organizationId ?? '',
        context.branchId ?? '',
        context.actorId ?? '',
        context.platform ? 'on' : 'off',
        context.readonly ? 'on' : 'off',
      ],
    );
  }

  private wrap(client: PoolClient, context: RequestContext): Tx {
    async function query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ): Promise<{ rows: T[]; rowCount: number }> {
      const result = await client.query<T>(text, values as never);
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    }

    async function one<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ): Promise<T | null> {
      const { rows } = await query<T>(text, values);
      return rows.length > 0 ? rows[0] : null;
    }

    async function oneOrFail<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
      message = 'Enregistrement introuvable.',
    ): Promise<T> {
      const row = await one<T>(text, values);
      if (!row) throw new RowNotFoundError(message);
      return row;
    }

    async function many<T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ): Promise<T[]> {
      const { rows } = await query<T>(text, values);
      return rows;
    }

    return { context, query, one, oneOrFail, many };
  }
}
