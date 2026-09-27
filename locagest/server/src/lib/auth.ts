import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { HttpError } from './errors.js';
import { one } from '../db/pool.js';

export type Role = 'bailleur' | 'locataire' | 'admin';
export interface AuthUser {
  id: number;
  role: Role;
  email: string;
  landlordId: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: '7d' });
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Authentification requise');
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new HttpError(401, 'Session expirée, reconnectez-vous');
    }
    const user = await one(
      'SELECT id, role, email, landlord_id, active FROM users WHERE id = $1',
      [Number(payload.sub)],
    );
    if (!user || !user.active) throw new HttpError(401, 'Compte introuvable ou désactivé');
    req.user = { id: user.id, role: user.role, email: user.email, landlordId: user.landlord_id };
    next();
  } catch (e) {
    next(e);
  }
};

/** Contrôle d'accès basé sur les rôles (RBAC). */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new HttpError(403, 'Accès refusé pour ce rôle'));
      return;
    }
    next();
  };

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new HttpError(401, 'Authentification requise');
  return req.user;
}

/** Identifiant entier d'un paramètre de route, ou 404. */
export function idParam(req: Request, name = 'id'): number {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(404, 'Ressource introuvable');
  return n;
}
