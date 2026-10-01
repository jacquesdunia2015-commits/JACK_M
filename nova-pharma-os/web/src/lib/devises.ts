/** Taux du jour tel que l'API le renvoie : « 1 base = rate quote ». */
export interface TauxDuJour {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate: string;
  change_rounding: string;
  created_at: string;
  set_by_name?: string | null;
}

/** L'autre devise de la caisse, à côté de celle de la pharmacie. */
export function autreDevise(taux: TauxDuJour | null, devise: string): string | null {
  if (!taux) return null;
  if (taux.base_currency === devise) return taux.quote_currency;
  if (taux.quote_currency === devise) return taux.base_currency;
  return null;
}

export function convertir(montant: number, de: string, vers: string, taux: TauxDuJour | null): number {
  if (de === vers || !taux) return montant;
  const r = Number(taux.rate);
  if (de === taux.base_currency && vers === taux.quote_currency) return montant * r;
  if (de === taux.quote_currency && vers === taux.base_currency) return montant / r;
  return montant;
}

/** Arrondi à la coupure qui circule (pas fixé pour la devise cotée), au centime sinon. */
export function arrondirMonnaie(montant: number, devise: string, taux: TauxDuJour | null): number {
  const pas = taux && devise === taux.quote_currency ? Number(taux.change_rounding) : 0;
  if (pas > 0) return Math.round(montant / pas) * pas;
  return Math.round(montant * 100) / 100;
}

/** Montant à demander dans une devise : arrondi à la coupure supérieure, pour ne jamais manquer. */
export function aPayer(montant: number, devise: string, taux: TauxDuJour | null): number {
  const pas = taux && devise === taux.quote_currency ? Number(taux.change_rounding) : 0;
  if (pas > 0) return Math.ceil(montant / pas - 1e-9) * pas;
  return Math.ceil(montant * 100 - 1e-9) / 100;
}

/** Le taux a-t-il été fixé aujourd'hui (heure du poste) ? */
export function fixeAujourdhui(taux: TauxDuJour | null): boolean {
  if (!taux) return false;
  return new Date(taux.created_at).toDateString() === new Date().toDateString();
}
