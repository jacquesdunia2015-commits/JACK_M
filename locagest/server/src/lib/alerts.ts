import { daysBetween, addDays, firstOfMonth, addMonths } from './dates.js';

/**
 * Code couleur des garanties (cahier des charges §3.4) :
 *  - vert   : 60 jours ou plus avant expiration
 *  - jaune  : 30 à 59 jours
 *  - orange : 1 à 29 jours
 *  - rouge  : 0 jour ou dépassé
 */
export type AlertLevel = 'vert' | 'jaune' | 'orange' | 'rouge';

export const ALERT_LEVELS: AlertLevel[] = ['rouge', 'orange', 'jaune', 'vert'];

export const ALERT_ACTIONS: Record<AlertLevel, string> = {
  vert: 'Aucune action immédiate',
  jaune: 'Préparer le renouvellement, contacter le locataire',
  orange: 'Relancer le locataire, préparer les documents',
  rouge: 'Action immédiate, régulariser la situation',
};

export function guaranteeLevel(daysRemaining: number): AlertLevel {
  if (daysRemaining <= 0) return 'rouge';
  if (daysRemaining < 30) return 'orange';
  if (daysRemaining < 60) return 'jaune';
  return 'vert';
}

export function guaranteeStatus(expiresOn: string, today: string) {
  const daysRemaining = daysBetween(today, expiresOn);
  const level = guaranteeLevel(daysRemaining);
  return { daysRemaining, level, action: ALERT_ACTIONS[level] };
}

/**
 * Paliers d'emails avant expiration (§3.4 : 7, 14, 30 jours), plus le jour
 * de l'expiration. On n'envoie que le palier le plus proche atteint : un bail
 * saisi à 10 jours de l'échéance reçoit l'alerte « 14 jours », pas aussi
 * celle des 30 jours.
 */
export const GUARANTEE_THRESHOLDS = [30, 14, 7, 0];

export function guaranteeThreshold(daysRemaining: number): number | null {
  const reached = GUARANTEE_THRESHOLDS.filter((t) => daysRemaining <= t);
  return reached.length ? Math.min(...reached) : null;
}

/** Paliers de retard de paiement (§3.5 : après 5, 10, 15 jours). */
export const PAYMENT_THRESHOLDS = [5, 10, 15];

export function paymentThreshold(daysLate: number): number | null {
  const reached = PAYMENT_THRESHOLDS.filter((t) => daysLate >= t);
  return reached.length ? Math.max(...reached) : null;
}

export type PaymentState = 'paye' | 'partiel' | 'a_venir' | 'en_retard' | 'impaye';

/**
 * Statut du loyer d'un mois. Le loyer est dû le jour anniversaire du début
 * du bail (le 1er si le bail commence le 1er). Au-delà de 15 jours de retard
 * sans paiement complet, le loyer est « impayé ».
 */
export function paymentState(opts: { period: string; startDate: string; rent: number; paid: number; today: string }) {
  const dueDay = Math.min(Number(opts.startDate.slice(8, 10)), 28);
  const dueDate = addDays(opts.period, dueDay - 1);
  const daysLate = Math.max(0, daysBetween(dueDate, opts.today));
  let state: PaymentState;
  if (opts.paid >= opts.rent) state = 'paye';
  else if (daysBetween(opts.today, dueDate) > 0) state = opts.paid > 0 ? 'partiel' : 'a_venir';
  else if (daysLate > 15) state = 'impaye';
  else state = 'en_retard';
  return { dueDate, daysLate: state === 'paye' ? 0 : daysLate, state, remaining: Math.max(0, opts.rent - opts.paid) };
}

/** Mois (1er du mois) couverts par un bail, jusqu'à `until` inclus. */
export function leasePeriods(startDate: string, endDate: string, until: string): string[] {
  const out: string[] = [];
  const last = firstOfMonth(endDate < until ? endDate : until);
  for (let p = firstOfMonth(startDate); p <= last; p = addMonths(p, 1)) out.push(p);
  return out;
}
