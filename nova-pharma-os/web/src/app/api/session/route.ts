import { NextRequest, NextResponse } from 'next/server';
import { ouvrirSession } from '@/lib/ouvrir-session';
import { SESSION_COOKIE } from '@/lib/session';

/** Échange les identifiants contre une session (voir lib/ouvrir-session). */
export async function POST(request: NextRequest) {
  const { email, password, organizationSlug, space, code } = await request.json();
  return ouvrirSession(request, { email, password, organizationSlug, space, code });
}

export async function DELETE() {
  const result = NextResponse.json({ ok: true });
  result.cookies.delete(SESSION_COOKIE);
  return result;
}
