import { resolve } from 'node:path';
import { runMigrations } from './migrator';
import { loadEnv } from './load-env';

async function main(): Promise<void> {
  loadEnv();
  const connectionString =
    process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_ADMIN_URL ou DATABASE_URL est requis.');
  }
  const dir = resolve(__dirname, '../../../db/migrations');
  const { applied, skipped } = await runMigrations(connectionString, dir);

  if (applied.length === 0) {
    console.log(`Base à jour — ${skipped.length} migration(s) déjà appliquée(s).`);
  } else {
    console.log(`${applied.length} migration(s) appliquée(s) :`);
    applied.forEach((f) => console.log(`  • ${f}`));
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
