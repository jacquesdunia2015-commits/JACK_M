import { afterAll, beforeAll } from 'vitest';
import { pool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { config } from '../src/lib/config.js';

// Garde-fou : les tests vident la base. Ils refusent de tourner sur une base
// dont le nom ne se termine pas par « _test » (base de démo ou de production).
const dbName = new URL(config.databaseUrl).pathname.slice(1);
if (!dbName.endsWith('_test')) {
  throw new Error(`Tests refusés : la base « ${dbName} » n'est pas une base de test (nom attendu : …_test).`);
}

// Chaque fichier de tests repart d'une base vide (DATABASE_URL, par défaut locagest_test).
beforeAll(async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(() => {});
});

afterAll(async () => {
  await pool.end();
});
