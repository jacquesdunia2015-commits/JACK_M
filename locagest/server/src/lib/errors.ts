import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Ressource') => new HttpError(404, `${what} introuvable`);

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Données invalides',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Violations de contraintes PostgreSQL
  if (err?.code === '23505') {
    res.status(409).json({ error: 'Cet enregistrement existe déjà ou entre en conflit avec un autre' });
    return;
  }
  if (err?.code === '23503') {
    res.status(409).json({ error: 'Opération impossible : des éléments liés existent' });
    return;
  }
  if (err?.code === '23514') {
    res.status(400).json({ error: 'Valeur non autorisée' });
    return;
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'Fichier trop volumineux (5 Mo maximum)' });
    return;
  }
  // Fichier statique absent (photo supprimée…)
  if (err?.code === 'ENOENT' || err?.status === 404) {
    res.status(404).json({ error: 'Fichier introuvable' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
};
