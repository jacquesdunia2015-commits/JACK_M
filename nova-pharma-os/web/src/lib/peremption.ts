import type { CleTraduction } from './i18n';

/**
 * Couleur d'une date d'expiration, calculée par l'API
 * (api/src/common/niveau-peremption.ts) :
 *   perime rouge · proche orange · a_surveiller jaune · eloignee vert.
 */
export type NiveauPeremption = 'perime' | 'proche' | 'a_surveiller' | 'eloignee';

export const NIVEAUX_PEREMPTION: NiveauPeremption[] = ['perime', 'proche', 'a_surveiller', 'eloignee'];

/** Mêmes couleurs que les niveaux de stock (classes .niveau.*). */
export const CLASSE_PEREMPTION: Record<NiveauPeremption, string> = {
  perime: 'rupture',
  proche: 'critique',
  a_surveiller: 'bas',
  eloignee: 'suffisant',
};

export const CLE_PEREMPTION: Record<NiveauPeremption, CleTraduction> = {
  perime: 'peremption.perime',
  proche: 'peremption.proche',
  a_surveiller: 'peremption.a_surveiller',
  eloignee: 'peremption.eloignee',
};

/** Libellés français, pour les écrans qui ne sont pas encore traduits. */
export const LIBELLES_PEREMPTION: Record<NiveauPeremption, string> = {
  perime: 'Périmé',
  proche: 'Expire bientôt',
  a_surveiller: 'À surveiller',
  eloignee: 'Date éloignée',
};

export function estNiveauPeremption(valeur: string | undefined): valeur is NiveauPeremption {
  return NIVEAUX_PEREMPTION.includes(valeur as NiveauPeremption);
}

/**
 * Date AAAA-MM-JJ (ou horodatage ISO) en JJ/MM/AAAA, lue sans objet Date
 * pour ne pas la décaler d'un jour selon le fuseau horaire.
 */
export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [annee, mois, jour] = String(iso).slice(0, 10).split('-');
  return `${jour}/${mois}/${annee}`;
}
