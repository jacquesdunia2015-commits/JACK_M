import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { runMigrations } from '../src/database/migrator';
import { loadEnv } from '../src/database/load-env';

/**
 * Prépare une base dédiée aux tests, recréée à chaque exécution : les
 * tests partent toujours d'un état connu et n'altèrent jamais la base
 * de développement.
 */
export default async function globalSetup(): Promise<void> {
  loadEnv();

  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL ?? process.env.DATABASE_ADMIN_URL;
  if (!adminUrl) throw new Error('DATABASE_ADMIN_URL est requis pour les tests.');

  const testDbName = process.env.TEST_DATABASE_NAME ?? 'nova_test';
  const maintenanceUrl = adminUrl.replace(/\/[^/?]+(\?|$)/, `/postgres$1`);

  const client = new Client({ connectionString: maintenanceUrl });
  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [testDbName],
    );
    await client.query(`DROP DATABASE IF EXISTS ${testDbName}`);
    await client.query(`CREATE DATABASE ${testDbName}`);
  } finally {
    await client.end();
  }

  const testAdminUrl = adminUrl.replace(/\/[^/?]+(\?|$)/, `/${testDbName}$1`);
  await runMigrations(testAdminUrl, resolve(__dirname, '../../db/migrations'));

  process.env.DATABASE_ADMIN_URL = testAdminUrl;
  process.env.DATABASE_URL = (process.env.DATABASE_URL ?? '').replace(
    /\/[^/?]+(\?|$)/,
    `/${testDbName}$1`,
  );
  process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
  process.env.TEST_DATABASE_ADMIN_URL = testAdminUrl;

  execSync('npx ts-node -T src/database/run-seed.ts', {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_ADMIN_URL: testAdminUrl },
    stdio: 'ignore',
  });
}
