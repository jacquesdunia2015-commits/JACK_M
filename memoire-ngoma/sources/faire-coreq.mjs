// faire-coreq.mjs — grille COREQ (Tong, Sainsbury et Craig, 2007) remplie pour
// l'étude : les 32 items, la réponse de l'étude et l'endroit où chacun est
// rapporté (section et page du mémoire, ou du protocole révisé).
//
// Usage : node faire-coreq.mjs ../livrables
//
// Les effectifs viennent des mêmes calculs que le mémoire. Les pages sont celles
// du mémoire complet du 3 octobre 2026 (72 pages) : à revoir après toute
// modification du mémoire. Ce que ni le protocole ni le mémoire n'établissent
// est signalé « à compléter », jamais inventé.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { MENTION } from "./echantillon.mjs";
import { arbre } from "./codes.mjs";
import { calculs } from "./calculs.mjs";
const require = createRequire(import.meta.url);
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  ShadingType, PageOrientation, Footer, PageNumber, VerticalAlign } = require("docx");

const dossier = process.argv[2] || ".";
const calc = await calculs(dossier);
const v = calc.valeurs;
const enfants = arbre.flatMap(f => f.enfants);
const deductifs = enfants.filter(e => !/inductif/.test(e.nom)).length;

const F = "Times New Roman";
const run = (t, o = {}) => new TextRun({ text: t, font: F, size: o.taille ?? 21, bold: o.gras, italics: o.italique, color: o.couleur });
const par = (t, o = {}) => new Paragraph({ alignment: o.align, spacing: { after: o.after ?? 80, line: o.line ?? 276 }, keepNext: o.keepNext,
  children: [run(t, o)] });

// [n°, item, question guide, réponse de l'étude, où c'est rapporté]
const D1 = "Domaine 1 — Équipe de recherche et réflexivité";
const D2 = "Domaine 2 — Conception de l'étude";
const D3 = "Domaine 3 — Analyse et résultats";
const GRILLE = [
  [D1, "Caractéristiques personnelles"],
  ["1", "Enquêteur", "Quel auteur a conduit les entretiens ?",
    "Le chercheur principal, MUKAKI DUNIA Jacques, a conduit seul tous les entretiens et toutes les observations, sans enquêteur.",
    "Protocole § 4.2.5.4 ; mémoire § 4.2.5 (p. 19-20)"],
  ["2", "Titres et diplômes", "Quels étaient les titres du chercheur ?",
    "Étudiant en Master de santé publique, spécialité Promotion de la santé, ENATSE, Université de Parakou. Diplômes antérieurs : à compléter.",
    "Page de garde ; protocole, annexe 4"],
  ["3", "Profession", "Quelle était sa profession au moment de l'étude ?",
    "Plus de vingt ans d'exercice dans le domaine de la santé, notamment en biologie médicale ; jamais en consultation prénatale ni dans la hiérarchie des participants.",
    "Protocole § 4.2.5.6 ; note de positionnalité"],
  ["4", "Genre", "Le chercheur était-il un homme ou une femme ?",
    "Homme.", "Note de positionnalité"],
  ["5", "Expérience et formation", "Quelle expérience ou formation le chercheur avait-il ?",
    "Formation et expérience en recherche qualitative : à compléter par l'auteur.",
    "Note de positionnalité (partie 1, à compléter)"],
  [D1, "Relation avec les participants"],
  ["6", "Relation antérieure", "Une relation existait-elle avant le début de l'étude ?",
    "Aucune relation hiérarchique ni clinique avec les participants. Sollicitation directe, hors médiation hiérarchique : les responsables facilitaient l'accès sans désigner les personnes. Exercice antérieur dans le district : à préciser.",
    "Protocole § 4.2.5.5 et 4.2.5.6 ; annexe 4, points 6 et 11 (p. 54-58)"],
  ["7", "Ce que les participants savaient du chercheur", "Que savaient-ils du chercheur (objectifs personnels, raisons de la recherche) ?",
    "Nom, cadre du Master, objet de l'étude ; l'introduction lue précise que le chercheur ne vient ni évaluer ni contrôler. Le formulaire d'information détaille objectifs, mesures de protection et absence de conflit d'intérêts.",
    "Annexe 1, introduction (p. 46-47) ; annexe 4 (p. 54-58)"],
  ["8", "Caractéristiques du chercheur", "Quelles caractéristiques (biais, présupposés, raisons, intérêts) sont rapportées ?",
    "Extériorité à la CPN (moins de réserve des participants) ; familiarité technique avec le laboratoire et risque d'interprétation prématurée ; kinyarwanda qui n'est pas sa langue première. Posture réflexive, conduite non directive, journal réflexif.",
    "Protocole § 4.2.5.6 ; mémoire § 4.2.5.3 (p. 20) ; note de positionnalité"],

  [D2, "Cadre théorique"],
  ["9", "Orientation méthodologique et théorie", "Quelle orientation sous-tend l'étude ?",
    "Paradigme constructiviste ; devis qualitatif descriptif ; analyse thématique en six phases, approche hybride ; cadre conceptuel fondé sur la Charte d'Ottawa et le modèle socio-écologique.",
    "Mémoire chap. 3 (p. 10-12), § 4.2 et 4.2.1 (p. 15), § 4.2.6 (p. 20)"],
  [D2, "Sélection des participants"],
  ["10", "Échantillonnage", "Comment les participants ont-ils été choisis ?",
    "Échantillonnage raisonné à variation maximale sur sept dimensions (qualification, fonction, ancienneté en CPN, secteur, distance à l'hôpital, volume d'activité, profil de pauvreté).",
    "Mémoire § 4.2.3.2, tableau II (p. 16-17)"],
  ["11", "Mode de prise de contact", "Comment ont-ils été approchés ?",
    "En personne, directement par le chercheur, après accord des responsables de centre ; information écrite et orale, consentement écrit.",
    "Protocole § 4.2.5.5 ; annexe 4 (p. 54)"],
  ["12", "Taille de l'échantillon", "Combien de participants ?",
    `${v.nbInf + v.nbSf} participants (${v.nbInf} infirmiers ou infirmières, ${v.nbSf} sages-femmes, dont ${v.nbTitulaires} titulaires) dans ${v.nbCentres} des seize centres de santé ; le seizième a servi au pré-test.`,
    "Mémoire § 4.2.3 « Échantillon obtenu » (p. 17), § 5.1 (p. 21)"],
  ["13", "Non-participation", "Combien de personnes ont refusé ou abandonné, et pourquoi ?",
    "Non rapporté dans cette version : refus et abandons sont à relever dans le suivi de l'échantillon (tableau II) pendant la collecte réelle, puis à indiquer au § 4.2.3.",
    "Suivi de l'échantillon (tableau II) — à compléter"],
  [D2, "Contexte"],
  ["14", "Lieu de la collecte", "Où les données ont-elles été recueillies ?",
    "Dans les centres de santé du district de Ngoma, sur le lieu de travail des participants, dans un local préservant la confidentialité ; observation du service sur une demi-journée par centre.",
    "Mémoire § 4.1.2 (p. 13), § 4.2.5.2 (p. 20) ; protocole § 4.2.5.5"],
  ["15", "Présence de non-participants", "D'autres personnes étaient-elles présentes ?",
    "Non pendant les entretiens, conduits en tête-à-tête dans un local isolé. L'observation porte sur le service, sans présence pendant l'examen clinique.",
    "Protocole § 4.2.5.5 et 4.2.7 ; annexe 2 (p. 50)"],
  ["16", "Description de l'échantillon", "Quelles caractéristiques importantes ?",
    "Qualification, sexe, âge, ancienneté totale et en CPN, fonction, formation sur les MNT, langue de l'entretien (tableau IV) ; caractéristiques des centres (tableau V), non croisées pour protéger l'anonymat.",
    "Mémoire § 5.1, tableaux IV et V (p. 21-22)"],
  [D2, "Recueil des données"],
  ["17", "Guide d'entretien", "Questions et relances fournies ? Pré-test ?",
    "Oui : guide en trois axes, vingt questions et relances (annexe 1). Pré-test auprès de deux professionnels du seizième centre, non retenu pour l'analyse.",
    "Annexe 1 (p. 46-50) ; mémoire § 4.2.3 (p. 17) ; protocole § 4.2.5.5"],
  ["18", "Entretiens répétés", "Des entretiens ont-ils été refaits ?",
    "Non. Un seul entretien par participant ; recontact seulement pour la vérification des interprétations.",
    "Mémoire § 4.2.5.3 (p. 20)"],
  ["19", "Enregistrement audio ou vidéo", "Comment les données ont-elles été recueillies ?",
    "Sans enregistrement : réponses notées pendant l'entretien, mises au propre le jour même, puis traduites du kinyarwanda par le chercheur.",
    "Mémoire § 4.2.6 (p. 20) et § 6.4 (p. 36)"],
  ["20", "Notes de terrain", "Des notes ont-elles été prises ?",
    "Oui : notes d'entretien, journal de bord après chaque entretien, grilles d'observation avec notes contextuelles et réflexives (rubriques E et F).",
    "Mémoire § 4.2.5.1 (p. 19) ; annexe 1, instructions (p. 46) ; annexe 2 (p. 50-53)"],
  ["21", "Durée", "Quelle a été la durée des entretiens ?",
    `De ${v.dureeMin} à ${v.dureeMax} minutes.`,
    "Mémoire § 4.2.5.2 (p. 20), § 5.1 (p. 21)"],
  ["22", "Saturation des données", "La saturation a-t-elle été discutée ?",
    "Oui : la clôture repose sur la suffisance informationnelle (puissance informationnelle), appréciée dimension par dimension, et non sur la saturation, dont l'usage est discuté.",
    "Mémoire § 4.2.6 (p. 20) et § 6.4 (p. 36) ; protocole § 4.2.3.1"],
  ["23", "Retour des transcriptions", "Les transcriptions ont-elles été renvoyées aux participants ?",
    "Non (pas de transcription, entretiens non enregistrés). Les interprétations ont été soumises à trois participants volontaires (voir item 28).",
    "Mémoire § 4.2.5.3 (p. 20)"],

  [D3, "Analyse des données"],
  ["24", "Nombre de codeurs", "Combien de personnes ont codé les données ?",
    `Deux : le chercheur, et un pair extérieur qui a recodé à l'aveugle ${v.relusInter} entretiens sur ${v.nbInf + v.nbSf} (κ = ${v.kappaInter}) ; ${v.relusIntra} autres recodés par le chercheur quatre semaines plus tard (κ = ${v.kappaIntra}).`,
    "Mémoire § 4.2.6, « Fidélité du codage » (p. 20)"],
  ["25", "Description de l'arbre de codage", "L'arbre de codage est-il décrit ?",
    `Oui : grille déductive de ${deductifs} codes en ${arbre.length} familles, dérivée du cadre conceptuel (tableau III), et ${v.nbInductifs} codes inductifs ; arbre complet dans le projet d'analyse.`,
    "Mémoire tableau III (p. 18-19), § 4.2.6 (p. 20)"],
  ["26", "Origine des thèmes", "Les thèmes ont-ils été définis à l'avance ou tirés des données ?",
    "Approche hybride : dimensions définies à l'avance par le cadre conceptuel, thèmes construits à partir des données (phases 3 à 5) ; les codes inductifs ont conduit à réviser le cadre (tableau VII, figure 3).",
    "Mémoire § 4.2.6 (p. 20), tableau VI (p. 29), tableau VII et figure 3 (p. 35-36)"],
  ["27", "Logiciel", "Quel logiciel a été utilisé ?",
    "NVivo.", "Mémoire § 4.2.6 (p. 20) ; protocole § 4.2.6"],
  ["28", "Vérification par les participants", "Les participants ont-ils donné leur avis sur les résultats ?",
    "Oui : vérification des interprétations auprès de trois participants volontaires en fin d'analyse.",
    "Mémoire § 4.2.5.3 (p. 20) ; annexe 4, point 10"],
  [D3, "Rapport"],
  ["29", "Citations", "Des citations illustrent-elles les thèmes ? Sont-elles identifiées ?",
    "Oui : extraits identifiés par le code du participant et sa seule qualification, sans centre ; les participants qui ont refusé la citation ne sont jamais cités ; les extraits traduits du kinyarwanda sont signalés.",
    "Mémoire § 5 « Conventions de lecture » (p. 21), § 5.2 à 5.4 (p. 23-29)"],
  ["30", "Cohérence données-résultats", "Les données présentées concordent-elles avec les résultats ?",
    "Oui : chaque thème est appuyé par des effectifs de participants et des extraits ; les écarts entre pratique déclarée et constat d'observation sont rapportés.",
    "Mémoire § 5.2 à 5.4 (p. 23-29)"],
  ["31", "Clarté des thèmes principaux", "Les thèmes principaux sont-ils clairement présentés ?",
    "Oui : sept thèmes, rattachés aux objectifs spécifiques et synthétisés dans le tableau VI.",
    "Mémoire tableau VI (p. 29) ; chap. 6 (p. 30-36)"],
  ["32", "Clarté des thèmes secondaires", "Les cas divergents ou thèmes secondaires sont-ils décrits ?",
    "Oui : codes inductifs, concordances et écarts présentés avec les thèmes ; révisions du cadre conceptuel qu'ils appellent (tableau VII).",
    "Mémoire § 5.2 à 5.4 (p. 23-29), tableau VII (p. 35-36)"],
];

// Mise en page : A4 paysage, Times New Roman ; tableau en 10,5 pt, interligne simple.
const L = [600, 2000, 3100, 5200, 3000];          // total 13 900 DXA (A4 paysage, marges 2 cm)
const cell = (t, w, o = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP,
  columnSpan: o.span, shading: o.fond ? { type: ShadingType.CLEAR, color: "auto", fill: o.fond } : undefined,
  margins: { top: 50, bottom: 50, left: 90, right: 90 },
  children: [new Paragraph({ keepNext: o.keepNext, spacing: { after: 0 }, children: [run(t, { gras: o.gras, italique: o.italique, taille: o.taille })] })] });
const lignes = [
  new TableRow({ tableHeader: true, children: ["N°", "Item", "Question guide", "Réponse de l'étude", "Où c'est rapporté"]
    .map((t, j) => cell(t, L[j], { gras: true, fond: "D9E2F3" })) }),
];
let domaine = "";
for (const l of GRILLE) {
  if (l.length === 2) {
    if (l[0] !== domaine) {
      domaine = l[0];
      lignes.push(new TableRow({ cantSplit: true, children: [cell(domaine, L.reduce((a, b) => a + b), { span: 5, gras: true, fond: "B4C6E7", keepNext: true, taille: 22 })] }));
    }
    lignes.push(new TableRow({ cantSplit: true, children: [cell(l[1], L.reduce((a, b) => a + b), { span: 5, gras: true, italique: true, fond: "EEF2F8", keepNext: true })] }));
  } else {
    lignes.push(new TableRow({ cantSplit: true, children: l.map((t, j) => cell(t, L[j], { gras: j === 1 })) }));
  }
}
const nbItems = GRILLE.filter(l => l.length === 5).length;
if (nbItems !== 32) throw new Error(`la grille COREQ compte 32 items, ${nbItems} écrits`);
const aCompleter = GRILLE.filter(l => l.length === 5 && /à compléter|à préciser/.test(l[3] + l[4])).map(l => l[0]);

const piedDePage = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
  run("Grille COREQ — MÉMOIRE NGOMA — MUKAKI DUNIA Jacques · ", { taille: 16, couleur: "888888" }),
  new TextRun({ children: [PageNumber.CURRENT], size: 18, font: F })] })] });

const doc = new Document({
  styles: { default: { document: { run: { font: F, size: 28 } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
      margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: piedDePage },
    children: [
      par("GRILLE COREQ", { gras: true, taille: 28, align: AlignmentType.CENTER, after: 40 }),
      par("Critères consolidés de rapportage des recherches qualitatives (32 items) appliqués au mémoire", { taille: 24, align: AlignmentType.CENTER, after: 40 }),
      par("L'équité d'accès au dépistage capacitant de l'hypertension artérielle et du diabète en consultation prénatale : perceptions et pratiques déclarées des infirmiers et sages-femmes de Ngoma (Rwanda)",
        { italique: true, taille: 22, align: AlignmentType.CENTER, after: 120 }),
      par("Référence : Tong A, Sainsbury P, Craig J. Consolidated criteria for reporting qualitative research (COREQ): a 32-item checklist for interviews and focus groups. Int J Qual Health Care. 2007;19(6):349-57. Items traduits et résumés en français par l'auteur du mémoire ; les pages renvoient au mémoire complet du 3 octobre 2026 (72 pages). " + MENTION + ".",
        { taille: 19, after: 160 }),
      new Table({ width: { size: L.reduce((a, b) => a + b), type: WidthType.DXA }, columnWidths: L, rows: lignes }),
      par("", { after: 60 }),
      par(`Items restant à compléter par l'auteur : ${aCompleter.join(", ")}. Ils portent sur des faits que ni le protocole ni le mémoire n'établissent (diplômes antérieurs, expérience de recherche, exercice antérieur dans le district, refus et abandons) : ils ne sont pas inventés ici.`,
        { taille: 20, after: 80 }),
    ],
  }],
});
const fichier = `${dossier}/Grille_COREQ_remplie.docx`;
writeFileSync(fichier, await Packer.toBuffer(doc));
console.log("écrit :", fichier, `· ${nbItems} items · à compléter : ${aCompleter.join(", ")}`);
