import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { messageErreur, ouvrirSession } from '@/lib/ouvrir-session';

/**
 * Inscription d'une pharmacie, puis connexion immédiate.
 *
 * La personne vient de choisir son mot de passe : lui demander de le
 * retaper sur la page de connexion serait une étape de trop. On crée le
 * compte, puis on ouvre la session avec les mêmes identifiants.
 */
export async function POST(request: NextRequest) {
  const donnees = await request.json();
  const { pharmacyName, city, fullName, phone, email, password } = donnees ?? {};

  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pharmacyName, city, fullName, phone, email, password }),
    cache: 'no-store',
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(
      { message: messageErreur(body, 'Inscription impossible pour le moment.') },
      { status: response.status },
    );
  }

  return ouvrirSession(request, {
    email,
    password,
    organizationSlug: body.organizationSlug,
    space: 'pharmacy',
  });
}
