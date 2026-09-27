import { query } from '../db/pool.js';

/** Trace une action critique dans le journal d'audit (ne bloque jamais la requête). */
export async function audit(userId: number | null, action: string, entity: string, entityId?: number, details?: unknown) {
  try {
    await query('INSERT INTO audit_logs(user_id, action, entity, entity_id, details) VALUES ($1,$2,$3,$4,$5)', [
      userId,
      action,
      entity,
      entityId ?? null,
      details ? JSON.stringify(details) : null,
    ]);
  } catch (e) {
    console.error('Audit impossible', e);
  }
}
