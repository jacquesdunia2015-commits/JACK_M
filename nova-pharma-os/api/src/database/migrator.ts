import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Applique les migrations SQL du dossier `db/migrations` dans l'ordre
 * lexicographique. Chaque fichier est joué une seule fois, dans sa
 * propre transaction, et son empreinte est enregistrée : un fichier
 * déjà appliqué puis modifié provoque une erreur explicite plutôt
 * qu'une divergence silencieuse entre environnements.
 */
export async function runMigrations(
  connectionString: string,
  migrationsDir: string,
): Promise<MigrationResult> {
  const client = new Client({ connectionString });
  await client.connect();
  const result: MigrationResult = { applied: [], skipped: [] };

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    text PRIMARY KEY,
        checksum    text NOT NULL,
        applied_at  timestamptz NOT NULL DEFAULT now(),
        duration_ms integer NOT NULL DEFAULT 0
      )`);

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const { rows } = await client.query<{ filename: string; checksum: string }>(
      'SELECT filename, checksum FROM schema_migrations',
    );
    const alreadyApplied = new Map(rows.map((r) => [r.filename, r.checksum]));

    for (const filename of files) {
      const sql = readFileSync(join(migrationsDir, filename), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = alreadyApplied.get(filename);

      if (previous) {
        if (previous !== checksum) {
          throw new Error(
            `La migration ${filename} a été modifiée après application ` +
              `(empreinte ${previous.slice(0, 12)} → ${checksum.slice(0, 12)}). ` +
              `Créez une nouvelle migration plutôt que de modifier celle-ci.`,
          );
        }
        result.skipped.push(filename);
        continue;
      }

      const startedAt = Date.now();
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum, duration_ms) VALUES ($1, $2, $3)',
          [filename, checksum, Date.now() - startedAt],
        );
        await client.query('COMMIT');
        result.applied.push(filename);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(
          `Échec de la migration ${filename} : ${(error as Error).message}`,
        );
      }
    }
    return result;
  } finally {
    await client.end();
  }
}
