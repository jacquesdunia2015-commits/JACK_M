import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'nova_session';

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  /** « pharmacy » pour l'espace pharmacie, « platform » pour le back-office SaaS. */
  space: 'pharmacy' | 'platform';
  name: string;
  email: string;
  organizationSlug?: string;
  organizationId?: string;
  role?: string;
  readonly?: boolean;
  locale?: string;
}

/**
 * La session vit dans un cookie httpOnly : le jeton d'accès n'est jamais
 * lisible par du JavaScript de page, ce qui met les identifiants hors de
 * portée d'une injection de script.
 */
export async function readSession(): Promise<SessionData | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as SessionData;
  } catch {
    return null;
  }
}

export function encodeSession(data: SessionData): string {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
}
