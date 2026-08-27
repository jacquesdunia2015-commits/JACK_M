import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';

/**
 * Ordre d'export et de restauration des tables d'une pharmacie.
 * Les dépendances de clés étrangères imposent cet ordre : une table
 * n'apparaît qu'après celles qu'elle référence.
 */
const TENANT_TABLES = [
  'branches', 'roles', 'role_permissions', 'users', 'user_roles', 'user_branches',
  'document_sequences', 'tax_rates', 'product_categories', 'molecules', 'products',
  'product_barcodes', 'price_lists', 'price_list_items',
  'suppliers', 'supplier_products', 'product_lots', 'stock_items',
  'customer_groups', 'customers', 'prescriptions',
  'purchase_orders', 'purchase_order_lines', 'goods_receipts', 'goods_receipt_lines',
  'supplier_payments',
  'cash_sessions', 'sales', 'sale_lines', 'sale_payments',
  'b2b_quotes', 'b2b_orders', 'b2b_order_lines', 'b2b_quote_lines',
  'invoices', 'invoice_lines', 'customer_payments',
  'deliveries', 'delivery_lines', 'delivery_events',
  'stock_transfers', 'stock_transfer_lines',
  'inventory_counts', 'inventory_count_lines',
  'stock_movements', 'stock_alerts', 'cash_movements',
  'documents', 'notifications', 'audit_logs',
  'api_keys', 'webhook_endpoints', 'sync_operations',
] as const;

interface BackupFile {
  format: 'nova-pharma-os/organization-backup';
  version: 1;
  organizationId: string;
  organizationSlug: string;
  exportedAt: string;
  organization: Record<string, unknown>;
  tables: Record<string, Record<string, unknown>[]>;
}

/**
 * Sauvegarde et restauration par organisation.
 *
 * L'unité de sauvegarde est la pharmacie, pas la plateforme : restaurer
 * une pharmacie n'exige jamais de restaurer les autres, et n'interrompt
 * pas leur service.
 */
@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private get storageDir(): string {
    return resolve(this.config.get<string>('BACKUP_DIR') ?? './storage/backups');
  }

  // -------------------------------------------------------------------
  // Sauvegarde
  // -------------------------------------------------------------------
  async createBackup(
    ctx: RequestContext,
    organizationId: string,
    kind: 'manual' | 'scheduled' | 'pre_termination' = 'manual',
  ) {
    const organization = await this.db.readTransaction(ctx, (tx) =>
      tx.oneOrFail<{ id: string; slug: string }>(
        'SELECT * FROM organizations WHERE id = $1',
        [organizationId],
        'Pharmacie introuvable.',
      ),
    );

    const backupId = await this.db.transaction(ctx, async (tx) => {
      const row = await tx.oneOrFail<{ id: string }>(
        `INSERT INTO organization_backups (organization_id, kind, status, created_by)
         VALUES ($1, $2, 'running', $3) RETURNING id`,
        [organizationId, kind, ctx.actorId ?? null],
      );
      return row.id;
    });

    try {
      // L'export lit les données dans le périmètre de la pharmacie, sous
      // RLS : la sauvegarde ne peut pas capter les données d'un voisin.
      const tenantCtx: RequestContext = {
        organizationId,
        actorKind: 'system',
        platform: false,
        readonly: true,
      };

      const payload = await this.db.readTransaction(tenantCtx, async (tx) => {
        const tables: Record<string, Record<string, unknown>[]> = {};
        for (const table of TENANT_TABLES) {
          tables[table] = await tx.many(
            `SELECT * FROM ${table} WHERE organization_id = $1`,
            [organizationId],
          );
        }
        return tables;
      });

      const file: BackupFile = {
        format: 'nova-pharma-os/organization-backup',
        version: 1,
        organizationId,
        organizationSlug: organization.slug,
        exportedAt: new Date().toISOString(),
        organization: organization as Record<string, unknown>,
        tables: payload,
      };

      const serialized = JSON.stringify(file);
      const checksum = createHash('sha256').update(serialized).digest('hex');
      // Le stockage est cloisonné par organisation, comme les documents.
      const relativeKey = join(
        'org',
        organizationId,
        `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      );
      const absolutePath = join(this.storageDir, relativeKey);
      await mkdir(join(this.storageDir, 'org', organizationId), { recursive: true });
      await writeFile(absolutePath, serialized, 'utf8');

      const counts = Object.fromEntries(
        Object.entries(payload).map(([table, rows]) => [table, rows.length]),
      );

      return this.db.transaction(ctx, async (tx) => {
        const backup = await tx.oneOrFail(
          `UPDATE organization_backups
              SET status = 'completed', storage_key = $2, checksum = $3,
                  size_bytes = $4, table_counts = $5, completed_at = now()
            WHERE id = $1 RETURNING *`,
          [backupId, relativeKey, checksum, Buffer.byteLength(serialized), JSON.stringify(counts)],
        );
        await this.audit.recordPlatform(tx, {
          organizationId,
          action: 'backup.created',
          entity: 'organization_backup',
          entityId: backupId,
          after: { kind, checksum, rows: Object.values(counts).reduce((a, b) => a + b, 0) },
        });
        return backup;
      });
    } catch (error) {
      await this.db.transaction(ctx, (tx) =>
        tx.query(
          `UPDATE organization_backups SET status = 'failed', error = $2 WHERE id = $1`,
          [backupId, (error as Error).message],
        ),
      );
      throw error;
    }
  }

  // -------------------------------------------------------------------
  // Restauration
  // -------------------------------------------------------------------
  /**
   * Restaure une pharmacie à partir d'une de ses sauvegardes.
   *
   * L'opération est atomique : les données métier existantes sont
   * remplacées puis réinsérées dans une seule transaction. Un échec en
   * cours de route laisse la pharmacie dans son état d'avant.
   */
  async restore(ctx: RequestContext, backupId: string, confirmSlug: string) {
    const backup = await this.db.readTransaction(ctx, (tx) =>
      tx.oneOrFail<{
        id: string; organization_id: string; storage_key: string;
        checksum: string; status: string;
      }>(
        'SELECT * FROM organization_backups WHERE id = $1',
        [backupId],
        'Sauvegarde introuvable.',
      ),
    );

    if (backup.status !== 'completed') {
      throw new BadRequestException(
        `Cette sauvegarde n'est pas exploitable (statut : ${backup.status}).`,
      );
    }

    const serialized = await readFile(join(this.storageDir, backup.storage_key), 'utf8');
    const checksum = createHash('sha256').update(serialized).digest('hex');
    if (checksum !== backup.checksum) {
      throw new BadRequestException(
        "L'empreinte de la sauvegarde ne correspond pas : fichier altéré ou incomplet.",
      );
    }

    const file = JSON.parse(serialized) as BackupFile;
    if (file.organizationSlug !== confirmSlug) {
      throw new BadRequestException(
        `Confirmation incorrecte : indiquez l'identifiant court « ${file.organizationSlug} » ` +
          'pour confirmer la restauration.',
      );
    }

    const tenantCtx: RequestContext = {
      organizationId: backup.organization_id,
      actorId: ctx.actorId,
      actorLabel: ctx.actorLabel,
      actorKind: 'system',
      platform: false,
      readonly: false,
    };

    const restored = await this.db.transaction(tenantCtx, async (tx) => {
      // Les contraintes sont différées le temps de la réinsertion :
      // l'ordre des tables suffit, mais les cycles éventuels ne bloquent pas.
      await tx.query('SET CONSTRAINTS ALL DEFERRED');

      for (const table of [...TENANT_TABLES].reverse()) {
        await tx.query(`DELETE FROM ${table} WHERE organization_id = $1`, [
          backup.organization_id,
        ]);
      }

      const counts: Record<string, number> = {};
      for (const table of TENANT_TABLES) {
        const rows = file.tables[table] ?? [];
        for (const row of rows) {
          await this.insertRow(tx, table, row);
        }
        counts[table] = rows.length;
      }
      return counts;
    });

    return this.db.transaction(ctx, async (tx) => {
      await tx.query(
        'UPDATE organization_backups SET restored_at = now() WHERE id = $1',
        [backupId],
      );
      await this.audit.recordPlatform(tx, {
        organizationId: backup.organization_id,
        action: 'backup.restored',
        entity: 'organization_backup',
        entityId: backupId,
        after: { rows: Object.values(restored).reduce((a, b) => a + b, 0) },
      });
      return {
        message: `Pharmacie « ${file.organizationSlug} » restaurée depuis la sauvegarde du ${file.exportedAt}.`,
        tables: restored,
      };
    });
  }

  private async insertRow(
    tx: Tx,
    table: string,
    row: Record<string, unknown>,
  ): Promise<void> {
    // Les colonnes générées ne sont pas réinsérables : la base les
    // recalcule à partir des colonnes sources.
    const generated = await this.generatedColumns(tx, table);
    const columns = Object.keys(row).filter((c) => !generated.includes(c));
    if (columns.length === 0) return;

    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    await tx.query(
      `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')})
       VALUES (${placeholders})`,
      columns.map((column) => row[column]),
    );
  }

  private generatedCache = new Map<string, string[]>();

  private async generatedColumns(tx: Tx, table: string): Promise<string[]> {
    const cached = this.generatedCache.get(table);
    if (cached) return cached;
    const rows = await tx.many<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
          AND is_generated = 'ALWAYS'`,
      [table],
    );
    const columns = rows.map((r) => r.column_name);
    this.generatedCache.set(table, columns);
    return columns;
  }

  async list(ctx: RequestContext, organizationId?: string) {
    return this.db.readTransaction(ctx, (tx) =>
      tx.many(
        `SELECT b.id, b.kind, b.status, b.checksum, b.size_bytes, b.table_counts,
                b.started_at, b.completed_at, b.restored_at, b.error,
                o.slug AS organization_slug, o.legal_name AS organization_name
           FROM organization_backups b
           JOIN organizations o ON o.id = b.organization_id
          WHERE ($1::uuid IS NULL OR b.organization_id = $1)
          ORDER BY b.started_at DESC LIMIT 100`,
        [organizationId ?? null],
      ),
    );
  }
}
