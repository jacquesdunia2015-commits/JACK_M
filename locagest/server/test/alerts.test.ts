import { describe, expect, it } from 'vitest';
import { guaranteeLevel, guaranteeThreshold, leasePeriods, paymentState, paymentThreshold } from '../src/lib/alerts.js';
import { addMonths, daysBetween } from '../src/lib/dates.js';

describe('code couleur des garanties (§3.4)', () => {
  it.each([
    [365, 'vert'], [60, 'vert'],
    [59, 'jaune'], [30, 'jaune'],
    [29, 'orange'], [1, 'orange'],
    [0, 'rouge'], [-10, 'rouge'],
  ])('%i jours restants → %s', (days, level) => {
    expect(guaranteeLevel(days)).toBe(level);
  });
});

describe('paliers des emails de garantie (7, 14, 30 jours, puis échéance)', () => {
  it.each([
    [45, null], [30, 30], [20, 30], [14, 14], [10, 14], [7, 7], [1, 7], [0, 0], [-3, 0],
  ])('%i jours → palier %s', (days, t) => {
    expect(guaranteeThreshold(days)).toBe(t);
  });
});

describe('retards de paiement (5, 10, 15 jours)', () => {
  it.each([[0, null], [4, null], [5, 5], [9, 5], [10, 10], [15, 15], [40, 15]])('%i jours → palier %s', (d, t) => {
    expect(paymentThreshold(d)).toBe(t);
  });

  const base = { period: '2026-09-01', startDate: '2026-01-01', rent: 100 };
  it('payé', () => expect(paymentState({ ...base, paid: 100, today: '2026-09-20' }).state).toBe('paye'));
  it('à venir avant l’échéance', () =>
    expect(paymentState({ ...base, startDate: '2026-01-10', paid: 0, today: '2026-09-05' }).state).toBe('a_venir'));
  it('en retard jusqu’à 15 jours', () => {
    const s = paymentState({ ...base, paid: 40, today: '2026-09-11' });
    expect(s).toMatchObject({ state: 'en_retard', daysLate: 10, remaining: 60 });
  });
  it('impayé au-delà de 15 jours', () => expect(paymentState({ ...base, paid: 0, today: '2026-09-20' }).state).toBe('impaye'));
  it('échéance au jour anniversaire du bail', () =>
    expect(paymentState({ ...base, startDate: '2026-01-15', paid: 0, today: '2026-09-20' }).dueDate).toBe('2026-09-15'));
});

describe('dates', () => {
  it('écarts de jours', () => {
    expect(daysBetween('2026-09-26', '2026-10-26')).toBe(30);
    expect(daysBetween('2026-09-26', '2026-09-20')).toBe(-6);
  });
  it('ajout de mois en fin de mois', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });
  it('mois couverts par un bail', () => {
    expect(leasePeriods('2026-07-15', '2027-07-14', '2026-09-26')).toEqual(['2026-07-01', '2026-08-01', '2026-09-01']);
  });
});
