// faire-kit-reel.mjs — le dossier de travail VIERGE pour la collecte réelle.
//
// Usage : node faire-kit-reel.mjs ../kit-donnees-reelles
//
// Il ne reprend que ce qui vient du protocole : guide d'entretien, grilles
// d'observation et fiches (annexes 1 à 4 et 9), grille de codage DÉDUCTIVE
// (Tableau III), variables, cadre conceptuel (figure 1). Il ne contient aucune
// donnée, aucun code inductif ni aucun thème du projet d'exercice : dans
// l'étude réelle, ceux-ci doivent naître du matériau réel.
//
// Le projet porte un identifiant DIFFÉRENT de celui du projet d'exercice :
// l'ouvrir dans QualiCode crée un second projet, il ne remplace rien.
//
// Contrôle final : aucun fichier n'est écrit s'il contient une trace du projet
// d'exercice (mot « simul… », « fictif », code de participant, segment, mémo
// de résultat).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  p, titre1, titre2, titre3, vide, saut, tableau, stylesCommuns, encadreRouge,
} from "./mise-en-page.mjs";
import { ETUDE, guide } from "./echantillon.mjs";
import { arbre } from "./codes.mjs";
import { observations } from "./observations.mjs";
import { RESERVE } from "./donnees-routine.mjs";

const dossier = process.argv[2] || "../kit-donnees-reelles";
mkdirSync(dossier, { recursive: true });
const exercice = JSON.parse(readFileSync(new URL("../livrables/Memoire_Ngoma_SIMULATION.projx", import.meta.url), "utf8"));
const maintenant = new Date().toISOString();
const INTERDIT = /simul|fictiv|fictif/i;

/* ================================================================
   1. Le projet QualiCode vierge
================================================================ */
let n = 0;
const uid = () => "r" + String(++n).padStart(5, "0");

// Définitions du Tableau III du protocole (grille d'opérationnalisation).
const definitions = {
  A: ["Sens attribué", "Signification et valeur conférées au dépistage dans le cadre de la CPN", "Utilité perçue pour la femme ; légitimité au regard du mandat ; priorité face aux autres tâches", "Justifications spontanées ; comparaisons avec d'autres actes ; adhésion ou réserve", "Guide, axe 1 (Q7, Q8)"],
  B: ["Pratiques techniques déclarées", "Réalisation matérielle du dépistage telle que décrite", "Systématicité ; gestes et outils ; orientation des cas détectés", "Descriptions de séquences ; mention d'outils ; récits de cas", "Guide, axe 1 (Q1-Q3) ; observation A, B, D"],
  C: ["Pratique informative et éducative", "Ce qui est transmis à la femme, fondement de sa capacité à agir", "Explication de la mesure ; restitution d'un résultat anormal ; risque au-delà de la grossesse ; modulation selon les femmes", "Récits d'échanges ; formulations rapportées ; réserves sur le temps disponible ; distinctions entre patientes", "Guide, axe 1 (Q4-Q6) ; observation C (supports uniquement)"],
  D: ["Conditions individuelles", "Éléments relevant de la personne du professionnel", "Formation ; sentiment de compétence ; expérience", "Références à des formations ; assurance ou doute", "Guide, axe 2 (Q15)"],
  E: ["Conditions organisationnelles", "Éléments relevant du fonctionnement du service", "Charge ; équipements et consommables ; flux ; supervision", "Récits de contraintes matérielles et temporelles", "Guide, axe 2 (Q9, Q10, Q16) ; observation A, B, C"],
  F: ["Conditions systémiques", "Éléments relevant du système et des politiques", "Directives ; programmes ; coordination ; circuit de référence", "Références à des directives ; récits de référence", "Guide, axe 2 (Q13, Q16)"],
  G: ["Conditions sociales perçues", "Représentations de la situation sociale des femmes dépistées et incidence déclarée sur la pratique", "Moyens et coût ; distance ; assurance ; instruction ; marge de décision ; croyances", "Distinctions entre catégories de patientes ; justifications d'un renoncement ; récits de non-retour ; impuissance ou adaptation", "Guide, axe 2 (Q11-Q14)"],
  H: ["Portée reconnue en équité", "Appréciation du caractère équitable de la distribution effective du dépistage et jugement porté sur elle", "Perception d'un accès différencié ; caractère acceptable ou non ; attribution de responsabilité ; marge d'action", "Formulations évaluatives sur le normal et l'anormal ; regret, résignation ou révolte", "Guide, axe 3 (Q19) ; recoupement Q11-Q14"],
  I: ["Transformations proposées", "Modifications jugées nécessaires", "Priorités formulées ; destinataires désignés", "Formulations prescriptives ; hiérarchisation spontanée", "Guide, axe 3 (Q17, Q18)"],
};

const projet = {
  format: "qualicode-projx", version: 1,
  id: "memoire-ngoma-donnees-reelles",
  name: "Mémoire Ngoma — Données réelles",
  created: maintenant, modified: maintenant,
  memo: "", documentGroups: [], documents: [], codes: [], segments: [], memos: [],
  variables: exercice.variables.filter(v => v !== "vague"),
  trash: { documents: [], codes: [] }, savedQueries: [], conceptMaps: [], bibliography: [],
};
projet.documentGroups.push({ id: uid(), name: "Entretiens (corpus principal)" }, { id: uid(), name: "Observations (corpus secondaire)" });

// Grille déductive seulement : les codes marqués « inductif » sont nés du
// matériau d'exercice ; dans l'étude réelle, ils naîtront du matériau réel.
for (const f of arbre) {
  const famille = { id: uid(), name: f.nom, parentId: null, color: f.couleur, created: maintenant };
  projet.codes.push(famille);
  for (const e of f.enfants.filter(e => !/inductif/i.test(e.nom))) {
    projet.codes.push({ id: uid(), name: e.nom, parentId: famille.id, color: f.couleur, created: maintenant });
  }
  const d = definitions[f.id];
  if (d) projet.memos.push({ id: uid(), targetType: "code", targetId: famille.id, created: maintenant,
    title: `Définition — ${f.nom}`,
    text: `Concept (Tableau III) : ${d[0]}\nDéfinition retenue : ${d[1]}\nDimensions explorées : ${d[2]}\nManifestations attendues : ${d[3]}\nSource : ${d[4]}\n\nCodes inductifs : à créer ici au fil du codage, en ajoutant « [inductif] » à leur nom, et à consigner dans la piste d'audit avec l'entretien qui les a fait naître.` });
}

// Cadre conceptuel du protocole (figure 1), sans aucun élément d'analyse.
projet.conceptMaps = exercice.conceptMaps.map(c => ({ ...c, id: uid() }));

projet.memo = `PROJET DE L'ÉTUDE RÉELLE — ${ETUDE.titre}
${ETUDE.chercheur} — ${ETUDE.institution}
Direction : ${ETUDE.directrice}

Ce projet ne contient encore aucune donnée. Il reprend du protocole : la grille
de codage déductive (Tableau III), les variables de document (annexe 3), et le
cadre conceptuel (figure 1). Les codes inductifs et les thèmes naîtront des
données réelles.

Règles (§ 4.2.7) :
· chaque participant est désigné par un code (P01, P02…) ; la table de
  correspondance entre codes et identités est conservée à part, hors de
  QualiCode, sous la seule responsabilité du chercheur ;
· chaque structure est désignée par un code (CS01…) ;
· vérifier, avant toute citation, la variable « citation_autorisee » ;
· enregistrer le projet (Accueil ▸ Enregistrer, .projx) après chaque séance,
  sur un support chiffré ; ne jamais le déposer dans un service public.`;

const modeles = [
  ["Note de positionnalité — à rédiger AVANT le codage",
`Confirmabilité (annexe 8 : « journal réflexif et note de positionnalité »).
Premier temps, avant le codage ; second temps, à la fin de l'analyse. À dater.

1. Qui je suis dans cette étude (COREQ 1-5) : formation, profession, sexe,
   âge, expérience de la recherche qualitative.
2. Ma relation au terrain et aux participants (COREQ 6-8) : ce qu'ils
   savaient de moi, ce qu'ils ont pu supposer, mes liens avec le district.
3. Ce que je pense trouver : mes présupposés, avant la collecte.
4. Ce que je fais pour contenir ces influences.
5. (À la fin de l'analyse) Ce que ma position a produit, d'après mon journal.`],
  ["Phase 1 — Familiarisation (journal)", "Lecture et relecture des transcriptions ; premières idées notées, sans coder. Une entrée par séance, datée."],
  ["Contrôle de fidélité des transcriptions (§ 4.2.6)", "Sondages de la transcription en kinyarwanda contre l'enregistrement ; vérification de la traduction ; passages discutés et décisions."],
  ["Phase 2 — Codage initial", "Codage avec la grille déductive ; création des codes inductifs (marqués « [inductif] ») ; chaque création consignée dans la piste d'audit."],
  ["Phase 3 — Recherche des thèmes", "Regroupement des codes en thèmes candidats ; carte des thèmes."],
  ["Phase 4 — Revue des thèmes", "Chaque thème confronté aux extraits codés, puis au corpus entier ; thèmes fusionnés, scindés ou écartés, avec la raison."],
  ["Phase 5 — Définition et dénomination des thèmes", "Pour chaque thème : ce qu'il est, ce qu'il n'est pas, les codes qui le composent, l'objectif spécifique auquel il répond."],
  ["Phase 6 — Production du rapport", "Plan du chapitre Résultats ; règles de citation (code du participant et une seule caractéristique ; consentements à respecter)."],
  ["Double codage et stabilité intra-codeur", "Un tiers des entretiens recodés par un second codeur (étiquette C2) ; recodage par le premier codeur à distance (C1b) ; coefficients κ (Analyse ▸ Accord inter-codeurs) et discussion des désaccords."],
  ["Triangulation", "Confrontation des propos, des observations et des données de routine ; écarts ET concordances consignés, sans imputer un écart à une intention."],
  ["Vérification des interprétations auprès des participants", "Résumé des thèmes adressé aux participants qui l'ont accepté ; réponses consignées telles quelles, y compris les désaccords."],
  ["Suffisance informationnelle — dimension par dimension (§ 4.2.3.1)", "Pour chacune des neuf dimensions du cadre : suffisante ou non, et pourquoi. La collecte se poursuit tant qu'une dimension reste faiblement renseignée."],
  ["Piste d'audit — décisions de codage", "Chaque décision datée : code créé, fusionné, renommé ou supprimé ; extrait qui l'a motivée."],
];
for (const [titre, texte] of modeles) {
  projet.memos.push({ id: uid(), targetType: "project", targetId: null, title: titre, text: texte, created: maintenant });
}

/* ================================================================
   2. Les outils de collecte vierges (Word)
================================================================ */
const LIGNES = 24; // effectif maximal prévu au § 4.2.3.1
const blanc = k => Array(k).fill("");
const lignesVides = (entete, largeurs, n = LIGNES, numeroter = true) =>
  tableau([entete, ...Array.from({ length: n }, (_, i) => numeroter ? [`P${String(i + 1).padStart(2, "0")}`, ...blanc(entete.length - 1)] : blanc(entete.length))], largeurs);
const case_ = options => options.map(o => `☐ ${o}`).join("   ");
const petit = t => p(t, { run: { size: 19, italics: true } });

const enfants = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 100 }, children: [new TextRun({ text: "UNIVERSITÉ DE PARAKOU — ENATSE", bold: true, size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: "Master en Santé publique — Promotion de la santé", size: 20 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: ETUDE.titre, italics: true, size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }, children: [new TextRun({ text: "Outils de collecte — formulaires à remplir sur le terrain", bold: true, size: 32 })] }),
  vide(),
  tableau([["Chercheur", ETUDE.chercheur], ["Institution", ETUDE.institution], ["Direction", ETUDE.directrice], ["Période de collecte", "du ……………… au ………………"]], [2400, 6626], { entete: false }),
  vide(),
  encadreRouge("Confidentialité (§ 4.2.7)", "Une fois remplis, ces formulaires contiennent des données de recherche. Ils se conservent sur un support chiffré, jamais dans un dépôt ou un service en ligne public. La table de correspondance entre codes et identités est tenue à part, sous la seule responsabilité du chercheur."),
  saut(),

  titre1("1. Suivi de l'échantillon (Tableau II)"),
  petit("À mettre à jour après chaque entretien : la collecte vise chacune des modalités des sept dimensions et couvre quinze des seize centres, à raison d'un à deux participants par structure ; le seizième sert au pré-test et n'est pas retenu."),
  vide(),
  lignesVides(["Code", "Structure", "Qualification", "Titulaire", "Anc. CPN", "Secteur", "Hôpital", "Volume", "Pauvreté", "Langue"], [700, 850, 1100, 850, 900, 900, 900, 900, 950, 976]),
  vide(),
  titre2("Couverture des dimensions de variation"),
  tableau([["Dimension", "Modalités recherchées", "Effectif atteint"],
    ["Qualification", "infirmiers ; sages-femmes", ""], ["Fonction", "prestataires ; infirmiers titulaires", ""],
    ["Ancienneté en CPN", "6 mois à 2 ans ; plus de 2 ans", ""], ["Secteur d'implantation", "urbain ; rural périphérique", ""],
    ["Distance à l'hôpital", "proche ; éloignée", ""], ["Volume d'activité prénatale", "élevé ; modéré", ""],
    ["Profil socio-économique du secteur", "pauvreté plus élevée ; plus faible", ""]], [2600, 3600, 2826]),
  saut(),

  titre1("2. Annexe 1 — Index des entretiens"),
  lignesVides(["Code", "Structure", "Date", "Durée", "Langue", "Transcription", "Traduction vérifiée"], [700, 900, 1200, 900, 1300, 2000, 2026]),
  saut(),

  titre1("3. Gabarit de transcription (un par entretien)"),
  tableau([["Code du participant", "", "Code de structure", ""], ["Date", "", "Durée", ""], ["Langue de l'entretien", "", "Transcrit par", ""]], [2200, 2313, 2200, 2313], { entete: false }),
  vide(),
  titre3("Journal de bord"),
  petit("Conditions du déroulement, éléments non verbaux, interruptions, réflexions du chercheur (§ 4.2.6)."),
  tableau([["…"]], [9026], { entete: false }),
  vide(),
];
let axe = "";
for (const q of guide) {
  if (q.axe !== axe) { axe = q.axe; enfants.push(titre3(axe)); }
  enfants.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: `${q.id}. ${q.texte}`, bold: true, size: 20 })] }));
  enfants.push(p("E : …", { run: { size: 20, color: "7F8C8D" } }), p("P__ : …", { run: { size: 20 } }));
}

const grille = observations[0];
enfants.push(saut(), titre1("4. Annexe 2 — Grille d'observation du service (une par centre)"),
  petit("Observation non participante, portant sur le service et non sur les personnes. Jamais observé ni consigné : identité ou performance individuelle d'un professionnel, contenu des échanges avec une femme enceinte, donnée permettant d'identifier une patiente, jugement de conformité d'un geste. Aucune présence pendant l'examen clinique. Une demi-journée par centre."),
  vide(),
  tableau([["Code de structure", "", "Date", "", "Heures", ""]], [1700, 1100, 800, 1400, 900, 3126], { entete: false }),
  vide(), titre3("A. Espace et flux"),
  tableau([["Salles affectées à la CPN", ""], ["Espace permettant un échange non entendu", case_(["oui", "partiellement", "non"])], ["Femmes reçues durant la période", ""],
    ["Professionnels assurant la consultation", ""], ["Poste distinct pour la prise des constantes", case_(["oui", "non"])], ["Durée moyenne entre entrée et sortie (estimation de flux)", ""]], [3400, 5626], { entete: false }),
  vide(), titre3("A bis. Séance d'éducation collective (rubrique ajoutée à la grille — à valider avec la direction de mémoire)"),
  tableau([["Fréquence déclarée (séances par semaine, jours)", ""], ["Séance observée ce jour", case_(["oui", "non"])],
    ["Heure, durée, lieu, animée par (fonction seulement)", ""], ["Nombre approximatif de femmes présentes ; conjoints présents", ""],
    ["Thème du jour ; support utilisé (boîte à images, affiche…)", ""], ["Tension abordée", case_(["oui", "non"])], ["Sucre (diabète) abordé", case_(["oui", "non"])],
    ["Femmes arrivées après la séance (estimation)", ""], ["Cahier des séances tenu (thème, date, nombre)", case_(["oui", "non"])]], [3400, 5626], { entete: false }),
  vide(), titre3("B. Équipements et consommables"),
  tableau([["Élément", "Présent", "Nombre", "État de fonctionnement", "Observations"], ...grille.B.map(x => [x.item, "☐ oui ☐ non", "", "", ""]),
    ["Rupture de stock signalée au cours des trois derniers mois", "", "", "", ""]], [1900, 1100, 800, 2300, 2926]),
  vide(), titre3("C. Protocoles et supports"),
  tableau([["Élément", "Présent", "Accessible au poste", "Observations"], ...grille.C.map(x => [x.item, "☐ oui ☐ non", "☐ oui ☐ non", ""])], [2600, 1200, 1500, 3726]),
  vide(), titre3("D. Enregistrement des données (supports agrégés uniquement)"),
  tableau([["Rubrique prévue pour la tension artérielle", case_(["oui", "non"])], ["Rubrique prévue pour la glycémie", case_(["oui", "non"])],
    ["Ces rubriques sont-elles renseignées régulièrement ?", ""], ["Les cas orientés vers l'hôpital sont-ils tracés ?", ""]], [3400, 5626], { entete: false }),
  vide(), titre3("E. Notes contextuelles libres"), tableau([["…"]], [9026], { entete: false }),
  vide(), titre3("F. Réflexivité"), tableau([["…"]], [9026], { entete: false }));

enfants.push(saut(), titre1("5. Annexe 3 — Fiche de données sociodémographiques et professionnelles"),
  petit("Renseignée en début d'entretien. Aucun nom, aucune fonction nominative, aucun nom de structure. Les tranches sont préférées aux valeurs exactes."),
  vide(),
  tableau([["Rubrique", "Réponse"],
    ["Code du participant / de structure", "P____ / CS____"],
    ["Sexe", case_(["féminin", "masculin"])],
    ["Tranche d'âge", case_(["20-29", "30-39", "40-49", "50 et plus"])],
    ["Qualification", case_(["infirmier", "sage-femme"]) + "   ☐ autre : ……"],
    ["Niveau de formation", case_(["A2", "A1", "A0"]) + "   ☐ autre : ……"],
    ["Ancienneté professionnelle totale", case_(["< 5 ans", "5-10 ans", "> 10 ans"])],
    ["Ancienneté en consultation prénatale", case_(["6 mois-2 ans", "> 2 ans"])],
    ["Fonction de titulaire de centre", case_(["oui", "non"])],
    ["Formation reçue sur les MNT", case_(["oui", "non", "ne sait pas"]) + "  — année : ……"],
    ["Secteur d'implantation du centre", case_(["urbain", "rural périphérique"])],
    ["Langue de l'entretien", case_(["kinyarwanda", "français", "anglais"])],
    ["Date et durée de l'entretien", "……………… — ………… min"]], [3000, 6026]));

enfants.push(saut(), titre1("6. Annexe 4 — Registre de suivi des consentements"),
  petit("L'enregistrement et la citation d'extraits font l'objet d'accords DISTINCTS (§ 4.2.7). Les formulaires signés, en deux exemplaires, sont conservés à part ; ce registre ne fait que suivre les accords pour que l'analyse en tienne compte."),
  vide(),
  lignesVides(["Code", "Date", "Langue du formulaire", "Consentement écrit", "Enregistrement", "Citation d'extraits", "Recontact", "Formulaire signé classé"], [650, 1000, 1150, 1050, 1150, 1400, 1100, 1526]),
  vide(), titre3("Particularités à respecter dans l'analyse"),
  tableau([["Code", "Accord particulier"], ...Array.from({ length: 6 }, () => ["", ""])], [1000, 8026]));

enfants.push(saut(), titre1("7. Annexe 9 — Données de routine du district"),
  petit("Sollicitées par écrit auprès de la Direction de la santé du district (annexe 6, étape 5) ; dernière année civile complète ; restituées avec leur source et leur période."),
  tableau([["Source", ""], ["Période", ""]], [2400, 6626], { entete: false }),
  vide(),
  tableau([["Centre", "CPN1", "CPN4", "CPN4 / CPN1", "1er contact au 1er trim.", "Référées HTA / prééclampsie", "Effectif CPN"], ...Array.from({ length: 15 }, (_, i) => [`CS${String(i + 1).padStart(2, "0")}`, ...blanc(6)])], [900, 900, 900, 1200, 1700, 1900, 1526]),
  vide(),
  tableau([["Centre", "Dépistages glycémiques en CPN", "Ruptures de bandelettes (mois)", "Profil de pauvreté du secteur"], ...Array.from({ length: 15 }, (_, i) => [`CS${String(i + 1).padStart(2, "0")}`, ...blanc(3)])], [900, 3300, 2300, 2526]),
  vide(),
  tableau([["File active des consultations dédiées aux MNT (district)", ""]], [3400, 5626], { entete: false }),
  vide(), petit(RESERVE.replace(/^Réserve de qualité \(annexe 9 du protocole\) : /, "Réserve de qualité (annexe 9) : ")));

/* ================================================================
   3. Contrôle, puis écriture
================================================================ */
const json = JSON.stringify(projet, null, 2);
const tampon = await Packer.toBuffer(new Document({ styles: stylesCommuns(), sections: [{ children: enfants }] }));
const JSZip = createRequire(import.meta.url)("jszip");
const xml = await (await JSZip.loadAsync(tampon)).file("word/document.xml").async("string");

const problemes = [];
for (const [nom, texte] of [["projet", json], ["outils de collecte", xml]]) {
  const m = texte.match(INTERDIT);
  if (m) problemes.push(`${nom} : « ${texte.slice(Math.max(0, m.index - 40), m.index + 40)} »`);
}
if (projet.id === exercice.id) problemes.push("le projet réel porterait l'identifiant du projet d'exercice");
if (projet.documents.length || projet.segments.length || projet.savedQueries.length) problemes.push("le projet réel contient des documents, segments ou requêtes");
if (projet.codes.some(c => /inductif/i.test(c.name))) problemes.push("le projet réel contient un code inductif du projet d'exercice");
const titresExercice = new Set(exercice.memos.map(m => m.text));
if (projet.memos.some(m => titresExercice.has(m.text))) problemes.push("un mémo du projet d'exercice a été recopié");
if (problemes.length) throw new Error("dossier réel refusé :\n  " + problemes.join("\n  "));

writeFileSync(`${dossier}/Memoire_Ngoma_DONNEES_REELLES_vierge.projx`, json);
writeFileSync(`${dossier}/Outils_de_collecte_VIERGES.docx`, tampon);
console.log(`écrit : ${dossier}/Memoire_Ngoma_DONNEES_REELLES_vierge.projx — ${projet.codes.length} codes (grille déductive), ${projet.memos.length} mémos-modèles, 0 document`);
console.log(`écrit : ${dossier}/Outils_de_collecte_VIERGES.docx`);
