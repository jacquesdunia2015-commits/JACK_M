import { afterAll, beforeAll } from 'vitest';
import { pool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';

// Chaque fichier de tests repart d'une base vide (DATABASE_URL, par défaut locagest_test).
beforeAll(async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(() => {});
});

afterAll(async () => {
  await pool.end();
});
