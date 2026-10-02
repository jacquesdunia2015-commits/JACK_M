// faire-rapport.mjs — produit le RAPPORT DE MÉMOIRE (exercice) au format Word :
// une synthèse d'une dizaine de pages destinée aux lecteurs qui ne liront pas
// le mémoire entier (direction de mémoire, district, centres participants).
//
// Usage : node faire-rapport.mjs ../livrables
//
// Tout chiffre vient de calculs.mjs ; les thèmes et les recommandations sont
// ceux des chapitres 5 et 6 (mêmes sources) ; les citations sont reprises du
// chapitre 5 et revérifiées. Les numéros de référence sont ceux du mémoire
// complet ; seules les références citées ici sont listées.
// Contrôles : aucun code de centre ; aucun paragraphe n'associe un participant
// à un centre ; aucun champ {…} non remplacé ; toute référence existe.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, titre1, titre2, vide, saut, tableau, pageDeGarde, stylesCommuns, encadreRouge,
} from "./mise-en-page.mjs";
import { calculs } from "./calculs.mjs";
import { numeroteur, PROTOCOLE } from "./references.mjs";
import { blocs as blocsResultats, THEMES } from "./resultats.mjs";
import { recommandations } from "./discussion.mjs";
import { legende, source, rendu } from "./rendu.mjs";
import { A_COMPLETER, A_VERIFIER, AVERTISSEMENT } from "./a-verifier.mjs";

const require = createRequire(import.meta.url);
const { Footer, PageNumber } = require("docx");
const JSZip = require("jszip");

const dossier = process.argv[2] || ".";
const calc = await calculs(dossier);
const { valeurs: v, verifierCitation, etiquette } = calc;

// Références : numérotation du mémoire, relevé de celles qui sont citées ici.
// Le rapport ne cite que des références du protocole ({p:n}), dont le numéro
// est le même dans le mémoire quel que soit l'ordre de citation.
const base = numeroteur();
const citees = new Set();
const refs = {
  protocole(n) { base.protocole(n); citees.add(n); return n; },
  numero() { throw new Error("le rapport ne cite que des références du protocole ({p:n})"); },
};
const { runs, paragraphe, citation } = rendu({ remplir: calc.remplir, refs, etiquette });
const puce = t => new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, alignment: AlignmentType.JUSTIFIED, children: runs(t) });

// Citations : reprises du chapitre 5 (déjà contrôlées), revérifiées ici.
const extrait = (code, debut) => {
  const b = blocsResultats.find(x => x.cite === code && x.t.startsWith(debut));
  if (!b) throw new Error(`citation introuvable dans le chapitre 5 : ${code} « ${debut} »`);
  verifierCitation(b);
  return citation(b);
};

/* ---------- Messages clés ---------- */
const MESSAGES = [
  "Le dépistage est coupé en deux. La tension est mesurée en CPN ; la glycémie se fait au laboratoire ou à la consultation des maladies chroniques. Aucun des {v:nbCentres} centres n'avait de glucomètre en salle de CPN, et la glycémie n'était accessible à la femme enceinte que dans {v:glycPossible} d'entre eux.",
  "L'explication — la part du dépistage qui permet à la femme d'agir — se raccourcit pour celles qui arrivent tard, posent peu de questions ou n'ont pas d'autre source d'information : elle est distribuée à l'inverse des besoins.",
  "Le dépistage ne figure dans aucun indicateur de la CPN : ses intrants ne sont pas suivis, ses appareils pas réparés, ses actes pas supervisés. Le contrôle porte sur la complétude du registre, qui peut masquer l'inégalité.",
  "La référence dépend d'un véhicule et revient rarement ; le suivi s'interrompt à l'accouchement.",
  "Les participants jugent ces différences inacceptables, reconnaissent une part qui leur revient et proposent des changements concrets : un circuit de la CPN vers le laboratoire, une ligne dans le rapport mensuel, un support visuel commun.",
];

/* ---------- Corps du rapport ---------- */
const enfants = [];
enfants.push(...pageDeGarde("Rapport de mémoire (rédaction d'exercice)",
  "Synthèse du mémoire à l'intention des lecteurs qui ne liront pas le document entier : direction de mémoire, direction de la santé du district, responsables des centres participants.\n\n" +
  "Les chiffres sont calculés à partir du projet d'analyse ; les thèmes, les citations et les recommandations sont ceux des chapitres 5 et 6. Les numéros entre crochets renvoient à la bibliographie du mémoire complet.\n\n" +
  "Ce texte est un MODÈLE de forme, rédigé sur des données simulées. Le rapport réel portera sur les résultats réels et ne reprendra rien de celui-ci.",
  `${v.nbInf} infirmiers ou infirmières et ${v.nbSf} sages-femmes, ${v.nbCentres} centres de santé, en deux vagues`));

enfants.push(saut(), titre1("MESSAGES CLÉS"), ...MESSAGES.map(puce));

enfants.push(titre1("1. CONTEXTE ET JUSTIFICATION"),
  paragraphe("L'hypertension artérielle et le diabète de la grossesse exposent la mère et l'enfant à des complications évitables, à condition d'être détectés et pris en charge à temps. La consultation prénatale est le contact le plus régulier entre une femme jeune et un professionnel qualifié ; l'Organisation mondiale de la Santé y recommande la mesure systématique de la pression artérielle et un dépistage du diabète orienté par les facteurs de risque {p:11}. Le Rwanda a adopté le paquet d'interventions essentielles de l'OMS contre les maladies non transmissibles {p:14}."),
  paragraphe("Les données nationales montrent l'écart entre ces recommandations et la pratique. Selon l'enquête STEPS de 2022, 87,0 % des femmes n'avaient jamais eu de mesure de la glycémie, contre 38 % qui n'avaient jamais eu de mesure de la tension {p:16}. Le dépistage du diabète gestationnel n'est pas systématique ; le protocole national de 2012 prévoit une glycémie capillaire à jeun et une épreuve de charge entre 24 et 28 semaines, et la seule estimation de prévalence en centre de santé public, 3,2 %, provient d'une étude de recherche {p:27}."),
  paragraphe("Au regard de la Charte d'Ottawa {p:23}, intégrer ce dépistage à la CPN est une réorientation des services, dont la portée dépend de ceux qui la réalisent : un dépistage n'est capacitant que si son résultat est expliqué et compris. L'étude s'intéresse donc aux infirmiers et sages-femmes de CPN, et à la manière dont ce dépistage se distribue entre les femmes."));

enfants.push(titre1("2. OBJECTIFS"),
  paragraphe("Objectif général. Analyser les perceptions et les pratiques déclarées des infirmiers et sages-femmes exerçant en consultation prénatale dans les centres de santé du district de Ngoma (Rwanda) à l'égard du dépistage de l'hypertension artérielle et du diabète chez la femme enceinte, et la portée qu'ils reconnaissent en matière d'équité d'accès au dépistage."),
  puce("Objectif spécifique 1 (OS1) : décrire le sens attribué à ce dépistage ainsi que les pratiques déclarées de dépistage et d'information capacitante auprès des femmes enceintes."),
  puce("Objectif spécifique 2 (OS2) : examiner les conditions individuelles, organisationnelles, systémiques et sociales perçues comme facilitant ou limitant ce dépistage, la portée reconnue en équité et les changements jugés nécessaires."));

enfants.push(titre1("3. MÉTHODES"),
  legende("Tableau 1. Méthodes en bref"),
  tableau([
    ["Élément", "Description"],
    ["Type d'étude", "Qualitative descriptive"],
    ["Cadre", `District de Ngoma (Province de l'Est) : les ${v.nbCentres} centres de santé`],
    ["Participants", calc.remplir("{N} prestataires de CPN ({v:nbInf} infirmiers ou infirmières, {v:nbSf} sages-femmes, dont {v:nbTitulaires} titulaires), échantillonnage à variation maximale")],
    ["Collecte", calc.remplir("Entretiens semi-structurés ({v:dureeMin} à {v:dureeMax} minutes) ; observation non participante d'une demi-journée par centre, service de CPN et laboratoire ; données de routine du district")],
    ["Analyse", "Analyse thématique en six phases, codage hybride (déductif à partir du cadre conceptuel, inductif)"],
    ["Rigueur", calc.remplir("Double codage indépendant (κ = {v:kappaInter}) et recodage intra-codeur (κ = {v:kappaIntra}) ; triangulation des sources ; retour des interprétations à des participants volontaires ; grille COREQ")],
    ["Éthique", "Consentement écrit ; accords distincts pour l'enregistrement et la citation ; codes de participant et de centre jamais associés ; approbation éthique et autorisation du district [références à compléter]"],
  ], [2200, 6826]),
  source("chapitre 4 du mémoire"));

enfants.push(titre1("4. PRINCIPAUX RÉSULTATS"),
  titre2("4.1. Le glucomètre est au laboratoire, pas en CPN"),
  paragraphe("Le jour de l'observation, le tensiomètre était présent en salle de CPN dans les {v:nbCentres} centres. La glycémie, elle, relevait d'un autre service (tableau 2)."),
  legende("Tableau 2. Accès de la femme enceinte à la glycémie, le jour de l'observation"),
  tableau([
    ["Situation observée", "Centres"],
    ["Glucomètre en salle de CPN", String(v.glucoEnCpn)],
    ["Glycémie réalisable au laboratoire, sur bon de la CPN", String(v.glycPossible)],
    ["Glucomètre et bandelettes réservés à la consultation des maladies chroniques", String(v.glycMnt)],
    ["Glycémie impossible : appareil en panne, bandelettes absentes ou périmées", String(v.glucoInutilisable)],
    ["Pas de glucomètre dans le centre", String(v.glucoAbsent)],
    ["Total", String(v.nbCentres)],
  ], [7026, 2000]),
  source("observation non participante des services de CPN et des laboratoires"),
  ...extrait("P20", "Le sucre, il y a un appareil"),
  titre2("4.2. Sept thèmes"),
  paragraphe("L'analyse a dégagé sept thèmes, dont deux répondent au premier objectif et cinq au second (tableau 3)."),
  legende("Tableau 3. Synthèse des thèmes"),
  tableau([["Thème", "Objectif", "Énoncé"], ...THEMES], [3000, 1400, 4626]),
  source("chapitre 5 du mémoire"),
  titre2("4.3. Trois propos qui résument"),
  ...extrait("P04", "Si vous venez à sept heures trente"),
  ...extrait("P07", "Le fer, on l'a toujours"),
  ...extrait("P07", "Aujourd'hui je réfère dans le vide"),
  titre2("4.4. Ce que l'observation confirme ou nuance"),
  paragraphe("La confrontation des entretiens avec l'observation et les données de routine a produit {v:nbConstats} constats : {v:nbConcordances} concordances et {v:nbEcarts} écarts entre pratiques déclarées et pratiques observées. L'observation a notamment permis de situer le glucomètre, ce que les entretiens seuls n'établissaient pas."));

enfants.push(titre1("5. POINTS DE DISCUSSION"),
  puce("Deux programmes dans le même centre. La glycémie appartient au programme des maladies non transmissibles, la CPN au programme de santé maternelle. Tant que ce partage n'est pas organisé, la femme enceinte reste en dehors du circuit du glucomètre, ce qui rejoint le caractère non systématique du dépistage rapporté au niveau national {p:27}."),
  puce("L'explication, distribuée à l'inverse des besoins. L'inégalité ne tient pas seulement à l'accès au test, mais au temps d'explication, qui se raréfie là où il serait le plus utile ; c'est la dimension capacitante du dépistage qui se distribue mal {p:23}."),
  puce("Ce qui est compté existe. Les indicateurs orientent intrants, maintenance et supervision. Un dépistage absent du rapport mensuel n'est ni approvisionné ni contrôlé, et un contrôle de complétude du registre peut produire une égalité apparente."),
  puce("La dotation ne suffit pas. Là où l'équipement est présent, l'inégalité du test disparaît mais celle de l'explication demeure : la réponse ne peut être seulement matérielle."));

enfants.push(titre1("6. RECOMMANDATIONS"),
  legende("Tableau 4. Recommandations par destinataire"),
  tableau([["Destinataire", "Recommandations", "Résultats d'appui"], ...recommandations], [2200, 5126, 1700]),
  source("chapitre 6 du mémoire"));

enfants.push(titre1("7. LIMITES"),
  paragraphe("Les résultats portent sur des perceptions et des pratiques déclarées ; le point de vue des femmes n'a pas été recueilli. L'observation, d'une demi-journée par centre, est exposée à un effet de la présence de l'observateur. Les données de routine, de qualité limitée {p:69}, ne servent qu'à décrire le contexte. L'étude porte sur un seul district : ses résultats ne se généralisent pas, mais la description du contexte permet d'apprécier leur transférabilité."));

enfants.push(titre1("8. CONCLUSION"),
  paragraphe("Le dépistage de l'hypertension et du diabète en CPN est accepté par les professionnels comme relevant de leur mandat, mais il n'est réalisé qu'à moitié : la tension est mesurée, la glycémie dépend d'un circuit qui n'est ouvert à la femme enceinte que dans {v:glycPossible} centres sur {v:nbCentres}. Rattacher la glycémie à la CPN, compter les actes de dépistage et leur suite, et soutenir la pratique informative sont les trois leviers qui ressortent de l'étude."));

// Références citées dans le rapport.
enfants.push(titre1("RÉFÉRENCES CITÉES"),
  paragraphe("Numérotation de la bibliographie du mémoire complet."),
  ...[...citees].sort((a, b) => a - b).map(n => new Paragraph({ spacing: { after: 80 }, indent: { left: 567, hanging: 567 },
    children: [new TextRun({ text: `${n}.\t${PROTOCOLE[n - 1]}`, size: 20 })] })));

// Page d'exercice.
enfants.push(saut(), encadreRouge("PAGE D'EXERCICE — À RETIRER", AVERTISSEMENT), vide(),
  titre2("Ce qui reste à compléter"), ...A_COMPLETER.map(t => new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: t, size: 21 })] })),
  titre2("Ce qui reste à vérifier"), ...A_VERIFIER.map(t => new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: t, size: 21 })] })));

/* ---------- Assemblage et contrôles ---------- */
const pied = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
  new TextRun({ text: "Rapport de mémoire Ngoma — exercice de formation, données simulées · ", size: 16, color: "888888" }),
  new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
] })] });
const tampon = await Packer.toBuffer(new Document({ styles: stylesCommuns(), sections: [{ footers: { default: pied }, children: enfants }] }));
const xml = await (await JSZip.loadAsync(tampon)).file("word/document.xml").async("string");
const texte = xml.replace(/<[^>]+>/g, "");
const centres = texte.match(/\bCS\d{2}\b/g);
if (centres) throw new Error(`le rapport désigne des centres : ${[...new Set(centres)].join(", ")}`);
const libres = texte.match(/\{[A-Za-z]+:[^}]*\}|\{N\}/g);
if (libres) throw new Error(`champs non remplacés : ${[...new Set(libres)].join(", ")}`);

const fichier = `${dossier}/7_Rapport_de_memoire_SIMULATION.docx`;
writeFileSync(fichier, tampon);
console.log("écrit :", fichier);
console.log(`  ${citees.size} références citées (${[...citees].sort((a, b) => a - b).join(", ")}) · ${Math.round(texte.length / 1000)} k caractères`);
