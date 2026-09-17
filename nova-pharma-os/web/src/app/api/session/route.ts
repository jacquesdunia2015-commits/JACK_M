import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { SESSION_COOKIE, encodeSession, SessionData } from '@/lib/session';

/**
 * Échange les identifiants contre une session.
 *
 * Le jeton d'accès n'est jamais renvoyé au navigateur : il est scellé
 * dans un cookie httpOnly, que seul le serveur Next peut lire.
 */
export async function POST(request: NextRequest) {
  const { email, password, organizationSlug, space } = await request.json();
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
      { message: body?.message ?? 'Connexion impossible.' },
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

export async function DELETE() {
  const result = NextResponse.json({ ok: true });
  result.cookies.delete(SESSION_COOKIE);
  return result;
}
