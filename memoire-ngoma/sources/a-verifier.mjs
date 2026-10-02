// a-verifier.mjs — ce qui reste à compléter ou à vérifier avant tout dépôt.
//
// Repris en dernière page du mémoire et du rapport d'exercice. Ces pages sont
// à RETIRER du document final : elles servent de liste de contrôle.
import { AJOUTEES, PROTOCOLE } from "./references.mjs";

const premiereAjoutee = PROTOCOLE.length + 1;
const derniereAjoutee = PROTOCOLE.length + Object.keys(AJOUTEES).length;

export const A_COMPLETER = [
  "Liste du personnel de l'École : à recopier depuis la liste officielle de l'ENATSE de l'année du dépôt.",
  "Dédicace, et hommages aux membres du jury : à écrire soi-même ; les noms du jury ne sont connus qu'après sa désignation.",
  "Annexe 6 et § 4.2.7 : numéros et dates de l'approbation du comité d'éthique et de l'autorisation du district — jamais inventés, recopiés des documents reçus.",
  "Annexe 5 : versions kinyarwanda et anglaise des outils issues de la traduction et de la rétro-traduction.",
  "Note de positionnalité : la question laissée entre crochets (exercice antérieur dans le district de Ngoma).",
  "Extraits d'entretien : le protocole prévoit leur reproduction dans les deux langues (langue source et traduction). Dans l'exercice, seule la traduction française figure ; avec les données réelles, ajouter la version source de chaque extrait.",
];

export const A_VERIFIER = [
  "Figure 2 (carte du district de Ngoma) : la source n'est pas indiquée dans le protocole ; l'ajouter sous la figure.",
  "Annexe 1 (guide d'entretien) : la numérotation passe de la section 5 à la section 7 dans le protocole ; corriger ou expliquer.",
  "Pré-test : le protocole le situe dans « un centre non retenu », alors que les seize centres du district sont échantillonnés ; préciser où il a eu lieu (district voisin, par exemple).",
  `Références ${premiereAjoutee} à ${derniereAjoutee}, ajoutées pendant la rédaction de la discussion : vérifier chacune dans sa source (auteurs, année, volume, pages) avant de la conserver.`,
  "Chiffres nationaux cités dans la discussion (STEPS 2022 [16] : 87,0 % des femmes jamais testées pour la glycémie, 38 % jamais pour la tension ; Meharry 2019 [27] : protocole national de 2012 et prévalence de 3,2 %) : relevés dans les résumés publiés ; les confirmer dans le texte intégral.",
  "Objectif spécifique 1 du protocole : « information capacitances » est une coquille pour « information capacitante » (corrigée dans le rapport et le mémoire, à corriger dans le protocole).",
  "Écart au protocole (QualiCode au lieu de NVivo, § 4.2.6) : à faire valider par la direction de mémoire.",
  "Dans Word : mettre à jour le sommaire et la table des matières (clic droit → Mettre à jour les champs, ou Ctrl+A puis F9).",
];

export const AVERTISSEMENT = "Exercice de formation : les entretiens, observations et données de routine de ce document sont simulés. Aucun résultat ne décrit le district de Ngoma. Avec les données réelles, tout est à refaire à partir du dossier vierge (kit-donnees-reelles).";
