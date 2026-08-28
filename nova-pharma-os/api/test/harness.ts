import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { loadEnv } from '../src/database/load-env';

export interface Session {
  token: string;
  user: Record<string, unknown>;
}

/**
 * Monte l'application complète (gardes, RLS, tâches) et expose des
 * raccourcis d'appel. Les tests franchissent donc les mêmes contrôles
 * que la production : rien n'est court-circuité.
 */
export class Harness {
  app!: INestApplication;

  async start(): Promise<void> {
    loadEnv();
    const testDbName = process.env.TEST_DATABASE_NAME ?? 'nova_test';
    process.env.DATABASE_URL = (process.env.DATABASE_URL ?? '').replace(
      /\/[^/?]+(\?|$)/,
      `/${testDbName}$1`,
    );
    process.env.DATABASE_ADMIN_URL = (process.env.DATABASE_ADMIN_URL ?? '').replace(
      /\/[^/?]+(\?|$)/,
      `/${testDbName}$1`,
    );
    process.env.SCHEDULER_ENABLED = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleRef.createNestApplication();
    this.app.setGlobalPrefix('api');
    this.app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await this.app.init();
  }

  async stop(): Promise<void> {
    await this.app?.close();
  }

  http() {
    return request(this.app.getHttpServer());
  }

  get(path: string, token?: string) {
    const req = this.http().get(`/api${path}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  post(path: string, body: unknown = {}, token?: string) {
    const req = this.http().post(`/api${path}`).send(body as object);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  patch(path: string, body: unknown = {}, token?: string) {
    const req = this.http().patch(`/api${path}`).send(body as object);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  put(path: string, body: unknown = {}, token?: string) {
    const req = this.http().put(`/api${path}`).send(body as object);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  async loginPlatform(email: string, password = 'NovaPharma2026!'): Promise<Session> {
    const res = await this.post('/auth/platform/login', { email, password }).expect(201);
    return { token: res.body.accessToken, user: res.body.user };
  }

  async loginPharmacy(email: string, password: string): Promise<Session> {
    const res = await this.post('/auth/login', { email, password }).expect(201);
    return { token: res.body.accessToken, user: res.body.user };
  }

  /** Force la date d'échéance d'une facture pour simuler un retard. */
  async setInvoiceOverdue(organizationId: string, days: number): Promise<void> {
    const { DatabaseService } = await import('../src/common/database/database.service');
    const { SYSTEM_CONTEXT } = await import('../src/common/database/request-context');
    const db = this.app.get(DatabaseService);
    await db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.query(
        `UPDATE subscription_invoices
            SET due_date = CURRENT_DATE - $2::integer
          WHERE organization_id = $1 AND kind = 'invoice'`,
        [organizationId, days],
      ),
    );
  }

  /** Force la fin de la période courante pour déclencher la facturation. */
  async expirePeriod(organizationId: string): Promise<void> {
    const { DatabaseService } = await import('../src/common/database/database.service');
    const { SYSTEM_CONTEXT } = await import('../src/common/database/request-context');
    const db = this.app.get(DatabaseService);
    await db.transaction(SYSTEM_CONTEXT, (tx) =>
      tx.query(
        `UPDATE organization_subscriptions
            SET trial_ends_at = now() - interval '1 day',
                current_period_end = now() - interval '1 day'
          WHERE organization_id = $1`,
        [organizationId],
      ),
    );
  }

  /** Vide le cache de contexte pour que les changements d'état prennent effet. */
  invalidate(organizationId: string): void {
    const {
      AccessContextService,
      // eslint-disable-next-line @typescript-eslint/no-var-requires
    } = require('../src/common/auth/access-context.service');
    this.app.get(AccessContextService).invalidate(organizationId);
  }
}

let counter = 0;
export function uniqueSlug(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
