/** Libellés des dépenses, utilisables côté serveur comme côté client. */
export const CATEGORIES_DEPENSE: Record<string, string> = {
  carburant: 'Carburant du groupe électrogène',
  electricite: 'Électricité (SNEL)',
  eau: 'Eau (REGIDESO)',
  loyer: 'Loyer',
  salaires: 'Salaires et primes',
  transport: 'Transport et livraisons',
  telephone_internet: 'Téléphone et Internet',
  frais_mobile_money: 'Frais Mobile Money',
  frais_bancaires: 'Frais bancaires',
  impots_taxes: 'Impôts et taxes',
  entretien: 'Entretien et réparations',
  fournitures: 'Fournitures et emballages',
  publicite: 'Publicité',
  honoraires: 'Honoraires (comptable, avocat…)',
  assurance: 'Assurances',
  autre: 'Autres dépenses',
};

export const MOYENS_DEPENSE: Record<string, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  bank: 'Banque',
  card: 'Carte',
  other: 'Autre',
};

/** Mois « AAAA-MM » décalé de n mois. */
export function decalerMois(mois: string, n: number): string {
  const [a, m] = mois.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** « 2026-10 » → « octobre 2026 ». */
export const nomMois = (mois: string) =>
  new Date(`${mois}-15T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
