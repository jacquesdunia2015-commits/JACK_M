import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_LANGUE, trouverLangue } from '@/lib/i18n';

/**
 * Mémorise la langue d'affichage.
 *
 * Le code reçu est passé par `trouverLangue`, qui ne rend qu'une langue
 * de la liste : une valeur fabriquée à la main n'atterrit jamais telle
 * quelle dans le cookie.
 */
export async function POST(request: NextRequest) {
  const { code } = (await request.json()) as { code?: string };
  const langue = trouverLangue(code);

  const reponse = NextResponse.json({ code: langue.code });
  reponse.cookies.set({
    name: COOKIE_LANGUE,
    value: langue.code,
    httpOnly: false,
    sameSite: 'lax',
    // Comme pour la session, « secure » suit le protocole réellement
    // utilisé : en http:// sur un réseau local, un cookie « secure »
    // serait refusé et la langue ne tiendrait pas d'une page à l'autre.
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return reponse;
}
