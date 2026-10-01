/** Appel JSON au relais de l'API, avec le message d'erreur de l'API en clair. */
export async function envoyer<T = Record<string, unknown>>(
  chemin: string,
  corps?: unknown,
  methode: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST',
): Promise<{ ok: true; body: T } | { ok: false; message: string }> {
  try {
    const r = await fetch(`/api/proxy${chemin}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json' },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = (body as { message?: unknown }).message;
      return { ok: false, message: (Array.isArray(m) ? m.join(' ') : (m as string)) ?? 'Opération refusée.' };
    }
    return { ok: true, body: body as T };
  } catch {
    return { ok: false, message: 'Service injoignable. Réessayez dans un instant.' };
  }
}

/** « 12,5 » ou « 12.5 » → 12.5 ; champ vide → undefined. */
export const nombreSaisi = (v: string): number | undefined => {
  const t = v.replace(/\s/g, '').replace(',', '.');
  return t === '' ? undefined : Number(t);
};
