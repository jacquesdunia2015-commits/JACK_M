/** Rubriques du rapport mensuel de gestion des stocks (dans l'ordre du rapport). */
export const RUBRIQUES_RAPPORT: { cle: string; libelle: string; court: string }[] = [
  { cle: 'opening', libelle: 'Stock initial', court: 'Initial' },
  { cle: 'received', libelle: 'Quantités reçues', court: 'Reçu' },
  { cle: 'consumed', libelle: 'Quantités consommées', court: 'Consommé' },
  { cle: 'losses', libelle: 'Pertes (péremption, casse)', court: 'Pertes' },
  { cle: 'adjustments', libelle: 'Ajustements (inventaire, transferts, retours)', court: 'Ajust.' },
  { cle: 'closing', libelle: 'Stock final', court: 'Final' },
  { cle: 'stockoutDays', libelle: 'Jours de rupture', court: 'Rupture (j)' },
  { cle: 'amc', libelle: 'Consommation moyenne mensuelle', court: 'CMM' },
  { cle: 'requested', libelle: 'Quantité à commander', court: 'Besoin' },
];

export type CorrespondanceDhis2 = Record<string, { de: string; coc?: string }>;

export interface LigneRapportPublic {
  productId: string; sku: string; nationalCode: string | null; product: string; unit: string;
  opening: number; received: number; consumed: number; losses: number; adjustments: number;
  closing: number; stockoutDays: number; amc: number; requested: number; mapped: boolean; dhis2: CorrespondanceDhis2;
}

export interface ReglagesProgrammes {
  facilityCode: string | null; dhis2OrgUnit: string | null; dhis2DataSet: string | null; maxMonths: number;
}
