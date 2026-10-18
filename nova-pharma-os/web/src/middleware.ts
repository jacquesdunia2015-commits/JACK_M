import { NextRequest, NextResponse } from 'next/server';

/**
 * Renouvellement de la session.
 *
 * Le jeton d'accès de l'API ne vit que quelques minutes ; la session, elle,
 * dure la journée. Avant chaque page ou appel du relais, si le jeton expire
 * dans moins d'une minute, on l'échange contre un neuf grâce au jeton de
 * rafraîchissement, et le cookie est réécrit — pour le navigateur, et pour
 * la page qui va être calculée dans la foulée. Sans cela, l'application se
 * vidait au bout d'un quart d'heure sans rien dire.
 *
 * Le middleware tourne dans le moteur « edge » : ni Buffer ni modules Node,
 * d'où l'encodage fait main (le même format que lib/session.ts).
 */

const SESSION_COOKIE = 'nova_session';
const API_URL = process.env.NOVA_API_URL ?? 'http://localhost:3001/api';
const MARGE_MS = 60_000;

interface Session {
  accessToken: string;
  refreshToken: string;
  space: 'pharmacy' | 'platform';
  [cle: string]: unknown;
}

function versBase64Url(texte: string): string {
  let binaire = '';
  new TextEncoder().encode(texte).forEach((octet) => { binaire += String.fromCharCode(octet); });
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function depuisBase64Url(valeur: string): string {
  const b64 = valeur.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((valeur.length + 3) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

/** Échéance du jeton d'accès, lue sans vérifier la signature (l'API le fera). */
function echeance(jeton: string): number {
  try {
    return Number(JSON.parse(depuisBase64Url(jeton.split('.')[1])).exp) * 1000;
  } catch {
    return 0;
  }
}

export async function middleware(request: NextRequest) {
  const brut = request.cookies.get(SESSION_COOKIE)?.value;
  if (!brut) return NextResponse.next();
  // Les liens du menu sont préchargés en arrière-plan : chacun renouvellerait
  // la session pour rien. Seule la vraie navigation la renouvelle.
  if (request.headers.get('next-router-prefetch') || request.headers.get('purpose') === 'prefetch') {
    return NextResponse.next();
  }

  let session: Session;
  try {
    session = JSON.parse(depuisBase64Url(brut)) as Session;
  } catch {
    return NextResponse.next();
  }
  if (!session.refreshToken || echeance(session.accessToken) - Date.now() > MARGE_MS) {
    return NextResponse.next();
  }

  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      cache: 'no-store',
    });
  } catch {
    // API injoignable (réveil d'un hébergement gratuit…) : on laisse passer,
    // la page affichera l'erreur habituelle.
    return NextResponse.next();
  }

  if (reponse.status === 401 || reponse.status === 403) {
    // Session révoquée ou expirée : retour à la connexion, plutôt qu'une
    // application vide.
    const relais = request.nextUrl.pathname.startsWith('/api/');
    const sortie = relais
      ? NextResponse.next()
      : NextResponse.redirect(new URL(session.space === 'platform' ? '/admin/connexion' : '/connexion', request.url));
    sortie.cookies.delete(SESSION_COOKIE);
    return sortie;
  }
  if (!reponse.ok) return NextResponse.next();

  const jetons = (await reponse.json()) as { accessToken: string; refreshToken: string };
  const valeur = versBase64Url(JSON.stringify({ ...session, accessToken: jetons.accessToken, refreshToken: jetons.refreshToken }));

  // La page calculée dans la foulée doit déjà voir le nouveau jeton.
  const entetes = new Headers(request.headers);
  const autres = request.cookies.getAll().filter((c) => c.name !== SESSION_COOKIE).map((c) => `${c.name}=${c.value}`);
  entetes.set('cookie', [...autres, `${SESSION_COOKIE}=${valeur}`].join('; '));

  const suite = NextResponse.next({ request: { headers: entetes } });
  suite.cookies.set(SESSION_COOKIE, valeur, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: request.nextUrl.protocol === 'https:',
    maxAge: 60 * 60 * 8,
  });
  return suite;
}

export const config = {
  matcher: ['/pharmacie/:path*', '/ticket/:path*', '/admin/((?!connexion).*)', '/admin', '/mobile/:path*', '/mobile', '/api/proxy/:path*'],
};
