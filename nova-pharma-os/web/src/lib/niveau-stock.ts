import type { CleTraduction } from './i18n';

/**
 * Niveau d'alerte calculé par l'API (voir api/.../inventory/niveau-stock.ts) :
 * rouge, orange, jaune, vert — du plus urgent au plus serein.
 */
export type NiveauStock = 'rupture' | 'critique' | 'bas' | 'suffisant';

export const NIVEAUX: NiveauStock[] = ['rupture', 'critique', 'bas', 'suffisant'];

export const LIBELLE_NIVEAU: Record<NiveauStock, CleTraduction> = {
  rupture: 'stock.rupture',
  critique: 'stock.niveau_critique',
  bas: 'stock.niveau_bas',
  suffisant: 'stock.niveau_suffisant',
};

export function estNiveau(valeur: string | undefined): valeur is NiveauStock {
  return NIVEAUX.includes(valeur as NiveauStock);
}
