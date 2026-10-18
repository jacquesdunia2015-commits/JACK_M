import { readSession } from './session';

/** Devise de la pharmacie connectée ; le dollar pour une session plus ancienne. */
export async function deviseSession(): Promise<string> {
  return (await readSession())?.currency ?? 'USD';
}
