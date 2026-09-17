import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';
import { readSession } from '@/lib/session';

/**
 * Relais vers l'API pour les écrans interactifs.
 *
 * Le composant client appelle `/api/proxy/...` sans jamais manipuler de
 * jeton : c'est ce relais, côté serveur, qui l'ajoute. Une faille XSS ne
 * permettrait donc pas d'exfiltrer une session.
 */
async function forward(request: NextRequest, path: string[]) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ message: 'Session expirée.' }, { status: 401 });
  }

  const target = `${API_URL}/${path.join('/')}${request.nextUrl.search}`;
  const body =
    request.method === 'GET' || request.method === 'DELETE'
      ? undefined
      : await request.text();

  const response = await fetch(target, {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
      ...(request.headers.get('x-branch-id')
        ? { 'X-Branch-Id': request.headers.get('x-branch-id') as string }
        : {}),
    },
    body,
    cache: 'no-store',
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Params = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: Params) {
  return forward(request, (await params).path);
}
export async function POST(request: NextRequest, { params }: Params) {
  return forward(request, (await params).path);
}
export async function PATCH(request: NextRequest, { params }: Params) {
  return forward(request, (await params).path);
}
export async function PUT(request: NextRequest, { params }: Params) {
  return forward(request, (await params).path);
}
export async function DELETE(request: NextRequest, { params }: Params) {
  return forward(request, (await params).path);
}
