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
  "Protocole : passer de seize à quinze centres (§ 4.2.2.2 et § 4.2.3.2) et préciser que le pré-test a lieu dans le seizième centre, exclu de l'échantillon — déjà fait dans le mémoire, à reporter dans le protocole.",
  "Glycémie hors du paquet de soins de la CPN et payée par la femme : vérifier dans les documents du Ministère de la Santé (paquet de la CPN, tarification des centres de santé, couverture de la mutuelle) avant de l'écrire comme un fait dans le mémoire réel.",
  "Mise en forme appliquée (Times New Roman 14, interligne 1,5, marges de 2,5 cm et 3 cm à gauche ; annexes, listes et références en 12 pt à interligne simple) : à confronter au document des règles de rédaction de l'ENATSE.",
  "Limite de 70 pages : le mémoire en compte 69, de la page de garde à l'abstract, annexes comprises, mesurées avec l'interligne 1,5 réel. Pour y tenir, 28 paragraphes des chapitres 1 à 4 du protocole ne sont pas repris (liste CONDENSATION dans faire-memoire.mjs) et le tableau de cohérence (annexe 8 du protocole) n'est pas reproduit : à valider avec la direction de mémoire.",
  `Références ${premiereAjoutee} à ${derniereAjoutee}, ajoutées pendant la rédaction de la discussion : vérifier chacune dans sa source (auteurs, année, volume, pages) avant de la conserver.`,
  "Chiffres nationaux cités dans la discussion (STEPS 2022 [16] : 87,0 % des femmes jamais testées pour la glycémie, 38 % jamais pour la tension ; Meharry 2019 [27] : protocole national de 2012 et prévalence de 3,2 %) : relevés dans les résumés publiés ; les confirmer dans le texte intégral.",
  "Objectif spécifique 1 du protocole : « information capacitances » est une coquille pour « information capacitante » (corrigée dans le rapport et le mémoire, à corriger dans le protocole).",
  "Figure 3 (cadre conceptuel révisé) : proposition issue de résultats SIMULÉS ; avec les données réelles, le cadre révisé sera à reconstruire à partir des codes inductifs réels.",
  "Écart au protocole (QualiCode au lieu de NVivo, § 4.2.6) : à faire valider par la direction de mémoire.",
  "Sommaire et table des matières : déjà remplis dans le fichier livré ; après toute modification, les mettre à jour dans Word (clic droit → Mettre à jour les champs).",
];

export const AVERTISSEMENT = "Exercice de formation : les entretiens, observations et données de routine de ce document sont simulés. Aucun résultat ne décrit le district de Ngoma. Avec les données réelles, tout est à refaire à partir du dossier vierge (kit-donnees-reelles).";
