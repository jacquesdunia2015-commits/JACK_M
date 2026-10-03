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
import { numeroteur, PROTOCOLE, AJOUTEES } from "./references.mjs";
import { blocs as blocsResultats, THEMES } from "./resultats.mjs";
import { recommandations } from "./discussion.mjs";
import { legende, source, rendu } from "./rendu.mjs";
import { A_COMPLETER, A_VERIFIER, AVERTISSEMENT } from "./a-verifier.mjs";
import { stylesAcademiques, pageAcademique, appliquerGabarit } from "./gabarit-academique.mjs";
import { renumeroter } from "./vancouver.mjs";

const require = createRequire(import.meta.url);
const { Footer, PageNumber } = require("docx");
const JSZip = require("jszip");

const dossier = process.argv[2] || ".";
const calc = await calculs(dossier);
const { valeurs: v, verifierCitation, etiquette } = calc;

// Références : numérotation provisoire, relevé de celles qui sont citées ici.
// Le rapport cite des références du protocole ({p:n}) et des références
// ajoutées ({c:cle}) ; renumeroter() les numérote ensuite dans l'ordre de
// première citation.
const base = numeroteur();
const citees = new Set();
const ajoutees = new Map();
const refs = {
  protocole(n) { base.protocole(n); citees.add(n); return n; },
  numero(cle) { const n = base.numero(cle); citees.add(n); ajoutees.set(n, AJOUTEES[cle]); return n; },
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
  "Le dépistage est coupé en deux. La tension est mesurée à chaque visite ; la glycémie, prévue pour toutes à la première CPN, se fait au laboratoire ou à la consultation des maladies chroniques. Aucun des {v:nbCentres} centres n'avait de glucomètre en salle de CPN ; le test de la première CPN n'était effectivement réalisé que dans {v:glycPossible} d'entre eux, et aucun ne le refaisait de façon systématique entre 24 et 28 semaines, quand apparaît le diabète gestationnel.",
  "L'explication — la part du dépistage qui permet à la femme d'agir — se raccourcit pour celles qui arrivent tard, posent peu de questions ou n'ont pas d'autre source d'information : elle est distribuée à l'inverse des besoins. La séance d'éducation collective, tenue deux à trois matins par semaine, donne à toutes les présentes la même information, mais parle peu de la tension, presque jamais du sucre, et manque les femmes arrivées après elle.",
  "Le dépistage ne figure dans aucun indicateur de la CPN : ses intrants ne sont pas suivis, ses appareils pas réparés, ses actes pas supervisés. Le contrôle porte sur la complétude du registre, qui peut masquer l'inégalité.",
  "La référence dépend d'un véhicule et revient rarement ; le suivi s'interrompt à l'accouchement. L'attente du conjoint pour la première CPN retarde la glycémie ; l'alerte téléphonique des ASM organise l'urgence, pas le contrôle d'une tension élevée.",
  "Les participants jugent ces différences inacceptables, reconnaissent une part qui leur revient et proposent des changements concrets : un circuit de la CPN vers le laboratoire, une ligne dans le rapport mensuel, un support visuel commun.",
];

/* ---------- Corps du rapport ---------- */
const enfants = [];
enfants.push(...pageDeGarde("Rapport de mémoire",
  "Synthèse du mémoire à l'intention des lecteurs qui ne liront pas le document entier : direction de mémoire, direction de la santé du district, responsables des centres participants.\n\n" +
  "Les chiffres sont calculés à partir du projet d'analyse ; les thèmes, les citations et les recommandations sont ceux des chapitres 5 et 6. Les références sont numérotées dans l'ordre de leur première citation (Vancouver).",
  `${v.nbInf} infirmiers ou infirmières et ${v.nbSf} sages-femmes, ${v.nbCentres} centres de santé, en deux vagues`));

enfants.push(saut(), titre1("MESSAGES CLÉS"), ...MESSAGES.map(puce));

enfants.push(titre1("1. CONTEXTE ET JUSTIFICATION"),
  paragraphe("L'hypertension artérielle et le diabète de la grossesse exposent la mère et l'enfant à des complications évitables, à condition d'être détectés et pris en charge à temps. La consultation prénatale est le contact le plus régulier entre une femme jeune et un professionnel qualifié ; l'Organisation mondiale de la Santé y recommande la mesure systématique de la pression artérielle et un dépistage du diabète orienté par les facteurs de risque {p:11}. Le Rwanda a adopté le paquet d'interventions essentielles de l'OMS contre les maladies non transmissibles {p:14}."),
  paragraphe("Les données nationales montrent l'écart entre ces recommandations et la pratique. Selon l'enquête STEPS de 2022, 87,0 % des femmes n'avaient jamais eu de mesure de la glycémie, contre 38 % qui n'avaient jamais eu de mesure de la tension {p:16} ; en CPN, la tension a été mesurée chez 93,5 % des femmes suivies dans la province de l'Est selon l'EDS 2025 {c:eds2025}. Le dépistage du diabète gestationnel n'est pas systématique ; le protocole national de 2012 prévoit une glycémie capillaire à jeun et une épreuve de charge entre 24 et 28 semaines, et la seule estimation de prévalence en centre de santé public, 3,2 %, provient d'une étude de recherche {p:27}."),
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
    ["Cadre", `District de Ngoma (Province de l'Est) : ${v.nbCentres} des 16 centres de santé, le seizième ayant servi au pré-test`],
    ["Participants", calc.remplir("{N} prestataires de CPN ({v:nbInf} infirmiers ou infirmières, {v:nbSf} sages-femmes, dont {v:nbTitulaires} titulaires), échantillonnage à variation maximale")],
    ["Collecte", calc.remplir("Entretiens semi-structurés ({v:dureeMin} à {v:dureeMax} minutes) ; observation non participante d'une demi-journée par centre, service de CPN et laboratoire ; données de routine du district")],
    ["Analyse", "Analyse thématique en six phases, codage hybride (déductif à partir du cadre conceptuel, inductif)"],
    ["Rigueur", calc.remplir("Double codage à l'aveugle de {v:relusInter} entretiens sur {N} (κ de Cohen par paragraphe = {v:kappaInter}) et recodage intra-codeur à quatre semaines (κ = {v:kappaIntra}), désaccords tranchés en consensus ; triangulation des sources ; retour des interprétations à des participants volontaires ; grille COREQ")],
    ["Éthique", "Consentement écrit ; accord distinct pour la citation ; entretiens notés, sans enregistrement ; codes de participant et de centre jamais associés ; approbation éthique et autorisation du district [références à compléter]"],
  ], [2200, 6826]),
  source("chapitre 4 du mémoire"));

enfants.push(titre1("4. PRINCIPAUX RÉSULTATS"),
  titre2("4.1. Le glucomètre est au laboratoire, pas en CPN"),
  paragraphe("Le jour de l'observation, le tensiomètre était présent en salle de CPN dans les {v:nbCentres} centres. La glycémie, elle, relevait d'un autre service (tableau 2)."),
  legende("Tableau 2. Accès de la femme enceinte à la glycémie, le jour de l'observation"),
  tableau([
    ["Situation observée", "Centres"],
    ["Glucomètre en salle de CPN", String(v.glucoEnCpn)],
    ["Glycémie de la première CPN réalisée au laboratoire, sur bon de la CPN", String(v.glycPossible)],
    ["   dont glycémie refaite systématiquement à 24-28 semaines", String(v.glycT3Systematique)],
    ["Glucomètre et bandelettes réservés à la consultation des maladies chroniques", String(v.glycMnt)],
    ["Glycémie impossible : appareil en panne, bandelettes absentes ou périmées", String(v.glucoInutilisable)],
    ["Pas de glucomètre dans le centre", String(v.glucoAbsent)],
    ["Total", String(v.nbCentres)],
  ], [7026, 2000]),
  source("observation non participante des services de CPN et des laboratoires"),
  ...extrait("P20", "Le sucre, normalement c'est pour toutes"),
  titre2("4.2. Sept thèmes"),
  paragraphe("L'analyse a dégagé sept thèmes, dont deux répondent au premier objectif et cinq au second (tableau 3)."),
  legende("Tableau 3. Synthèse des thèmes"),
  tableau([["Thème", "Objectif", "Énoncé"], ...THEMES], [3000, 1400, 4626]),
  source("chapitre 5 du mémoire"),
  titre2("4.3. Un propos qui résume"),
  ...extrait("P04", "Si vous venez à sept heures trente"),
  titre2("4.4. Ce que l'observation confirme ou nuance"),
  paragraphe("La confrontation des entretiens avec l'observation et les données de routine a produit {v:nbConstats} constats : {v:nbConcordances} concordances et {v:nbEcarts} écarts ; elle seule a permis de situer le glucomètre."));

enfants.push(titre1("5. POINTS DE DISCUSSION"),
  puce("Deux programmes dans le même centre. La glycémie relève du programme des maladies non transmissibles, la CPN de la santé maternelle : sans organisation de ce partage, la femme enceinte reste hors du circuit du glucomètre, comme le suggère le caractère non systématique du dépistage au niveau national {p:27}."),
  puce("Un test unique, trop précoce. La glycémie de la première CPN repère un diabète préexistant ; le diabète gestationnel apparaît entre 24 et 28 semaines, période où le protocole national prévoit une épreuve de charge {p:27} que les centres ne pratiquent pas, alors que le contact de 26 semaines s'y prêterait {c:rbcAnc}."),
  puce("L'explication, distribuée à l'inverse des besoins. L'inégalité ne tient pas seulement à l'accès au test, mais au temps d'explication, qui se raréfie là où il serait le plus utile ; c'est la dimension capacitante du dépistage qui se distribue mal {p:23}."),
  puce("Ce qui est compté existe. Un dépistage absent du rapport mensuel n'est ni approvisionné ni contrôlé, et le contrôle de complétude du registre peut produire une égalité apparente. Le financement basé sur la performance rémunère la première CPN précoce et les quatre visites {c:schmidt} ; son effet est plus net sur les services les mieux payés et les moins exigeants {c:basinga}."),
  puce("La séance collective, levier à orienter. Égale pour les présentes, elle ne restitue aucun résultat et manque celles qui arrivent tard ; y inscrire la tension et le sucre et la relayer vers les familles (ASM, umugoroba w'ababyeyi {c:nsanzabera}) en ferait un instrument d'équité {p:66}."),
  puce("La dotation ne suffit pas. L'équipement réduit l'inégalité du test, pas celles de la référence et de l'explication."));

enfants.push(titre1("6. RECOMMANDATIONS"),
  legende("Tableau 4. Recommandations par destinataire"),
  tableau([["Destinataire", "Recommandations", "Résultats d'appui"], ...recommandations], [2200, 5126, 1700]),
  source("chapitre 6 du mémoire"));

enfants.push(titre1("7. LIMITES"),
  paragraphe("Pratiques déclarées et représentations professionnelles ; point de vue des femmes non recueilli ; propos notés sans enregistrement ; effet possible de la présence de l'observateur ; données de routine de qualité limitée ; un seul district, dont la description permet d'apprécier la transférabilité."));

enfants.push(titre1("8. CONCLUSION"),
  paragraphe("Le dépistage de l'hypertension et du diabète en CPN est accepté par les professionnels comme relevant de leur mandat, mais réalisé à moitié : la tension est mesurée ; la glycémie, prévue pour toutes à la première CPN, n'est faite que dans {v:glycPossible} centres sur {v:nbCentres} et n'est pas refaite entre 24 et 28 semaines. Trois leviers ressortent : garantir le test initial et rendre praticable celui de 24-28 semaines, compter les actes de dépistage et leur suite, soutenir la pratique informative."));

// Références citées dans le rapport.
// Les numéros du protocole sont renumérotés dans l'ordre de citation (vancouver.mjs).
enfants.push(titre1("RÉFÉRENCES"),
  ...[...citees].sort((a, b) => a - b).map(n => new Paragraph({ style: "Bibliographie",
    children: [new TextRun({ text: `${n}.\t${n <= PROTOCOLE.length ? PROTOCOLE[n - 1] : ajoutees.get(n)}` })] })));


/* ---------- Assemblage et contrôles ---------- */
const pied = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
  new TextRun({ text: "Rapport de mémoire — MUKAKI DUNIA Jacques · version d'entraînement · ", size: 16, color: "888888" }),
  new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
] })] });
const zipRapport = await JSZip.loadAsync(await appliquerGabarit(await Packer.toBuffer(new Document({ styles: stylesAcademiques(),
  sections: [{ properties: { page: pageAcademique }, footers: { default: pied }, children: enfants }] }))));
const { xml } = renumeroter(await zipRapport.file("word/document.xml").async("string"));
zipRapport.file("word/document.xml", xml);
const tampon = await zipRapport.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
const texte = xml.replace(/<[^>]+>/g, "");
const centres = texte.match(/\bCS\d{2}\b/g);
if (centres) throw new Error(`le rapport désigne des centres : ${[...new Set(centres)].join(", ")}`);
const libres = texte.match(/\{[A-Za-z]+:[^}]*\}|\{N\}/g);
if (libres) throw new Error(`champs non remplacés : ${[...new Set(libres)].join(", ")}`);

const fichier = `${dossier}/Rapport_de_memoire.docx`;
writeFileSync(fichier, tampon);
console.log("écrit :", fichier);

// Liste de contrôle avant dépôt : document séparé, hors du rapport.
const puceSimple = t => new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: t, size: 22 })] });
const controle = new Document({ styles: stylesAcademiques(), sections: [{ properties: { page: pageAcademique }, children: [
  titre1("LISTE DE CONTRÔLE AVANT DÉPÔT"),
  paragraphe(AVERTISSEMENT),
  titre2("Ce qui reste à compléter"), ...A_COMPLETER.map(puceSimple),
  titre2("Ce qui reste à vérifier"), ...A_VERIFIER.map(puceSimple),
] }] });
writeFileSync(`${dossier}/Liste_de_controle_avant_depot.docx`, await Packer.toBuffer(controle));
console.log("écrit :", `${dossier}/Liste_de_controle_avant_depot.docx`);
console.log(`  ${citees.size} références citées (${[...citees].sort((a, b) => a - b).join(", ")}) · ${Math.round(texte.length / 1000)} k caractères`);
