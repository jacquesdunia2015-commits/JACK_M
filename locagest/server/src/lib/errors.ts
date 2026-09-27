import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

/**
 * Erreur renvoyée au client. `code` permet à l'interface d'afficher le message
 * dans la langue de l'utilisateur (`vars` pour les valeurs à insérer) ; le
 * message français reste le texte de repli.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'error',
    public vars?: Record<string, string | number>,
  ) {
    super(message);
  }
}

const ENTITIES = {
  property: 'Propriété', tenant: 'Locataire', lease: 'Bail', payment: 'Paiement', photo: 'Photo',
  account: 'Compte', resource: 'Ressource',
} as const;
export const notFound = (entity: keyof typeof ENTITIES = 'resource') =>
  new HttpError(404, `${ENTITIES[entity]} introuvable`, 'not_found', { entity });

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Données invalides',
      code: 'validation',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code, vars: err.vars });
    return;
  }
  // Violations de contraintes PostgreSQL
  if (err?.code === '23505') {
    res.status(409).json({ error: 'Cet enregistrement existe déjà ou entre en conflit avec un autre', code: 'conflict' });
    return;
  }
  if (err?.code === '23503') {
    res.status(409).json({ error: 'Opération impossible : des éléments liés existent', code: 'linked_records' });
    return;
  }
  if (err?.code === '23514') {
    res.status(400).json({ error: 'Valeur non autorisée', code: 'bad_value' });
    return;
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'Fichier trop volumineux (5 Mo maximum)', code: 'file_too_large' });
    return;
  }
  // Fichier statique absent (photo supprimée…)
  if (err?.code === 'ENOENT' || err?.status === 404) {
    res.status(404).json({ error: 'Fichier introuvable', code: 'file_not_found' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur', code: 'internal' });
};
