/**
 * Niveau d'alerte d'une date d'expiration : la couleur affichée à côté.
 *
 *   perime       (rouge)  la date est passée ;
 *   proche       (orange) expire dans le délai d'alerte du produit
 *                         (90 jours par défaut, réglable produit par produit) ;
 *   a_surveiller (jaune)  expire dans moins du double de ce délai
 *                         (six mois par défaut) ;
 *   eloignee     (vert)   au-delà.
 *
 * Le calcul part du nombre de jours restants, calculé par PostgreSQL
 * (`date - CURRENT_DATE`) : une seule horloge pour tout le monde.
 */
export type NiveauPeremption = 'perime' | 'proche' | 'a_surveiller' | 'eloignee';

export const JOURS_ALERTE_PAR_DEFAUT = 90;

export function niveauPeremption(
  joursRestants: number | string | null | undefined,
  joursAlerte: number | string | null | undefined = JOURS_ALERTE_PAR_DEFAUT,
): NiveauPeremption | null {
  if (joursRestants === null || joursRestants === undefined || joursRestants === '') return null;
  const jours = Number(joursRestants);
  if (!Number.isFinite(jours)) return null;
  const alerte = Number(joursAlerte) > 0 ? Number(joursAlerte) : JOURS_ALERTE_PAR_DEFAUT;
  if (jours < 0) return 'perime';
  if (jours <= alerte) return 'proche';
  if (jours <= alerte * 2) return 'a_surveiller';
  return 'eloignee';
}
