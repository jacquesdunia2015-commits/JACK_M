import { config } from './config.js';

/** Date du jour « AAAA-MM-JJ » dans le fuseau de l'application. */
export function today(tz = config.timezone): string {
  // en-CA formate en AAAA-MM-JJ
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  );
}

function toUtc(d: string): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

/** Nombre de jours de `from` à `to` (négatif si `to` est passé). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function addDays(d: string, n: number): string {
  return new Date(toUtc(d) + n * 86_400_000).toISOString().slice(0, 10);
}

export function addMonths(d: string, n: number): string {
  const [y, m, day] = d.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function firstOfMonth(d: string): string {
  return d.slice(0, 8) + '01';
}
