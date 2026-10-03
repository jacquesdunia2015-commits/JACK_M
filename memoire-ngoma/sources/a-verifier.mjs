// a-verifier.mjs — ce qui reste à compléter ou à vérifier avant tout dépôt.
//
// Réunis dans la liste de contrôle avant dépôt (document séparé, produit par
// faire-rapport.mjs).
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
  "Figure 2 : carte administrative officielle du profil du district de Ngoma (NISR, recensement 2022, page xi, figure 1.1), citée en source et en bibliographie ; l'image (figures/carte_ngoma_nisr.jpg) reste hors du dépôt, comme les autres figures.",
  "Annexe 1 (guide d'entretien) : la numérotation passe de la section 5 à la section 7 dans le protocole ; corriger ou expliquer.",
  "Protocole : passer de seize à quinze centres (§ 4.2.2.2 et § 4.2.3.2) et préciser que le pré-test a lieu dans le seizième centre, exclu de l'échantillon — déjà fait dans le mémoire, à reporter dans le protocole.",
  "Glycémie de la première CPN demandée par la CPN pour toutes les femmes et réalisée par le laboratoire ; en urgence, glucomètre propre à la CPN quand il existe, sinon appel au laborantin ou passage de la femme au laboratoire ; test interrompu par les ruptures de bandelettes, les pannes et l'absence du laborantin : réalités de terrain rapportées par l'auteur, intégrées aux données d'entraînement. Aucune source publiée consultée ne les décrit : Schmidt et al. (2021) indiquent seulement que le diabète figure parmi les affections recherchées chez toutes à la première CPN au registre de maternité ; Meharry et al. (2019) écrivent que le dépistage du diabète gestationnel n'est pas systématique ; les directives nationales de CPN (RBC, 2021), selon les résumés consultés, décrivent un dépistage par bandelette urinaire orienté par les facteurs de risque. La phrase de la discussion qui le dit (§ 6.2.1) est à vérifier sur le texte des directives, et la pratique à documenter par l'observation réelle (rubrique B bis) ; chercher une note ou circulaire du RBC qui l'aurait instaurée.",
  "Autosurveillance à domicile (tensiomètre ou glucomètre achetés par des femmes de ménages aisés après le diagnostic) : réalité de terrain rapportée par l'auteur, intégrée aux entretiens (code G15) ; aucune source rwandaise trouvée ; la discussion s'appuie sur deux sources non rwandaises vérifiées dans PubMed (Munyungula et Shakwane, 2021, Afrique du Sud : le coût du tensiomètre freine l'autosurveillance des femmes pauvres ; Klatman et al., 2019 : glucomètres et bandelettes chers et rares dans les pays à ressources limitées). Ajouter une relance après Q13 du guide d'entretien pour la documenter.",
  "Mise en forme appliquée à tout le document (Times New Roman 14, interligne 1,5, marges de 2,5 cm et 3 cm à gauche), pages liminaires, listes des tableaux et des figures (chacune sur sa page), références et annexes comprises ; seuls le contenu des tableaux (11 pt, interligne simple), les mentions de source (11 pt), les citations longues en retrait (12 pt, interligne simple) et la liste des références (14 pt, interligne simple dans une référence) font exception : à confronter au document des règles de rédaction de l'ENATSE.",
  "Limite de 72 pages : le mémoire complet en compte 72, de la page de garde à l'abstract, annexes comprises (corps de l'introduction à la conclusion : 37 pages). Pour y tenir, 47 paragraphes et 3 intertitres des chapitres 1 à 3 du protocole ne sont pas repris ou sont résumés (listes CONDENSATION et TITRES_CONDENSES dans faire-memoire.mjs), les méthodes telles que conduites (§ 4.2.5 à 4.2.7), les résultats et la discussion sont resserrés, le tableau des jugements d'équité n'est plus reproduit (ses effectifs figurent dans le texte), et le tableau de cohérence (annexe 8 du protocole) n'est pas reproduit : à valider avec la direction de mémoire.",
  "Entretiens sans enregistrement audio : le § 4.2.6 du mémoire décrit la prise de notes, et les annexes reprises dans le mémoire (guide d'entretien, formulaire de consentement, engagement de confidentialité) ont été adaptées (plus de case « enregistrement audio » ni de transcripteur) ; reporter ces adaptations dans le protocole et dans les formulaires réellement signés, ainsi que dans le mémo QualiCode sur la fidélité des notes.",
  "Rubrique « Glycémie de la première CPN » (B bis : faite ou non, motif, rattrapage) ajoutée à la grille d'observation (annexe 2) : écart au protocole à faire valider.",
  "Rubrique « Séance d'éducation collective » ajoutée à la grille d'observation (annexe 2) : écart au protocole à faire valider ; la fréquence de deux à trois séances par semaine vient de l'information de terrain de l'auteur et sera documentée par l'observation réelle.",
  "Référence Shisha Kibondo (Rwanda Biomedical Centre) : titre exact de la page à vérifier ; catégories ubudehe réformées en 2020 : vérifier les montants de prime en vigueur avant de les citer.",
  `Références ${premiereAjoutee} à ${derniereAjoutee}, ajoutées pendant la rédaction : les articles indexés ont été vérifiés dans PubMed le 2 octobre 2026 (auteurs, revue, volume, pages, DOI) ; restent à vérifier sur pièce les ouvrages et rapports (Lipsky, Marmot, directives du RBC de 2021) et le rapport final de l'EDS 2025, dont les chiffres ont été relevés par l'API du programme DHS. Une affirmation antérieure attribuée à Rurangirwa et al. (2018), absente de l'article, a été retirée.`,
  "Nombre de centres de santé du district : le protocole en compte seize ; une étude de 2015 en recensait douze, et l'annuaire statistique du Ministère de la Santé 2023-2024 compte 44 formations sanitaires dans le district, postes de santé compris. Confirmer la liste actuelle auprès de la direction de la santé du district avant la collecte.",
  "Annexe 9 : le tableau des repères réels cite le Health Labour Market Analysis Report du Ministère de la Santé pour la norme de 21 agents par centre ; en compléter l'année et la référence exacte.",
  "Chiffres nationaux cités dans la discussion (STEPS 2022 [16] : 87,0 % des femmes jamais testées pour la glycémie, 38 % jamais pour la tension ; Meharry 2019 [27] : protocole national de 2012 et prévalence de 3,2 %) : relevés dans les résumés publiés ; les confirmer dans le texte intégral.",
  "Objectif spécifique 1 du protocole : « information capacitances » est une coquille pour « information capacitante » (corrigée dans le rapport et le mémoire, à corriger dans le protocole).",
  "Figure 3 (cadre conceptuel révisé) : proposition issue des résultats de l'entraînement ; avec les données réelles, le cadre révisé sera à reconstruire à partir des codes inductifs réels.",
  "Écart au protocole (QualiCode au lieu de NVivo, § 4.2.6) : à faire valider par la direction de mémoire.",
  "Sommaire et table des matières : déjà remplis dans le fichier livré ; après toute modification, les mettre à jour dans Word (clic droit → Mettre à jour les champs).",
];

export const AVERTISSEMENT = "Version d'entraînement : les entretiens, observations et données de routine sont fictifs. Avant le dépôt, le mémoire est réécrit à partir des données recueillies sur le terrain (dossier kit-donnees-reelles), puis cette liste est parcourue point par point.";
