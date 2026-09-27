const TOKEN_KEY = 'locagest.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* navigation privée : la session ne survivra pas au rechargement */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; raw?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) body = opts.body;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`/api${path}`, { method: opts.method ?? 'GET', headers, body });
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const details = data.details as ApiError['details'];
    const message = details?.length ? details.map((d) => d.message).join(' · ') : data.error ?? `Erreur ${res.status}`;
    throw new ApiError(res.status, message, details);
  }
  if (res.status === 204) return undefined as T;
  return (opts.raw ? res.text() : res.json()) as Promise<T>;
}

/** Ouvre un document HTML de l'API (authentifié) dans un nouvel onglet, prêt à imprimer. */
export async function openDocument(path: string) {
  const win = window.open('', '_blank');
  const html = await api<string>(path, { raw: true });
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  if (win) win.location.href = url;
  else window.location.href = url;
}

export const openContract = (leaseId: number) => openDocument(`/leases/${leaseId}/contract`);

/** Télécharge un fichier de l'API (authentifié), par exemple un export CSV. */
export async function download(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, `Téléchargement impossible (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
