import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/api';

/**
 * Relais des pages publiques des pharmacies et des SMS transférés par le
 * téléphone marchand : sans session ni jeton, et limité à ces points
 * d'entrée publics de l'API (`/public/pharmacies/...`, `/public/mobile-money/sms/...`).
 */
async function forward(request: NextRequest, path: string[]) {
  const autorise = path[0] === 'pharmacies' || (path[0] === 'mobile-money' && path[1] === 'sms' && request.method === 'POST');
  if (!autorise || path.some((p) => p === '..' || p.includes('/'))) {
    return NextResponse.json({ message: 'Introuvable.' }, { status: 404 });
  }
  const response = await fetch(`${API_URL}/public/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`, {
    method: request.method,
    headers: { 'Content-Type': 'application/json' },
    body: request.method === 'POST' ? await request.text() : undefined,
    cache: 'no-store',
  });
  return new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('content-type') ?? 'application/json' },
  });
}

type Params = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: Params) {
  return forward(request, (await params).path);
}
export async function POST(request: NextRequest, { params }: Params) {
  return forward(request, (await params).path);
}
