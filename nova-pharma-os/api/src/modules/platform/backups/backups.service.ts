import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { AuditService } from '../../../common/audit/audit.service';
import { DatabaseService, Tx } from '../../../common/database/database.service';
import { RequestContext } from '../../../common/database/request-context';

/**
 * Les tables d'une pharmacie ne sont plus listées à la main : une liste
 * figée oubliait chaque table ajoutée depuis (traitements suivis,
 * fidélité, devises de caisse…). Pire, la restauration vidait les tables
 * listées et, par les clés étrangères en cascade, les tables oubliées — sans
 * les avoir sauvegardées. Le plan est désormais lu dans la base : toutes les
 * tables dotées de la politique « pharmacie » (nova.apply_tenant_rls), dans
 * l'ordre de leurs clés étrangères.
 */
interface PlanSauvegarde {
  /** Ordre d'insertion : une table vient après celles qu'elle référence. */
  ordre: string[];
  /** Colonnes insérées vides puis renseignées à la fin (cycles, autoréférences). */
  differees: Map<string, string[]>;
  /** Colonnes par table : générées (non réinsérables), JSON, binaires. */
  colonnes: Map<string, { generees: Set<string>; json: Set<string>; binaires: Set<string> }>;
}

/** Valeur d'une ligne exportée en JSON sans perte (binaire en hexadécimal). */
const exporterValeur = (v: unknown) => (Buffer.isBuffer(v) ? `\\x${v.toString('hex')}` : v);

interface BackupFile {
  format: 'nova-pharma-os/organization-backup';
  version: 1 | 2;
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
        const plan = await this.plan(tx);
        const tables: Record<string, Record<string, unknown>[]> = {};
        for (const table of plan.ordre) {
          const lignes = await tx.many<Record<string, unknown>>(
            `SELECT * FROM "${table}" WHERE organization_id = $1`,
            [organizationId],
          );
          tables[table] = lignes.map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, exporterValeur(v)])));
        }
        return tables;
      });

      const file: BackupFile = {
        format: 'nova-pharma-os/organization-backup',
        version: 2,
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
      const plan = await this.plan(tx);
      // On vide de la table la plus dépendante à la plus référencée.
      for (const table of [...plan.ordre].reverse()) {
        await tx.query(`DELETE FROM "${table}" WHERE organization_id = $1`, [backup.organization_id]);
      }

      const counts: Record<string, number> = {};
      const aCompleter: { table: string; id: unknown; valeurs: Record<string, unknown> }[] = [];
      for (const table of plan.ordre) {
        const rows = file.tables[table] ?? [];
        const differees = plan.differees.get(table) ?? [];
        for (const row of rows) {
          // Cycle ou autoréférence : la colonne est insérée vide, puis renseignée.
          const reportees = Object.fromEntries(differees.filter((c) => row[c] != null).map((c) => [c, row[c]]));
          await this.insertRow(tx, plan, table, Object.keys(reportees).length ? { ...row, ...Object.fromEntries(Object.keys(reportees).map((c) => [c, null])) } : row);
          if (Object.keys(reportees).length) aCompleter.push({ table, id: row.id, valeurs: reportees });
        }
        counts[table] = rows.length;
      }
      for (const c of aCompleter) {
        const cols = Object.keys(c.valeurs);
        await tx.query(
          `UPDATE "${c.table}" SET ${cols.map((col, i) => `"${col}" = $${i + 2}`).join(', ')} WHERE id = $1`,
          [c.id, ...cols.map((col) => c.valeurs[col])],
        );
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
    plan: PlanSauvegarde,
    table: string,
    row: Record<string, unknown>,
  ): Promise<void> {
    const infos = plan.colonnes.get(table);
    // Les colonnes générées ne sont pas réinsérables : la base les
    // recalcule à partir des colonnes sources.
    const columns = Object.keys(row).filter((c) => !infos?.generees.has(c));
    if (columns.length === 0) return;
    const valeurs = columns.map((c) => {
      const v = row[c];
      // Un tableau JSON serait pris pour un tableau PostgreSQL : on l'envoie en texte.
      if (v !== null && v !== undefined && infos?.json.has(c)) return JSON.stringify(v);
      return v;
    });
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    await tx.query(
      `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')})
       VALUES (${placeholders})`,
      valeurs,
    );
  }

  /**
   * Plan de sauvegarde lu dans le catalogue : tables « pharmacie », ordre
   * des clés étrangères (Kahn), et, pour rompre un cycle, une clé
   * facultative différée.
   */
  private async plan(tx: Tx): Promise<PlanSauvegarde> {
    const tables = (await tx.many<{ t: string }>(
      `SELECT DISTINCT c.relname AS t FROM pg_policy p
         JOIN pg_class c ON c.oid = p.polrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND p.polname = c.relname || '_tenant_select'
        ORDER BY 1`,
    )).map((r) => r.t);
    const liens = await tx.many<{ de: string; vers: string; colonnes: string[]; facultatif: boolean }>(
      `SELECT a.relname AS de, b.relname AS vers,
              array_agg(att.attname::text ORDER BY att.attnum) AS colonnes,
              bool_and(NOT att.attnotnull) AS facultatif
         FROM pg_constraint con
         JOIN pg_class a ON a.oid = con.conrelid
         JOIN pg_class b ON b.oid = con.confrelid
         JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
        WHERE con.contype = 'f' AND a.relname = ANY($1) AND b.relname = ANY($1)
        GROUP BY con.oid, a.relname, b.relname`,
      [tables],
    );
    const differees = new Map<string, string[]>();
    const differer = (table: string, cols: string[]) => differees.set(table, [...(differees.get(table) ?? []), ...cols]);
    const dependances = new Map(tables.map((t) => [t, new Map<string, typeof liens>()]));
    for (const l of liens) {
      if (l.de === l.vers) { differer(l.de, l.colonnes); continue; }
      const m = dependances.get(l.de) as Map<string, typeof liens>;
      m.set(l.vers, [...(m.get(l.vers) ?? []), l]);
    }
    const ordre: string[] = [];
    const restantes = new Set(tables);
    while (restantes.size) {
      const pretes = [...restantes].filter((t) => [...(dependances.get(t) as Map<string, unknown>).keys()].every((v) => !restantes.has(v)));
      if (pretes.length) {
        for (const t of pretes) { ordre.push(t); restantes.delete(t); }
        continue;
      }
      // Cycle : on diffère une clé facultative entre deux tables restantes.
      let rompu = false;
      for (const t of restantes) {
        for (const [v, ls] of dependances.get(t) as Map<string, typeof liens>) {
          if (restantes.has(v) && ls.every((l) => l.facultatif)) {
            for (const l of ls) differer(t, l.colonnes);
            (dependances.get(t) as Map<string, unknown>).delete(v);
            rompu = true;
            break;
          }
        }
        if (rompu) break;
      }
      if (!rompu) throw new Error(`Cycle de clés obligatoires entre : ${[...restantes].join(', ')}`);
    }
    const infos = await tx.many<{ table_name: string; column_name: string; data_type: string; is_generated: string }>(
      `SELECT table_name, column_name, data_type, is_generated FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [tables],
    );
    const colonnes = new Map(tables.map((t) => [t, { generees: new Set<string>(), json: new Set<string>(), binaires: new Set<string>() }]));
    for (const c of infos) {
      const e = colonnes.get(c.table_name);
      if (!e) continue;
      if (c.is_generated === 'ALWAYS') e.generees.add(c.column_name);
      if (c.data_type === 'json' || c.data_type === 'jsonb') e.json.add(c.column_name);
      if (c.data_type === 'bytea') e.binaires.add(c.column_name);
    }
    return { ordre, differees, colonnes };
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
