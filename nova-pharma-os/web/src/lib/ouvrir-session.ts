import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { SESSION_COOKIE, encodeSession, SessionData } from '@/lib/session';

export interface Identifiants {
  email: string;
  password: string;
  organizationSlug?: string;
  space?: 'pharmacy' | 'platform';
}

/**
 * Message lisible à partir d'une réponse d'erreur de l'API.
 *
 * La validation renvoie une liste de messages — un par champ refusé. On
 * les assemble en une phrase : sans cela, l'interface les collait bout à
 * bout, sans espace.
 */
export function messageErreur(body: unknown, repli: string): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string' && message) return message;
  return repli;
}

/**
 * Échange des identifiants contre une session, et la scelle dans un
 * cookie.
 *
 * Le jeton d'accès n'est jamais renvoyé au navigateur : il vit dans un
 * cookie httpOnly, que seul le serveur Next peut lire. Utilisé par la
 * connexion et par l'inscription, qui connecte aussitôt la personne.
 */
export async function ouvrirSession(
  request: NextRequest,
  { email, password, organizationSlug, space }: Identifiants,
): Promise<NextResponse> {
  const path = space === 'platform' ? '/auth/platform/login' : '/auth/login';

  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, organizationSlug }),
    cache: 'no-store',
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(
      { message: messageErreur(body, 'Connexion impossible.') },
      { status: response.status },
    );
  }

  const session: SessionData = {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    space: space === 'platform' ? 'platform' : 'pharmacy',
    name: body.user.fullName,
    email: body.user.email,
    organizationSlug: body.user.organizationSlug,
    organizationId: body.user.organizationId,
    role: body.user.role,
    readonly: body.user.readonly,
  };

  const result = NextResponse.json({
    redirectTo: session.space === 'platform' ? '/admin' : '/pharmacie',
  });
  result.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // Le drapeau « secure » suit le protocole réellement utilisé, et non
    // l'environnement : sur un réseau Wi-Fi local en http://, un cookie
    // marqué « secure » serait refusé par le navigateur, et la connexion
    // depuis un téléphone échouerait sans message d'erreur.
    secure: request.nextUrl.protocol === 'https:',
    maxAge: 60 * 60 * 8,
  });
  return result;
}
