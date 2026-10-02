/**
 * Niveau d'alerte du stock d'un produit : la couleur affichée à l'écran.
 *
 *   rupture   (rouge)  plus rien en stock ;
 *   critique  (orange) presque épuisé : moins d'une semaine de ventes,
 *                      ou la moitié du seuil de réapprovisionnement ;
 *   bas       (jaune)  il en reste un peu : moins de deux semaines de
 *                      ventes, ou le seuil atteint ;
 *   suffisant (vert)   au-delà.
 *
 * L'estimation repose sur ce que la pharmacie vend réellement : les ventes
 * nettes des retours sur les 30 derniers jours donnent une consommation
 * moyenne par jour, et le stock divisé par cette consommation donne la
 * couverture en jours. Une semaine, c'est le délai courant entre une
 * commande et sa réception ; deux semaines laissent le temps de commander
 * sans urgence.
 *
 * Quand le seuil et les ventes donnent deux avis, le plus prudent l'emporte :
 * un produit qui se vend peu mais dont le seuil est atteint reste signalé.
 * Sans seuil ni vente récente, rien ne permet d'estimer un rythme ; on se
 * rabat alors sur la quantité elle-même (5 unités ou moins : orange,
 * 10 ou moins : jaune).
 */
export type NiveauStock = 'rupture' | 'critique' | 'bas' | 'suffisant';

export const JOURS_CRITIQUE = 7;
export const JOURS_BAS = 14;
export const JOURS_CONSOMMATION = 30;
export const QUANTITE_CRITIQUE_PAR_DEFAUT = 5;
export const QUANTITE_BAS_PAR_DEFAUT = 10;

const GRAVITE: Record<NiveauStock, number> = { rupture: 3, critique: 2, bas: 1, suffisant: 0 };

export interface EvaluationStock {
  niveau: NiveauStock;
  /** Jours de ventes couverts par le stock ; null sans vente récente. */
  couvertureJours: number | null;
  /** Ventes moyennes par jour sur la période observée. */
  consommationJournaliere: number;
}

export function evaluerStock(entree: {
  enStock: number;
  seuil: number;
  ventesPeriode: number;
}): EvaluationStock {
  const consommationJournaliere = Math.max(entree.ventesPeriode, 0) / JOURS_CONSOMMATION;
  const couvertureJours =
    consommationJournaliere > 0 ? Math.max(entree.enStock, 0) / consommationJournaliere : null;

  if (entree.enStock <= 0) {
    return { niveau: 'rupture', couvertureJours, consommationJournaliere };
  }

  const avis: NiveauStock[] = [];
  if (couvertureJours !== null) {
    avis.push(
      couvertureJours < JOURS_CRITIQUE ? 'critique' : couvertureJours < JOURS_BAS ? 'bas' : 'suffisant',
    );
  }
  if (entree.seuil > 0) {
    avis.push(
      entree.enStock <= entree.seuil / 2
        ? 'critique'
        : entree.enStock <= entree.seuil
          ? 'bas'
          : 'suffisant',
    );
  }
  if (avis.length === 0) {
    avis.push(
      entree.enStock <= QUANTITE_CRITIQUE_PAR_DEFAUT
        ? 'critique'
        : entree.enStock <= QUANTITE_BAS_PAR_DEFAUT
          ? 'bas'
          : 'suffisant',
    );
  }

  const niveau = avis.reduce((pire, n) => (GRAVITE[n] > GRAVITE[pire] ? n : pire), 'suffisant');
  return { niveau, couvertureJours, consommationJournaliere };
}
