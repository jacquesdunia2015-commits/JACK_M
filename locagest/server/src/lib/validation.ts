import { z } from 'zod';

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');
/** Chaîne optionnelle : '' devient null. */
export const optText = z
  .string()
  .trim()
  .max(5000)
  .nullish()
  .transform((v) => (v ? v : null));
export const currency = z.enum(['USD', 'CDF']);
export const money = z.coerce.number().min(0, 'Montant positif attendu').max(1e12);
export const count = z.coerce.number().int().min(0).max(100).default(0);
export const email = z.string().trim().toLowerCase().email('Email invalide');
