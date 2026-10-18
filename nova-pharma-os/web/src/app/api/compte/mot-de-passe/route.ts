import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { messageErreur } from '@/lib/ouvrir-session';
import { SESSION_COOKIE, encodeSession, readSession } from '@/lib/session';

/**
 * Changement de mot de passe. L'API ferme toutes les sessions et en ouvre
 * une neuve pour cet appareil : ses jetons remplacent ceux du cookie, la
 * personne reste connectée.
 */
export async function POST(request: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ message: 'Session expirée : reconnectez-vous.' }, { status: 401 });
  const { currentPassword, newPassword } = await request.json();
  const r = await fetch(`${API_URL}/auth/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify({ currentPassword, newPassword }),
    cache: 'no-store',
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    return NextResponse.json({ message: messageErreur(body, 'Changement refusé.') }, { status: r.status });
  }
  const resultat = NextResponse.json({ message: body.message });
  resultat.cookies.set(
    SESSION_COOKIE,
    encodeSession({ ...session, accessToken: body.accessToken, refreshToken: body.refreshToken }),
    { httpOnly: true, sameSite: 'lax', path: '/', secure: request.nextUrl.protocol === 'https:', maxAge: 60 * 60 * 8 },
  );
  return resultat;
}
