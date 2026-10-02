import { cache } from 'react';
import { apiSafe } from './api';

interface Contexte {
  permissions: string[];
  modules: string[];
  readonly: boolean;
}

/**
 * Droits de la personne connectée, lus une fois par requête : ses
 * permissions (le gérant a « * ») et les modules de son forfait.
 * Sans réponse de l'API, on ne masque rien : les pages gèrent déjà
 * un refus en s'affichant vides.
 */
export const droits = cache(async () => {
  const ctx = await apiSafe<Contexte | null>('/auth/me', null);
  const peut = (...permissions: string[]) =>
    !ctx || ctx.permissions.includes('*') || permissions.some((p) => ctx.permissions.includes(p));
  const aModule = (module: string) => !ctx || ctx.modules.includes(module);
  return { peut, aModule, connu: Boolean(ctx) };
});
