import pg from 'pg';
import { config } from '../lib/config.js';

// Les colonnes DATE restent des chaînes « AAAA-MM-JJ » : pas de décalage de fuseau.
pg.types.setTypeParser(1082, (v) => v);
// NUMERIC -> number (montants de loyer, largement dans la précision d'un double)
pg.types.setTypeParser(1700, (v) => Number(v));
// COUNT(*) -> number
pg.types.setTypeParser(20, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export async function query<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}

export async function one<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []) {
  const r = await pool.query<T>(text, params);
  return r.rows[0] as T | undefined;
}

export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
