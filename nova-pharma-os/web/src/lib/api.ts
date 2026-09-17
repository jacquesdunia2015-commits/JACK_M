import { readSession } from './session';

export const API_URL = process.env.NOVA_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Appelle l'API depuis le serveur Next, en joignant le jeton de session.
 * Le navigateur ne voit jamais ni l'URL de l'API ni le jeton.
 */
export async function api<T = unknown>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const token = init.token ?? (await readSession())?.accessToken;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.message ?? `Erreur ${response.status}`,
      body?.details,
    );
  }
  return body as T;
}

/** Variante tolérante : renvoie `fallback` plutôt que de faire échouer la page. */
export async function apiSafe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await api<T>(path);
  } catch {
    return fallback;
  }
}
